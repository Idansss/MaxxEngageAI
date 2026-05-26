"""
Proof-of-personhood endpoints.

These endpoints let users collect "stamps" — verifiable signals that they are
a real, unique human. Stamps feed into humanity_score (0–100), which weights
credential credibility in public rankings.

Stamp types available:
  email             Auto-awarded at registration (Supabase magic link = verified)
  github            GitHub account age + activity check (no wallet required)
  gitcoin_passport  Gitcoin Passport score via Ethereum wallet address

Why this matters for African talent:
  Gitcoin requires an ETH wallet — not universal in our target market.
  GitHub is the default path: any developer with 6+ months of activity qualifies.
  Both paths converge to the same humanity_score scale.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.database import get_pool
from app.core.logging import logger
from app.services.identity import (
    recompute_humanity_score,
    verify_gitcoin_stamp,
    verify_github_stamp,
)

router = APIRouter(prefix="/identity", tags=["identity"])


# ── Request models ────────────────────────────────────────────────────────────

class GitHubStampRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=39, description="Your GitHub username")


class GitcoinStampRequest(BaseModel):
    eth_address: str = Field(
        ..., min_length=42, max_length=42,
        description="Your Ethereum wallet address (0x-prefixed, 42 chars)",
    )


# ── Internal helper ───────────────────────────────────────────────────────────

async def _resolve_user_id(auth_user: dict) -> str:
    """Resolve Supabase auth_id → app user UUID."""
    pool = get_pool()
    row = await pool.fetchrow(
        "SELECT id FROM public.users WHERE auth_id = $1::uuid", auth_user["id"]
    )
    if not row:
        raise HTTPException(status_code=404, detail="User profile not found.")
    return str(row["id"])


# ── GitHub stamp ──────────────────────────────────────────────────────────────

@router.post(
    "/stamps/github",
    summary="Verify a GitHub account and earn the GitHub stamp",
)
async def stamp_github(
    body: GitHubStampRequest,
    auth_user: dict = Depends(get_current_user),
):
    """
    Verifies that your GitHub account is:
    - At least 6 months old
    - Has at least 1 public repository or follower

    **Senior tier (+35 pts)**: account ≥ 2 years old AND ≥ 10 public repos.
    **Standard tier (+25 pts)**: meets the minimum criteria above.

    No OAuth or wallet required. Re-run to refresh your stamp yearly.
    """
    user_id = await _resolve_user_id(auth_user)
    settings = get_settings()

    result = await verify_github_stamp(
        username=body.username,
        user_id=user_id,
        pool=get_pool(),
        github_token=settings.github_token,
    )

    if not result.ok:
        raise HTTPException(status_code=422, detail=result.message)

    logger.info(
        "identity.github.stamped",
        user_id=user_id,
        username=body.username,
        contribution=result.score_contribution,
    )
    return {
        "ok": True,
        "stamp_type": result.stamp_type,
        "score_contribution": result.score_contribution,
        "message": result.message,
        "metadata": {
            k: v for k, v in result.metadata.items()
            if k not in ("github_id",)  # omit internal fields
        },
    }


# ── Gitcoin Passport stamp ────────────────────────────────────────────────────

@router.post(
    "/stamps/gitcoin",
    summary="Verify a Gitcoin Passport and earn the Gitcoin stamp",
)
async def stamp_gitcoin(
    body: GitcoinStampRequest,
    auth_user: dict = Depends(get_current_user),
):
    """
    Fetches your Gitcoin Passport score for the given Ethereum address.
    Score tiers: 1–9 → +5, 10–19 → +15, 20–49 → +25, 50+ → +35.

    **Requirements:**
    - A Gitcoin Passport at passport.gitcoin.co with a score ≥ 1.
    - The ETH address must match the passport you created.

    Stamps expire after 90 days — re-run to refresh.
    """
    user_id = await _resolve_user_id(auth_user)
    settings = get_settings()

    result = await verify_gitcoin_stamp(
        eth_address=body.eth_address,
        user_id=user_id,
        pool=get_pool(),
        gitcoin_api_key=settings.gitcoin_api_key,
        gitcoin_scorer_id=settings.gitcoin_scorer_id,
    )

    if not result.ok:
        raise HTTPException(status_code=422, detail=result.message)

    logger.info(
        "identity.gitcoin.stamped",
        user_id=user_id,
        contribution=result.score_contribution,
    )
    return {
        "ok": True,
        "stamp_type": result.stamp_type,
        "score_contribution": result.score_contribution,
        "message": result.message,
        "metadata": result.metadata,
    }


# ── List my stamps ────────────────────────────────────────────────────────────

@router.get(
    "/stamps",
    summary="List all stamps you have collected",
)
async def list_stamps(auth_user: dict = Depends(get_current_user)):
    """
    Returns all stamps for the authenticated user, including score contribution
    and expiry. Expired stamps show but do not count toward humanity_score.
    """
    user_id = await _resolve_user_id(auth_user)
    pool = get_pool()

    rows = await pool.fetch(
        """
        SELECT stamp_type, score_contribution, verified_at, expires_at,
               (expires_at IS NOT NULL AND expires_at < now()) AS is_expired,
               metadata
        FROM public.stamps
        WHERE user_id = $1::uuid
        ORDER BY verified_at DESC
        """,
        user_id,
    )

    stamps = []
    for r in rows:
        active = not r["is_expired"]
        stamps.append({
            "stamp_type": r["stamp_type"],
            "score_contribution": float(r["score_contribution"]) if active else 0,
            "active": active,
            "verified_at": r["verified_at"].isoformat(),
            "expires_at": r["expires_at"].isoformat() if r["expires_at"] else None,
            "metadata": dict(r["metadata"]) if r["metadata"] else {},
        })

    return {"user_id": user_id, "stamps": stamps}


# ── My humanity score ─────────────────────────────────────────────────────────

@router.get(
    "/score",
    summary="Get your current humanity score and breakdown",
)
async def my_score(auth_user: dict = Depends(get_current_user)):
    """
    Returns your current humanity score (0–100) with a breakdown by stamp.
    Score ≥ 50 = your credentials carry full public weight.
    """
    user_id = await _resolve_user_id(auth_user)
    pool = get_pool()

    # Recompute from DB (catches any expired stamps)
    score = await recompute_humanity_score(user_id, pool)

    rows = await pool.fetch(
        """
        SELECT stamp_type, score_contribution,
               (expires_at IS NOT NULL AND expires_at < now()) AS is_expired
        FROM public.stamps
        WHERE user_id = $1::uuid
        ORDER BY score_contribution DESC
        """,
        user_id,
    )

    breakdown = [
        {
            "stamp_type": r["stamp_type"],
            "points": float(r["score_contribution"]) if not r["is_expired"] else 0,
            "active": not r["is_expired"],
        }
        for r in rows
    ]

    # Which stamps are still missing
    earned = {r["stamp_type"] for r in rows if not r["is_expired"]}
    available = []
    if "github" not in earned:
        available.append({"stamp_type": "github", "max_points": 35,
                          "how": "POST /identity/stamps/github with your GitHub username"})
    if "gitcoin_passport" not in earned:
        available.append({"stamp_type": "gitcoin_passport", "max_points": 35,
                          "how": "POST /identity/stamps/gitcoin with your ETH wallet address"})
    if "phone" not in earned:
        available.append({"stamp_type": "phone", "max_points": 20,
                          "how": "Phone verification coming soon"})

    return {
        "user_id": user_id,
        "humanity_score": score,
        "full_weight_threshold": 50,
        "full_weight_achieved": score >= 50,
        "breakdown": breakdown,
        "stamps_available": available,
    }


# ── Public: any user's humanity score ────────────────────────────────────────

@router.get(
    "/users/{user_id}/score",
    summary="Get any user's humanity score (public)",
)
async def public_score(user_id: str):
    """
    Public endpoint. Returns a user's humanity score and stamp types (not values).
    Verifiers can use this to assess the Sybil-resistance of a credential holder.
    """
    try:
        uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="user_id must be a valid UUID.")

    pool = get_pool()
    row = await pool.fetchrow(
        "SELECT humanity_score, public_profile FROM public.users WHERE id = $1::uuid",
        user_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="User not found.")

    # Respect privacy — only return stamp types, never stamp values
    stamps_rows = await pool.fetch(
        """
        SELECT stamp_type, verified_at
        FROM public.stamps
        WHERE user_id = $1::uuid
          AND (expires_at IS NULL OR expires_at > now())
        ORDER BY verified_at DESC
        """,
        user_id,
    )

    return {
        "user_id": user_id,
        "humanity_score": float(row["humanity_score"] or 0),
        "full_weight_achieved": float(row["humanity_score"] or 0) >= 50,
        "active_stamps": [
            {"stamp_type": r["stamp_type"], "verified_at": r["verified_at"].isoformat()}
            for r in stamps_rows
        ],
    }

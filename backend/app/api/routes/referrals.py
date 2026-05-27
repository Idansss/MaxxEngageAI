"""
Referral system.

Each user has a unique 8-char referral_code. When someone signs up via
an invite link and claims the code, a referral row is recorded.
Once a referrer reaches STAMP_THRESHOLD successful referrals they receive
a +15 'referral' identity stamp.
"""

import asyncio
import secrets
import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.database import get_pool
from app.core.logging import logger
from app.services.identity import _upsert_stamp, recompute_humanity_score

router = APIRouter(prefix="/referrals", tags=["referrals"])

STAMP_THRESHOLD = 3       # referrals needed to earn the identity stamp
REFERRAL_STAMP_POINTS = 15.0


# ── Helpers ───────────────────────────────────────────────────────────────────

def _generate_code() -> str:
    return secrets.token_hex(4).upper()


async def _ensure_referral_code(user_id: str, pool) -> str:
    """Return existing code, or generate and persist a new one."""
    row = await pool.fetchrow(
        "SELECT referral_code FROM public.users WHERE id = $1::uuid", user_id
    )
    code = row["referral_code"] if row else None
    if not code:
        code = _generate_code()
        await pool.execute(
            "UPDATE public.users SET referral_code = $1 WHERE id = $2::uuid",
            code, user_id,
        )
    return code


# ── GET /referrals/my ─────────────────────────────────────────────────────────

@router.get("/my", summary="Get my referral code and stats")
async def my_referral(auth_user: dict = Depends(get_current_user)):
    pool = get_pool()
    user_row = await pool.fetchrow(
        "SELECT id FROM public.users WHERE auth_id = $1::uuid", auth_user["id"]
    )
    if not user_row:
        raise HTTPException(status_code=404, detail="User profile not found.")
    user_id = str(user_row["id"])

    code = await _ensure_referral_code(user_id, pool)

    referral_count = await pool.fetchval(
        "SELECT COUNT(*) FROM public.referrals WHERE referrer_id = $1::uuid", user_id
    )
    stamp_awarded = await pool.fetchval(
        "SELECT EXISTS(SELECT 1 FROM public.stamps WHERE user_id = $1::uuid AND stamp_type = 'referral')",
        user_id,
    )

    settings = get_settings()
    site = getattr(settings, "site_url", None) or "https://maxx-engage-ai.vercel.app"
    invite_url = f"{site}/login?ref={code}"

    return {
        "referral_code": code,
        "invite_url": invite_url,
        "referral_count": int(referral_count or 0),
        "stamp_awarded": bool(stamp_awarded),
        "stamp_threshold": STAMP_THRESHOLD,
        "stamp_points": REFERRAL_STAMP_POINTS,
    }


# ── POST /referrals/claim ─────────────────────────────────────────────────────

class ClaimRequest(BaseModel):
    code: str = Field(..., min_length=4, max_length=12, description="Referral code to claim")


@router.post("/claim", summary="Claim a referral code after sign-up")
async def claim_referral(
    body: ClaimRequest,
    auth_user: dict = Depends(get_current_user),
):
    pool = get_pool()

    # Resolve referee
    referee_row = await pool.fetchrow(
        "SELECT id FROM public.users WHERE auth_id = $1::uuid", auth_user["id"]
    )
    if not referee_row:
        raise HTTPException(status_code=404, detail="User profile not found.")
    referee_id = str(referee_row["id"])

    # Already claimed? (referee_id is UNIQUE in referrals)
    existing = await pool.fetchval(
        "SELECT id FROM public.referrals WHERE referee_id = $1::uuid", referee_id
    )
    if existing:
        return {"ok": True, "already_claimed": True, "referrer_name": None}

    # Resolve referrer by code
    referrer_row = await pool.fetchrow(
        "SELECT id, display_name FROM public.users WHERE UPPER(referral_code) = UPPER($1)",
        body.code,
    )
    if not referrer_row:
        raise HTTPException(status_code=404, detail="Referral code not found.")

    referrer_id = str(referrer_row["id"])
    referrer_name = referrer_row["display_name"]

    if referrer_id == referee_id:
        raise HTTPException(status_code=409, detail="You cannot use your own referral code.")

    # Create referral record
    await pool.execute(
        """
        INSERT INTO public.referrals (referrer_id, referee_id)
        VALUES ($1::uuid, $2::uuid)
        ON CONFLICT (referee_id) DO NOTHING
        """,
        referrer_id, referee_id,
    )

    logger.info("referral.claimed", referrer_id=referrer_id, referee_id=referee_id)

    # Check if referrer has hit the stamp threshold
    count = await pool.fetchval(
        "SELECT COUNT(*) FROM public.referrals WHERE referrer_id = $1::uuid", referrer_id
    )
    already_stamped = await pool.fetchval(
        "SELECT EXISTS(SELECT 1 FROM public.stamps WHERE user_id = $1::uuid AND stamp_type = 'referral')",
        referrer_id,
    )

    if int(count) >= STAMP_THRESHOLD and not already_stamped:
        await _upsert_stamp(
            user_id=referrer_id,
            stamp_type="referral",
            stamp_value=None,
            score_contribution=REFERRAL_STAMP_POINTS,
            expires_at=None,
            metadata={"referral_count": int(count), "threshold": STAMP_THRESHOLD},
            pool=pool,
        )
        await pool.execute(
            "UPDATE public.referrals SET stamp_awarded = TRUE WHERE referrer_id = $1::uuid",
            referrer_id,
        )
        await recompute_humanity_score(referrer_id, pool)
        logger.info("referral.stamp_awarded", referrer_id=referrer_id, count=int(count))

        async def _fire_referral_email() -> None:
            try:
                from app.services.email import get_email_by_auth_id, send_referral_milestone
                row = await pool.fetchrow(
                    "SELECT auth_id, display_name FROM public.users WHERE id = $1::uuid", referrer_id
                )
                if not row or not row["auth_id"]:
                    return
                email = await get_email_by_auth_id(str(row["auth_id"]))
                if email:
                    settings = get_settings()
                    await send_referral_milestone(
                        to=email,
                        display_name=row["display_name"] or "Learner",
                        referral_count=int(count),
                        stamp_points=REFERRAL_STAMP_POINTS,
                        site_url=settings.site_url,
                    )
            except Exception as exc:
                logger.warning("referral.email_error", referrer_id=referrer_id, error=str(exc))

        asyncio.create_task(_fire_referral_email())

    return {
        "ok": True,
        "already_claimed": False,
        "referrer_name": referrer_name,
    }

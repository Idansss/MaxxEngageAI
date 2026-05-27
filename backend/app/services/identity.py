"""
Proof-of-personhood stamps and humanity score.

Stamps are independent signals that a user is a real, unique human.
Each verified stamp contributes a fixed number of points to humanity_score (0–100).

Score weights:
  email             +10   automatic — Supabase magic link = verified email
  phone             +20   SMS OTP (Supabase Phone or Twilio)
  github            +25   account ≥ 6 months old, ≥ 1 public repo or follower
  github (senior)   +35   account ≥ 2 years old AND ≥ 10 repos (replaces base +25)
  gitcoin_passport  tiered: 1–9 → +5, 10–19 → +15, 20–49 → +25, 50+ → +35

Target users in Lagos and other Global South cities may not have ETH wallets,
so GitHub is deliberately included as a wallet-free alternative. Gitcoin is
additive, not required.

API contract:
  verify_github_stamp(username, user_id, pool, github_token) → StampResult
  verify_gitcoin_stamp(eth_address, user_id, pool, settings) → StampResult
  mark_email_stamp(user_id, pool) → None   (called at registration)
  recompute_humanity_score(user_id, pool) → float
"""

import hashlib
import json
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import httpx

from app.core.logging import logger

# ── Score weights ─────────────────────────────────────────────────────────────

STAMP_WEIGHTS = {
    "email": 10,
    "phone": 20,
    "github": 25,
    "github_senior": 35,   # internal tier, stored as stamp_type='github'
    "referral": 15,        # earned when referrer reaches 3 successful referrals
    "gitcoin_passport": {  # tiered by score
        "low":    (1,  9,  5),
        "medium": (10, 19, 15),
        "high":   (20, 49, 25),
        "elite":  (50, 999, 35),
    },
}

GITCOIN_BASE_URL = "https://api.scorer.gitcoin.co"
GITHUB_API_URL   = "https://api.github.com"


# ── Result type ───────────────────────────────────────────────────────────────

@dataclass
class StampResult:
    ok: bool
    stamp_type: str
    score_contribution: float
    message: str
    metadata: dict


# ── GitHub stamp ──────────────────────────────────────────────────────────────

async def verify_github_stamp(
    username: str,
    user_id: str,
    pool,
    github_token: str = "",
) -> StampResult:
    """
    Verify a GitHub account and award a stamp.

    Criteria (in order of trust):
      Senior (+35): account age ≥ 2 years AND public_repos ≥ 10
      Standard (+25): account age ≥ 6 months AND (public_repos ≥ 1 OR followers ≥ 1)
      Rejected: account too new or empty

    No OAuth required — uses the public GitHub REST API.
    Rate limit: 60 req/hour unauthenticated, 5000 with token.
    """
    headers = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
    if github_token:
        headers["Authorization"] = f"Bearer {github_token}"

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(f"{GITHUB_API_URL}/users/{username}", headers=headers)

    if resp.status_code == 404:
        return StampResult(False, "github", 0, f"GitHub user '{username}' not found.", {})
    if resp.status_code == 403:
        return StampResult(False, "github", 0, "GitHub rate limit exceeded. Try again later.", {})
    if resp.status_code != 200:
        return StampResult(False, "github", 0, f"GitHub API error: HTTP {resp.status_code}.", {})

    data = resp.json()
    created_at = datetime.fromisoformat(data["created_at"].replace("Z", "+00:00"))
    now = datetime.now(timezone.utc)
    age_days = (now - created_at).days
    repos = int(data.get("public_repos", 0))
    followers = int(data.get("followers", 0))

    if age_days < 180:
        return StampResult(
            False, "github", 0,
            f"GitHub account is only {age_days} days old (minimum 180 days required).",
            {"age_days": age_days},
        )

    if repos < 1 and followers < 1:
        return StampResult(
            False, "github", 0,
            "GitHub account has no public repositories or followers. Create at least one public repo first.",
            {"public_repos": repos, "followers": followers},
        )

    # Determine tier
    is_senior = age_days >= 730 and repos >= 10
    contribution = STAMP_WEIGHTS["github_senior"] if is_senior else STAMP_WEIGHTS["github"]
    tier = "senior" if is_senior else "standard"

    metadata = {
        "github_username": username,
        "account_age_days": age_days,
        "public_repos": repos,
        "followers": followers,
        "tier": tier,
        "github_id": data.get("id"),
    }

    expires_at = (now + timedelta(days=365)).isoformat()

    await _upsert_stamp(
        user_id=user_id,
        stamp_type="github",
        stamp_value=_hash(username.lower()),
        score_contribution=contribution,
        expires_at=expires_at,
        metadata=metadata,
        pool=pool,
    )
    await recompute_humanity_score(user_id, pool)

    return StampResult(
        True, "github", contribution,
        f"GitHub stamp verified ({tier}). +{contribution:.0f} points added to your humanity score.",
        metadata,
    )


# ── Gitcoin Passport stamp ────────────────────────────────────────────────────

async def verify_gitcoin_stamp(
    eth_address: str,
    user_id: str,
    pool,
    gitcoin_api_key: str,
    gitcoin_scorer_id: str,
) -> StampResult:
    """
    Fetch the Gitcoin Passport score for an Ethereum address.

    Requires a Scorer API key from https://www.scorer.gitcoin.co/
    Gitcoin aggregates Web2 + Web3 stamps (Twitter, GitHub, Google, Coinbase, etc.)
    into a single score. Score ≥ 20 = likely unique human.
    """
    if not gitcoin_api_key or not gitcoin_scorer_id:
        return StampResult(
            False, "gitcoin_passport", 0,
            "Gitcoin Passport is not configured on this Maxx Engage instance. "
            "Use the GitHub stamp instead.",
            {},
        )

    if not eth_address.startswith("0x") or len(eth_address) != 42:
        return StampResult(
            False, "gitcoin_passport", 0,
            "Invalid Ethereum address. Must be 0x-prefixed, 42 characters.",
            {},
        )

    headers = {"X-API-KEY": gitcoin_api_key, "Accept": "application/json"}
    address = eth_address.lower()

    async with httpx.AsyncClient(timeout=15) as client:
        # Submit/refresh the passport first
        await client.post(
            f"{GITCOIN_BASE_URL}/registry/submit-passport",
            json={"address": address, "scorer_id": gitcoin_scorer_id},
            headers=headers,
        )
        # Fetch the score
        resp = await client.get(
            f"{GITCOIN_BASE_URL}/registry/score/{gitcoin_scorer_id}/{address}",
            headers=headers,
        )

    if resp.status_code == 404:
        return StampResult(
            False, "gitcoin_passport", 0,
            "No Gitcoin Passport found for this address. "
            "Create one at passport.gitcoin.co and add at least a few stamps.",
            {"eth_address": address},
        )
    if resp.status_code != 200:
        logger.warning("identity.gitcoin.api_error", status=resp.status_code, body=resp.text[:300])
        return StampResult(
            False, "gitcoin_passport", 0,
            f"Gitcoin Passport API error: HTTP {resp.status_code}. Try again.",
            {},
        )

    data = resp.json()
    raw_score = float(data.get("score", 0))

    # Determine contribution tier
    contribution = 0.0
    tier_name = "none"
    for tier, (lo, hi, pts) in STAMP_WEIGHTS["gitcoin_passport"].items():
        if lo <= raw_score <= hi:
            contribution = float(pts)
            tier_name = tier
            break

    if contribution == 0:
        return StampResult(
            False, "gitcoin_passport", 0,
            f"Gitcoin Passport score is {raw_score:.1f} — below the minimum threshold of 1. "
            "Add more stamps at passport.gitcoin.co.",
            {"gitcoin_score": raw_score},
        )

    now = datetime.now(timezone.utc)
    metadata = {
        "gitcoin_score": raw_score,
        "tier": tier_name,
        "scorer_id": gitcoin_scorer_id,
        "stamp_count": len(data.get("stamps", [])),
    }
    expires_at = (now + timedelta(days=90)).isoformat()

    await _upsert_stamp(
        user_id=user_id,
        stamp_type="gitcoin_passport",
        stamp_value=_hash(address),
        score_contribution=contribution,
        expires_at=expires_at,
        metadata=metadata,
        pool=pool,
    )
    await recompute_humanity_score(user_id, pool)

    return StampResult(
        True, "gitcoin_passport", contribution,
        f"Gitcoin Passport score {raw_score:.1f} verified (tier: {tier_name}). "
        f"+{contribution:.0f} points added to your humanity score.",
        metadata,
    )


# ── Email stamp (automatic at registration) ───────────────────────────────────

async def mark_email_stamp(user_id: str, pool) -> None:
    """
    Award the email stamp automatically on first login.
    Magic-link authentication = verified email — no additional check needed.
    """
    await _upsert_stamp(
        user_id=user_id,
        stamp_type="email",
        stamp_value=None,
        score_contribution=float(STAMP_WEIGHTS["email"]),
        expires_at=None,
        metadata={"method": "supabase_magic_link"},
        pool=pool,
    )
    await recompute_humanity_score(user_id, pool)


# ── Humanity score computation ────────────────────────────────────────────────

async def recompute_humanity_score(user_id: str, pool) -> float:
    """
    Sum all active (non-expired) stamp contributions, cap at 100.
    Writes the result to users.humanity_score. Returns the new score.
    """
    rows = await pool.fetch(
        """
        SELECT score_contribution
        FROM public.stamps
        WHERE user_id = $1::uuid
          AND (expires_at IS NULL OR expires_at > now())
        """,
        user_id,
    )
    total = min(100.0, sum(float(r["score_contribution"]) for r in rows))
    await pool.execute(
        "UPDATE public.users SET humanity_score = $1 WHERE id = $2::uuid",
        total, user_id,
    )
    return total


# ── Internal helpers ──────────────────────────────────────────────────────────

def _hash(value: str) -> str:
    """SHA-256 hash for storing PII identifiers (phone, ETH address) without plain text."""
    return hashlib.sha256(value.encode()).hexdigest()


async def _upsert_stamp(
    user_id: str,
    stamp_type: str,
    stamp_value: str | None,
    score_contribution: float,
    expires_at: str | None,
    metadata: dict,
    pool,
) -> None:
    await pool.execute(
        """
        INSERT INTO public.stamps
            (user_id, stamp_type, stamp_value, score_contribution, expires_at, metadata)
        VALUES ($1::uuid, $2, $3, $4, $5::timestamptz, $6::jsonb)
        ON CONFLICT (user_id, stamp_type)
        DO UPDATE SET
            stamp_value        = EXCLUDED.stamp_value,
            score_contribution = EXCLUDED.score_contribution,
            verified_at        = now(),
            expires_at         = EXCLUDED.expires_at,
            metadata           = EXCLUDED.metadata
        """,
        user_id, stamp_type, stamp_value,
        score_contribution, expires_at,
        json.dumps(metadata),
    )

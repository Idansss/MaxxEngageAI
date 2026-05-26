"""
Sybil resistance via trust-network vouching.

Trust score = min(100, credential_count * 10 + active_vouch_count * 5)
Examples:
  - 2 credentials, 0 vouches → trust 20  (minimum to vouch for others)
  - 4 credentials, 6 vouches → trust 70
  - 10 credentials, 0 vouches → trust 100 (max)

Vouching rules:
  - Voucher must have trust_score >= 20 to vouch for others.
  - Max 5 vouches given per rolling 30-day window.
  - No self-vouching (DB constraint + application check).
  - Each (voucher, vouchee) pair is unique (DB UNIQUE constraint).

Trust score is recomputed after every credential issuance and every new vouch,
so it stays current without a background job.
"""

import uuid

from fastapi import HTTPException

from app.core.database import get_pool
from app.core.logging import logger


async def vouch(voucher_id: str, vouchee_id: str) -> dict:
    """Vouch for a user. Raises HTTPException on any rule violation."""
    pool = get_pool()

    voucher = await pool.fetchrow(
        "SELECT trust_score FROM public.users WHERE id = $1::uuid",
        voucher_id,
    )
    if not voucher:
        raise HTTPException(status_code=404, detail="Voucher profile not found.")
    if float(voucher["trust_score"] or 0) < 20:
        raise HTTPException(
            status_code=403,
            detail="Your trust score must be ≥ 20 to vouch for others. Earn at least 2 credentials first.",
        )

    vouchee = await pool.fetchrow(
        "SELECT id FROM public.users WHERE id = $1::uuid", vouchee_id
    )
    if not vouchee:
        raise HTTPException(status_code=404, detail="User to vouch for not found.")

    recent_count = await pool.fetchval(
        """
        SELECT COUNT(*) FROM public.vouches
        WHERE voucher_id = $1::uuid
          AND created_at > now() - interval '30 days'
        """,
        voucher_id,
    )
    if (recent_count or 0) >= 5:
        raise HTTPException(
            status_code=429,
            detail="Monthly vouch limit (5) reached. Resets on a rolling 30-day window.",
        )

    vouch_id = str(uuid.uuid4())
    try:
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO public.vouches (id, voucher_id, vouchee_id)
                VALUES ($1::uuid, $2::uuid, $3::uuid)
                """,
                vouch_id,
                voucher_id,
                vouchee_id,
            )
            # Keep vouched_by array in sync for cheap array-contains queries
            await conn.execute(
                """
                UPDATE public.users
                SET vouched_by = array_append(vouched_by, $1::uuid)
                WHERE id = $2::uuid
                  AND NOT ($1::uuid = ANY(vouched_by))
                """,
                voucher_id,
                vouchee_id,
            )
            await _recompute_trust(vouchee_id, conn)
    except Exception as e:
        if "unique" in str(e).lower() or "duplicate" in str(e).lower():
            raise HTTPException(
                status_code=409,
                detail="You have already vouched for this user.",
            )
        logger.error("sybil.vouch_error", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to record vouch.")

    logger.info("sybil.vouched", voucher=voucher_id, vouchee=vouchee_id)
    return {"ok": True, "vouch_id": vouch_id}


async def recompute_trust_after_credential(user_id: str) -> None:
    """Call after issuing a credential so the trust score reflects the new credential."""
    pool = get_pool()
    async with pool.acquire() as conn:
        await _recompute_trust(user_id, conn)


async def _recompute_trust(user_id: str, conn) -> None:
    row = await conn.fetchrow(
        """
        SELECT
            (SELECT COUNT(*) FROM public.credentials
             WHERE user_id = $1::uuid)                                         AS cred_count,
            (SELECT COUNT(*) FROM public.vouches
             WHERE vouchee_id = $1::uuid AND status = 'active')                AS vouch_count
        """,
        user_id,
    )
    cred_count = int(row["cred_count"] or 0)
    vouch_count = int(row["vouch_count"] or 0)
    trust = min(100.0, float(cred_count * 10 + vouch_count * 5))
    await conn.execute(
        "UPDATE public.users SET trust_score = $1 WHERE id = $2::uuid",
        trust,
        user_id,
    )

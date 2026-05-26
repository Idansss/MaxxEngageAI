import uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.api.deps import get_current_user, get_optional_user
from app.core.config import get_settings
from app.core.database import get_pool
from app.core.logging import logger
from app.services.audit import append_audit_log
from app.services.decay import compute_decay
from app.services.zk import make_percentile_claim, verify_percentile_claim

router = APIRouter(prefix="/credentials", tags=["credentials"])


# ── GET /credentials/my/decay-status ─────────────────────────────────────────

@router.get(
    "/my/decay-status",
    summary="List all your credentials with current decay and refresh urgency",
)
async def my_decay_status(auth_user: dict = Depends(get_current_user)):
    """
    Returns every credential you hold, enriched with:
    - **effective_score**: what the credential is worth today (decays over time)
    - **decay_factor**: fraction of original score still valid (1.0 = full, 0.5 = half-life)
    - **overdue_for_refresh**: true if the credential is past its decay_refresh_months window
    - **reassessment_recommended_at**: date you should retake to maintain full weight

    Sorted by urgency — most overdue credentials first.
    """
    pool = get_pool()
    user_row = await pool.fetchrow(
        "SELECT id FROM public.users WHERE auth_id = $1::uuid", auth_user["id"]
    )
    if not user_row:
        raise HTTPException(status_code=404, detail="User profile not found.")

    rows = await pool.fetch(
        """
        SELECT c.id, c.level, c.level_label, c.score, c.is_public,
               c.valid_from, c.valid_until, c.created_at,
               sp.slug AS skill_path_slug, sp.name AS skill_path_name, sp.domain,
               sp.decay_half_life_months, sp.decay_refresh_months
        FROM public.credentials c
        JOIN public.skill_paths sp ON sp.id = c.skill_path_id
        WHERE c.user_id = $1::uuid
        ORDER BY c.created_at DESC
        """,
        str(user_row["id"]),
    )

    items = []
    for r in rows:
        decay = compute_decay(
            raw_score=float(r["score"]),
            issued_at=r["valid_from"],
            half_life_months=r["decay_half_life_months"],
            refresh_months=r.get("decay_refresh_months"),
        )
        items.append({
            "id": str(r["id"]),
            "skill_path_name": r["skill_path_name"],
            "skill_path_slug": r["skill_path_slug"],
            "domain": r["domain"],
            "level": r["level"],
            "level_label": r["level_label"],
            "is_public": r["is_public"],
            "raw_score": float(r["score"]),
            **decay,
        })

    # Sort: overdue first, then by decay_factor ascending (most decayed first)
    items.sort(key=lambda x: (not x.get("overdue_for_refresh", False), x.get("decay_factor", 1.0)))

    overdue_count = sum(1 for x in items if x.get("overdue_for_refresh"))
    return {
        "total": len(items),
        "overdue_count": overdue_count,
        "credentials": items,
    }


# ── GET /credentials/{credential_id} ─────────────────────────────────────────

@router.get("/{credential_id}", summary="Get a credential with decay and ZK proof data")
async def get_credential(
    credential_id: str,
    auth_user: dict | None = Depends(get_optional_user),
):
    """
    Returns the full credential enriched with:
    - **decay**: effective_score (what the credential is worth today given skill half-life)
    - **percentile_claim**: signed claim holder can share to prove rank without revealing score
    - **consistency**: how stable this user's scores have been over multiple attempts

    Public credentials are visible to anyone. Private credentials are only visible to their owner.
    """
    try:
        uuid.UUID(credential_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="credential_id must be a valid UUID.")

    pool = get_pool()
    row = await pool.fetchrow(
        """
        SELECT c.id, c.holder_did, c.level, c.level_label, c.score, c.percentile,
               c.verified_by_human, c.zk_proof_available, c.score_commitment,
               c.consistency_score, c.consistency_rating, c.attempt_count,
               c.content_hash, c.ipfs_cid, c.anchor_provider, c.anchor_status, c.anchor_url,
               c.vc_document, c.valid_from, c.valid_until, c.created_at, c.is_public,
               c.user_id,
               sp.slug  AS skill_path_slug,
               sp.name  AS skill_path_name,
               sp.decay_half_life_months,
               sp.decay_refresh_months
        FROM public.credentials c
        JOIN public.skill_paths sp ON sp.id = c.skill_path_id
        WHERE c.id = $1::uuid
        """,
        credential_id,
    )
    if not row:
        raise HTTPException(
            status_code=404, detail=f"Credential '{credential_id}' not found."
        )

    # Private credentials are only accessible to their owner.
    if not row["is_public"]:
        owner_id = None
        if auth_user:
            owner_row = await pool.fetchrow(
                "SELECT id FROM public.users WHERE auth_id = $1::uuid", auth_user["id"]
            )
            if owner_row:
                owner_id = str(owner_row["id"])
        if owner_id != str(row["user_id"]):
            raise HTTPException(status_code=404, detail=f"Credential '{credential_id}' not found.")

    data = dict(row)
    data["id"] = str(data["id"])

    # Decay enrichment
    if data.get("valid_from"):
        data["decay"] = compute_decay(
            raw_score=float(data["score"]),
            issued_at=data["valid_from"],
            half_life_months=data["decay_half_life_months"],
            refresh_months=data.get("decay_refresh_months"),
        )
    else:
        data["decay"] = None

    # ZK percentile claim
    settings = get_settings()
    if data.get("percentile") is not None:
        data["percentile_claim"] = make_percentile_claim(
            credential_id=data["id"],
            percentile=float(data["percentile"]),
            skill_path_slug=data["skill_path_slug"],
            level=int(data["level"]),
            secret=settings.zk_secret_key,
        )
    else:
        data["percentile_claim"] = None

    return data


# ── PATCH /credentials/{credential_id}/visibility ─────────────────────────────

class VisibilityRequest(BaseModel):
    is_public: bool


@router.patch(
    "/{credential_id}/visibility",
    summary="Toggle a credential public/private",
)
async def set_visibility(
    credential_id: str,
    body: VisibilityRequest,
    auth_user: dict = Depends(get_current_user),
):
    """
    Show or hide a credential from your public profile and from verifiers.

    - `is_public: true` — visible to anyone with the credential link or on your profile
    - `is_public: false` — hidden; only you can see it; the verification URL returns 404

    Your profile's overall public/private toggle still applies on top of this.
    """
    try:
        uuid.UUID(credential_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="credential_id must be a valid UUID.")

    pool = get_pool()
    user_row = await pool.fetchrow(
        "SELECT id FROM public.users WHERE auth_id = $1::uuid", auth_user["id"]
    )
    if not user_row:
        raise HTTPException(status_code=404, detail="User profile not found.")

    old_row = await pool.fetchrow(
        """
        SELECT id, is_public
        FROM public.credentials
        WHERE id = $1::uuid AND user_id = $2::uuid
        """,
        credential_id,
        str(user_row["id"]),
    )
    if not old_row:
        raise HTTPException(
            status_code=404,
            detail="Credential not found or does not belong to you.",
        )

    result = await pool.fetchrow(
        """
        UPDATE public.credentials
        SET is_public = $1
        WHERE id = $2::uuid AND user_id = $3::uuid
        RETURNING id, is_public
        """,
        body.is_public,
        credential_id,
        str(user_row["id"]),
    )

    logger.info(
        "credential.visibility_changed",
        credential_id=credential_id,
        is_public=body.is_public,
    )
    await append_audit_log(
        action="credential.visibility_changed",
        actor_type="user",
        actor_id=str(user_row["id"]),
        entity_type="credential",
        entity_id=credential_id,
        old_values={"is_public": old_row["is_public"]},
        new_values={"is_public": result["is_public"]},
    )
    return {
        "ok": True,
        "credential_id": credential_id,
        "is_public": result["is_public"],
        "message": (
            "Credential is now public — visible on your profile and to verifiers."
            if body.is_public
            else "Credential is now private — hidden from your profile and verifiers."
        ),
    }


# ── GET /credentials/{credential_id}/verify-percentile ───────────────────────

@router.get(
    "/{credential_id}/verify-percentile",
    summary="Verify a signed percentile claim",
)
async def verify_percentile(credential_id: str, signature: str, percentile_band: str):
    """
    Verifier endpoint: confirm that a presented percentile claim was issued by Maxx Engage.
    The holder provides (credential_id, percentile_band, signature);
    the verifier calls this endpoint to check authenticity.
    """
    try:
        uuid.UUID(credential_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="credential_id must be a valid UUID.")

    pool = get_pool()
    row = await pool.fetchrow(
        """
        SELECT c.percentile, c.level, c.is_public,
               sp.slug AS skill_path_slug
        FROM public.credentials c
        JOIN public.skill_paths sp ON sp.id = c.skill_path_id
        WHERE c.id = $1::uuid
        """,
        credential_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Credential not found.")
    if not row["is_public"]:
        raise HTTPException(status_code=404, detail="Credential not found.")

    settings = get_settings()
    claim = {
        "credential_id": credential_id,
        "percentile_band": percentile_band,
        "skill_path": row["skill_path_slug"],
        "level": int(row["level"]),
        "signature": signature,
    }
    valid = verify_percentile_claim(claim, settings.zk_secret_key)

    return {
        "valid": valid,
        "credential_id": credential_id,
        "percentile_band": percentile_band,
        "skill_path": row["skill_path_slug"],
        "level": int(row["level"]),
    }

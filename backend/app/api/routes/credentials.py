import uuid
from fastapi import APIRouter, HTTPException
from app.core.database import get_pool

router = APIRouter(prefix="/credentials", tags=["credentials"])


@router.get("/{credential_id}", summary="Get a public credential by ID")
async def get_credential(credential_id: str):
    try:
        uuid.UUID(credential_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="credential_id must be a valid UUID.")

    pool = get_pool()
    row = await pool.fetchrow(
        """
        SELECT c.id, c.holder_did, c.level, c.level_label, c.score,
               c.verified_by_human, c.zk_proof_available, c.vc_document,
               c.valid_from, c.valid_until, c.created_at,
               sp.slug AS skill_path_slug, sp.name AS skill_path_name
        FROM public.credentials c
        JOIN public.skill_paths sp ON sp.id = c.skill_path_id
        WHERE c.id = $1::uuid
        """,
        credential_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail=f"Credential '{credential_id}' not found.")

    data = dict(row)
    data["id"] = str(data["id"])
    return data

from fastapi import APIRouter, HTTPException
from app.core.database import get_pool
from app.core.logging import logger

router = APIRouter(prefix="/skill-paths", tags=["skill paths"])


@router.get("", summary="List all active skill paths")
async def list_skill_paths():
    pool = get_pool()
    rows = await pool.fetch(
        "SELECT id, slug, name, domain, description, levels, tags, decay_half_life_months "
        "FROM public.skill_paths WHERE active = true ORDER BY name"
    )
    return [dict(r) for r in rows]


@router.get("/{slug}", summary="Get one skill path by slug")
async def get_skill_path(slug: str):
    pool = get_pool()
    row = await pool.fetchrow(
        "SELECT id, slug, name, domain, description, levels, tags, decay_half_life_months "
        "FROM public.skill_paths WHERE slug = $1 AND active = true",
        slug,
    )
    if not row:
        raise HTTPException(status_code=404, detail=f"Skill path '{slug}' not found.")
    return dict(row)

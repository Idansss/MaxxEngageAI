import json
from pathlib import Path
from fastapi import APIRouter, HTTPException
from app.core.database import get_pool
from app.core.logging import logger

router = APIRouter(prefix="/skill-paths", tags=["skill paths"])

_RUBRICS_DIR = Path(__file__).parent.parent.parent.parent / "rubrics"


@router.get("", summary="List all active skill paths")
async def list_skill_paths():
    pool = get_pool()
    rows = await pool.fetch(
        "SELECT id, slug, name, domain, description, levels, tags, decay_half_life_months "
        "FROM public.skill_paths WHERE active = true ORDER BY name"
    )
    return [dict(r) for r in rows]


@router.get("/{slug}/stats", summary="Credential stats and top performers for a skill path")
async def get_skill_path_stats(slug: str):
    pool = get_pool()

    sp = await pool.fetchrow(
        "SELECT id FROM public.skill_paths WHERE slug = $1 AND active = true", slug
    )
    if not sp:
        raise HTTPException(status_code=404, detail=f"Skill path '{slug}' not found.")

    sp_id = sp["id"]

    stats = await pool.fetchrow(
        """
        SELECT
            COUNT(*)                        AS credential_count,
            COUNT(DISTINCT c.user_id)       AS earner_count,
            ROUND(AVG(c.score)::numeric, 1) AS avg_score,
            MAX(c.score)                    AS top_score
        FROM public.credentials c
        WHERE c.skill_path_id = $1::uuid AND c.is_public = true AND c.public_visible = true AND c.revoked = false
        """,
        sp_id,
    )

    performers = await pool.fetch(
        """
        SELECT DISTINCT ON (c.user_id)
            u.username, u.display_name, u.avatar_url,
            c.score, c.verified_by_human, c.level_label
        FROM public.credentials c
        JOIN public.users u ON u.id = c.user_id
        WHERE c.skill_path_id = $1::uuid
          AND c.is_public = true
          AND c.public_visible = true
          AND c.revoked = false
          AND u.proof_page_visibility = 'public'
          AND u.username IS NOT NULL
        ORDER BY c.user_id, c.score DESC
        """,
        sp_id,
    )

    # Sort performers by score and take top 5
    sorted_p = sorted(performers, key=lambda r: float(r["score"]), reverse=True)[:5]

    return {
        "credential_count": int(stats["credential_count"] or 0),
        "earner_count": int(stats["earner_count"] or 0),
        "avg_score": float(stats["avg_score"]) if stats["avg_score"] else None,
        "top_score": float(stats["top_score"]) if stats["top_score"] else None,
        "top_performers": [
            {
                "username": r["username"],
                "display_name": r["display_name"],
                "avatar_url": r["avatar_url"],
                "score": float(r["score"]),
                "verified_by_human": r["verified_by_human"],
                "level_label": r["level_label"],
            }
            for r in sorted_p
        ],
    }


@router.get("/{slug}/rubric/{level}", summary="Rubric dimensions for a given skill path level")
async def get_skill_path_rubric(slug: str, level: int):
    pool = get_pool()

    sp = await pool.fetchrow(
        "SELECT id, levels FROM public.skill_paths WHERE slug = $1 AND active = true", slug
    )
    if not sp:
        raise HTTPException(status_code=404, detail=f"Skill path '{slug}' not found.")

    levels = sp["levels"] if isinstance(sp["levels"], list) else json.loads(str(sp["levels"]))
    level_cfg = next((lv for lv in levels if lv.get("level") == level), None)
    if not level_cfg:
        raise HTTPException(status_code=404, detail=f"Level {level} not found for '{slug}'.")

    rubric_id = level_cfg.get("rubric_id")
    if not rubric_id:
        raise HTTPException(status_code=404, detail="No rubric configured for this level.")

    rubric_path = _RUBRICS_DIR / f"{rubric_id}.json"
    if not rubric_path.exists():
        raise HTTPException(status_code=404, detail="Rubric file not found.")

    with open(rubric_path) as f:
        rubric = json.load(f)

    return {
        "rubric_id": rubric_id,
        "title": rubric.get("title", ""),
        "pass_threshold": rubric.get("pass_threshold", 70),
        "dimensions": [
            {
                "id": d["id"],
                "name": d["name"],
                "description": d["description"],
                "weight": d["weight"],
                "max_score": d["max_score"],
            }
            for d in rubric.get("dimensions", [])
        ],
    }


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

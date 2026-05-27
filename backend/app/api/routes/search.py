"""
Global search — skill paths and public talent profiles.
No authentication required; only public data is returned.
"""

from fastapi import APIRouter, Query
from app.core.database import get_pool

router = APIRouter(prefix="/search", tags=["search"])


@router.get("", summary="Search skill paths and public talent profiles")
async def search(q: str = Query(..., min_length=2, max_length=100)):
    pool = get_pool()
    pattern = f"%{q}%"

    sp_rows = await pool.fetch(
        """
        SELECT slug, name, domain, description
        FROM public.skill_paths
        WHERE active = true
          AND (
            name        ILIKE $1
            OR description ILIKE $1
            OR EXISTS (SELECT 1 FROM unnest(tags) t(tag) WHERE tag ILIKE $1)
          )
        ORDER BY
          CASE WHEN name ILIKE $2 THEN 0 ELSE 1 END,
          name
        LIMIT 5
        """,
        pattern,
        f"{q}%",
    )

    user_rows = await pool.fetch(
        """
        SELECT id, username, display_name, avatar_url, country_code,
               COALESCE(overall_score, 0) AS overall_score
        FROM public.users
        WHERE proof_page_visibility = 'public'
          AND username IS NOT NULL
          AND (
            display_name ILIKE $1
            OR username   ILIKE $1
            OR bio        ILIKE $1
          )
        ORDER BY
          CASE WHEN username ILIKE $2 OR display_name ILIKE $2 THEN 0 ELSE 1 END,
          COALESCE(overall_score, 0) DESC
        LIMIT 5
        """,
        pattern,
        f"{q}%",
    )

    return {
        "skill_paths": [dict(r) for r in sp_rows],
        "users": [
            {
                "id":            str(r["id"]),
                "username":      r["username"],
                "display_name":  r["display_name"],
                "avatar_url":    r["avatar_url"],
                "country_code":  r["country_code"],
                "overall_score": float(r["overall_score"]),
            }
            for r in user_rows
        ],
    }

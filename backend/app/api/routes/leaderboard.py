"""
Public leaderboard — top scores per skill assessment.

Shows one entry per user per skill path (their best credential for that path),
ranked globally by score. Filterable by domain or specific skill path.
No auth required — only public credentials are included.
"""

from typing import Optional
from fastapi import APIRouter, Query

from app.core.database import get_pool

router = APIRouter(prefix="/leaderboard", tags=["leaderboard"])


@router.get("", summary="Top credentials ranked by score")
async def get_leaderboard(
    domain: Optional[str] = Query(None, description="Filter by skill domain"),
    skill_path_slug: Optional[str] = Query(None, description="Filter by skill path slug"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    pool = get_pool()

    where_clauses = []
    params: list = []

    if domain:
        params.append(domain)
        where_clauses.append(f"sp.domain = ${len(params)}")
    if skill_path_slug:
        params.append(skill_path_slug)
        where_clauses.append(f"sp.slug = ${len(params)}")

    where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

    params.extend([limit, offset])
    limit_param = len(params) - 1
    offset_param = len(params)

    rows = await pool.fetch(
        f"""
        WITH best_credentials AS (
            SELECT DISTINCT ON (c.user_id, c.skill_path_id)
                COALESCE(c.public_id, c.id::text) AS public_id, c.user_id, c.skill_path_id,
                c.level, c.level_label, c.score, c.percentile,
                c.verified_by_human, c.valid_from
            FROM public.credentials c
            WHERE c.is_public = true AND c.public_visible = true AND c.revoked = false
            ORDER BY c.user_id, c.skill_path_id, c.score DESC
        ),
        ranked AS (
            SELECT
                RANK() OVER (ORDER BY bc.score DESC, bc.verified_by_human DESC) AS rank,
                COUNT(*) OVER () AS total_count,
                bc.public_id       AS credential_id,
                u.display_name,
                u.username,
                u.country_code,
                sp.name            AS skill_path_name,
                sp.slug            AS skill_path_slug,
                sp.domain,
                bc.level,
                bc.level_label,
                bc.score,
                bc.percentile,
                bc.verified_by_human,
                bc.valid_from      AS issued_at
            FROM best_credentials bc
            JOIN public.users u      ON u.id  = bc.user_id
            JOIN public.skill_paths sp ON sp.id = bc.skill_path_id
            {where_sql}
        )
        SELECT *
        FROM ranked
        ORDER BY rank, credential_id
        LIMIT ${limit_param} OFFSET ${offset_param}
        """,
        *params,
    )

    total = int(rows[0]["total_count"]) if rows else 0

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "items": [
            {
                "rank": int(r["rank"]),
                "credential_id": str(r["credential_id"]),
                "display_name": r["display_name"],
                "username": r["username"],
                "country_code": r["country_code"],
                "skill_path_name": r["skill_path_name"],
                "skill_path_slug": r["skill_path_slug"],
                "domain": r["domain"],
                "level": r["level"],
                "level_label": r["level_label"],
                "score": float(r["score"]),
                "percentile": float(r["percentile"]) if r["percentile"] is not None else None,
                "verified_by_human": r["verified_by_human"],
                "issued_at": r["issued_at"].isoformat() if r["issued_at"] else None,
            }
            for r in rows
        ],
    }

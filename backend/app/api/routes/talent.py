"""
Talent discovery for employers and recruiters.

Returns users who have:
  - proof_page_visibility = 'public'
  - username set (so there's a proof page to link to)
  - at least one public credential

Filterable by domain, country, and minimum score.
Only public data is returned — no PII beyond what the user chose to make public.
"""

from typing import Optional
from fastapi import APIRouter, Query

from app.core.database import get_pool

router = APIRouter(prefix="/talent", tags=["talent"])


@router.get("/search", summary="Discover verified talent")
async def search_talent(
    domain: Optional[str] = Query(None, description="Filter by skill domain"),
    country_code: Optional[str] = Query(None, description="Filter by ISO 3166-1 alpha-2 country code"),
    min_score: Optional[float] = Query(None, ge=0, le=100, description="Minimum top score"),
    skill_path_slug: Optional[str] = Query(None, description="Filter by specific skill path slug"),
    q: Optional[str] = Query(None, min_length=1, max_length=80, description="Search by name or username"),
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
):
    pool = get_pool()

    where_clauses = [
        "u.proof_page_visibility = 'public'",
        "u.username IS NOT NULL",
    ]
    having_clauses: list[str] = []
    params: list = []

    if domain:
        params.append(domain)
        where_clauses.append(f"sp.domain = ${len(params)}")
    if country_code:
        params.append(country_code.upper())
        where_clauses.append(f"u.country_code = ${len(params)}")
    if skill_path_slug:
        params.append(skill_path_slug)
        where_clauses.append(f"sp.slug = ${len(params)}")
    if q:
        params.append(f"%{q}%")
        where_clauses.append(f"(u.display_name ILIKE ${len(params)} OR u.username ILIKE ${len(params)})")
    if min_score is not None:
        params.append(min_score)
        having_clauses.append(f"MAX(c.score) >= ${len(params)}")

    where_sql = " AND ".join(where_clauses)
    having_sql = ("HAVING " + " AND ".join(having_clauses)) if having_clauses else ""

    params.extend([limit, offset])
    limit_param = len(params) - 1
    offset_param = len(params)

    rows = await pool.fetch(
        f"""
        WITH eligible_users AS (
            SELECT
                u.id,
                u.display_name,
                u.username,
                u.country_code,
                u.bio,
                u.avatar_url,
                u.overall_score,
                MAX(c.score)        AS top_score,
                COUNT(DISTINCT c.id) AS credential_count
            FROM public.users u
            JOIN public.credentials c  ON c.user_id = u.id AND c.is_public = true AND c.public_visible = true AND c.revoked = false
            JOIN public.skill_paths sp ON sp.id = c.skill_path_id
            WHERE {where_sql}
            GROUP BY u.id, u.display_name, u.username, u.country_code,
                     u.bio, u.avatar_url, u.overall_score
            {having_sql}
        ),
        ranked_creds AS (
            SELECT
                c.user_id,
                COALESCE(c.public_id, c.id::text) AS credential_id,
                sp.name            AS skill_path_name,
                sp.domain,
                c.score,
                c.verified_by_human,
                ROW_NUMBER() OVER (PARTITION BY c.user_id ORDER BY c.score DESC) AS rn
            FROM public.credentials c
            JOIN public.skill_paths sp ON sp.id = c.skill_path_id
            WHERE c.is_public = true AND c.public_visible = true AND c.revoked = false
              AND c.user_id IN (SELECT id FROM eligible_users)
        )
        SELECT
            eu.id           AS user_id,
            eu.display_name,
            eu.username,
            eu.country_code,
            eu.bio,
            eu.avatar_url,
            eu.overall_score,
            eu.top_score,
            eu.credential_count,
            COUNT(*) OVER ()                    AS total_count,
            ARRAY_AGG(DISTINCT rc.domain)
                FILTER (WHERE rc.domain IS NOT NULL) AS domains,
            JSONB_AGG(
                JSONB_BUILD_OBJECT(
                    'credential_id',   rc.credential_id::text,
                    'skill_path_name', rc.skill_path_name,
                    'domain',          rc.domain,
                    'score',           rc.score,
                    'verified_by_human', rc.verified_by_human
                ) ORDER BY rc.score DESC
            ) FILTER (WHERE rc.rn <= 3)         AS top_credentials
        FROM eligible_users eu
        JOIN ranked_creds rc ON rc.user_id = eu.id
        GROUP BY eu.id, eu.display_name, eu.username, eu.country_code,
                 eu.bio, eu.avatar_url, eu.overall_score,
                 eu.top_score, eu.credential_count
        ORDER BY eu.top_score DESC, eu.credential_count DESC
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
                "user_id": str(r["user_id"]),
                "display_name": r["display_name"],
                "username": r["username"],
                "country_code": r["country_code"],
                "bio": r["bio"],
                "avatar_url": r["avatar_url"],
                "overall_score": float(r["overall_score"]) if r["overall_score"] else 0,
                "top_score": float(r["top_score"]),
                "credential_count": int(r["credential_count"]),
                "domains": list(r["domains"]) if r["domains"] else [],
                "top_credentials": list(r["top_credentials"]) if r["top_credentials"] else [],
            }
            for r in rows
        ],
    }

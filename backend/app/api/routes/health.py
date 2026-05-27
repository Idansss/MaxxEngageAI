from fastapi import APIRouter
from datetime import datetime, timezone
from app.core.database import get_pool

router = APIRouter(tags=["meta"])


@router.get("/health", summary="Liveness check")
async def health():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


@router.get("/stats", summary="Public platform statistics")
async def platform_stats():
    """Public aggregate stats shown on the landing page. Cached at the CDN level."""
    pool = get_pool()
    row = await pool.fetchrow(
        """
        SELECT
            (SELECT COUNT(*) FROM public.credentials WHERE is_public = true)   AS credential_count,
            (SELECT COUNT(*) FROM public.users)                                 AS user_count,
            (SELECT COUNT(DISTINCT country_code) FROM public.users
             WHERE country_code IS NOT NULL AND country_code != '')             AS country_count,
            (SELECT COUNT(*) FROM public.skill_paths WHERE active = true)       AS skill_path_count
        """
    )
    return {
        "credential_count": int(row["credential_count"] or 0),
        "user_count":       int(row["user_count"] or 0),
        "country_count":    int(row["country_count"] or 0),
        "skill_path_count": int(row["skill_path_count"] or 0),
    }


@router.get("/", summary="API root")
async def root():
    return {
        "name": "Maxx Engage API",
        "version": "0.1.0",
        "description": "Verified Competence Engine — Engine 1 of Civilization OS",
        "docs": "/docs",
    }

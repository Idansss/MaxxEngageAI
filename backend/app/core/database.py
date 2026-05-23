"""
Async Postgres connection pool via asyncpg.
One pool per process, shared across all requests.
"""

import re
import asyncpg
from app.core.config import get_settings
from app.core.logging import logger

_pool: asyncpg.Pool | None = None


def _asyncpg_url(raw: str) -> str:
    return re.sub(r"^postgresql\+asyncpg://", "postgresql://", raw)


async def init_pool() -> None:
    global _pool
    settings = get_settings()
    if not settings.database_url:
        logger.warning("database.pool.skip", reason="DATABASE_URL not set")
        return
    _pool = await asyncpg.create_pool(
        _asyncpg_url(settings.database_url),
        ssl="require",
        min_size=1,
        max_size=10,
        command_timeout=30,
    )
    logger.info("database.pool.ready")


async def close_pool() -> None:
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
        logger.info("database.pool.closed")


def get_pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("Database pool not initialised. Call init_pool() first.")
    return _pool

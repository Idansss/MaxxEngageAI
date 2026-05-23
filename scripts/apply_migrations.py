"""
Apply all SQL migration files in supabase/migrations/ in order.
Uses the DATABASE_URL from backend/.env (Neon Postgres — direct connection).

Usage:
    cd MaxxEngageAI
    python scripts/apply_migrations.py
"""

import asyncio
import os
import re
import sys
from pathlib import Path

import asyncpg
from dotenv import load_dotenv

# Load backend env
load_dotenv(Path(__file__).parent.parent / "backend" / ".env")

MIGRATIONS_DIR = Path(__file__).parent.parent / "supabase" / "migrations"


def _asyncpg_url(raw: str) -> str:
    """Strip SQLAlchemy driver prefix so asyncpg can use the URL."""
    return re.sub(r"^postgresql\+asyncpg://", "postgresql://", raw)


async def run():
    raw_url = os.getenv("DATABASE_URL")
    if not raw_url:
        print("ERROR: DATABASE_URL not set in backend/.env", file=sys.stderr)
        sys.exit(1)

    url = _asyncpg_url(raw_url)
    print(f"Connecting to: {url.split('@')[1]}")  # hide credentials in output

    conn = await asyncpg.connect(url, ssl="require")
    print("Connected.\n")

    # Track applied migrations in a simple table
    await conn.execute("""
        CREATE TABLE IF NOT EXISTS public._migrations (
            filename TEXT PRIMARY KEY,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)

    migration_files = sorted(
        f for f in MIGRATIONS_DIR.glob("*.sql")
        if "supabase_only" not in f.name
    )
    if not migration_files:
        print("No migration files found in", MIGRATIONS_DIR)
        return

    for path in migration_files:
        filename = path.name
        already = await conn.fetchval(
            "SELECT 1 FROM public._migrations WHERE filename = $1", filename
        )
        if already:
            print(f"  SKIP  {filename} (already applied)")
            continue

        sql = path.read_text(encoding="utf-8")
        print(f"  APPLY {filename} ...", end=" ")
        try:
            await conn.execute(sql)
            await conn.execute(
                "INSERT INTO public._migrations (filename) VALUES ($1)", filename
            )
            print("OK")
        except Exception as e:
            print(f"FAILED\n  Error: {e}")
            await conn.close()
            sys.exit(1)

    await conn.close()
    print("\nAll migrations applied.")


if __name__ == "__main__":
    asyncio.run(run())

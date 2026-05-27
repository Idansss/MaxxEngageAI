"""
Phase 1 smoke checks for Maxx Engage.

This verifies that the local API, frontend, and database contain the core
assessment and credential contract needed by the public proof/verify loop.
It does not create users, submit assessments, call the AI grader, or mutate
application data.

Usage from repo root:
    python scripts/smoke_phase1.py
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import sys
from pathlib import Path
from typing import Any

import asyncpg
import httpx
from dotenv import load_dotenv


ROOT = Path(__file__).resolve().parent.parent
BACKEND_ENV = ROOT / "backend" / ".env"

BACKEND_URL = os.environ.get("BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000").rstrip("/")

REQUIRED_SKILL_PATHS = {
    "web-dev-frontend": "web-dev-html-001",
    "backend-api": "backend-api-001",
    "copywriting-en": "copy-en-001",
    "translation-yo-en": "translate-yo-en-001",
}

REQUIRED_CREDENTIAL_COLUMNS = {
    "public_id",
    "user_id",
    "rubric_id",
    "rubric_version",
    "skill_name",
    "category",
    "score",
    "max_score",
    "passed",
    "pass_threshold",
    "scores_by_category",
    "submission_hash",
    "graded_at",
    "graded_by",
    "human_reviewer_id",
    "flagged_for_review",
    "flag_reason",
    "revoked",
    "revoked_at",
    "revoked_reason",
    "public_visible",
}


class SmokeFailure(Exception):
    pass


def _asyncpg_url(raw: str) -> str:
    return re.sub(r"^postgresql\+asyncpg://", "postgresql://", raw)


def _ok(label: str) -> None:
    print(f"OK   {label}")


def _fail(label: str, detail: str) -> None:
    print(f"FAIL {label}: {detail}")


async def _check_api(client: httpx.AsyncClient) -> None:
    response = await client.get("/health")
    if response.status_code != 200:
        raise SmokeFailure(f"/health returned {response.status_code}")
    _ok("backend health endpoint")

    response = await client.get("/skill-paths")
    if response.status_code != 200:
        raise SmokeFailure(f"/skill-paths returned {response.status_code}")
    paths = response.json()
    by_slug = {item.get("slug"): item for item in paths}
    missing = [slug for slug in REQUIRED_SKILL_PATHS if slug not in by_slug]
    if missing:
        raise SmokeFailure(f"missing skill paths: {', '.join(missing)}")
    _ok("skill path API exposes all Phase 1 paths")

    for slug, rubric_id in REQUIRED_SKILL_PATHS.items():
        response = await client.get(
            "/assess/adaptive-task",
            params={"skill_path_slug": slug},
        )
        if response.status_code != 200:
            raise SmokeFailure(f"adaptive task for {slug} returned {response.status_code}")
        task = response.json()
        if task.get("rubric_id") != rubric_id:
            raise SmokeFailure(
                f"adaptive task for {slug} expected {rubric_id}, got {task.get('rubric_id')}"
            )
    _ok("adaptive task API resolves all Phase 1 rubrics")

    response = await client.get("/verify", params={"q": "cred_notreal123"})
    if response.status_code != 404:
        raise SmokeFailure(f"/verify not-found check returned {response.status_code}")
    _ok("verify API handles unknown credential IDs")


async def _check_frontend(client: httpx.AsyncClient) -> None:
    for path in ("/assess", "/verify"):
        response = await client.get(path)
        if response.status_code != 200:
            raise SmokeFailure(f"{path} returned {response.status_code}")
    _ok("frontend public assessment and verify pages load")


async def _fetch_table_columns(conn: asyncpg.Connection, table: str) -> set[str]:
    rows = await conn.fetch(
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        """,
        table,
    )
    return {row["column_name"] for row in rows}


async def _check_database(conn: asyncpg.Connection) -> None:
    path_rows = await conn.fetch(
        """
        SELECT slug
        FROM public.skill_paths
        WHERE slug = ANY($1::text[])
        """,
        list(REQUIRED_SKILL_PATHS),
    )
    path_map = {row["slug"] for row in path_rows}
    missing_paths = [slug for slug in REQUIRED_SKILL_PATHS if slug not in path_map]
    if missing_paths:
        raise SmokeFailure(f"missing DB skill paths: {', '.join(missing_paths)}")
    _ok("database contains all Phase 1 skill paths")

    task_rows = await conn.fetch(
        """
        SELECT sp.slug, t.rubric_id, COUNT(*) AS task_count
        FROM public.skill_paths sp
        JOIN public.tasks t ON t.skill_path_id = sp.id
        WHERE sp.slug = ANY($1::text[])
        GROUP BY sp.slug, t.rubric_id
        """,
        list(REQUIRED_SKILL_PATHS),
    )
    task_counts = {
        (row["slug"], row["rubric_id"]): row["task_count"]
        for row in task_rows
    }
    missing_tasks = [
        f"{slug}/{rubric_id}"
        for slug, rubric_id in REQUIRED_SKILL_PATHS.items()
        if task_counts.get((slug, rubric_id), 0) < 1
    ]
    if missing_tasks:
        raise SmokeFailure(f"missing seeded tasks: {', '.join(missing_tasks)}")
    _ok("database has seeded tasks with expected Phase 1 rubrics")

    credential_columns = await _fetch_table_columns(conn, "credentials")
    missing_columns = sorted(REQUIRED_CREDENTIAL_COLUMNS - credential_columns)
    if missing_columns:
        raise SmokeFailure(f"credentials table missing columns: {', '.join(missing_columns)}")
    _ok("credential table contains Phase 1 contract columns")

    verify_columns = await _fetch_table_columns(conn, "credential_verify_events")
    if not verify_columns:
        raise SmokeFailure("credential_verify_events table is missing")
    _ok("credential verify event table exists")

    rubric_path = ROOT / "rubrics" / "translate-yo-en-001.json"
    if not rubric_path.exists():
        raise SmokeFailure("translation rubric JSON is missing")
    rubric = json.loads(rubric_path.read_text(encoding="utf-8-sig"))
    if rubric.get("force_human_review") is not True:
        raise SmokeFailure("translation rubric must force human review")
    _ok("translation rubric requires human review")


async def main() -> int:
    load_dotenv(BACKEND_ENV)

    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        _fail("configuration", f"DATABASE_URL missing after loading {BACKEND_ENV}")
        return 1

    failures: list[str] = []

    try:
        conn = await asyncpg.connect(_asyncpg_url(database_url), ssl="require")
        try:
            await _check_database(conn)
        finally:
            await conn.close()
    except Exception as exc:  # noqa: BLE001 - this is a diagnostic script.
        failures.append(f"database: {exc}")

    async with httpx.AsyncClient(base_url=BACKEND_URL, timeout=30) as client:
        try:
            await _check_api(client)
        except Exception as exc:  # noqa: BLE001 - this is a diagnostic script.
            failures.append(f"backend API: {exc}")

    async with httpx.AsyncClient(base_url=FRONTEND_URL, timeout=30, follow_redirects=True) as client:
        try:
            await _check_frontend(client)
        except Exception as exc:  # noqa: BLE001 - this is a diagnostic script.
            failures.append(f"frontend: {exc}")

    if failures:
        print()
        for failure in failures:
            _fail("phase 1 smoke", failure)
        return 1

    print()
    print("Phase 1 smoke checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))

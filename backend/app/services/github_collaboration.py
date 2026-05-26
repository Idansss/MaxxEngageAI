"""Public GitHub collaboration surface for the Maxx Engage repo."""

from __future__ import annotations

import httpx

from app.core.config import get_settings
from app.core.logging import logger


def _headers() -> dict[str, str]:
    settings = get_settings()
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "MaxxEngageAI/0.1",
    }
    if settings.github_token:
        headers["Authorization"] = f"Bearer {settings.github_token}"
    return headers


async def get_public_repo_status() -> dict:
    settings = get_settings()
    owner = settings.github_repo_owner
    repo = settings.github_repo_name
    base = f"https://api.github.com/repos/{owner}/{repo}"

    async with httpx.AsyncClient(timeout=httpx.Timeout(10.0, connect=5.0), headers=_headers()) as client:
        repo_data = await _get(client, base)
        issues_data = await _get(
            client,
            f"{base}/issues",
            params={
                "state": "open",
                "per_page": 10,
                "labels": "",
                "sort": "created",
                "direction": "asc",
            },
        )

    issues = [
        {
            "number": issue.get("number"),
            "title": issue.get("title"),
            "url": issue.get("html_url"),
            "labels": [label.get("name") for label in issue.get("labels", [])],
            "created_at": issue.get("created_at"),
        }
        for issue in issues_data
        if "pull_request" not in issue
    ]

    return {
        "repo": {
            "name": repo_data.get("full_name", f"{owner}/{repo}"),
            "url": repo_data.get("html_url", settings.public_github_url),
            "description": repo_data.get("description"),
            "stars": repo_data.get("stargazers_count", 0),
            "forks": repo_data.get("forks_count", 0),
            "open_issues": repo_data.get("open_issues_count", 0),
            "license": (repo_data.get("license") or {}).get("spdx_id"),
            "default_branch": repo_data.get("default_branch"),
        },
        "issues": issues,
        "docs": [
            {"title": "Manifesto", "url": f"{settings.public_github_url}/blob/main/MANIFESTO.md"},
            {"title": "Technical spec", "url": f"{settings.public_github_url}/blob/main/docs/TECHNICAL_SPEC.md"},
            {"title": "Contributing", "url": f"{settings.public_github_url}/blob/main/CONTRIBUTING.md"},
            {"title": "Reviewer training", "url": f"{settings.public_github_url}/blob/main/docs/REVIEWER_TRAINING.md"},
        ],
        "community": {
            "discord_invite_url": settings.discord_invite_url,
            "github_url": settings.public_github_url,
        },
    }


async def _get(client: httpx.AsyncClient, url: str, params: dict | None = None):
    try:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        return resp.json()
    except Exception as exc:
        logger.warning("github_collaboration.fetch_failed", url=url, error=str(exc))
        return [] if url.endswith("/issues") else {}

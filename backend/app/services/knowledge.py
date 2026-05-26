"""
Trusted public knowledge retrieval for grading context.

This is intentionally small and source-limited: Wikipedia summaries and
Wikidata entity matches only. It is not a general web scraper.
"""

from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import quote

import httpx

from app.core.config import get_settings
from app.core.logging import logger


@dataclass
class KnowledgeSource:
    title: str
    url: str
    source_type: str
    summary: str

    def as_dict(self) -> dict:
        return {
            "title": self.title,
            "url": self.url,
            "source_type": self.source_type,
            "summary": self.summary,
        }


SKILL_QUERY_HINTS = {
    "web-dev-frontend": [
        "HTML",
        "Cascading Style Sheets",
        "JavaScript",
        "Web accessibility",
    ],
}


def build_knowledge_query(skill_path_slug: str, rubric: dict, content: str) -> str:
    dimensions = [
        str(d.get("name") or d.get("dimension") or "")
        for d in rubric.get("dimensions", [])
        if isinstance(d, dict)
    ]
    hints = SKILL_QUERY_HINTS.get(skill_path_slug, [])
    terms = [*hints[:3], *dimensions[:2]]
    if not terms:
        terms = [skill_path_slug.replace("-", " ")]
    if "accessibility" in content.lower() and "Web accessibility" not in terms:
        terms.append("Web accessibility")
    return " ".join(t for t in terms if t).strip()


async def retrieve_public_knowledge(
    skill_path_slug: str,
    rubric: dict,
    content: str,
) -> list[KnowledgeSource]:
    settings = get_settings()
    if not settings.knowledge_retrieval_enabled:
        return []

    query = build_knowledge_query(skill_path_slug, rubric, content)
    if not query:
        return []

    sources: list[KnowledgeSource] = []
    timeout = httpx.Timeout(8.0, connect=4.0)
    headers = {"User-Agent": "MaxxEngageAI/0.1 (public-benefit competence assessment)"}

    async with httpx.AsyncClient(timeout=timeout, headers=headers) as client:
        try:
            search = await client.get(
                settings.wikipedia_action_api_url,
                params={
                    "action": "opensearch",
                    "search": query,
                    "limit": min(settings.knowledge_max_sources, 3),
                    "namespace": 0,
                    "format": "json",
                },
            )
            search.raise_for_status()
            data = search.json()
            titles = data[1] if len(data) > 1 else []
            links = data[3] if len(data) > 3 else []
            for idx, title in enumerate(titles[: settings.knowledge_max_sources]):
                summary = await _wikipedia_summary(client, title)
                if summary:
                    sources.append(
                        KnowledgeSource(
                            title=title,
                            url=links[idx] if idx < len(links) else f"https://en.wikipedia.org/wiki/{quote(title)}",
                            source_type="wikipedia",
                            summary=summary,
                        )
                    )
        except Exception as exc:
            logger.warning("knowledge.wikipedia_failed", error=str(exc), query=query)

        remaining = settings.knowledge_max_sources - len(sources)
        if remaining > 0:
            try:
                wikidata = await client.get(
                    settings.wikidata_api_url,
                    params={
                        "action": "wbsearchentities",
                        "search": query,
                        "language": "en",
                        "limit": remaining,
                        "format": "json",
                    },
                )
                wikidata.raise_for_status()
                for entity in wikidata.json().get("search", [])[:remaining]:
                    entity_id = entity.get("id")
                    label = entity.get("label")
                    description = entity.get("description")
                    if entity_id and label and description:
                        sources.append(
                            KnowledgeSource(
                                title=label,
                                url=f"https://www.wikidata.org/wiki/{entity_id}",
                                source_type="wikidata",
                                summary=description,
                            )
                        )
            except Exception as exc:
                logger.warning("knowledge.wikidata_failed", error=str(exc), query=query)

    return sources[: settings.knowledge_max_sources]


async def _wikipedia_summary(client: httpx.AsyncClient, title: str) -> str:
    settings = get_settings()
    resp = await client.get(f"{settings.wikipedia_api_url}/page/summary/{quote(title)}")
    resp.raise_for_status()
    data = resp.json()
    return str(data.get("extract") or "")[:700]


def format_knowledge_context(sources: list[KnowledgeSource]) -> str:
    if not sources:
        return ""
    lines = [
        "## Trusted Public Knowledge Context",
        "Use only as background calibration. Do not reward or punish the submission for facts not required by the rubric.",
    ]
    for idx, source in enumerate(sources, start=1):
        lines.append(
            f"{idx}. [{source.source_type}] {source.title}: {source.summary} ({source.url})"
        )
    return "\n".join(lines)

"""
LangSmith tracing helpers for model and agent-like calls.

This is intentionally optional: missing SDKs or missing env vars never block
grading. When LANGSMITH_TRACING=true and LANGSMITH_API_KEY is set, each grading
call creates a run that records sanitized inputs, model metadata, outputs, and
errors.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from app.core.config import get_settings
from app.core.logging import logger


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _truncate(value: str, limit: int = 4000) -> str:
    return value if len(value) <= limit else value[:limit] + "...[truncated]"


@dataclass
class LangSmithRun:
    run_id: uuid.UUID | None
    client: Any | None
    enabled: bool

    def finish(self, *, outputs: dict[str, Any] | None = None, error: str | None = None) -> None:
        if not self.enabled or not self.client or not self.run_id:
            return
        try:
            self.client.update_run(
                self.run_id,
                outputs=outputs,
                error=error,
                end_time=_now(),
            )
        except Exception as exc:
            logger.warning("langsmith.finish_failed", error=str(exc))


def start_langsmith_run(
    *,
    name: str,
    run_type: str,
    inputs: dict[str, Any],
    metadata: dict[str, Any] | None = None,
) -> LangSmithRun:
    settings = get_settings()
    if not settings.langsmith_tracing or not settings.langsmith_api_key:
        return LangSmithRun(run_id=None, client=None, enabled=False)

    try:
        from langsmith import Client
    except Exception as exc:
        logger.warning("langsmith.unavailable", error=str(exc))
        return LangSmithRun(run_id=None, client=None, enabled=False)

    run_id = uuid.uuid4()
    client = Client(api_key=settings.langsmith_api_key)
    try:
        client.create_run(
            id=run_id,
            name=name,
            run_type=run_type,
            project_name=settings.langsmith_project,
            inputs={k: _truncate(str(v)) for k, v in inputs.items()},
            start_time=_now(),
            extra={"metadata": metadata or {}},
        )
        logger.info("langsmith.run_started", run_id=str(run_id), name=name)
        return LangSmithRun(run_id=run_id, client=client, enabled=True)
    except Exception as exc:
        logger.warning("langsmith.start_failed", error=str(exc))
        return LangSmithRun(run_id=None, client=None, enabled=False)

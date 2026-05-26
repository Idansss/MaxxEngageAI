"""
Append-only audit logging.

Audit writes are best-effort so a logging outage never prevents the user action,
but the database migration prevents UPDATE/DELETE on stored audit events.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any

from app.core.database import get_pool
from app.core.logging import logger


def _canonical(data: dict[str, Any]) -> str:
    return json.dumps(data, sort_keys=True, separators=(",", ":"), default=str)


async def append_audit_log(
    *,
    action: str,
    entity_type: str,
    entity_id: str | None,
    actor_type: str = "system",
    actor_id: str | None = None,
    old_values: dict[str, Any] | None = None,
    new_values: dict[str, Any] | None = None,
    metadata: dict[str, Any] | None = None,
    request_id: str | None = None,
) -> str | None:
    try:
        pool = get_pool()
    except RuntimeError:
        logger.info("audit.skip", reason="db pool not initialised", action=action)
        return None

    try:
        async with pool.acquire() as conn:
            async with conn.transaction():
                await conn.execute("SELECT pg_advisory_xact_lock(hashtext('proofos_audit_log'))")
                previous_hash = await conn.fetchval(
                    "SELECT event_hash FROM public.audit_log ORDER BY created_at DESC, id DESC LIMIT 1"
                )
                payload = {
                    "action": action,
                    "entity_type": entity_type,
                    "entity_id": entity_id,
                    "actor_type": actor_type,
                    "actor_id": actor_id,
                    "old_values": old_values or {},
                    "new_values": new_values or {},
                    "metadata": metadata or {},
                    "previous_event_hash": previous_hash,
                }
                event_hash = hashlib.sha256(_canonical(payload).encode("utf-8")).hexdigest()
                row = await conn.fetchrow(
                    """
                    INSERT INTO public.audit_log (
                        actor_type, actor_id, action, entity_type, entity_id,
                        old_values, new_values, metadata, request_id,
                        previous_event_hash, event_hash
                    )
                    VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9, $10, $11)
                    RETURNING id
                    """,
                    actor_type,
                    actor_id,
                    action,
                    entity_type,
                    entity_id,
                    json.dumps(old_values or {}),
                    json.dumps(new_values or {}),
                    json.dumps(metadata or {}),
                    request_id,
                    previous_hash,
                    event_hash,
                )
        audit_id = str(row["id"])
        logger.info("audit.appended", audit_id=audit_id, action=action)
        return audit_id
    except Exception as exc:
        logger.warning("audit.append_failed", action=action, error=str(exc))
        return None

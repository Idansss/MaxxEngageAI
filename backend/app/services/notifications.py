import json
from app.core.database import get_pool
from app.core.logging import logger


async def push(
    user_id: str,
    type: str,
    title: str,
    body: str | None = None,
    href: str | None = None,
    metadata: dict | None = None,
) -> None:
    """Insert a notification for a user. Fire-and-forget safe."""
    try:
        pool = get_pool()
        await pool.execute(
            """
            INSERT INTO public.notifications (user_id, type, title, body, href, metadata)
            VALUES ($1::uuid, $2::public.notification_type, $3, $4, $5, $6::jsonb)
            """,
            user_id,
            type,
            title,
            body,
            href,
            json.dumps(metadata) if metadata else None,
        )
    except Exception as exc:
        logger.warning("notifications.push_failed", user_id=user_id, type=type, error=str(exc))

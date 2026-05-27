import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from app.core.database import get_pool
from app.api.deps import get_admin_user, get_current_user
from app.core.config import get_settings
from app.core.logging import logger

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _row_to_dict(r) -> dict:
    return {
        "id": str(r["id"]),
        "type": r["type"],
        "title": r["title"],
        "body": r["body"],
        "href": r["href"],
        "is_read": r["is_read"],
        "created_at": r["created_at"].isoformat(),
        "metadata": r["metadata"],
    }


@router.get("/me", summary="List current user's notifications")
async def list_notifications(
    limit: int = Query(20, ge=1, le=50),
    auth_user: dict = Depends(get_current_user),
):
    pool = get_pool()
    user_row = await pool.fetchrow(
        "SELECT id FROM public.users WHERE auth_id = $1::uuid", auth_user["id"]
    )
    if not user_row:
        raise HTTPException(status_code=404, detail="User profile not found.")

    user_id = str(user_row["id"])

    rows = await pool.fetch(
        """
        SELECT id, type, title, body, href, is_read, created_at, metadata
        FROM public.notifications
        WHERE user_id = $1::uuid
        ORDER BY is_read ASC, created_at DESC
        LIMIT $2
        """,
        user_id,
        limit,
    )

    unread_count = await pool.fetchval(
        "SELECT COUNT(*) FROM public.notifications WHERE user_id = $1::uuid AND is_read = false",
        user_id,
    )

    return {
        "unread_count": int(unread_count or 0),
        "items": [_row_to_dict(r) for r in rows],
    }


@router.patch("/{notification_id}/read", summary="Mark a notification as read")
async def mark_read(
    notification_id: str,
    auth_user: dict = Depends(get_current_user),
):
    try:
        uuid.UUID(notification_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="notification_id must be a valid UUID.")

    pool = get_pool()
    user_row = await pool.fetchrow(
        "SELECT id FROM public.users WHERE auth_id = $1::uuid", auth_user["id"]
    )
    if not user_row:
        raise HTTPException(status_code=404, detail="User profile not found.")

    result = await pool.execute(
        """
        UPDATE public.notifications
        SET is_read = true
        WHERE id = $1::uuid AND user_id = $2::uuid
        """,
        notification_id,
        str(user_row["id"]),
    )
    if result == "UPDATE 0":
        raise HTTPException(status_code=404, detail="Notification not found.")

    return {"ok": True}


@router.post("/me/read-all", summary="Mark all notifications as read")
async def mark_all_read(auth_user: dict = Depends(get_current_user)):
    pool = get_pool()
    user_row = await pool.fetchrow(
        "SELECT id FROM public.users WHERE auth_id = $1::uuid", auth_user["id"]
    )
    if not user_row:
        raise HTTPException(status_code=404, detail="User profile not found.")

    await pool.execute(
        "UPDATE public.notifications SET is_read = true WHERE user_id = $1::uuid AND is_read = false",
        str(user_row["id"]),
    )

    return {"ok": True}


# ── POST /notifications/send-decay-reminders (admin) ─────────────────────────

@router.post(
    "/send-decay-reminders",
    summary="Send decay reminder emails to all users with overdue credentials (admin)",
)
async def send_decay_reminders(
    dry_run: bool = Query(False, description="Preview without sending"),
    _admin: dict = Depends(get_admin_user),
):
    """
    Finds every user who has at least one credential past its decay_refresh_months
    window, then sends them a single digest email listing all overdue credentials.

    Tip: call this from a cron job once per week.
    Set dry_run=true to see who would be emailed without actually sending.
    """
    pool = get_pool()
    settings = get_settings()

    rows = await pool.fetch(
        """
        SELECT
            u.id           AS user_id,
            u.auth_id,
            u.display_name,
            ARRAY_AGG(sp.name ORDER BY sp.name) AS skill_names
        FROM public.credentials c
        JOIN public.users       u  ON u.id  = c.user_id
        JOIN public.skill_paths sp ON sp.id = c.skill_path_id
        WHERE c.revoked = false
          AND sp.decay_refresh_months IS NOT NULL
          AND c.valid_from < NOW() - (sp.decay_refresh_months * INTERVAL '1 month')
        GROUP BY u.id, u.auth_id, u.display_name
        ORDER BY u.display_name
        """
    )

    if not rows:
        return {"sent": 0, "skipped": 0, "dry_run": dry_run, "total_users": 0}

    from app.services.email import get_email_by_auth_id, send_decay_reminder

    sent = 0
    skipped = 0

    for row in rows:
        auth_id = str(row["auth_id"]) if row["auth_id"] else None
        if not auth_id:
            skipped += 1
            continue

        email = await get_email_by_auth_id(auth_id)
        if not email:
            skipped += 1
            continue

        skill_names: list[str] = list(row["skill_names"]) if row["skill_names"] else []
        if not dry_run:
            ok = await send_decay_reminder(
                to=email,
                display_name=row["display_name"] or "Learner",
                overdue_skill_names=skill_names,
                site_url=settings.site_url,
            )
            if ok:
                sent += 1
                logger.info("decay_reminder.sent", user_id=str(row["user_id"]), skills=skill_names)
            else:
                skipped += 1
        else:
            logger.info("decay_reminder.dry_run", user_id=str(row["user_id"]), email=email, skills=skill_names)
            sent += 1

    return {"sent": sent, "skipped": skipped, "dry_run": dry_run, "total_users": len(rows)}

import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from app.api.deps import get_current_user
from app.core.database import get_pool
from app.core.logging import logger
from app.services.audit import append_audit_log

router = APIRouter(prefix="/submissions", tags=["submissions"])

_APPEALABLE = {"ai_reviewed", "pending_human_review"}


@router.get("/my", summary="List the authenticated user's submission history")
async def my_submissions(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    auth_user: dict = Depends(get_current_user),
):
    """
    Returns the authenticated user's submission history, newest first.
    Each row includes the task prompt title, skill path name, score, and status.
    """
    pool = get_pool()
    user_row = await pool.fetchrow(
        "SELECT id FROM public.users WHERE auth_id = $1::uuid", auth_user["id"]
    )
    if not user_row:
        raise HTTPException(status_code=404, detail="User profile not found.")
    user_id = str(user_row["id"])

    rows = await pool.fetch(
        """
        SELECT
            s.id,
            s.status,
            s.submitted_at,
            s.attempt_number,
            t.level,
            t.type   AS task_type,
            t.prompt AS task_prompt,
            sp.name  AS skill_path_name,
            sp.slug  AS skill_path_slug,
            sp.domain,
            r.overall_score,
            r.confidence,
            r.credential_eligible,
            r.human_review_requested,
            r.id     AS review_id,
            COALESCE(c.public_id, c.id::text) AS credential_id
        FROM public.submissions s
        JOIN public.tasks t          ON t.id = s.task_id
        JOIN public.skill_paths sp   ON sp.id = t.skill_path_id
        LEFT JOIN public.reviews r   ON r.id = s.review_id
        LEFT JOIN public.credentials c ON c.submission_id = s.id
        WHERE s.user_id = $1::uuid
        ORDER BY s.submitted_at DESC
        LIMIT $2 OFFSET $3
        """,
        user_id, limit, offset,
    )

    total = await pool.fetchval(
        "SELECT COUNT(*) FROM public.submissions WHERE user_id = $1::uuid", user_id
    )

    items = []
    for r in rows:
        prompt = r["task_prompt"] or {}
        title = prompt.get("title") or prompt.get("text", "")[:80] if isinstance(prompt, dict) else ""
        items.append({
            "id": str(r["id"]),
            "status": r["status"],
            "submitted_at": r["submitted_at"].isoformat(),
            "attempt_number": r["attempt_number"],
            "level": r["level"],
            "task_type": r["task_type"],
            "task_title": title,
            "skill_path_name": r["skill_path_name"],
            "skill_path_slug": r["skill_path_slug"],
            "domain": r["domain"],
            "score": float(r["overall_score"]) if r["overall_score"] is not None else None,
            "confidence": float(r["confidence"]) if r["confidence"] is not None else None,
            "credential_eligible": r["credential_eligible"],
            "human_review_requested": r["human_review_requested"],
            "review_id": str(r["review_id"]) if r["review_id"] else None,
            "credential_id": str(r["credential_id"]) if r["credential_id"] else None,
        })

    return {"total": total, "items": items}


class AppealRequest(BaseModel):
    reason: str = Field(..., min_length=20, max_length=500,
                        description="Why do you believe this score is incorrect?")


@router.post("/{submission_id}/appeal", summary="Appeal an AI score")
async def appeal_submission(
    submission_id: str,
    body: AppealRequest,
    auth_user: dict = Depends(get_current_user),
):
    try:
        uuid.UUID(submission_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="submission_id must be a valid UUID.")

    pool = get_pool()

    # Resolve Supabase auth_id → app user id
    user_row = await pool.fetchrow(
        "SELECT id FROM public.users WHERE auth_id = $1::uuid", auth_user["id"]
    )
    if not user_row:
        raise HTTPException(status_code=404, detail="User profile not found.")
    app_user_id = str(user_row["id"])

    # Fetch the submission + its review
    row = await pool.fetchrow(
        """
        SELECT s.id, s.user_id, s.status, r.id AS review_id,
               r.human_review_requested, r.credential_eligible, r.overall_score
        FROM public.submissions s
        JOIN public.reviews r ON r.id = s.review_id
        WHERE s.id = $1::uuid
        """,
        submission_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Submission not found.")

    if str(row["user_id"]) != app_user_id:
        raise HTTPException(status_code=403, detail="This submission does not belong to you.")

    if row["status"] == "appealed":
        raise HTTPException(status_code=409, detail="This submission has already been appealed.")

    if row["status"] not in _APPEALABLE:
        raise HTTPException(
            status_code=409,
            detail=f"Submissions with status '{row['status']}' cannot be appealed.",
        )

    review_id = str(row["review_id"])
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE public.submissions SET status = 'appealed' WHERE id = $1::uuid",
            submission_id,
        )
        await conn.execute(
            """
            UPDATE public.reviews
            SET appeal_reason = $1,
                human_review_requested = true
            WHERE id = $2::uuid
            """,
            body.reason,
            review_id,
        )

    logger.info("appeal.submitted", submission_id=submission_id, user_id=app_user_id)
    await append_audit_log(
        action="review.appealed",
        actor_type="user",
        actor_id=app_user_id,
        entity_type="review",
        entity_id=review_id,
        old_values={
            "submission_status": row["status"],
            "human_review_requested": row["human_review_requested"],
            "credential_eligible": row["credential_eligible"],
            "overall_score": float(row["overall_score"]) if row["overall_score"] is not None else None,
        },
        new_values={
            "submission_status": "appealed",
            "human_review_requested": True,
        },
        metadata={"submission_id": submission_id, "reason_length": len(body.reason)},
    )

    import asyncio
    from app.services import webhook as wh
    asyncio.ensure_future(wh.on_appeal_received(
        submission_id=submission_id,
        review_id=review_id,
        reason=body.reason,
    ))

    return {"ok": True, "submission_id": submission_id, "status": "appealed"}

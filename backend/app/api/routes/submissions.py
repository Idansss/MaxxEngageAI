import uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from app.api.deps import get_current_user
from app.core.database import get_pool
from app.core.logging import logger

router = APIRouter(prefix="/submissions", tags=["submissions"])

_APPEALABLE = {"ai_reviewed", "pending_human_review"}


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

    # Resolve Supabase auth_id → ProofOS user id
    user_row = await pool.fetchrow(
        "SELECT id FROM public.users WHERE auth_id = $1::uuid", auth_user["id"]
    )
    if not user_row:
        raise HTTPException(status_code=404, detail="User profile not found.")
    proofos_user_id = str(user_row["id"])

    # Fetch the submission + its review
    row = await pool.fetchrow(
        """
        SELECT s.id, s.user_id, s.status, r.id AS review_id
        FROM public.submissions s
        JOIN public.reviews r ON r.id = s.review_id
        WHERE s.id = $1::uuid
        """,
        submission_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Submission not found.")

    if str(row["user_id"]) != proofos_user_id:
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

    logger.info("appeal.submitted", submission_id=submission_id, user_id=proofos_user_id)
    return {"ok": True, "submission_id": submission_id, "status": "appealed"}

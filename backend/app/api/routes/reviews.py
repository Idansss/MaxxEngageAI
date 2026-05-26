import uuid
from fastapi import APIRouter, Depends, HTTPException
from app.api.deps import get_current_user
from app.core.database import get_pool

router = APIRouter(prefix="/reviews", tags=["reviews"])


@router.get("/{review_id}", summary="Get a full review including per-dimension scores and AI feedback")
async def get_review(
    review_id: str,
    auth_user: dict = Depends(get_current_user),
):
    """
    Returns the complete review record for a submission the authenticated user owns.
    Includes per-dimension scores with rationale and evidence quotes, plus the full
    AI feedback block (summary, strengths, improvements, next steps).
    """
    try:
        uuid.UUID(review_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="review_id must be a valid UUID.")

    pool = get_pool()

    user_row = await pool.fetchrow(
        "SELECT id FROM public.users WHERE auth_id = $1::uuid", auth_user["id"]
    )
    if not user_row:
        raise HTTPException(status_code=404, detail="User profile not found.")
    user_id = str(user_row["id"])

    row = await pool.fetchrow(
        """
        SELECT
            r.id,
            r.rubric_id,
            r.reviewer_type,
            r.reviewer_id,
            r.scores,
            r.overall_score,
            r.confidence,
            r.feedback,
            r.reviewed_at,
            r.credential_eligible,
            r.human_review_requested,
            r.model_version,
            s.status        AS submission_status,
            s.attempt_number,
            sp.name         AS skill_path_name,
            sp.slug         AS skill_path_slug,
            t.level
        FROM public.reviews r
        JOIN public.submissions s  ON s.review_id = r.id
        JOIN public.tasks t        ON t.id = s.task_id
        JOIN public.skill_paths sp ON sp.id = t.skill_path_id
        WHERE r.id = $1::uuid
          AND s.user_id = $2::uuid
        """,
        review_id,
        user_id,
    )

    if not row:
        raise HTTPException(status_code=404, detail="Review not found or does not belong to you.")

    scores = row["scores"]
    feedback = row["feedback"]
    if isinstance(scores, str):
        import json
        scores = json.loads(scores)
    if isinstance(feedback, str):
        import json
        feedback = json.loads(feedback)

    return {
        "id": str(row["id"]),
        "rubric_id": row["rubric_id"],
        "reviewer_type": row["reviewer_type"],
        "model_version": row["model_version"],
        "overall_score": float(row["overall_score"]),
        "confidence": float(row["confidence"]) if row["confidence"] is not None else None,
        "scores": scores,
        "feedback": feedback,
        "reviewed_at": row["reviewed_at"].isoformat(),
        "credential_eligible": row["credential_eligible"],
        "human_review_requested": row["human_review_requested"],
        "submission_status": row["submission_status"],
        "attempt_number": row["attempt_number"],
        "skill_path_name": row["skill_path_name"],
        "skill_path_slug": row["skill_path_slug"],
        "level": row["level"],
    }

"""
Persist graded submissions and reviews to Neon Postgres.
Persistence is best-effort — failures are logged but never bubble up to the caller.
"""

import json
import uuid

from app.core.database import get_pool
from app.core.logging import logger
from app.models.assess import AssessRequest, AssessResponse
from app.services.audit import append_audit_log
from app.services.credentials import issue_credential


def _is_valid_uuid(val: str | None) -> bool:
    if not val:
        return False
    try:
        uuid.UUID(val)
        return True
    except ValueError:
        return False


async def persist_assessment(
    request: AssessRequest,
    response: AssessResponse,
) -> tuple[str | None, str | None]:
    """
    Write submission + AI review to the DB, then issue a credential if eligible.

    Returns (submission_id, credential_id). Both are None when skipped or on error.
    Skipped when user_id is absent (anonymous diagnostic) or task_id is not
    a real UUID (e.g. eval fixture strings like 'task-001').
    """
    if not _is_valid_uuid(request.user_id):
        logger.info("persistence.skip", reason="no user_id (anonymous submission)")
        return None, None

    if not _is_valid_uuid(request.task_id):
        logger.info(
            "persistence.skip",
            reason="task_id is not a UUID",
            task_id=request.task_id,
        )
        return None, None

    try:
        pool = get_pool()
    except RuntimeError:
        logger.warning("persistence.skip", reason="db pool not initialised")
        return None, None

    submission_id = str(uuid.uuid4())
    review_id = response.review_id

    content_json = json.dumps({"type": request.submission_type, "body": request.content})
    scores_json = json.dumps([s.model_dump() for s in response.scores])
    feedback_json = json.dumps(response.feedback.model_dump())

    log = logger.bind(
        submission_id=submission_id,
        review_id=review_id,
        user_id=request.user_id,
        task_id=request.task_id,
    )

    try:
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO public.submissions
                    (id, user_id, task_id, content, status, attempt_number)
                VALUES ($1::uuid, $2::uuid, $3::uuid, $4::jsonb, 'ai_reviewed', 1)
                """,
                submission_id,
                request.user_id,
                request.task_id,
                content_json,
            )

            await conn.execute(
                """
                INSERT INTO public.reviews
                    (id, submission_id, reviewer_type, reviewer_id, rubric_id,
                     scores, overall_score, confidence, feedback,
                     credential_eligible, human_review_requested,
                     model_version, prompt_hash)
                VALUES
                    ($1::uuid, $2::uuid, 'ai', $3, $4,
                     $5::jsonb, $6, $7, $8::jsonb,
                     $9, $10, $11, $12)
                """,
                review_id,
                submission_id,
                response.model_used,
                request.rubric_id,
                scores_json,
                response.overall_score,
                response.confidence,
                feedback_json,
                response.credential_eligible,
                response.human_review_requested,
                response.model_used,
                response.prompt_hash,
            )

            await conn.execute(
                "UPDATE public.submissions SET review_id = $1::uuid WHERE id = $2::uuid",
                review_id,
                submission_id,
            )

        log.info(
            "persistence.saved",
            overall_score=response.overall_score,
            credential_eligible=response.credential_eligible,
        )
        await append_audit_log(
            action="review.ai_created",
            actor_type="ai",
            actor_id=response.model_used,
            entity_type="review",
            entity_id=review_id,
            new_values={
                "submission_id": submission_id,
                "user_id": request.user_id,
                "overall_score": response.overall_score,
                "confidence": response.confidence,
                "credential_eligible": response.credential_eligible,
                "human_review_requested": response.human_review_requested,
                "model_version": response.model_used,
                "prompt_hash": response.prompt_hash,
                "secondary_model_used": response.secondary_model_used,
                "secondary_overall_score": response.secondary_overall_score,
                "model_disagreement": response.model_disagreement,
                "model_disagreement_reason": response.model_disagreement_reason,
            },
            metadata={
                "task_id": request.task_id,
                "rubric_id": request.rubric_id,
                "skill_path_slug": request.skill_path_slug,
                "level": request.level,
            },
        )

        credential_id: str | None = None
        if response.credential_eligible:
            credential_id = await issue_credential(request, response, submission_id)

        return submission_id, credential_id

    except Exception as e:
        log.error("persistence.error", error=str(e))
        return None, None

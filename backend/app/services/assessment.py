import asyncio

from app.core.logging import logger
from app.models.assess import AssessRequest, AssessResponse
from app.services.audit import append_audit_log
from app.services.grading import grade_submission
from app.services.persistence import persist_assessment
from app.services.safety import apply_safety_result, run_safety_checks


async def fetch_prior_scores(user_id: str, skill_path_slug: str) -> list[float]:
    """Retrieve the user's recent scores for this skill path, oldest to newest."""
    from app.core.database import get_pool

    try:
        pool = get_pool()
    except RuntimeError:
        return []
    try:
        rows = await pool.fetch(
            """
            SELECT r.overall_score
            FROM public.reviews r
            JOIN public.submissions s ON s.review_id = r.id
            JOIN public.tasks t ON t.id = s.task_id
            JOIN public.skill_paths sp ON sp.id = t.skill_path_id
            WHERE s.user_id = $1::uuid AND sp.slug = $2
            ORDER BY r.reviewed_at ASC
            LIMIT 5
            """,
            user_id,
            skill_path_slug,
        )
        return [float(r["overall_score"]) for r in rows]
    except Exception:
        return []


async def run_assessment(request: AssessRequest) -> AssessResponse:
    prior_scores: list[float] = []
    if request.user_id:
        prior_scores = await fetch_prior_scores(request.user_id, request.skill_path_slug)

    safety = run_safety_checks(request)
    if safety.enabled and (safety.adversarial_flags or safety.protected_class_flags):
        logger.warning(
            "assess.safety_flags",
            severity=safety.severity,
            adversarial_flags=safety.adversarial_flags,
            protected_class_flags=safety.protected_class_flags,
            force_human_review=safety.force_human_review,
        )

    response = await grade_submission(request, prior_scores=prior_scores)
    response = apply_safety_result(response, safety)
    submission_id, credential_id = await persist_assessment(request, response)
    response.submission_id = submission_id
    response.credential_id = credential_id

    if safety.enabled and (safety.adversarial_flags or safety.protected_class_flags):
        await append_audit_log(
            action="assessment.safety_check",
            actor_type="system",
            actor_id=request.user_id,
            entity_type="review",
            entity_id=response.review_id,
            new_values={
                "human_review_requested": response.human_review_requested,
                "credential_eligible": response.credential_eligible,
            },
            metadata={
                **safety.model_dump(),
                "submission_id": submission_id,
                "skill_path_slug": request.skill_path_slug,
                "rubric_id": request.rubric_id,
            },
        )

    if response.human_review_requested and submission_id and request.user_id:
        from app.services import webhook as wh
        from app.api.routes.peer_review import enqueue_peer_review

        asyncio.ensure_future(
            wh.on_human_review_queued(
                submission_id=submission_id,
                review_id=response.review_id,
                skill_path=request.skill_path_slug,
                score=response.overall_score,
                confidence=response.confidence,
            )
        )
        asyncio.ensure_future(
            enqueue_peer_review(
                user_id=request.user_id,
                submission_id=submission_id,
                review_id=response.review_id,
                skill_path_slug=request.skill_path_slug,
                rubric_id=request.rubric_id,
                ai_score=response.overall_score,
            )
        )

    if credential_id:
        from app.services import webhook as wh

        asyncio.ensure_future(
            wh.on_credential_issued(
                credential_id=credential_id,
                user_did=request.user_id or "anonymous",
                skill_path=request.skill_path_slug,
                level=request.level,
                score=response.overall_score,
            )
        )

    return response

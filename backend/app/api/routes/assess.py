import json
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request

from app.api.deps import get_current_user
from app.core.limiter import limiter
from app.core.logging import logger
from app.models.assess import AssessRequest, AssessResponse, AssessmentJobResponse
from app.services.assessment import run_assessment
from app.services.assessment_jobs import (
    create_assessment_job,
    get_assessment_job,
    process_assessment_job,
)

router = APIRouter(prefix="/assess", tags=["assessment"])

_ASSESS_LIMIT = "10/5minute"


async def _profile_id_for_auth(auth_user: dict) -> str:
    from app.core.database import get_pool

    pool = get_pool()
    row = await pool.fetchrow(
        "SELECT id FROM public.users WHERE auth_id = $1::uuid",
        auth_user["id"],
    )
    if not row:
        raise HTTPException(status_code=404, detail="User profile not found.")
    return str(row["id"])


@router.post("", response_model=AssessResponse, summary="Grade a submission against a rubric")
@limiter.limit(_ASSESS_LIMIT)
async def assess(request: Request, payload: AssessRequest) -> AssessResponse:
    """
    Synchronous grading endpoint retained for calibration and internal tooling.
    The browser UI should use POST /assess/jobs to avoid HTTP request timeouts.
    """
    try:
        return await run_assessment(payload)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        logger.error("assess.grading_error", error=str(e))
        raise HTTPException(
            status_code=502,
            detail="Grading model returned an unexpected response. Try again.",
        )
    except Exception as e:
        logger.error("assess.unexpected_error", error=str(e))
        raise HTTPException(status_code=500, detail="Internal grading error.")


@router.post("/jobs", response_model=AssessmentJobResponse, summary="Queue an assessment for async grading")
@limiter.limit(_ASSESS_LIMIT)
async def queue_assessment(
    request: Request,
    payload: AssessRequest,
    background_tasks: BackgroundTasks,
    auth_user: dict = Depends(get_current_user),
) -> AssessmentJobResponse:
    profile_id = await _profile_id_for_auth(auth_user)
    payload.user_id = profile_id
    try:
        job = await create_assessment_job(payload)
    except Exception as e:
        logger.error("assessment_job.create_failed", error=str(e))
        raise HTTPException(status_code=500, detail="Could not queue assessment.")
    background_tasks.add_task(process_assessment_job, job.id)
    return job


@router.get("/jobs/{job_id}", response_model=AssessmentJobResponse, summary="Get an assessment job")
async def get_assessment_job_status(
    job_id: str,
    auth_user: dict = Depends(get_current_user),
) -> AssessmentJobResponse:
    try:
        uuid.UUID(job_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="job_id must be a valid UUID.")

    profile_id = await _profile_id_for_auth(auth_user)
    job = await get_assessment_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Assessment job not found.")
    if job.request and job.request.get("user_id") != profile_id:
        raise HTTPException(status_code=403, detail="This job does not belong to you.")
    return job


@router.get("/adaptive-task", summary="Get the right assessment level and task based on prior performance")
async def adaptive_task(
    skill_path_slug: str = Query(..., description="Skill path slug, e.g. 'web-dev-frontend'"),
    user_id: str | None = Query(None, description="User UUID; omit for anonymous -> always Level 1"),
):
    from app.core.database import get_pool

    pool = get_pool()

    sp_row = await pool.fetchrow(
        "SELECT id, levels FROM public.skill_paths WHERE slug = $1 AND active = true",
        skill_path_slug,
    )
    if not sp_row:
        raise HTTPException(
            status_code=404,
            detail=f"Skill path '{skill_path_slug}' not found.",
        )

    levels_cfg = (
        sp_row["levels"]
        if isinstance(sp_row["levels"], list)
        else json.loads(sp_row["levels"])
    )
    max_level = max(lv["level"] for lv in levels_cfg)

    recommended_level = 1
    reasoning = "No prior submissions - starting at Level 1."

    if user_id:
        last_cred = await pool.fetchrow(
            """
            SELECT c.level, c.score
            FROM public.credentials c
            WHERE c.user_id = $1::uuid AND c.skill_path_id = $2::uuid
            ORDER BY c.created_at DESC
            LIMIT 1
            """,
            user_id,
            str(sp_row["id"]),
        )
        if last_cred:
            last_score = float(last_cred["score"])
            last_level = int(last_cred["level"])

            if last_score >= 90:
                recommended_level = min(max_level, last_level + 2)
                reasoning = f"Last score {last_score:.0f}/100 - fast-track to Level {recommended_level}."
            elif last_score >= 70:
                recommended_level = min(max_level, last_level + 1)
                reasoning = f"Last score {last_score:.0f}/100 - advancing to Level {recommended_level}."
            else:
                recommended_level = last_level
                reasoning = f"Last score {last_score:.0f}/100 - retry Level {recommended_level} to improve."

    task_row = await pool.fetchrow(
        """
        SELECT t.id, t.rubric_id, t.prompt, t.difficulty_rating
        FROM public.tasks t
        WHERE t.skill_path_id = $1::uuid
          AND t.level = $2
          AND t.active = true
        ORDER BY RANDOM()
        LIMIT 1
        """,
        str(sp_row["id"]),
        recommended_level,
    )

    if not task_row:
        recommended_level = 1
        reasoning += " (No task at recommended level - defaulting to Level 1.)"
        task_row = await pool.fetchrow(
            """
            SELECT t.id, t.rubric_id, t.prompt, t.difficulty_rating
            FROM public.tasks t
            WHERE t.skill_path_id = $1::uuid AND t.level = 1 AND t.active = true
            LIMIT 1
            """,
            str(sp_row["id"]),
        )

    if not task_row:
        raise HTTPException(
            status_code=404,
            detail="No tasks available for this skill path.",
        )

    level_meta = next((lv for lv in levels_cfg if lv["level"] == recommended_level), {})
    prompt = (
        task_row["prompt"]
        if isinstance(task_row["prompt"], dict)
        else json.loads(task_row["prompt"])
    )

    return {
        "recommended_level": recommended_level,
        "level_label": level_meta.get("label", f"Level {recommended_level}"),
        "reasoning": reasoning,
        "task_id": str(task_row["id"]),
        "rubric_id": task_row["rubric_id"],
        "skill_path_slug": skill_path_slug,
        "prompt": prompt,
        "difficulty_rating": float(task_row["difficulty_rating"] or 0.5),
    }

import json

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request

from app.api.deps import get_current_user
from app.core.database import get_pool
from app.core.limiter import limiter
from app.core.logging import logger
from app.models.assess import AssessRequest, AssessmentJobResponse
from app.models.project import (
    ProjectBrief,
    ProjectBriefSummary,
    ProjectDeliverable,
    ProjectSubmitRequest,
    ProjectSubmitResponse,
)
from app.services.assessment_jobs import (
    create_assessment_job,
    get_assessment_job,
    process_assessment_job,
)

router = APIRouter(prefix="/projects", tags=["projects"])

_SUBMIT_LIMIT = "5/5minute"

# Rubric → submission_type mapping (same as diagnostics)
_RUBRIC_SUBMISSION_TYPE: dict[str, str] = {
    "web-dev-html-001":    "html_css_js",
    "backend-api-001":     "code",
    "copy-en-001":         "text",
    "translate-yo-en-001": "text",
}


def _build_content(files: list, notes: str | None) -> str:
    """Concatenate multi-file submission into a single graded string."""
    parts: list[str] = []
    for f in files:
        parts.append(f"=== FILE: {f['filename']} ===\n{f['content']}")
    if notes:
        parts.append(f"=== COVER NOTE ===\n{notes}")
    return "\n\n".join(parts)


def _row_to_summary(row) -> ProjectBriefSummary:
    deliverables = row["deliverables"]
    if isinstance(deliverables, str):
        deliverables = json.loads(deliverables)
    return ProjectBriefSummary(
        id=str(row["id"]),
        slug=row["slug"],
        skill_path_slug=row["skill_path_slug"],
        skill_path_name=row["skill_path_name"],
        skill_path_domain=row["skill_path_domain"],
        title=row["title"],
        summary=row["summary"],
        deliverables=[ProjectDeliverable(**d) for d in deliverables],
        rubric_id=row["rubric_id"],
        level=row["level"],
        estimated_days=row["estimated_days"],
        pass_threshold=row["pass_threshold"],
    )


def _row_to_brief(row) -> ProjectBrief:
    deliverables = row["deliverables"]
    if isinstance(deliverables, str):
        deliverables = json.loads(deliverables)
    return ProjectBrief(
        id=str(row["id"]),
        slug=row["slug"],
        skill_path_slug=row["skill_path_slug"],
        skill_path_name=row["skill_path_name"],
        skill_path_domain=row["skill_path_domain"],
        task_id=str(row["task_id"]) if row["task_id"] else None,
        title=row["title"],
        summary=row["summary"],
        brief_markdown=row["brief_markdown"],
        deliverables=[ProjectDeliverable(**d) for d in deliverables],
        rubric_id=row["rubric_id"],
        level=row["level"],
        estimated_days=row["estimated_days"],
        pass_threshold=row["pass_threshold"],
    )


_BRIEF_SELECT = """
    SELECT
        pb.id, pb.slug, pb.task_id, pb.title, pb.summary, pb.brief_markdown,
        pb.deliverables, pb.rubric_id, pb.level, pb.estimated_days, pb.pass_threshold,
        sp.slug  AS skill_path_slug,
        sp.name  AS skill_path_name,
        sp.domain AS skill_path_domain
    FROM public.project_briefs pb
    JOIN public.skill_paths sp ON sp.id = pb.skill_path_id
"""


@router.get("", response_model=list[ProjectBriefSummary], summary="List all active project briefs")
async def list_projects() -> list[ProjectBriefSummary]:
    pool = get_pool()
    rows = await pool.fetch(
        f"{_BRIEF_SELECT} WHERE pb.active = true ORDER BY pb.created_at ASC"
    )
    return [_row_to_summary(r) for r in rows]


@router.get("/{slug}", response_model=ProjectBrief, summary="Get a project brief by slug")
async def get_project(slug: str) -> ProjectBrief:
    pool = get_pool()
    row = await pool.fetchrow(
        f"{_BRIEF_SELECT} WHERE pb.slug = $1 AND pb.active = true",
        slug,
    )
    if not row:
        raise HTTPException(status_code=404, detail=f"Project '{slug}' not found.")
    return _row_to_brief(row)


@router.post("/{slug}/submit", response_model=ProjectSubmitResponse, summary="Submit work for a project brief")
@limiter.limit(_SUBMIT_LIMIT)
async def submit_project(
    request: Request,
    slug: str,
    body: ProjectSubmitRequest,
    background_tasks: BackgroundTasks,
    auth_user: dict = Depends(get_current_user),
) -> ProjectSubmitResponse:
    pool = get_pool()

    # Resolve user profile ID
    user_row = await pool.fetchrow(
        "SELECT id FROM public.users WHERE auth_id = $1::uuid", auth_user["id"]
    )
    if not user_row:
        raise HTTPException(status_code=404, detail="User profile not found.")
    user_id = str(user_row["id"])

    # Fetch brief + task ID
    row = await pool.fetchrow(
        f"{_BRIEF_SELECT} WHERE pb.slug = $1 AND pb.active = true",
        slug,
    )
    if not row:
        raise HTTPException(status_code=404, detail=f"Project '{slug}' not found.")

    if not row["task_id"]:
        raise HTTPException(status_code=503, detail="This project does not have a grading task configured yet.")

    brief = _row_to_brief(row)
    content = _build_content(
        [{"filename": f.filename, "content": f.content} for f in body.files],
        body.notes,
    )
    submission_type = _RUBRIC_SUBMISSION_TYPE.get(brief.rubric_id, "text")

    assess_request = AssessRequest(
        task_id=str(row["task_id"]),
        skill_path_slug=brief.skill_path_slug,
        level=brief.level,
        submission_type=submission_type,
        content=content,
        rubric_id=brief.rubric_id,
        user_id=user_id,
    )

    job = await create_assessment_job(assess_request)
    background_tasks.add_task(process_assessment_job, job.id)

    logger.info(
        "projects.submitted",
        slug=slug,
        user_id=user_id,
        job_id=job.id,
        file_count=len(body.files),
    )

    return ProjectSubmitResponse(
        job_id=job.id,
        status="queued",
        message="Your project has been queued for grading. This usually takes 30–60 seconds.",
    )


@router.get("/submissions/{job_id}", response_model=AssessmentJobResponse, summary="Poll project grading status")
async def get_submission_status(
    job_id: str,
    auth_user: dict = Depends(get_current_user),
) -> AssessmentJobResponse:
    job = await get_assessment_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Submission not found.")
    return job

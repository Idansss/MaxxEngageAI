import json
import uuid
from datetime import datetime, timezone

from app.core.database import get_pool
from app.core.logging import logger
from app.models.assess import AssessRequest, AssessmentJobResponse
from app.services.assessment import run_assessment


def _iso(value) -> str | None:
    return value.isoformat() if value else None


def _row_to_job(row) -> AssessmentJobResponse:
    result = row["result"]
    request = row["request"]
    if isinstance(result, str):
        result = json.loads(result)
    if isinstance(request, str):
        request = json.loads(request)
    return AssessmentJobResponse(
        id=str(row["id"]),
        status=row["status"],
        request=request,
        result=result,
        error=row["error"],
        created_at=_iso(row["created_at"]) or datetime.now(timezone.utc).isoformat(),
        updated_at=_iso(row["updated_at"]) or datetime.now(timezone.utc).isoformat(),
        started_at=_iso(row["started_at"]),
        completed_at=_iso(row["completed_at"]),
    )


async def create_assessment_job(request: AssessRequest) -> AssessmentJobResponse:
    pool = get_pool()
    job_id = str(uuid.uuid4())
    row = await pool.fetchrow(
        """
        INSERT INTO public.assessment_jobs (id, user_id, request, status)
        VALUES ($1::uuid, $2::uuid, $3::jsonb, 'queued')
        RETURNING *
        """,
        job_id,
        request.user_id,
        json.dumps(request.model_dump(mode="json")),
    )
    return _row_to_job(row)


async def get_assessment_job(job_id: str) -> AssessmentJobResponse | None:
    pool = get_pool()
    row = await pool.fetchrow(
        "SELECT * FROM public.assessment_jobs WHERE id = $1::uuid",
        job_id,
    )
    return _row_to_job(row) if row else None


async def process_assessment_job(job_id: str) -> None:
    pool = get_pool()
    row = await pool.fetchrow(
        """
        UPDATE public.assessment_jobs
        SET status = 'running', started_at = now(), updated_at = now()
        WHERE id = $1::uuid AND status = 'queued'
        RETURNING *
        """,
        job_id,
    )
    if not row:
        return

    try:
        payload = row["request"]
        if isinstance(payload, str):
            payload = json.loads(payload)
        response = await run_assessment(AssessRequest(**payload))
        await pool.execute(
            """
            UPDATE public.assessment_jobs
            SET status = 'succeeded',
                result = $2::jsonb,
                completed_at = now(),
                updated_at = now()
            WHERE id = $1::uuid
            """,
            job_id,
            json.dumps(response.model_dump(mode="json")),
        )
        logger.info("assessment_job.succeeded", job_id=job_id)
    except Exception as exc:
        logger.error("assessment_job.failed", job_id=job_id, error=str(exc))
        await pool.execute(
            """
            UPDATE public.assessment_jobs
            SET status = 'failed',
                error = $2,
                completed_at = now(),
                updated_at = now()
            WHERE id = $1::uuid
            """,
            job_id,
            str(exc),
        )


async def process_next_queued_job() -> str | None:
    pool = get_pool()
    row = await pool.fetchrow(
        """
        SELECT id
        FROM public.assessment_jobs
        WHERE status = 'queued'
        ORDER BY created_at ASC
        LIMIT 1
        """
    )
    if not row:
        return None
    job_id = str(row["id"])
    await process_assessment_job(job_id)
    return job_id

from fastapi import APIRouter, HTTPException
from app.models.assess import AssessRequest, AssessResponse
from app.services.grading import grade_submission
from app.services.persistence import persist_assessment
from app.core.logging import logger

router = APIRouter(prefix="/assess", tags=["assessment"])


@router.post("", response_model=AssessResponse, summary="Grade a submission against a rubric")
async def assess(request: AssessRequest) -> AssessResponse:
    """
    Submit user work for AI grading.

    - Grades against the specified rubric using Claude.
    - Returns per-dimension scores, rationale, feedback, and a confidence estimate.
    - Flags submissions for human review when confidence is low or score is near the pass threshold.
    - Persists submission + review to the DB when a valid user_id is provided.
    - All reasoning is returned to the user — no hidden scores.
    """
    try:
        response = await grade_submission(request)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        logger.error("assess.grading_error", error=str(e))
        raise HTTPException(status_code=502, detail="Grading model returned an unexpected response. Try again.")
    except Exception as e:
        logger.error("assess.unexpected_error", error=str(e))
        raise HTTPException(status_code=500, detail="Internal grading error.")

    submission_id, credential_id = await persist_assessment(request, response)
    response.submission_id = submission_id
    response.credential_id = credential_id
    return response

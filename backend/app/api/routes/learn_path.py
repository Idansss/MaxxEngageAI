from fastapi import APIRouter, HTTPException
from app.models.learn_path import LearnPathRequest, LearnPathResponse
from app.services.learning import generate_learn_path
from app.core.logging import logger

router = APIRouter(prefix="/learn-path", tags=["learning"])


@router.post("", response_model=LearnPathResponse, summary="Generate a personalized learning roadmap")
async def learn_path(request: LearnPathRequest) -> LearnPathResponse:
    """
    Generate a personalized week-by-week learning path from a diagnostic score.

    - Duration scales with score gap: lower scores get longer paths (up to 12 weeks).
    - All resources are free and accessible from low-bandwidth connections.
    - Milestone assessments are scheduled at the midpoint and final week.
    - Optionally pass `weak_dimensions` from a diagnostic review to focus the path.
    """
    try:
        return await generate_learn_path(request)
    except ValueError as e:
        logger.error("learn_path.generation_error", error=str(e))
        raise HTTPException(status_code=502, detail="Learning path model returned an unexpected response. Try again.")
    except Exception as e:
        logger.error("learn_path.unexpected_error", error=str(e))
        raise HTTPException(status_code=500, detail="Internal error generating learning path.")

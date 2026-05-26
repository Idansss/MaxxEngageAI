from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class SubmissionType(str, Enum):
    text = "text"
    code = "code"
    html_css_js = "html_css_js"
    markdown = "markdown"
    url = "url"


class AssessRequest(BaseModel):
    """Payload for POST /assess — a user submits work for AI grading."""

    task_id: str = Field(..., description="UUID of the Task being answered.")
    skill_path_slug: str = Field(
        ..., examples=["web-dev-frontend"], description="Slug of the skill path."
    )
    level: int = Field(..., ge=1, le=10, description="Task level (1=beginner, 10=expert).")
    submission_type: SubmissionType
    content: str = Field(
        ..., min_length=10, description="The user's submitted work as a string."
    )
    rubric_id: str = Field(
        ..., description="Rubric to grade against, e.g. 'web-dev-html-001'."
    )
    user_id: str | None = Field(
        None, description="Optional; omit for anonymous diagnostic assessments."
    )


class DimensionScore(BaseModel):
    dimension: str
    score: float
    max_score: float
    rationale: str
    evidence_quotes: list[str] = []


class ReviewFeedback(BaseModel):
    summary: str
    strengths: list[str]
    improvements: list[str]
    next_steps: list[str] = []


class AssessResponse(BaseModel):
    """Response from POST /assess. All reasoning visible to the user — no secret scores."""

    task_id: str
    overall_score: float = Field(..., ge=0, le=100)
    pass_threshold: int
    passed: bool
    confidence: float = Field(..., ge=0, le=1)
    scores: list[DimensionScore]
    feedback: ReviewFeedback
    credential_eligible: bool
    human_review_requested: bool
    model_used: str
    prompt_hash: str
    review_id: str
    submission_id: str | None = Field(None, description="DB record ID; null for anonymous submissions.")
    credential_id: str | None = Field(None, description="Issued W3C VC credential ID; null when not eligible.")
    secondary_model_used: str | None = None
    secondary_overall_score: float | None = Field(None, ge=0, le=100)
    tertiary_model_used: str | None = None
    tertiary_overall_score: float | None = Field(None, ge=0, le=100)
    model_disagreement: bool = False
    model_disagreement_reason: str | None = None
    knowledge_sources: list[dict[str, Any]] = []


class AssessmentJobStatus(str, Enum):
    queued = "queued"
    running = "running"
    succeeded = "succeeded"
    failed = "failed"


class AssessmentJobResponse(BaseModel):
    id: str
    status: AssessmentJobStatus
    created_at: str
    updated_at: str
    started_at: str | None = None
    completed_at: str | None = None
    error: str | None = None
    result: AssessResponse | None = None
    request: dict[str, Any] | None = None

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class PeerReviewQueueItem(BaseModel):
    id: str
    user_id: str
    submission_id: str | None = None
    review_id: str | None = None
    skill_path_slug: str
    rubric_id: str
    ai_score: float | None = None
    status: Literal["pending", "claimed", "approved", "rejected", "expired"]
    claimed_by: str | None = None
    claimed_at: str | None = None
    claim_expires_at: str | None = None
    verdict: Literal["approve", "reject"] | None = None
    verdict_notes: str | None = None
    completed_at: str | None = None
    credential_id: str | None = None
    created_at: str
    updated_at: str


class ClaimResponse(BaseModel):
    id: str
    status: str
    claim_expires_at: str
    message: str


class VerdictRequest(BaseModel):
    verdict: Literal["approve", "reject"]
    verdict_notes: str | None = Field(
        None,
        description="Required when verdict is reject; shown to the submitter.",
        max_length=1000,
    )


class VerdictResponse(BaseModel):
    id: str
    verdict: str
    credential_id: str | None = None
    message: str


class ReviewerReputation(BaseModel):
    reviewer_id: str
    reviews_completed: int
    reviews_approved: int
    reviews_rejected: int
    last_active_at: str | None = None

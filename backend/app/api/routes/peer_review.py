"""
Peer Review Queue — human review for translation submissions that pass AI grading.

Flow:
  1. Assessment pipeline calls enqueue_peer_review() after a human_review_requested result.
  2. Any authenticated user (who is not the submitter) can claim a pending item.
     Claims expire after 48 hours; expired items return to pending.
  3. The claimer submits a verdict (approve / reject).
     - approve: issue credential with graded_by='ai+human', notify submitter.
     - reject:  notify submitter with feedback, item closed.
"""

import json
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request

from app.api.deps import get_current_user
from app.core.database import get_pool
from app.core.limiter import limiter
from app.core.logging import logger
from app.models.assess import (
    AssessRequest,
    AssessResponse,
    DimensionScore,
    ReviewFeedback,
    SubmissionType,
)
from app.models.peer_review import (
    ClaimResponse,
    PeerReviewQueueItem,
    ReviewerReputation,
    VerdictRequest,
    VerdictResponse,
)
from app.services.credentials import issue_credential
from app.services.notifications import push as push_notification

router = APIRouter(prefix="/peer-review", tags=["peer-review"])

_CLAIM_TTL_HOURS = 48
_LIST_LIMIT = "60/minute"
_VERDICT_LIMIT = "20/minute"


# ── helpers ───────────────────────────────────────────────────────────────────

def _iso(value) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        return value
    return value.isoformat()


def _row_to_item(row) -> PeerReviewQueueItem:
    return PeerReviewQueueItem(
        id=str(row["id"]),
        user_id=str(row["user_id"]),
        submission_id=str(row["submission_id"]) if row["submission_id"] else None,
        review_id=str(row["review_id"]) if row["review_id"] else None,
        skill_path_slug=row["skill_path_slug"],
        rubric_id=row["rubric_id"],
        ai_score=float(row["ai_score"]) if row["ai_score"] is not None else None,
        status=row["status"],
        claimed_by=str(row["claimed_by"]) if row["claimed_by"] else None,
        claimed_at=_iso(row["claimed_at"]),
        claim_expires_at=_iso(row["claim_expires_at"]),
        verdict=row["verdict"],
        verdict_notes=row["verdict_notes"],
        completed_at=_iso(row["completed_at"]),
        credential_id=str(row["credential_id"]) if row["credential_id"] else None,
        created_at=_iso(row["created_at"]) or datetime.now(timezone.utc).isoformat(),
        updated_at=_iso(row["updated_at"]) or datetime.now(timezone.utc).isoformat(),
    )


async def _expire_stale_claims(pool) -> None:
    """Release claims whose TTL has passed, returning them to pending."""
    await pool.execute(
        """
        UPDATE public.peer_review_queue
        SET status = 'pending', claimed_by = NULL, claimed_at = NULL, claim_expires_at = NULL,
            updated_at = now()
        WHERE status = 'claimed'
          AND claim_expires_at < now()
        """
    )


# ── public enqueue (called from assessment pipeline) ─────────────────────────

async def enqueue_peer_review(
    *,
    user_id: str,
    submission_id: str,
    review_id: str,
    skill_path_slug: str,
    rubric_id: str,
    ai_score: float,
) -> str | None:
    """
    Insert a pending review item.  Idempotent — skips if a row already exists
    for this submission_id so duplicate calls are harmless.
    """
    try:
        pool = get_pool()
        row = await pool.fetchrow(
            """
            INSERT INTO public.peer_review_queue
                (user_id, submission_id, review_id, skill_path_slug, rubric_id, ai_score)
            VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6)
            ON CONFLICT DO NOTHING
            RETURNING id
            """,
            user_id,
            submission_id,
            review_id,
            skill_path_slug,
            rubric_id,
            ai_score,
        )
        if row:
            logger.info(
                "peer_review.queued",
                queue_id=str(row["id"]),
                submission_id=submission_id,
                skill_path_slug=skill_path_slug,
                ai_score=ai_score,
            )
            return str(row["id"])
        return None
    except Exception as exc:
        logger.error("peer_review.enqueue_failed", submission_id=submission_id, error=str(exc))
        return None


# ── GET /peer-review/queue ────────────────────────────────────────────────────

@router.get("/queue", response_model=list[PeerReviewQueueItem], summary="List pending peer review items")
@limiter.limit(_LIST_LIMIT)
async def list_queue(
    request: Request,
    auth_user: dict = Depends(get_current_user),
) -> list[PeerReviewQueueItem]:
    """Returns pending and claimed items, excluding items submitted by the current user."""
    pool = get_pool()
    user_row = await pool.fetchrow(
        "SELECT id FROM public.users WHERE auth_id = $1::uuid", auth_user["id"]
    )
    if not user_row:
        raise HTTPException(status_code=404, detail="User profile not found.")
    user_id = str(user_row["id"])

    await _expire_stale_claims(pool)

    rows = await pool.fetch(
        """
        SELECT * FROM public.peer_review_queue
        WHERE status = 'pending'
          AND user_id != $1::uuid
        ORDER BY created_at ASC
        LIMIT 50
        """,
        user_id,
    )
    return [_row_to_item(r) for r in rows]


# ── GET /peer-review/my-items ─────────────────────────────────────────────────

@router.get("/my-claims", response_model=list[PeerReviewQueueItem], summary="List items claimed by current reviewer")
@limiter.limit(_LIST_LIMIT)
async def my_claims(
    request: Request,
    auth_user: dict = Depends(get_current_user),
) -> list[PeerReviewQueueItem]:
    pool = get_pool()
    user_row = await pool.fetchrow(
        "SELECT id FROM public.users WHERE auth_id = $1::uuid", auth_user["id"]
    )
    if not user_row:
        raise HTTPException(status_code=404, detail="User profile not found.")

    await _expire_stale_claims(pool)

    rows = await pool.fetch(
        """
        SELECT * FROM public.peer_review_queue
        WHERE claimed_by = $1::uuid
          AND status = 'claimed'
        ORDER BY claimed_at ASC
        """,
        str(user_row["id"]),
    )
    return [_row_to_item(r) for r in rows]


@router.get("/my-items", response_model=list[PeerReviewQueueItem], summary="List current user's submitted items")
@limiter.limit(_LIST_LIMIT)
async def my_items(
    request: Request,
    auth_user: dict = Depends(get_current_user),
) -> list[PeerReviewQueueItem]:
    pool = get_pool()
    user_row = await pool.fetchrow(
        "SELECT id FROM public.users WHERE auth_id = $1::uuid", auth_user["id"]
    )
    if not user_row:
        raise HTTPException(status_code=404, detail="User profile not found.")

    rows = await pool.fetch(
        """
        SELECT * FROM public.peer_review_queue
        WHERE user_id = $1::uuid
        ORDER BY created_at DESC
        LIMIT 20
        """,
        str(user_row["id"]),
    )
    return [_row_to_item(r) for r in rows]


# ── GET /peer-review/my-reputation ────────────────────────────────────────────

@router.get("/my-reputation", response_model=ReviewerReputation, summary="Get own reviewer reputation")
@limiter.limit(_LIST_LIMIT)
async def my_reputation(
    request: Request,
    auth_user: dict = Depends(get_current_user),
) -> ReviewerReputation:
    pool = get_pool()
    user_row = await pool.fetchrow(
        "SELECT id FROM public.users WHERE auth_id = $1::uuid", auth_user["id"]
    )
    if not user_row:
        raise HTTPException(status_code=404, detail="User profile not found.")
    reviewer_id = str(user_row["id"])

    row = await pool.fetchrow(
        "SELECT * FROM public.peer_reviewer_reputation WHERE reviewer_id = $1::uuid",
        reviewer_id,
    )
    if not row:
        return ReviewerReputation(
            reviewer_id=reviewer_id,
            reviews_completed=0,
            reviews_approved=0,
            reviews_rejected=0,
        )
    return ReviewerReputation(
        reviewer_id=reviewer_id,
        reviews_completed=row["reviews_completed"],
        reviews_approved=row["reviews_approved"],
        reviews_rejected=row["reviews_rejected"],
        last_active_at=_iso(row["last_active_at"]),
    )


# ── POST /peer-review/queue/{id}/claim ────────────────────────────────────────

@router.post("/queue/{item_id}/claim", response_model=ClaimResponse, summary="Claim a review item")
@limiter.limit(_VERDICT_LIMIT)
async def claim_item(
    request: Request,
    item_id: str,
    auth_user: dict = Depends(get_current_user),
) -> ClaimResponse:
    pool = get_pool()
    user_row = await pool.fetchrow(
        "SELECT id FROM public.users WHERE auth_id = $1::uuid", auth_user["id"]
    )
    if not user_row:
        raise HTTPException(status_code=404, detail="User profile not found.")
    reviewer_id = str(user_row["id"])

    await _expire_stale_claims(pool)

    expires_at = datetime.now(timezone.utc) + timedelta(hours=_CLAIM_TTL_HOURS)

    row = await pool.fetchrow(
        """
        UPDATE public.peer_review_queue
        SET status = 'claimed',
            claimed_by = $2::uuid,
            claimed_at = now(),
            claim_expires_at = $3,
            updated_at = now()
        WHERE id = $1::uuid
          AND status = 'pending'
          AND user_id != $2::uuid
        RETURNING id, status, claim_expires_at
        """,
        item_id,
        reviewer_id,
        expires_at,
    )

    if not row:
        existing = await pool.fetchrow(
            "SELECT status, user_id FROM public.peer_review_queue WHERE id = $1::uuid",
            item_id,
        )
        if not existing:
            raise HTTPException(status_code=404, detail="Review item not found.")
        if str(existing["user_id"]) == reviewer_id:
            raise HTTPException(status_code=409, detail="You cannot review your own submission.")
        raise HTTPException(status_code=409, detail=f"Item is not available for claiming (status: {existing['status']}).")

    logger.info("peer_review.claimed", item_id=item_id, reviewer_id=reviewer_id)

    # Upsert reviewer reputation row
    await pool.execute(
        """
        INSERT INTO public.peer_reviewer_reputation (reviewer_id)
        VALUES ($1::uuid)
        ON CONFLICT (reviewer_id) DO NOTHING
        """,
        reviewer_id,
    )

    return ClaimResponse(
        id=str(row["id"]),
        status=row["status"],
        claim_expires_at=_iso(row["claim_expires_at"]),
        message=f"You have {_CLAIM_TTL_HOURS} hours to submit your verdict.",
    )


# ── POST /peer-review/queue/{id}/release ──────────────────────────────────────

@router.post("/queue/{item_id}/release", summary="Release a claimed item back to pending")
@limiter.limit(_VERDICT_LIMIT)
async def release_item(
    request: Request,
    item_id: str,
    auth_user: dict = Depends(get_current_user),
) -> dict:
    pool = get_pool()
    user_row = await pool.fetchrow(
        "SELECT id FROM public.users WHERE auth_id = $1::uuid", auth_user["id"]
    )
    if not user_row:
        raise HTTPException(status_code=404, detail="User profile not found.")
    reviewer_id = str(user_row["id"])

    row = await pool.fetchrow(
        """
        UPDATE public.peer_review_queue
        SET status = 'pending', claimed_by = NULL, claimed_at = NULL,
            claim_expires_at = NULL, updated_at = now()
        WHERE id = $1::uuid
          AND claimed_by = $2::uuid
          AND status = 'claimed'
        RETURNING id
        """,
        item_id,
        reviewer_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Item not found or not claimed by you.")

    logger.info("peer_review.released", item_id=item_id, reviewer_id=reviewer_id)
    return {"id": item_id, "status": "pending", "message": "Item released back to the queue."}


# ── POST /peer-review/queue/{id}/verdict ──────────────────────────────────────

@router.post("/queue/{item_id}/verdict", response_model=VerdictResponse, summary="Submit a peer review verdict")
@limiter.limit(_VERDICT_LIMIT)
async def submit_verdict(
    request: Request,
    item_id: str,
    body: VerdictRequest,
    auth_user: dict = Depends(get_current_user),
) -> VerdictResponse:
    if body.verdict == "reject" and not (body.verdict_notes or "").strip():
        raise HTTPException(status_code=422, detail="verdict_notes is required when rejecting.")

    pool = get_pool()
    user_row = await pool.fetchrow(
        "SELECT id FROM public.users WHERE auth_id = $1::uuid", auth_user["id"]
    )
    if not user_row:
        raise HTTPException(status_code=404, detail="User profile not found.")
    reviewer_id = str(user_row["id"])

    # Lock the queue item
    item = await pool.fetchrow(
        "SELECT * FROM public.peer_review_queue WHERE id = $1::uuid FOR UPDATE",
        item_id,
    )
    if not item:
        raise HTTPException(status_code=404, detail="Review item not found.")
    if item["status"] != "claimed":
        raise HTTPException(status_code=409, detail=f"Item is not in claimed state (status: {item['status']}).")
    if str(item["claimed_by"]) != reviewer_id:
        raise HTTPException(status_code=403, detail="You have not claimed this item.")
    if item["claim_expires_at"] and item["claim_expires_at"] < datetime.now(timezone.utc):
        raise HTTPException(status_code=409, detail="Your claim has expired. The item has been returned to the queue.")

    new_credential_id: str | None = None

    if body.verdict == "approve":
        new_credential_id = await _approve_and_issue(pool, item, reviewer_id)

    # Update queue item
    await pool.execute(
        """
        UPDATE public.peer_review_queue
        SET status = $2, verdict = $3, verdict_notes = $4,
            completed_at = now(), updated_at = now(),
            credential_id = $5::uuid
        WHERE id = $1::uuid
        """,
        item_id,
        body.verdict + "d",  # 'approve' → 'approved', 'reject' → 'rejected'
        body.verdict,
        body.verdict_notes,
        new_credential_id,
    )

    # Update reviewer reputation
    is_approve = body.verdict == "approve"
    await pool.execute(
        """
        INSERT INTO public.peer_reviewer_reputation
            (reviewer_id, reviews_completed, reviews_approved, reviews_rejected, last_active_at)
        VALUES ($1::uuid, 1, $2, $3, now())
        ON CONFLICT (reviewer_id) DO UPDATE
        SET reviews_completed = peer_reviewer_reputation.reviews_completed + 1,
            reviews_approved  = peer_reviewer_reputation.reviews_approved  + $2,
            reviews_rejected  = peer_reviewer_reputation.reviews_rejected  + $3,
            last_active_at    = now(),
            updated_at        = now()
        """,
        reviewer_id,
        1 if is_approve else 0,
        0 if is_approve else 1,
    )

    # Notify submitter
    await _notify_submitter(pool, item, body.verdict, body.verdict_notes, new_credential_id)

    logger.info(
        "peer_review.verdict_submitted",
        item_id=item_id,
        verdict=body.verdict,
        reviewer_id=reviewer_id,
        credential_id=new_credential_id,
    )

    return VerdictResponse(
        id=item_id,
        verdict=body.verdict,
        credential_id=new_credential_id,
        message=(
            "Credential issued and submitter notified."
            if is_approve
            else "Submitter notified with your feedback."
        ),
    )


async def _approve_and_issue(pool, item, reviewer_id: str) -> str | None:
    """
    Reconstruct AssessRequest + AssessResponse from DB, then call issue_credential
    with graded_by='ai+human'.  Returns the public credential_id on success.
    """
    review_id = str(item["review_id"]) if item["review_id"] else None
    submission_id = str(item["submission_id"]) if item["submission_id"] else None

    if not review_id or not submission_id:
        logger.error("peer_review.approve_missing_ids", item_id=str(item["id"]))
        raise HTTPException(status_code=422, detail="Queue item is missing review or submission reference.")

    # Load review
    review_row = await pool.fetchrow(
        "SELECT * FROM public.reviews WHERE id = $1::uuid",
        review_id,
    )
    if not review_row:
        raise HTTPException(status_code=404, detail="Original review record not found.")

    # Load submission + task + skill_path
    sub_row = await pool.fetchrow(
        """
        SELECT s.*, t.level, t.rubric_id AS task_rubric_id,
               sp.slug AS skill_path_slug, sp.id AS skill_path_id
        FROM public.submissions s
        JOIN public.tasks t ON t.id = s.task_id
        JOIN public.skill_paths sp ON sp.id = t.skill_path_id
        WHERE s.id = $1::uuid
        """,
        submission_id,
    )
    if not sub_row:
        raise HTTPException(status_code=404, detail="Original submission not found.")

    # Deserialise JSONB fields
    scores_raw = review_row["scores"]
    if isinstance(scores_raw, str):
        scores_raw = json.loads(scores_raw)

    feedback_raw = review_row["feedback"]
    if isinstance(feedback_raw, str):
        feedback_raw = json.loads(feedback_raw)

    content_raw = sub_row["content"]
    if isinstance(content_raw, str):
        content_raw = json.loads(content_raw)
    submission_body = content_raw.get("body", "") if isinstance(content_raw, dict) else str(content_raw)

    try:
        scores = [DimensionScore(**s) for s in (scores_raw or [])]
    except Exception:
        scores = []

    try:
        feedback = ReviewFeedback(**feedback_raw)
    except Exception:
        feedback = ReviewFeedback(summary="Reviewed by human translator.", strengths=[], improvements=[])

    assess_request = AssessRequest(
        task_id=str(sub_row["task_id"]),
        skill_path_slug=item["skill_path_slug"],
        level=sub_row["level"],
        submission_type=SubmissionType.text,
        content=submission_body or "—",
        rubric_id=item["rubric_id"],
        user_id=str(item["user_id"]),
    )

    assess_response = AssessResponse(
        task_id=str(sub_row["task_id"]),
        overall_score=float(review_row["overall_score"]),
        pass_threshold=75,
        passed=True,
        confidence=float(review_row["confidence"] or 0.9),
        scores=scores,
        feedback=feedback,
        credential_eligible=True,
        human_review_requested=True,
        model_used=review_row["model_version"] or "ai",
        prompt_hash=review_row["prompt_hash"] or "",
        review_id=review_id,
        submission_id=submission_id,
    )

    credential_id = await issue_credential(
        assess_request,
        assess_response,
        submission_id,
        graded_by="ai+human",
        verified_by_human=True,
        human_reviewer_id=reviewer_id,
    )
    return credential_id


async def _notify_submitter(pool, item, verdict: str, verdict_notes: str | None, credential_id: str | None) -> None:
    """Send an in-app notification to the submission author."""
    user_id = str(item["user_id"])
    skill = item["skill_path_slug"]

    if verdict == "approve":
        await push_notification(
            user_id=user_id,
            type="peer_review_complete",
            title="Your translation passed human review",
            body=f"A human translator has approved your {skill} submission. Your credential has been issued.",
            href=f"/identity",
            metadata={"credential_id": credential_id, "skill_path_slug": skill},
        )
    else:
        note = verdict_notes or "No additional feedback provided."
        await push_notification(
            user_id=user_id,
            type="peer_review_complete",
            title="Translation review decision",
            body=f"A reviewer has not approved your {skill} submission. Feedback: {note[:200]}",
            href=f"/assess/{skill}",
            metadata={"skill_path_slug": skill, "verdict": "rejected"},
        )

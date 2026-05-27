"""
Admin routes — protected by ADMIN_EMAILS allowlist.
Human reviewers use these to triage flagged submissions and view calibration data.
"""

import json
import uuid
from datetime import date, timedelta
from typing import Literal, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.api.deps import get_admin_user
from app.core.database import get_pool
from app.core.logging import logger
from app.models.assess import AssessRequest, AssessResponse, DimensionScore, ReviewFeedback
from app.services.audit import append_audit_log
from app.services.credentials import issue_credential

router = APIRouter(prefix="/admin", tags=["admin"])


# ── GET /admin/queue ──────────────────────────────────────────────────────────

@router.get("/queue", summary="List submissions pending human review")
async def get_queue(_admin: dict = Depends(get_admin_user)):
    pool = get_pool()
    rows = await pool.fetch(
        """
        SELECT
            r.id              AS review_id,
            r.overall_score,
            r.confidence,
            r.feedback,
            r.scores,
            r.model_version,
            r.reviewed_at,
            r.credential_eligible,
            r.appeal_reason,

            s.id              AS submission_id,
            s.content         AS submission_content,
            s.submitted_at,
            s.status          AS submission_status,

            u.id              AS user_id,
            u.display_name,
            u.country_code,

            sp.name           AS skill_path_name,
            sp.slug           AS skill_path_slug,

            -- check if a credential was already issued for this submission
            EXISTS (
                SELECT 1 FROM public.credentials c
                WHERE c.submission_id = s.id
            ) AS credential_issued,

            -- if issued, was it human-verified?
            COALESCE((
                SELECT c.verified_by_human FROM public.credentials c
                WHERE c.submission_id = s.id LIMIT 1
            ), false) AS credential_verified_by_human

        FROM public.reviews r
        JOIN public.submissions s ON s.id = r.submission_id
        JOIN public.users u ON u.id = s.user_id
        JOIN public.tasks t ON t.id = s.task_id
        JOIN public.skill_paths sp ON sp.id = t.skill_path_id
        WHERE r.human_review_requested = true
          AND s.status NOT IN ('human_reviewed', 'final')
        ORDER BY r.reviewed_at ASC
        """,
    )

    def _parse(row) -> dict:
        d = dict(row)
        d["review_id"] = str(d["review_id"])
        d["submission_id"] = str(d["submission_id"])
        d["user_id"] = str(d["user_id"])
        # feedback and scores are already dicts (asyncpg parses JSONB)
        if isinstance(d["feedback"], str):
            d["feedback"] = json.loads(d["feedback"])
        if isinstance(d["scores"], str):
            d["scores"] = json.loads(d["scores"])
        if isinstance(d["submission_content"], str):
            d["submission_content"] = json.loads(d["submission_content"])
        return d

    return [_parse(r) for r in rows]


# ── POST /admin/reviews/{review_id}/decide ────────────────────────────────────

class DecisionRequest(BaseModel):
    decision: Literal["approve", "reject"]
    note: str = ""


def _json_value(value):
    if isinstance(value, str):
        return json.loads(value)
    return value


def _pass_threshold_for_rubric(rubric_id: str) -> int:
    return 75 if rubric_id == "translate-yo-en-001" else 70


def _submission_content_parts(content) -> tuple[str, str]:
    parsed = _json_value(content) or {}
    return str(parsed.get("type") or "text"), str(parsed.get("body") or "")


def _admin_issue_payloads(row) -> tuple[AssessRequest, AssessResponse] | None:
    rubric_id = row["rubric_id"]
    threshold = _pass_threshold_for_rubric(rubric_id)
    overall_score = float(row["overall_score"])
    if overall_score < threshold:
        return None

    submission_type, body = _submission_content_parts(row["submission_content"])
    request = AssessRequest(
        task_id=str(row["task_id"]),
        skill_path_slug=row["skill_path_slug"],
        level=int(row["level"] or 1),
        submission_type=submission_type,
        content=body,
        rubric_id=rubric_id,
        user_id=str(row["user_id"]),
    )
    response = AssessResponse(
        task_id=str(row["task_id"]),
        overall_score=overall_score,
        pass_threshold=threshold,
        passed=True,
        confidence=float(row["confidence"]) if row["confidence"] is not None else 1.0,
        scores=[DimensionScore(**score) for score in (_json_value(row["scores"]) or [])],
        feedback=ReviewFeedback(**(_json_value(row["feedback"]) or {
            "summary": "Approved by a human reviewer.",
            "strengths": [],
            "improvements": [],
            "next_steps": [],
        })),
        credential_eligible=True,
        human_review_requested=False,
        model_used=row["model_version"] or "human-review",
        prompt_hash=row["prompt_hash"] or "human-review",
        review_id=str(row["review_id"]),
        submission_id=str(row["submission_id"]),
    )
    return request, response


@router.post("/reviews/{review_id}/decide", summary="Approve or reject a flagged submission")
async def decide(
    review_id: str,
    body: DecisionRequest,
    admin: dict = Depends(get_admin_user),
):
    pool = get_pool()

    # Fetch review + submission + user to build the credential if approving
    row = await pool.fetchrow(
        """
        SELECT
            r.id              AS review_id,
            r.overall_score,
            r.credential_eligible,
            r.human_review_requested,
            r.rubric_id,
            r.confidence,
            r.scores,
            r.feedback,
            r.model_version,
            r.prompt_hash,
            s.id              AS submission_id,
            s.task_id,
            s.content         AS submission_content,
            s.status          AS submission_status,
            s.user_id,
            t.level,
            sp.id             AS skill_path_id,
            sp.slug           AS skill_path_slug,
            sp.name           AS skill_path_name,
            sp.domain         AS skill_path_domain,
            sp.levels,
            u.did             AS holder_did,
            EXISTS (
                SELECT 1 FROM public.credentials c WHERE c.submission_id = s.id
            ) AS credential_issued
        FROM public.reviews r
        JOIN public.submissions s  ON s.id = r.submission_id
        JOIN public.tasks t        ON t.id = s.task_id
        JOIN public.skill_paths sp ON sp.id = t.skill_path_id
        JOIN public.users u        ON u.id = s.user_id
        WHERE r.id = $1::uuid
        """,
        review_id,
    )

    if not row:
        raise HTTPException(status_code=404, detail="Review not found.")

    submission_id = str(row["submission_id"])
    user_id = str(row["user_id"])
    old_values = {
        "submission_status": row["submission_status"],
        "human_review_requested": row["human_review_requested"],
        "credential_eligible": row["credential_eligible"],
        "credential_issued": row["credential_issued"],
        "overall_score": float(row["overall_score"]),
        "confidence": float(row["confidence"]) if row["confidence"] is not None else None,
    }
    issued_credential_id: str | None = None
    should_issue_credential = False

    async with pool.acquire() as conn:
        if body.decision == "approve":
            # Mark submission as human-reviewed
            await conn.execute(
                "UPDATE public.submissions SET status = 'human_reviewed' WHERE id = $1::uuid",
                submission_id,
            )
            await conn.execute(
                "UPDATE public.reviews SET credential_eligible = ($2 >= $3), human_review_requested = false WHERE id = $1::uuid",
                review_id,
                float(row["overall_score"]),
                _pass_threshold_for_rubric(row["rubric_id"]),
            )

            if row["credential_issued"]:
                # Credential already exists — mark it human-verified
                await conn.execute(
                    """
                    UPDATE public.credentials
                    SET verified_by_human = true,
                        graded_by = 'ai+human',
                        human_reviewer_id = $2::uuid,
                        vc_document = jsonb_set(
                            vc_document,
                            '{credentialSubject,verifiedByHuman}',
                            'true'::jsonb
                        )
                    WHERE submission_id = $1::uuid
                    """,
                    submission_id,
                    admin.get("id"),
                )
                logger.info("admin.approved.credential_upgraded",
                            review_id=review_id, admin=admin["email"])
            else:
                should_issue_credential = True

        else:  # reject
            await conn.execute(
                "UPDATE public.submissions SET status = 'human_reviewed' WHERE id = $1::uuid",
                submission_id,
            )
            await conn.execute(
                "UPDATE public.reviews SET credential_eligible = false, human_review_requested = false WHERE id = $1::uuid",
                review_id,
            )
            if body.note:
                await conn.execute(
                    "UPDATE public.reviews SET appeal_reason = $1 WHERE id = $2::uuid",
                    f"[REJECTED by {admin['email']}] {body.note}",
                    review_id,
                )
            logger.info("admin.rejected", review_id=review_id, admin=admin["email"], note=body.note)

    if should_issue_credential:
        payloads = _admin_issue_payloads(row)
        if payloads:
            issue_request, issue_response = payloads
            issued_credential_id = await issue_credential(
                issue_request,
                issue_response,
                submission_id,
                graded_by="ai+human",
                verified_by_human=True,
                human_reviewer_id=admin.get("id"),
                flagged_for_review=False,
                flag_reason=None,
            )
            logger.info(
                "admin.approved.credential_issued",
                review_id=review_id,
                credential_id=issued_credential_id,
                admin=admin["email"],
            )
        else:
            logger.info(
                "admin.approved.no_credential_below_threshold",
                review_id=review_id,
                score=float(row["overall_score"]),
                rubric_id=row["rubric_id"],
            )

    await append_audit_log(
        action="review.admin_decision",
        actor_type="admin",
        actor_id=admin.get("email"),
        entity_type="review",
        entity_id=review_id,
        old_values=old_values,
        new_values={
            "decision": body.decision,
            "submission_status": "human_reviewed",
            "credential_id": issued_credential_id,
            "verified_by_human": body.decision == "approve",
        },
        metadata={
            "submission_id": submission_id,
            "user_id": user_id,
            "note_present": bool(body.note),
        },
    )

    if issued_credential_id:
        await append_audit_log(
            action="credential.issued_by_admin",
            actor_type="admin",
            actor_id=admin.get("email"),
            entity_type="credential",
            entity_id=issued_credential_id,
            new_values={
                "user_id": user_id,
                "submission_id": submission_id,
                "review_id": review_id,
                "score": float(row["overall_score"]),
                "verified_by_human": True,
            },
        )

    # Fire webhook (best-effort)
    import asyncio
    from app.services import webhook as wh
    asyncio.ensure_future(wh.on_appeal_resolved(
        review_id=review_id,
        decision=body.decision,
        admin_email=admin.get("email", "admin"),
    ))

    # Push in-app notification to the learner
    from app.services.notifications import push as push_notif
    if body.decision == "approve":
        if issued_credential_id:
            asyncio.ensure_future(push_notif(
                user_id=user_id,
                type="credential_earned",
                title="You earned a credential!",
                body="Your human-reviewed submission has been approved and a credential was issued.",
                href="/wallet",
                metadata={"credential_id": issued_credential_id, "review_id": review_id},
            ))
        else:
            asyncio.ensure_future(push_notif(
                user_id=user_id,
                type="human_review_done",
                title="Human review approved",
                body="Your submission was approved and your credential is now human-verified.",
                href="/wallet",
                metadata={"review_id": review_id},
            ))
    else:
        asyncio.ensure_future(push_notif(
            user_id=user_id,
            type="human_review_done",
            title="Human review complete",
            body="Your submission was reviewed. Check your wallet for details.",
            href="/wallet",
            metadata={"review_id": review_id, "decision": "rejected"},
        ))

    return {"ok": True, "decision": body.decision, "review_id": review_id}


# ── POST /admin/calibration/ingest ────────────────────────────────────────────

class CalibrationCase(BaseModel):
    run_id: str
    eval_file: str
    eval_case_id: str
    skill_path_slug: str
    level: int
    rubric_id: str
    label: str
    expected_range_lo: int
    expected_range_hi: int
    human_score: Optional[float] = None
    human_pass: Optional[bool] = None
    ai_score: float
    ai_confidence: Optional[float] = None
    ai_model: str
    in_range: bool
    abs_error: Optional[float] = None
    bias: Optional[float] = None
    within5: Optional[bool] = None
    pass_agreement: Optional[bool] = None
    feedback_summary: Optional[str] = None


class CalibrationIngestRequest(BaseModel):
    run_id: str
    cases: list[CalibrationCase]


@router.post("/calibration/ingest", summary="Ingest calibration run results from run_calibration.py")
async def ingest_calibration(
    body: CalibrationIngestRequest,
    _admin: dict = Depends(get_admin_user),
):
    """
    Called by `evals/run_calibration.py --persist` after each run.
    Inserts one row per eval case into calibration_log.
    """
    pool = get_pool()
    run_uuid = uuid.UUID(body.run_id) if body.run_id else uuid.uuid4()

    inserted = 0
    for case in body.cases:
        await pool.execute(
            """
            INSERT INTO public.calibration_log (
                run_id, eval_file, eval_case_id,
                skill_path_slug, level, rubric_id, label,
                expected_range_lo, expected_range_hi,
                human_score, human_pass,
                ai_score, ai_confidence, ai_model,
                in_range, abs_error, bias, within5, pass_agreement,
                feedback_summary
            ) VALUES (
                $1::uuid, $2, $3,
                $4, $5, $6, $7,
                $8, $9,
                $10, $11,
                $12, $13, $14,
                $15, $16, $17, $18, $19,
                $20
            )
            """,
            run_uuid, case.eval_file, case.eval_case_id,
            case.skill_path_slug, case.level, case.rubric_id, case.label,
            case.expected_range_lo, case.expected_range_hi,
            case.human_score, case.human_pass,
            case.ai_score, case.ai_confidence, case.ai_model,
            case.in_range, case.abs_error, case.bias, case.within5, case.pass_agreement,
            case.feedback_summary,
        )
        inserted += 1

    logger.info("admin.calibration.ingested", run_id=body.run_id, cases=inserted)
    return {"ok": True, "run_id": body.run_id, "inserted": inserted}


# ── GET /admin/calibration/history ────────────────────────────────────────────

@router.get("/calibration/history", summary="List calibration run summaries")
async def calibration_history(
    limit: int = Query(20, ge=1, le=100),
    skill_path_slug: Optional[str] = Query(None),
    _admin: dict = Depends(get_admin_user),
):
    """
    Returns one summary row per calibration run (grouped by run_id + eval_file),
    newest first. Shows aggregate metrics: MAE, within-5 rate, pass agreement, bias.
    """
    pool = get_pool()

    where = "WHERE 1=1"
    params: list = []
    if skill_path_slug:
        where += f" AND skill_path_slug = ${len(params)+1}"
        params.append(skill_path_slug)

    rows = await pool.fetch(
        f"""
        SELECT
            run_id,
            eval_file,
            skill_path_slug,
            level,
            MIN(run_at)                                   AS run_at,
            COUNT(*)                                      AS total_cases,
            ROUND(AVG(CASE WHEN in_range THEN 1.0 ELSE 0.0 END)::numeric, 3)  AS in_range_rate,
            ROUND(AVG(abs_error)::numeric, 2)             AS mae,
            ROUND(AVG(CASE WHEN within5 THEN 1.0 WHEN within5 IS NOT NULL THEN 0.0 END)::numeric, 3) AS within5_rate,
            ROUND(AVG(CASE WHEN pass_agreement THEN 1.0 WHEN pass_agreement IS NOT NULL THEN 0.0 END)::numeric, 3) AS pass_agreement,
            ROUND(AVG(bias)::numeric, 2)                  AS mean_bias,
            COUNT(human_score)                            AS human_graded_n,
            MAX(ai_model)                                 AS ai_model
        FROM public.calibration_log
        {where}
        GROUP BY run_id, eval_file, skill_path_slug, level
        ORDER BY run_at DESC
        LIMIT {limit}
        """,
        *params,
    )

    return [
        {
            "run_id":          str(r["run_id"]),
            "eval_file":       r["eval_file"],
            "skill_path_slug": r["skill_path_slug"],
            "level":           r["level"],
            "run_at":          r["run_at"].isoformat(),
            "total_cases":     r["total_cases"],
            "human_graded_n":  r["human_graded_n"],
            "in_range_rate":   float(r["in_range_rate"]) if r["in_range_rate"] is not None else None,
            "mae":             float(r["mae"]) if r["mae"] is not None else None,
            "within5_rate":    float(r["within5_rate"]) if r["within5_rate"] is not None else None,
            "pass_agreement":  float(r["pass_agreement"]) if r["pass_agreement"] is not None else None,
            "mean_bias":       float(r["mean_bias"]) if r["mean_bias"] is not None else None,
            "ai_model":        r["ai_model"],
        }
        for r in rows
    ]


# ── GET /admin/calibration/latest ────────────────────────────────────────────

@router.get("/calibration/latest", summary="Latest calibration run per skill path")
async def calibration_latest(_admin: dict = Depends(get_admin_user)):
    """
    Returns the most recent run metrics for each (skill_path_slug, level) pair.
    Use this as a dashboard health-check: if MAE > 10 or within5_rate < 0.6, investigate.
    """
    pool = get_pool()

    rows = await pool.fetch(
        """
        WITH ranked AS (
            SELECT
                skill_path_slug, level, eval_file,
                run_id, run_at, in_range, abs_error, within5, pass_agreement, bias, ai_model,
                ROW_NUMBER() OVER (PARTITION BY skill_path_slug, level ORDER BY run_at DESC) AS rn
            FROM public.calibration_log
        ),
        latest_runs AS (
            SELECT DISTINCT run_id, skill_path_slug, level, eval_file, run_at, ai_model
            FROM ranked WHERE rn = 1
        )
        SELECT
            lr.skill_path_slug,
            lr.level,
            lr.eval_file,
            lr.run_at,
            lr.ai_model,
            lr.run_id,
            COUNT(cl.*)                                                     AS total_cases,
            ROUND(AVG(CASE WHEN cl.in_range THEN 1.0 ELSE 0.0 END)::numeric, 3) AS in_range_rate,
            ROUND(AVG(cl.abs_error)::numeric, 2)                            AS mae,
            ROUND(AVG(CASE WHEN cl.within5 THEN 1.0 WHEN cl.within5 IS NOT NULL THEN 0.0 END)::numeric, 3) AS within5_rate,
            ROUND(AVG(CASE WHEN cl.pass_agreement THEN 1.0 WHEN cl.pass_agreement IS NOT NULL THEN 0.0 END)::numeric, 3) AS pass_agreement,
            ROUND(AVG(cl.bias)::numeric, 2)                                 AS mean_bias
        FROM latest_runs lr
        JOIN public.calibration_log cl ON cl.run_id = lr.run_id
        GROUP BY lr.skill_path_slug, lr.level, lr.eval_file, lr.run_at, lr.ai_model, lr.run_id
        ORDER BY lr.skill_path_slug, lr.level
        """,
    )

    def health(r: dict) -> str:
        if r["mae"] is None:
            return "no_human_scores"
        if r["mae"] <= 5 and (r["in_range_rate"] or 0) >= 0.8:
            return "green"
        if r["mae"] <= 10 and (r["in_range_rate"] or 0) >= 0.6:
            return "yellow"
        return "red"

    results = []
    for r in rows:
        d = {
            "skill_path_slug": r["skill_path_slug"],
            "level":           r["level"],
            "eval_file":       r["eval_file"],
            "run_id":          str(r["run_id"]),
            "run_at":          r["run_at"].isoformat(),
            "ai_model":        r["ai_model"],
            "total_cases":     r["total_cases"],
            "in_range_rate":   float(r["in_range_rate"]) if r["in_range_rate"] is not None else None,
            "mae":             float(r["mae"]) if r["mae"] is not None else None,
            "within5_rate":    float(r["within5_rate"]) if r["within5_rate"] is not None else None,
            "pass_agreement":  float(r["pass_agreement"]) if r["pass_agreement"] is not None else None,
            "mean_bias":       float(r["mean_bias"]) if r["mean_bias"] is not None else None,
        }
        d["health"] = health(d)
        results.append(d)

    return results


# ── GET /admin/audit-log ─────────────────────────────────────────────────────

@router.get("/audit-log", summary="List append-only audit events")
async def audit_log(
    limit: int = Query(50, ge=1, le=200),
    entity_type: Optional[str] = Query(None),
    entity_id: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    _admin: dict = Depends(get_admin_user),
):
    pool = get_pool()
    where = "WHERE 1=1"
    params: list = []

    if entity_type:
        params.append(entity_type)
        where += f" AND entity_type = ${len(params)}"
    if entity_id:
        params.append(entity_id)
        where += f" AND entity_id = ${len(params)}"
    if action:
        params.append(action)
        where += f" AND action = ${len(params)}"

    rows = await pool.fetch(
        f"""
        SELECT id, actor_type, actor_id, action, entity_type, entity_id,
               old_values, new_values, metadata, request_id,
               previous_event_hash, event_hash, created_at
        FROM public.audit_log
        {where}
        ORDER BY created_at DESC, id DESC
        LIMIT {limit}
        """,
        *params,
    )

    return [
        {
            "id": str(r["id"]),
            "actor_type": r["actor_type"],
            "actor_id": r["actor_id"],
            "action": r["action"],
            "entity_type": r["entity_type"],
            "entity_id": r["entity_id"],
            "old_values": r["old_values"],
            "new_values": r["new_values"],
            "metadata": r["metadata"],
            "request_id": r["request_id"],
            "previous_event_hash": r["previous_event_hash"],
            "event_hash": r["event_hash"],
            "created_at": r["created_at"].isoformat(),
        }
        for r in rows
    ]


# ── GET /admin/analytics ──────────────────────────────────────────────────────

@router.get("/analytics", summary="Platform analytics for admin dashboard")
async def analytics(_admin: dict = Depends(get_admin_user)):
    pool = get_pool()

    # Submission volume last 30 days
    vol_rows = await pool.fetch(
        """
        SELECT
            DATE(s.submitted_at)                                          AS day,
            COUNT(s.id)                                                   AS total,
            COUNT(r.id) FILTER (WHERE r.credential_eligible = true)       AS passed
        FROM public.submissions s
        LEFT JOIN public.reviews r ON r.submission_id = s.id
        WHERE s.submitted_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(s.submitted_at)
        ORDER BY day
        """
    )
    vol_by_day: dict[date, dict] = {row["day"]: row for row in vol_rows}
    today = date.today()
    submissions_by_day = [
        {
            "date": (today - timedelta(days=i)).isoformat(),
            "total": int(vol_by_day.get(today - timedelta(days=i), {}).get("total", 0)),
            "passed": int(vol_by_day.get(today - timedelta(days=i), {}).get("passed", 0)),
        }
        for i in range(29, -1, -1)
    ]

    # Pass rate by skill path (last 30 days, top 10 by volume)
    path_rows = await pool.fetch(
        """
        SELECT
            sp.slug,
            sp.name,
            COUNT(s.id)                                               AS total,
            COUNT(r.id) FILTER (WHERE r.credential_eligible = true)  AS passed
        FROM public.submissions s
        LEFT JOIN public.reviews r  ON r.submission_id = s.id
        JOIN public.tasks t         ON t.id = s.task_id
        JOIN public.skill_paths sp  ON sp.id = t.skill_path_id
        WHERE s.submitted_at >= NOW() - INTERVAL '30 days'
        GROUP BY sp.slug, sp.name
        ORDER BY total DESC
        LIMIT 10
        """
    )
    pass_rate_by_path = [
        {
            "slug": r["slug"],
            "name": r["name"],
            "total": int(r["total"]),
            "passed": int(r["passed"]),
            "pass_rate": round(float(r["passed"]) / float(r["total"]), 3) if r["total"] else 0.0,
        }
        for r in path_rows
    ]

    # Top countries by submission count (last 30 days)
    country_rows = await pool.fetch(
        """
        SELECT
            COALESCE(u.country_code, 'XX')  AS country_code,
            COUNT(s.id)                      AS submission_count,
            COUNT(DISTINCT u.id)             AS user_count
        FROM public.submissions s
        JOIN public.users u ON u.id = s.user_id
        WHERE s.submitted_at >= NOW() - INTERVAL '30 days'
        GROUP BY u.country_code
        ORDER BY submission_count DESC
        LIMIT 10
        """
    )
    top_countries = [
        {
            "country_code": r["country_code"],
            "submission_count": int(r["submission_count"]),
            "user_count": int(r["user_count"]),
        }
        for r in country_rows
    ]

    # 30-day totals
    totals_row = await pool.fetchrow(
        """
        SELECT
            (SELECT COUNT(*) FROM public.submissions
             WHERE submitted_at >= NOW() - INTERVAL '30 days')              AS submissions_30d,
            (SELECT COUNT(*) FROM public.credentials
             WHERE created_at  >= NOW() - INTERVAL '30 days')              AS credentials_30d,
            (SELECT COUNT(DISTINCT user_id) FROM public.submissions
             WHERE submitted_at >= NOW() - INTERVAL '30 days')             AS active_users_30d,
            (SELECT COUNT(*) FROM public.reviews r
             WHERE r.human_review_requested = true
               AND EXISTS (
                   SELECT 1 FROM public.submissions s
                   WHERE s.id = r.submission_id
                     AND s.status NOT IN ('human_reviewed', 'final')
               ))                                                           AS queue_depth
        """
    )

    return {
        "submissions_by_day": submissions_by_day,
        "pass_rate_by_path": pass_rate_by_path,
        "top_countries": top_countries,
        "totals": {
            "submissions_30d": int(totals_row["submissions_30d"]),
            "credentials_30d": int(totals_row["credentials_30d"]),
            "active_users_30d": int(totals_row["active_users_30d"]),
            "queue_depth": int(totals_row["queue_depth"]),
        },
    }

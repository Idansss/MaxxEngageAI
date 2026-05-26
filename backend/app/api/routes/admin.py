"""
Admin routes — protected by ADMIN_EMAILS allowlist.
Human reviewers use these to triage flagged submissions and view calibration data.
"""

import json
import uuid
from typing import Literal, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.api.deps import get_admin_user
from app.core.database import get_pool
from app.core.logging import logger
from app.services.audit import append_audit_log

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
            s.id              AS submission_id,
            s.status          AS submission_status,
            s.user_id,
            t.level,
            sp.id             AS skill_path_id,
            sp.slug           AS skill_path_slug,
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

    async with pool.acquire() as conn:
        if body.decision == "approve":
            # Mark submission as human-reviewed
            await conn.execute(
                "UPDATE public.submissions SET status = 'human_reviewed' WHERE id = $1::uuid",
                submission_id,
            )

            if row["credential_issued"]:
                # Credential already exists — mark it human-verified
                await conn.execute(
                    """
                    UPDATE public.credentials
                    SET verified_by_human = true,
                        vc_document = jsonb_set(
                            vc_document,
                            '{credentialSubject,verifiedByHuman}',
                            'true'::jsonb
                        )
                    WHERE submission_id = $1::uuid
                    """,
                    submission_id,
                )
                logger.info("admin.approved.credential_upgraded",
                            review_id=review_id, admin=admin["email"])
            else:
                # No credential yet (score was near threshold) — issue one now
                import uuid, json as _json
                from datetime import datetime, timezone

                levels = row["levels"] if isinstance(row["levels"], list) else json.loads(str(row["levels"]))
                level = row["level"] or 1
                level_label = next((lv["label"] for lv in levels if lv.get("level") == level), f"Level {level}")

                credential_id = str(uuid.uuid4())
                issued_credential_id = credential_id
                now = datetime.now(timezone.utc).isoformat()
                vc_document = {
                    "@context": ["https://www.w3.org/ns/credentials/v2"],
                    "id": f"urn:uuid:{credential_id}",
                    "type": ["VerifiableCredential", "MaxxEngageCompetenceCredential"],
                    "issuer": {"id": "did:web:maxx-engage.io", "name": "Maxx Engage"},
                    "validFrom": now,
                    "credentialSubject": {
                        "id": row["holder_did"],
                        "skillPath": row["skill_path_slug"],
                        "level": level,
                        "levelLabel": level_label,
                        "score": float(row["overall_score"]),
                        "rubricId": row["rubric_id"],
                        "reviewId": review_id,
                        "submissionId": submission_id,
                        "verifiedByHuman": True,
                        "zkProofAvailable": False,
                    },
                }
                await conn.execute(
                    """
                    INSERT INTO public.credentials
                        (id, user_id, submission_id, review_id, holder_did,
                         skill_path_id, level, level_label, score,
                         verified_by_human, zk_proof_available, vc_document)
                    VALUES
                        ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5,
                         $6::uuid, $7, $8, $9, true, false, $10::jsonb)
                    """,
                    credential_id, user_id, submission_id, review_id,
                    row["holder_did"], str(row["skill_path_id"]),
                    level, level_label, float(row["overall_score"]),
                    _json.dumps(vc_document),
                )
                logger.info("admin.approved.credential_issued",
                            review_id=review_id, credential_id=credential_id, admin=admin["email"])

        else:  # reject
            await conn.execute(
                "UPDATE public.submissions SET status = 'human_reviewed' WHERE id = $1::uuid",
                submission_id,
            )
            if body.note:
                await conn.execute(
                    "UPDATE public.reviews SET appeal_reason = $1 WHERE id = $2::uuid",
                    f"[REJECTED by {admin['email']}] {body.note}",
                    review_id,
                )
            logger.info("admin.rejected", review_id=review_id, admin=admin["email"], note=body.note)

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

"""
Admin routes — protected by ADMIN_EMAILS allowlist.
Human reviewers use these to triage flagged submissions.
"""

import json
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.api.deps import get_admin_user
from app.core.database import get_pool
from app.core.logging import logger

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
            r.rubric_id,
            s.id              AS submission_id,
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
                now = datetime.now(timezone.utc).isoformat()
                vc_document = {
                    "@context": ["https://www.w3.org/ns/credentials/v2"],
                    "id": f"urn:uuid:{credential_id}",
                    "type": ["VerifiableCredential", "ProofOSCompetenceCredential"],
                    "issuer": {"id": "did:web:proofos.io", "name": "ProofOS"},
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

    return {"ok": True, "decision": body.decision, "review_id": review_id}

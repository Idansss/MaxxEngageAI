"""
Issue a W3C Verifiable Credential 2.0 when a submission is credential-eligible.
Writes to the credentials table; returns credential_id or None on failure.
"""

import json
import uuid
from datetime import datetime, timezone

from app.core.database import get_pool
from app.core.logging import logger
from app.models.assess import AssessRequest, AssessResponse


async def issue_credential(
    request: AssessRequest,
    response: AssessResponse,
    submission_id: str,
) -> str | None:
    """
    Look up skill path + user DID, build a W3C VC 2.0 document, persist to DB.
    Returns credential_id if issued, None on any failure.
    """
    try:
        pool = get_pool()
    except RuntimeError:
        return None

    try:
        async with pool.acquire() as conn:
            sp_row = await conn.fetchrow(
                "SELECT id, levels FROM public.skill_paths WHERE slug = $1 AND active = true",
                request.skill_path_slug,
            )
            if not sp_row:
                logger.warning(
                    "credentials.skill_path_not_found",
                    slug=request.skill_path_slug,
                )
                return None

            skill_path_id = str(sp_row["id"])
            levels = sp_row["levels"] if isinstance(sp_row["levels"], list) else json.loads(sp_row["levels"])
            level_label = next(
                (lv["label"] for lv in levels if lv.get("level") == request.level),
                f"Level {request.level}",
            )

            user_row = await conn.fetchrow(
                "SELECT did FROM public.users WHERE id = $1::uuid",
                request.user_id,
            )
            if not user_row:
                logger.warning("credentials.user_not_found", user_id=request.user_id)
                return None

            holder_did = user_row["did"]
            credential_id = str(uuid.uuid4())
            now = datetime.now(timezone.utc).isoformat()

            vc_document = {
                "@context": ["https://www.w3.org/ns/credentials/v2"],
                "id": f"urn:uuid:{credential_id}",
                "type": ["VerifiableCredential", "ProofOSCompetenceCredential"],
                "issuer": {"id": "did:web:proofos.io", "name": "ProofOS"},
                "validFrom": now,
                "credentialSubject": {
                    "id": holder_did,
                    "type": "CompetenceCredential",
                    "skillPath": request.skill_path_slug,
                    "skillPathId": skill_path_id,
                    "level": request.level,
                    "levelLabel": level_label,
                    "score": response.overall_score,
                    "rubricId": request.rubric_id,
                    "reviewId": response.review_id,
                    "submissionId": submission_id,
                    "verifiedByHuman": False,
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
                     $6::uuid, $7, $8, $9,
                     false, false, $10::jsonb)
                """,
                credential_id,
                request.user_id,
                submission_id,
                response.review_id,
                holder_did,
                skill_path_id,
                request.level,
                level_label,
                response.overall_score,
                json.dumps(vc_document),
            )

        logger.info(
            "credentials.issued",
            credential_id=credential_id,
            user_id=request.user_id,
            skill_path=request.skill_path_slug,
            level=request.level,
            score=response.overall_score,
        )
        return credential_id

    except Exception as e:
        logger.error("credentials.error", error=str(e))
        return None

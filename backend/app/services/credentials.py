"""
Issue a W3C Verifiable Credential 2.0 when a submission is credential-eligible.
Writes to the credentials table; returns credential_id or None on failure.

Engine 1 additions (migration 006):
  - Percentile rank among all credentials for this skill_path/level.
  - Score commitment (HMAC-SHA256) for verifier-friendly selective disclosure.
  - Consistency score across prior attempts for this user + skill_path.
  - Trust score recomputed after issuance (Sybil resistance).
"""

import json
import uuid
from datetime import datetime, timezone

from app.core.config import get_settings
from app.core.database import get_pool
from app.core.logging import logger
from app.models.assess import AssessRequest, AssessResponse
from app.services.anchoring import anchor_credential
from app.services.audit import append_audit_log
from app.services.consistency import compute_consistency
from app.services.did import did_to_verification_method
from app.services.sybil import recompute_trust_after_credential
from app.services.vc_signing import VC_CONTEXT, sign_credential
from app.services.zk import compute_percentile, make_percentile_claim, make_score_commitment


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

    settings = get_settings()

    try:
        async with pool.acquire() as conn:
            sp_row = await conn.fetchrow(
                """
                SELECT id, levels, decay_half_life_months, decay_refresh_months
                FROM public.skill_paths
                WHERE slug = $1 AND active = true
                """,
                request.skill_path_slug,
            )
            if not sp_row:
                logger.warning(
                    "credentials.skill_path_not_found",
                    slug=request.skill_path_slug,
                )
                return None

            skill_path_id = str(sp_row["id"])
            levels = (
                sp_row["levels"]
                if isinstance(sp_row["levels"], list)
                else json.loads(sp_row["levels"])
            )
            level_label = next(
                (lv["label"] for lv in levels if lv.get("level") == request.level),
                f"Level {request.level}",
            )

            user_row = await conn.fetchrow(
                "SELECT did FROM public.users WHERE id = $1::uuid",
                request.user_id,
            )
            if not user_row:
                logger.warning(
                    "credentials.user_not_found", user_id=request.user_id
                )
                return None

            holder_did = user_row["did"]
            credential_id = str(uuid.uuid4())
            now = datetime.now(timezone.utc)
            now_iso = now.isoformat()

        # ── Compute Engine 1 enrichments (outside the conn scope to avoid timeouts) ──

        # Percentile rank (needs full pool, not single conn)
        percentile = await compute_percentile(
            response.overall_score,
            request.skill_path_slug,
            request.level,
            pool,
        )

        # ZK commitment over exact score
        commitment = make_score_commitment(
            credential_id, response.overall_score, settings.zk_secret_key
        )

        # Signed percentile claim (None when percentile is not yet computable)
        percentile_claim = None
        zk_proof_available = False
        if percentile is not None:
            percentile_claim = make_percentile_claim(
                credential_id,
                percentile,
                request.skill_path_slug,
                request.level,
                settings.zk_secret_key,
            )
            zk_proof_available = True

        # Consistency across attempts
        consistency = await compute_consistency(
            request.user_id,
            request.skill_path_slug,
            pool,
        )

        # ── Build W3C VC 2.0 document (unsigned) ──────────────────────────────
        unsigned_vc: dict = {
            "@context": VC_CONTEXT,
            "id": f"urn:uuid:{credential_id}",
            "type": ["VerifiableCredential", "MaxxEngageCompetenceCredential"],
            "issuer": {"id": settings.issuer_did, "name": "Maxx Engage"},
            "validFrom": now_iso,
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
                "zkProofAvailable": zk_proof_available,
                "scoreCommitment": commitment,
                "decayHalfLifeMonths": sp_row["decay_half_life_months"],
                **({"percentileClaim": percentile_claim} if percentile_claim else {}),
                "consistencyRating": consistency["consistency_rating"],
                **(
                    {"consistencyScore": consistency["consistency_score"]}
                    if consistency["consistency_score"] is not None
                    else {}
                ),
                "attemptCount": consistency["attempt_count"],
            },
        }

        # ── Sign with issuer Ed25519 key (eddsa-jcs-2022) ─────────────────────
        if settings.issuer_private_key_b64:
            verification_method = did_to_verification_method(settings.issuer_did)
            vc_document = sign_credential(
                unsigned_vc,
                settings.issuer_private_key_b64,
                settings.issuer_did,
                verification_method,
            )
        else:
            # No issuer key configured — store unsigned (dev/test only)
            logger.warning("credentials.unsigned", reason="ISSUER_PRIVATE_KEY_B64 not set")
            vc_document = unsigned_vc

        anchor = await anchor_credential(vc_document, credential_id)
        # ── Persist ───────────────────────────────────────────────────────────
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO public.credentials
                    (id, user_id, submission_id, review_id, holder_did,
                     skill_path_id, level, level_label, score, percentile,
                     verified_by_human, zk_proof_available,
                     score_commitment, consistency_score, consistency_rating,
                     attempt_count, vc_document,
                     content_hash, ipfs_cid, anchor_provider, anchor_status, anchor_url)
                VALUES
                    ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5,
                     $6::uuid, $7, $8, $9, $10,
                     false, $11,
                     $12, $13, $14,
                     $15, $16::jsonb,
                     $17, $18, $19, $20, $21)
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
                percentile,
                zk_proof_available,
                commitment,
                consistency["consistency_score"],
                consistency["consistency_rating"],
                consistency["attempt_count"],
                json.dumps(vc_document),
                anchor.content_hash,
                anchor.ipfs_cid,
                anchor.provider,
                anchor.status,
                anchor.anchor_url,
            )

        # Recompute trust score — new credential raises vouching eligibility
        try:
            await recompute_trust_after_credential(request.user_id)
        except Exception:
            pass  # non-critical; next vouch or credential issuance will fix it

        logger.info(
            "credentials.issued",
            credential_id=credential_id,
            user_id=request.user_id,
            skill_path=request.skill_path_slug,
            level=request.level,
            score=response.overall_score,
            percentile=percentile,
            consistency_rating=consistency["consistency_rating"],
            anchor_status=anchor.status,
            ipfs_cid=anchor.ipfs_cid,
        )
        await append_audit_log(
            action="credential.issued",
            actor_type="system",
            actor_id=response.model_used,
            entity_type="credential",
            entity_id=credential_id,
            new_values={
                "user_id": request.user_id,
                "submission_id": submission_id,
                "review_id": response.review_id,
                "skill_path_slug": request.skill_path_slug,
                "level": request.level,
                "score": response.overall_score,
                "percentile": percentile,
                "verified_by_human": False,
                "content_hash": anchor.content_hash,
                "ipfs_cid": anchor.ipfs_cid,
                "anchor_provider": anchor.provider,
                "anchor_status": anchor.status,
                "anchor_url": anchor.anchor_url,
            },
            metadata={
                "rubric_id": request.rubric_id,
                "consistency_rating": consistency["consistency_rating"],
                "zk_proof_available": zk_proof_available,
            },
        )
        return credential_id

    except Exception as e:
        logger.error("credentials.error", error=str(e))
        return None

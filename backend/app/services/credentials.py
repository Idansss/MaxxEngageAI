"""
Issue a W3C Verifiable Credential 2.0 when a submission is credential-eligible.
Writes to the credentials table; returns credential_id or None on failure.

Engine 1 additions (migration 006):
  - Percentile rank among all credentials for this skill_path/level.
  - Score commitment (HMAC-SHA256) for verifier-friendly selective disclosure.
  - Consistency score across prior attempts for this user + skill_path.
  - Trust score recomputed after issuance (Sybil resistance).
"""

import asyncio
import hashlib
import json
import re
import secrets
import string
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


async def _fire_credential_email(
    user_id: str,
    skill_path_name: str,
    level_label: str,
    score: float,
    credential_id: str,
    pool,
) -> None:
    try:
        from app.services.email import get_email_by_auth_id, send_credential_earned
        row = await pool.fetchrow(
            "SELECT auth_id, display_name FROM public.users WHERE id = $1::uuid", user_id
        )
        if not row or not row["auth_id"]:
            return
        email = await get_email_by_auth_id(str(row["auth_id"]))
        if not email:
            return
        site_url = get_settings().site_url
        await send_credential_earned(
            to=email,
            display_name=row["display_name"] or "Learner",
            skill_path_name=skill_path_name,
            level_label=level_label,
            score=score,
            credential_id=credential_id,
            site_url=site_url,
        )
    except Exception as exc:
        logger.warning("credentials.email_error", user_id=user_id, error=str(exc))


def _new_public_credential_id() -> str:
    alphabet = string.ascii_lowercase + string.digits
    return "cred_" + "".join(secrets.choice(alphabet) for _ in range(12))


_RESERVED_USERNAMES = {
    "admin", "api", "assess", "dashboard", "verify", "u", "identity",
    "wallet", "community", "start", "sign", "login", "signup", "learn",
    "skill-paths", "results", "credentials", "submissions", "profile",
    "onboarding", "auth", "health", "support", "maxx", "maxxengage",
    "system", "null", "undefined", "root", "help", "leaderboard",
    "employers", "hire", "talent",
}


def _username_base(display_name: str | None) -> str:
    base = re.sub(r"[^a-z0-9_]+", "_", (display_name or "talent").lower()).strip("_")
    if len(base) < 3:
        base = "talent"
    if base in _RESERVED_USERNAMES:
        base = f"{base}_user"
    return base[:20].strip("_") or "talent"


async def _ensure_username(user_id: str, pool) -> str | None:
    row = await pool.fetchrow(
        "SELECT username, display_name FROM public.users WHERE id = $1::uuid",
        user_id,
    )
    if not row or row["username"]:
        return row["username"] if row else None

    base = _username_base(row["display_name"])
    for attempt in range(8):
        suffix = "" if attempt == 0 else "_" + "".join(
            secrets.choice(string.digits) for _ in range(min(4, attempt + 2))
        )
        candidate = f"{base[:20 - len(suffix)]}{suffix}"
        if candidate in _RESERVED_USERNAMES:
            continue
        try:
            updated = await pool.fetchrow(
                """
                UPDATE public.users
                SET username = $1
                WHERE id = $2::uuid AND username IS NULL
                RETURNING username
                """,
                candidate,
                user_id,
            )
            if updated:
                return updated["username"]
        except Exception as exc:
            if "unique" not in str(exc).lower():
                logger.warning("credentials.username_auto_failed", user_id=user_id, error=str(exc))
                return None
    return None


async def issue_credential(
    request: AssessRequest,
    response: AssessResponse,
    submission_id: str,
    *,
    graded_by: str = "ai",
    verified_by_human: bool = False,
    human_reviewer_id: str | None = None,
    flagged_for_review: bool = False,
    flag_reason: str | None = None,
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
                SELECT id, name, domain, levels, decay_half_life_months, decay_refresh_months
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
            db_credential_id = str(uuid.uuid4())
            credential_id = _new_public_credential_id()
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
            "id": f"urn:maxx-engage:credential:{credential_id}",
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
                "verifiedByHuman": verified_by_human,
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
        submission_hash = hashlib.sha256(request.content.encode("utf-8")).hexdigest()
        scores_by_category = {
            s.dimension: {
                "points": s.score,
                "max": s.max_score,
                "comment": s.rationale,
                "suggestion": response.feedback.improvements[0] if response.feedback.improvements else "",
            }
            for s in response.scores
        }
        # ── Persist ───────────────────────────────────────────────────────────
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO public.credentials
                    (id, public_id, user_id, submission_id, review_id, holder_did,
                     skill_path_id, level, level_label, score, percentile,
                     verified_by_human, zk_proof_available,
                     score_commitment, consistency_score, consistency_rating,
                     attempt_count, vc_document,
                     content_hash, ipfs_cid, anchor_provider, anchor_status, anchor_url,
                     rubric_id, rubric_version, skill_name, category, max_score,
                     pass_threshold, scores_by_category, submission_hash, graded_by,
                     human_reviewer_id, flagged_for_review, flag_reason,
                     passed, graded_at, public_visible)
                VALUES
                    ($1::uuid, $2, $3::uuid, $4::uuid, $5::uuid, $6,
                     $7::uuid, $8, $9, $10, $11,
                     $12, $13,
                     $14, $15, $16,
                     $17, $18::jsonb,
                     $19, $20, $21, $22, $23,
                     $24, $25, $26, $27, $28,
                     $29, $30::jsonb, $31, $32,
                     $33::uuid, $34, $35,
                     true, $36, true)
                """,
                db_credential_id,
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
                verified_by_human,
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
                request.rubric_id,
                "1",
                sp_row["name"],
                str(sp_row["domain"]).title(),
                100,
                response.pass_threshold,
                json.dumps(scores_by_category),
                submission_hash,
                graded_by,
                human_reviewer_id,
                flagged_for_review,
                flag_reason,
                now,
            )

        # Recompute trust score — new credential raises vouching eligibility
        try:
            await recompute_trust_after_credential(request.user_id)
        except Exception:
            pass  # non-critical; next vouch or credential issuance will fix it

        try:
            await _ensure_username(request.user_id, pool)
        except Exception as exc:
            logger.warning("credentials.username_auto_error", user_id=request.user_id, error=str(exc))

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
                "verified_by_human": verified_by_human,
                "graded_by": graded_by,
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
        asyncio.create_task(_fire_credential_email(
            request.user_id, sp_row["name"], level_label,
            response.overall_score, credential_id, pool,
        ))

        return credential_id

    except Exception as e:
        logger.error("credentials.error", error=str(e))
        return None

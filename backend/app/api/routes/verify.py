import hashlib
import re
from urllib.parse import urlparse

from fastapi import APIRouter, HTTPException, Query, Request

from app.core.database import get_pool
from app.core.limiter import limiter
from app.core.logging import logger

router = APIRouter(prefix="/verify", tags=["verify"])

_CRED_RE = re.compile(r"cred_[A-Za-z0-9_-]{10,32}")
_UUID_RE = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", re.I)
_USERNAME_RE = re.compile(r"^[a-z0-9_]{3,20}$", re.I)


def _hash(value: str | None) -> str | None:
    if not value:
        return None
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _parse_input(raw: str) -> tuple[str, str] | None:
    value = raw.strip()
    if not value:
        return None

    cred = _CRED_RE.search(value)
    if cred:
        return "credential", cred.group(0)

    uuid_match = _UUID_RE.search(value)
    if uuid_match:
        return "credential", uuid_match.group(0)

    try:
        parsed = urlparse(value if "://" in value else f"https://{value}")
        parts = [p for p in parsed.path.split("/") if p]
        if len(parts) >= 4 and parts[0] == "u" and parts[2] == "credential":
            return "credential", parts[3]
        if len(parts) >= 2 and parts[0] == "u" and _USERNAME_RE.match(parts[1]):
            return "user", parts[1].lower()
    except Exception:
        pass

    if _USERNAME_RE.match(value) and "." not in value:
        return "user", value.lower()

    return None


def _credential_payload(row) -> dict:
    return {
        "id": row["public_id"],
        "skill_name": row["skill_name"] or row["skill_path_name"],
        "skill_path_name": row["skill_path_name"],
        "skill_path_slug": row["skill_path_slug"],
        "category": row["category"] or str(row["domain"]).title(),
        "domain": row["domain"],
        "score": float(row["score"]),
        "max_score": float(row["max_score"] or 100),
        "pass_threshold": float(row["pass_threshold"] or 70),
        "level": row["level"],
        "level_label": row["level_label"],
        "rubric_id": row["rubric_id"],
        "rubric_version": row["rubric_version"],
        "issued_at": row["valid_from"].isoformat() if row["valid_from"] else None,
        "graded_by": row["graded_by"],
        "verified_by_human": row["verified_by_human"],
        "flagged_for_review": row["flagged_for_review"],
        "flag_reason": row["flag_reason"],
        "revoked": row["revoked"],
        "revoked_at": row["revoked_at"].isoformat() if row["revoked_at"] else None,
        "revoked_reason": row["revoked_reason"],
        "content_hash": row["content_hash"],
        "submission_hash": row["submission_hash"],
        "vc_document": row["vc_document"],
    }


async def _log_verify(request: Request, *, input_kind: str, found: bool, credential_id: str | None = None, username: str | None = None):
    try:
        pool = get_pool()
        await pool.execute(
            """
            INSERT INTO public.credential_verify_events
                (input_kind, credential_id, username, found, ip_hash, user_agent_hash)
            VALUES ($1, $2, $3, $4, $5, $6)
            """,
            input_kind,
            credential_id,
            username,
            found,
            _hash(request.client.host if request.client else None),
            _hash(request.headers.get("user-agent")),
        )
    except Exception as exc:
        logger.warning("verify.log_failed", error=str(exc))


async def _fetch_credential(identifier: str):
    pool = get_pool()
    return await pool.fetchrow(
        """
        SELECT
            COALESCE(c.public_id, c.id::text) AS public_id,
            c.level, c.level_label, c.score, c.valid_from, c.verified_by_human,
            c.content_hash, c.vc_document, c.user_id,
            c.rubric_id, c.rubric_version, c.skill_name, c.category, c.max_score,
            c.pass_threshold, c.submission_hash, c.graded_by, c.flagged_for_review,
            c.flag_reason, c.revoked, c.revoked_at, c.revoked_reason,
            sp.name AS skill_path_name, sp.slug AS skill_path_slug, sp.domain,
            u.display_name, u.username
        FROM public.credentials c
        JOIN public.skill_paths sp ON sp.id = c.skill_path_id
        JOIN public.users u ON u.id = c.user_id
        WHERE (c.public_id = $1 OR c.id::text = $1)
          AND c.is_public = true
          AND c.public_visible = true
          AND u.proof_page_visibility IN ('public', 'unlisted')
        """,
        identifier,
    )


@router.get("", summary="Verify a credential ID, credential URL, or proof page URL")
@limiter.limit("60/minute")
async def verify(request: Request, q: str = Query(..., min_length=1, max_length=500)):
    parsed = _parse_input(q)
    if not parsed:
        await _log_verify(request, input_kind="invalid", found=False)
        raise HTTPException(status_code=404, detail="Credential or user not found.")

    kind, value = parsed
    if kind == "credential":
        row = await _fetch_credential(value)
        await _log_verify(request, input_kind="credential", credential_id=value, found=bool(row))
        if not row:
            raise HTTPException(status_code=404, detail="Credential not found.")
        return {
            "kind": "credential",
            "credential": _credential_payload(row),
            "user": {
                "id": str(row["user_id"]),
                "display_name": row["display_name"],
                "username": row["username"],
            },
        }

    pool = get_pool()
    user = await pool.fetchrow(
        """
        SELECT id, display_name, username
        FROM public.users
        WHERE username = $1
          AND proof_page_visibility IN ('public', 'unlisted')
        """,
        value,
    )
    if not user:
        await _log_verify(request, input_kind="user", username=value, found=False)
        raise HTTPException(status_code=404, detail="User not found.")

    rows = await pool.fetch(
        """
        SELECT
            COALESCE(c.public_id, c.id::text) AS public_id,
            c.level, c.level_label, c.score, c.valid_from, c.verified_by_human,
            c.content_hash, c.vc_document, c.user_id,
            c.rubric_id, c.rubric_version, c.skill_name, c.category, c.max_score,
            c.pass_threshold, c.submission_hash, c.graded_by, c.flagged_for_review,
            c.flag_reason, c.revoked, c.revoked_at, c.revoked_reason,
            sp.name AS skill_path_name, sp.slug AS skill_path_slug, sp.domain,
            u.display_name, u.username
        FROM public.credentials c
        JOIN public.skill_paths sp ON sp.id = c.skill_path_id
        JOIN public.users u ON u.id = c.user_id
        WHERE c.user_id = $1::uuid
          AND c.is_public = true
          AND c.public_visible = true
        ORDER BY c.valid_from DESC
        """,
        str(user["id"]),
    )
    await _log_verify(request, input_kind="user", username=value, found=True)
    return {
        "kind": "user",
        "user": {
            "id": str(user["id"]),
            "display_name": user["display_name"],
            "username": user["username"],
        },
        "credentials": [_credential_payload(row) for row in rows],
    }

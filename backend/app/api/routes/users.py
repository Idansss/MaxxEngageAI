import re
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from app.models.users import CreateUserRequest, UserResponse
from app.core.database import get_pool
from app.core.logging import logger
from app.api.deps import get_current_user, get_optional_user
from app.services.sybil import vouch as sybil_vouch
from app.services.did import generate_keypair, pub_to_did, pub_to_multibase, priv_to_b64

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/{user_id}/credentials", summary="List credentials for a user")
async def get_user_credentials(user_id: str):
    try:
        uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="user_id must be a valid UUID.")

    pool = get_pool()

    user = await pool.fetchrow(
        "SELECT id, proof_page_visibility FROM public.users WHERE id = $1::uuid", user_id
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    if user["proof_page_visibility"] == "private":
        raise HTTPException(status_code=404, detail="User not found.")

    rows = await pool.fetch(
        """
        SELECT COALESCE(c.public_id, c.id::text) AS public_id,
               c.id AS internal_id, c.level, c.level_label, c.score, c.percentile,
               c.verified_by_human, c.zk_proof_available, c.is_public, c.public_visible,
               c.revoked, c.revoked_at, c.revoked_reason,
               c.consistency_score, c.consistency_rating, c.attempt_count,
               c.valid_from, c.valid_until, c.created_at,
               sp.slug AS skill_path_slug, sp.name AS skill_path_name, sp.domain,
               sp.decay_half_life_months, sp.decay_refresh_months
        FROM public.credentials c
        JOIN public.skill_paths sp ON sp.id = c.skill_path_id
        WHERE c.user_id = $1::uuid
          AND c.is_public = true
          AND c.public_visible = true
        ORDER BY c.created_at DESC
        """,
        user_id,
    )

    from app.services.decay import compute_decay

    def _enrich(r) -> dict:
        d = {**dict(r), "id": r["public_id"], "internal_id": str(r["internal_id"])}
        d.pop("public_id", None)
        if d.get("valid_from"):
            decay = compute_decay(
                raw_score=float(d["score"]),
                issued_at=d["valid_from"],
                half_life_months=d["decay_half_life_months"],
                refresh_months=d.get("decay_refresh_months"),
            )
            d["decay"] = decay
        return d

    return [_enrich(r) for r in rows]


@router.get("/{user_id}/pending-credentials", summary="List passed assessments pending human review for a user")
async def get_user_pending_credentials(user_id: str):
    try:
        uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="user_id must be a valid UUID.")

    pool = get_pool()
    user = await pool.fetchrow(
        "SELECT id, proof_page_visibility FROM public.users WHERE id = $1::uuid", user_id
    )
    if not user or user["proof_page_visibility"] == "private":
        raise HTTPException(status_code=404, detail="User not found.")

    rows = await pool.fetch(
        """
        SELECT
            r.id AS review_id,
            r.rubric_id,
            r.overall_score,
            r.reviewed_at,
            sp.name AS skill_path_name,
            sp.slug AS skill_path_slug,
            sp.domain,
            t.level
        FROM public.reviews r
        JOIN public.submissions s ON s.id = r.submission_id
        JOIN public.tasks t ON t.id = s.task_id
        JOIN public.skill_paths sp ON sp.id = t.skill_path_id
        LEFT JOIN public.credentials c ON c.submission_id = s.id
        WHERE s.user_id = $1::uuid
          AND r.human_review_requested = true
          AND r.overall_score >= CASE WHEN r.rubric_id = 'translate-yo-en-001' THEN 75 ELSE 70 END
          AND c.id IS NULL
        ORDER BY r.reviewed_at DESC
        """,
        user_id,
    )
    return [
        {
            "review_id": str(r["review_id"]),
            "rubric_id": r["rubric_id"],
            "score": float(r["overall_score"]),
            "reviewed_at": r["reviewed_at"].isoformat() if r["reviewed_at"] else None,
            "skill_path_name": r["skill_path_name"],
            "skill_path_slug": r["skill_path_slug"],
            "domain": r["domain"],
            "level": r["level"],
            "status": "pending_human_review",
        }
        for r in rows
    ]


@router.post("", response_model=UserResponse, status_code=201, summary="Register a new user")
async def create_user(request: CreateUserRequest) -> UserResponse:
    pool = get_pool()

    # If caller provides their own DID (e.g. from an external wallet), honour it.
    # Otherwise generate a fresh did:key keypair server-side.
    if request.did:
        did = request.did
        pub_multibase = None
        priv_b64_val = None
    else:
        priv_bytes, pub_bytes = generate_keypair()
        did = pub_to_did(pub_bytes)
        pub_multibase = pub_to_multibase(pub_bytes)
        priv_b64_val = priv_to_b64(priv_bytes)

    try:
        row = await pool.fetchrow(
            """
            INSERT INTO public.users
                (did, public_key_multibase, private_key_b64,
                 display_name, bio, country_code, preferred_language, avatar_url, public_profile)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
            RETURNING id, did, display_name, bio, country_code, preferred_language,
                      avatar_url, public_profile, overall_score, created_at, location,
                      username, proof_page_visibility
            """,
            did,
            pub_multibase,
            priv_b64_val,
            request.display_name,
            request.bio,
            request.country_code.upper(),
            request.preferred_language,
            request.avatar_url,
        )
    except Exception as e:
        if "unique" in str(e).lower():
            raise HTTPException(status_code=409, detail=f"DID '{did}' is already registered.")
        logger.error("users.create_error", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to create user.")

    logger.info("users.created", user_id=str(row["id"]), did=did)
    return UserResponse(**{**dict(row), "id": str(row["id"])})


@router.get("/{user_id}", response_model=UserResponse, summary="Get a user by ID")
async def get_user(user_id: str) -> UserResponse:
    try:
        uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="user_id must be a valid UUID.")

    pool = get_pool()
    row = await pool.fetchrow(
        """
        SELECT id, auth_id, did, display_name, bio, country_code, preferred_language,
               avatar_url, public_profile, overall_score, created_at, location,
               username, proof_page_visibility
        FROM public.users WHERE id = $1::uuid
        """,
        user_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail=f"User '{user_id}' not found.")
    return UserResponse(**{**dict(row), "id": str(row["id"])})


# ── GET /users/{user_id}/submissions ─────────────────────────────────────────

@router.get("/{user_id}/submissions", summary="List a user's completed submissions (public)")
async def get_user_submissions(
    user_id: str,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """
    Public endpoint. Returns a user's completed (ai_reviewed, human_reviewed, final)
    submissions with scores — useful for verifiers who want to see a learner's
    assessment track record beyond just their issued credentials.

    Only submissions attached to a review are returned. Pending and private submissions
    are excluded.
    """
    try:
        uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="user_id must be a valid UUID.")

    pool = get_pool()
    user = await pool.fetchrow(
        "SELECT id, proof_page_visibility FROM public.users WHERE id = $1::uuid", user_id
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    if user["proof_page_visibility"] == "private":
        raise HTTPException(
            status_code=404,
            detail="User not found.",
        )

    rows = await pool.fetch(
        """
        SELECT
            s.id,
            s.status,
            s.submitted_at,
            s.attempt_number,
            t.level,
            t.type   AS task_type,
            sp.name  AS skill_path_name,
            sp.slug  AS skill_path_slug,
            sp.domain,
            r.overall_score,
            r.confidence,
            r.credential_eligible,
            r.reviewed_at,
            COALESCE(c.public_id, c.id::text) AS credential_id
        FROM public.submissions s
        JOIN public.tasks t          ON t.id = s.task_id
        JOIN public.skill_paths sp   ON sp.id = t.skill_path_id
        JOIN public.reviews r        ON r.id = s.review_id
        LEFT JOIN public.credentials c
            ON c.submission_id = s.id AND c.is_public = true AND c.public_visible = true
        WHERE s.user_id = $1::uuid
          AND s.status IN ('ai_reviewed', 'human_reviewed', 'final')
        ORDER BY s.submitted_at DESC
        LIMIT $2 OFFSET $3
        """,
        user_id, limit, offset,
    )

    total = await pool.fetchval(
        """
        SELECT COUNT(*) FROM public.submissions s
        JOIN public.reviews r ON r.id = s.review_id
        WHERE s.user_id = $1::uuid
          AND s.status IN ('ai_reviewed', 'human_reviewed', 'final')
        """,
        user_id,
    )

    return {
        "user_id": user_id,
        "total": total,
        "items": [
            {
                "id": str(r["id"]),
                "status": r["status"],
                "submitted_at": r["submitted_at"].isoformat(),
                "reviewed_at": r["reviewed_at"].isoformat() if r["reviewed_at"] else None,
                "attempt_number": r["attempt_number"],
                "level": r["level"],
                "task_type": r["task_type"],
                "skill_path_name": r["skill_path_name"],
                "skill_path_slug": r["skill_path_slug"],
                "domain": r["domain"],
                "score": float(r["overall_score"]) if r["overall_score"] is not None else None,
                "credential_id": str(r["credential_id"]) if r["credential_id"] else None,
            }
            for r in rows
        ],
    }


# ── Sybil resistance: trust-network vouching ──────────────────────────────────

@router.post("/{user_id}/vouch", summary="Vouch for a user's real-world identity")
async def vouch_for_user(
    user_id: str,
    auth_user: dict = Depends(get_current_user),
):
    """
    Attest that this user is a real, unique person you know personally.

    Rules:
    - Your trust_score must be ≥ 20 (earn 2+ credentials to unlock).
    - Maximum 5 vouches given per rolling 30-day window.
    - Cannot vouch for yourself.
    - Each (voucher, vouchee) pair is unique — no duplicate vouches.

    Effect: raises the vouchee's trust_score by 5 points, improving their
    Sybil resistance signal and making their credentials more credible.
    """
    try:
        uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="user_id must be a valid UUID.")

    pool = get_pool()
    voucher_row = await pool.fetchrow(
        "SELECT id FROM public.users WHERE auth_id = $1::uuid",
        auth_user["id"],
    )
    if not voucher_row:
        raise HTTPException(status_code=404, detail="Your user profile not found.")

    voucher_id = str(voucher_row["id"])
    if voucher_id == user_id:
        raise HTTPException(status_code=422, detail="You cannot vouch for yourself.")

    result = await sybil_vouch(voucher_id, user_id)

    # Notify the person being vouched for
    import asyncio
    from app.services.notifications import push as push_notif
    voucher_name_row = await pool.fetchrow(
        "SELECT display_name FROM public.users WHERE id = $1::uuid", voucher_id
    )
    voucher_name = voucher_name_row["display_name"] if voucher_name_row else "Someone"
    asyncio.ensure_future(push_notif(
        user_id=user_id,
        type="vouch_received",
        title="Someone vouched for you",
        body=f"{voucher_name} attested that you are a real, unique person.",
        href="/identity",
        metadata={"voucher_id": voucher_id},
    ))

    return result


@router.get("/{user_id}/vouches", summary="Get vouches received by a user")
async def get_user_vouches(user_id: str):
    """
    Public endpoint. Returns how many verified users have vouched for this user,
    and basic info about each voucher (name and trust score).
    Voucher display names are shown; exact scores are withheld.
    """
    try:
        uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="user_id must be a valid UUID.")

    pool = get_pool()
    rows = await pool.fetch(
        """
        SELECT v.id, v.created_at,
               u.display_name AS voucher_name,
               u.trust_score  AS voucher_trust
        FROM public.vouches v
        JOIN public.users u ON u.id = v.voucher_id
        WHERE v.vouchee_id = $1::uuid AND v.status = 'active'
        ORDER BY v.created_at DESC
        """,
        user_id,
    )
    return {
        "user_id": user_id,
        "vouch_count": len(rows),
        "vouches": [
            {
                "id": str(r["id"]),
                "voucher_name": r["voucher_name"],
                "voucher_trust_score": float(r["voucher_trust"] or 0),
                "created_at": r["created_at"].isoformat(),
            }
            for r in rows
        ],
    }


# ── GET /users/by-username/{username} ────────────────────────────────────────

@router.get("/by-username/{username}", response_model=UserResponse, summary="Look up a user by their public username")
async def get_user_by_username(
    username: str,
    auth_user: dict | None = Depends(get_optional_user),
) -> UserResponse:
    """
    Public endpoint. Used by /u/[username] proof pages to resolve a username to a user profile.
    Returns 404 if the user does not exist or has set their proof page to private.
    """
    pool = get_pool()
    row = await pool.fetchrow(
        """
        SELECT id, did, display_name, bio, country_code, preferred_language,
               avatar_url, public_profile, overall_score, created_at, location,
               username, proof_page_visibility
        FROM public.users
        WHERE username = $1
        """,
        username.lower(),
    )
    if not row:
        raise HTTPException(status_code=404, detail=f"User '{username}' not found.")
    if row["proof_page_visibility"] == "private" and (
        not auth_user or str(row["auth_id"]) != auth_user.get("id")
    ):
        raise HTTPException(status_code=404, detail=f"User '{username}' not found.")
    return UserResponse(**{**dict(row), "id": str(row["id"])})


# ── PATCH /users/me/username ──────────────────────────────────────────────────

_RESERVED_USERNAMES = {
    "admin", "api", "assess", "dashboard", "verify", "u", "identity",
    "wallet", "community", "start", "sign", "login", "signup", "learn",
    "skill-paths", "results", "credentials", "submissions", "profile",
    "onboarding", "auth", "health", "support", "maxx", "maxxengage",
    "system", "null", "undefined", "root", "help",
    "leaderboard", "employers", "hire", "talent",
}

_USERNAME_RE = re.compile(r"^[a-z0-9_]{3,20}$")


class SetUsernameRequest(BaseModel):
    username: str


@router.patch("/me/username", response_model=UserResponse, summary="Set or change your public username")
async def set_username(
    body: SetUsernameRequest,
    auth_user: dict = Depends(get_current_user),
) -> UserResponse:
    """
    Set a unique username that appears in your public proof page URL: /u/[username].
    Rules: 3–20 chars, lowercase alphanumeric + underscore, not a reserved word.
    """
    clean = body.username.strip().lower()

    if not _USERNAME_RE.match(clean):
        raise HTTPException(
            status_code=422,
            detail="Username must be 3–20 characters: lowercase letters, numbers, and underscores only.",
        )
    if clean in _RESERVED_USERNAMES:
        raise HTTPException(
            status_code=422,
            detail=f"'{clean}' is a reserved word and cannot be used as a username.",
        )

    pool = get_pool()
    user_row = await pool.fetchrow(
        "SELECT id FROM public.users WHERE auth_id = $1::uuid", auth_user["id"]
    )
    if not user_row:
        raise HTTPException(status_code=404, detail="User profile not found.")

    try:
        row = await pool.fetchrow(
            """
            UPDATE public.users
            SET username = $1
            WHERE id = $2::uuid
            RETURNING id, did, display_name, bio, country_code, preferred_language,
                      avatar_url, public_profile, overall_score, created_at, location,
                      username, proof_page_visibility
            """,
            clean,
            str(user_row["id"]),
        )
    except Exception as e:
        if "unique" in str(e).lower():
            raise HTTPException(
                status_code=409, detail=f"Username '{clean}' is already taken."
            )
        logger.error("users.set_username_error", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to set username.")

    logger.info("users.username_set", user_id=str(user_row["id"]), username=clean)
    return UserResponse(**{**dict(row), "id": str(row["id"])})


# ── PATCH /users/me ───────────────────────────────────────────────────────────

_COUNTRY_RE = re.compile(r"^[A-Z]{2}$")
_LANG_RE    = re.compile(r"^[a-z]{2,3}(-[A-Za-z]{2,4})?$")
_URL_RE     = re.compile(r"^https?://")


class UpdateProfileRequest(BaseModel):
    display_name: str | None = None
    bio: str | None = None
    avatar_url: str | None = None
    location: str | None = None
    country_code: str | None = None
    preferred_language: str | None = None


@router.patch("/me", response_model=UserResponse, summary="Update your profile")
async def update_profile(
    body: UpdateProfileRequest,
    auth_user: dict = Depends(get_current_user),
) -> UserResponse:
    pool = get_pool()
    user_row = await pool.fetchrow(
        "SELECT id FROM public.users WHERE auth_id = $1::uuid", auth_user["id"]
    )
    if not user_row:
        raise HTTPException(status_code=404, detail="User profile not found.")

    # Validate provided fields
    if body.display_name is not None:
        name = body.display_name.strip()
        if not 2 <= len(name) <= 100:
            raise HTTPException(status_code=422, detail="Display name must be 2–100 characters.")
    else:
        name = None

    if body.country_code is not None:
        cc = body.country_code.strip().upper()
        if not _COUNTRY_RE.match(cc):
            raise HTTPException(status_code=422, detail="country_code must be an ISO 3166-1 alpha-2 code.")
    else:
        cc = None

    if body.preferred_language is not None:
        lang = body.preferred_language.strip()
        if not _LANG_RE.match(lang):
            raise HTTPException(status_code=422, detail="preferred_language must be a BCP-47 tag (e.g. 'en', 'yo').")
    else:
        lang = None

    if body.avatar_url is not None and body.avatar_url != "":
        if not _URL_RE.match(body.avatar_url):
            raise HTTPException(status_code=422, detail="avatar_url must start with http:// or https://.")
    if body.bio is not None and len(body.bio.strip()) > 140:
        raise HTTPException(status_code=422, detail="Bio must be 140 characters or fewer.")
    if body.location is not None and len(body.location.strip()) > 80:
        raise HTTPException(status_code=422, detail="Location must be 80 characters or fewer.")

    # Build dynamic SET clause — only update provided fields
    updates = {}
    if name is not None:          updates["display_name"]      = name
    if body.bio is not None:      updates["bio"]               = body.bio.strip() or None
    if body.avatar_url is not None: updates["avatar_url"]      = body.avatar_url or None
    if body.location is not None: updates["location"]          = body.location.strip() or None
    if cc is not None:            updates["country_code"]      = cc
    if lang is not None:          updates["preferred_language"] = lang

    if not updates:
        # Nothing to change — return current profile
        row = await pool.fetchrow(
            """
            SELECT id, did, display_name, bio, country_code, preferred_language,
                   avatar_url, public_profile, overall_score, created_at, location,
                   username, proof_page_visibility
            FROM public.users WHERE id = $1::uuid
            """,
            str(user_row["id"]),
        )
        return UserResponse(**{**dict(row), "id": str(row["id"])})

    params = list(updates.values())
    set_clause = ", ".join(f"{col} = ${i + 1}" for i, col in enumerate(updates))
    params.append(str(user_row["id"]))

    row = await pool.fetchrow(
        f"""
        UPDATE public.users SET {set_clause}
        WHERE id = ${len(params)}::uuid
        RETURNING id, did, display_name, bio, country_code, preferred_language,
                  avatar_url, public_profile, overall_score, created_at, location,
                  username, proof_page_visibility
        """,
        *params,
    )

    logger.info("users.profile_updated", user_id=str(user_row["id"]))
    return UserResponse(**{**dict(row), "id": str(row["id"])})


# ── PATCH /users/me/visibility ────────────────────────────────────────────────

class SetVisibilityRequest(BaseModel):
    proof_page_visibility: str


@router.patch("/me/visibility", response_model=UserResponse, summary="Set proof page visibility")
async def set_visibility(
    body: SetVisibilityRequest,
    auth_user: dict = Depends(get_current_user),
) -> UserResponse:
    if body.proof_page_visibility not in ("public", "unlisted", "private"):
        raise HTTPException(status_code=422, detail="visibility must be 'public', 'unlisted', or 'private'.")

    pool = get_pool()
    user_row = await pool.fetchrow(
        "SELECT id FROM public.users WHERE auth_id = $1::uuid", auth_user["id"]
    )
    if not user_row:
        raise HTTPException(status_code=404, detail="User profile not found.")

    row = await pool.fetchrow(
        """
        UPDATE public.users
        SET proof_page_visibility = $1,
            public_profile = ($1 <> 'private')
        WHERE id = $2::uuid
        RETURNING id, did, display_name, bio, country_code, preferred_language,
                  avatar_url, public_profile, overall_score, created_at, location,
                  username, proof_page_visibility
        """,
        body.proof_page_visibility,
        str(user_row["id"]),
    )

    logger.info("users.visibility_set", user_id=str(user_row["id"]), visibility=body.proof_page_visibility)
    return UserResponse(**{**dict(row), "id": str(row["id"])})


# ── DELETE /users/me ──────────────────────────────────────────────────────────

@router.delete("/me", status_code=204, summary="Permanently delete the authenticated user's account")
async def delete_account(auth_user: dict = Depends(get_current_user)):
    """
    Hard-deletes all app data for the current user, then removes the Supabase
    auth record. This action is irreversible.
    """
    from fastapi.responses import Response as FResponse
    from app.api.deps import _supabase

    pool = get_pool()
    user_row = await pool.fetchrow(
        "SELECT id FROM public.users WHERE auth_id = $1::uuid", auth_user["id"]
    )
    if not user_row:
        raise HTTPException(status_code=404, detail="User profile not found.")

    user_id = str(user_row["id"])

    # Delete app data; DB cascades handle related rows, but be explicit for safety
    async with pool.acquire() as conn:
        await conn.execute("DELETE FROM public.referrals WHERE referrer_id = $1::uuid OR referee_id = $1::uuid", user_id)
        await conn.execute("DELETE FROM public.stamps WHERE user_id = $1::uuid", user_id)
        await conn.execute("DELETE FROM public.notifications WHERE user_id = $1::uuid", user_id)
        await conn.execute("DELETE FROM public.users WHERE id = $1::uuid", user_id)

    # Remove Supabase auth user (best-effort; already signed-out client can't re-auth)
    try:
        _supabase().auth.admin.delete_user(auth_user["id"])
    except Exception as exc:
        logger.error("account.delete.auth_error", user_id=user_id, error=str(exc))

    logger.info("account.deleted", user_id=user_id)
    return FResponse(status_code=204)

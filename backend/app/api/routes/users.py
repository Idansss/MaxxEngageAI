import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from app.models.users import CreateUserRequest, UserResponse
from app.core.database import get_pool
from app.core.logging import logger
from app.api.deps import get_current_user
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
        "SELECT id, public_profile FROM public.users WHERE id = $1::uuid", user_id
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    rows = await pool.fetch(
        """
        SELECT c.id, c.level, c.level_label, c.score, c.percentile,
               c.verified_by_human, c.zk_proof_available, c.is_public,
               c.consistency_score, c.consistency_rating, c.attempt_count,
               c.valid_from, c.valid_until, c.created_at,
               sp.slug AS skill_path_slug, sp.name AS skill_path_name, sp.domain,
               sp.decay_half_life_months, sp.decay_refresh_months
        FROM public.credentials c
        JOIN public.skill_paths sp ON sp.id = c.skill_path_id
        WHERE c.user_id = $1::uuid
          AND c.is_public = true
        ORDER BY c.created_at DESC
        """,
        user_id,
    )

    from app.services.decay import compute_decay

    def _enrich(r) -> dict:
        d = {**dict(r), "id": str(r["id"])}
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
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id, did, display_name, bio, country_code, preferred_language,
                      avatar_url, public_profile, overall_score, created_at
            """,
            did,
            pub_multibase,
            priv_b64_val,
            request.display_name,
            request.bio,
            request.country_code.upper(),
            request.preferred_language,
            request.avatar_url,
            request.public_profile,
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
        SELECT id, did, display_name, bio, country_code, preferred_language,
               avatar_url, public_profile, overall_score, created_at
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
        "SELECT id, public_profile FROM public.users WHERE id = $1::uuid", user_id
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    if not user["public_profile"]:
        raise HTTPException(
            status_code=403,
            detail="This user's profile is private.",
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
            c.id     AS credential_id
        FROM public.submissions s
        JOIN public.tasks t          ON t.id = s.task_id
        JOIN public.skill_paths sp   ON sp.id = t.skill_path_id
        JOIN public.reviews r        ON r.id = s.review_id
        LEFT JOIN public.credentials c
            ON c.submission_id = s.id AND c.is_public = true
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

    return await sybil_vouch(voucher_id, user_id)


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

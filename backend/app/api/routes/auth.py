import uuid
from fastapi import APIRouter, Depends, HTTPException
from app.api.deps import get_current_user
from app.core.database import get_pool
from app.models.users import UserResponse
from app.core.logging import logger
from app.services.did import generate_keypair, pub_to_did, pub_to_multibase, priv_to_b64
from app.services.identity import mark_email_stamp

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me", response_model=UserResponse, summary="Get or create the authenticated user's Maxx Engage profile")
async def me(auth_user: dict = Depends(get_current_user)) -> UserResponse:
    """
    Returns the Maxx Engage user linked to the Supabase session.
    Creates the profile automatically on first login (no separate signup step).
    """
    auth_id = auth_user["id"]
    email = auth_user.get("email", "")
    pool = get_pool()

    row = await pool.fetchrow(
        "SELECT id, did, display_name, bio, country_code, preferred_language, "
        "avatar_url, public_profile, overall_score, created_at, location, username, proof_page_visibility "
        "FROM public.users WHERE auth_id = $1::uuid",
        auth_id,
    )

    if row:
        return UserResponse(**{**dict(row), "id": str(row["id"])})

    # First login — auto-provision profile with a real did:key DID
    priv_bytes, pub_bytes = generate_keypair()
    did = pub_to_did(pub_bytes)
    pub_multibase = pub_to_multibase(pub_bytes)
    priv_b64 = priv_to_b64(priv_bytes)
    display_name = email.split("@")[0] if email else "Learner"
    try:
        row = await pool.fetchrow(
            """
            INSERT INTO public.users
                (auth_id, did, public_key_multibase, private_key_b64,
                 display_name, country_code, preferred_language, email_verified, public_profile)
            VALUES ($1::uuid, $2, $3, $4, $5, 'NG', 'en', true, true)
            RETURNING id, did, display_name, bio, country_code, preferred_language,
                      avatar_url, public_profile, overall_score, created_at, location,
                      username, proof_page_visibility
            """,
            auth_id, did, pub_multibase, priv_b64, display_name,
        )
    except Exception as e:
        logger.error("auth.me.provision_error", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to create user profile.")

    logger.info("auth.me.provisioned", auth_id=auth_id, did=did)

    # Award email stamp immediately — magic-link login = verified email
    new_user_id = str(row["id"])
    try:
        await mark_email_stamp(new_user_id, pool)
    except Exception:
        pass  # non-critical; score will be 0 until next login triggers it

    return UserResponse(**{**dict(row), "id": new_user_id})

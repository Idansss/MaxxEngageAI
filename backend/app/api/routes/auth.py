import uuid
from fastapi import APIRouter, Depends, HTTPException
from app.api.deps import get_current_user
from app.core.database import get_pool
from app.models.users import UserResponse
from app.core.logging import logger

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me", response_model=UserResponse, summary="Get or create the authenticated user's ProofOS profile")
async def me(auth_user: dict = Depends(get_current_user)) -> UserResponse:
    """
    Returns the ProofOS user linked to the Supabase session.
    Creates the profile automatically on first login (no separate signup step).
    """
    auth_id = auth_user["id"]
    email = auth_user.get("email", "")
    pool = get_pool()

    row = await pool.fetchrow(
        "SELECT id, did, display_name, bio, country_code, preferred_language, "
        "avatar_url, public_profile, overall_score, created_at "
        "FROM public.users WHERE auth_id = $1::uuid",
        auth_id,
    )

    if row:
        return UserResponse(**{**dict(row), "id": str(row["id"])})

    # First login — auto-provision profile
    did = f"did:proofos:{uuid.uuid4()}"
    display_name = email.split("@")[0] if email else "Learner"
    try:
        row = await pool.fetchrow(
            """
            INSERT INTO public.users
                (auth_id, did, display_name, country_code, preferred_language, email_verified)
            VALUES ($1::uuid, $2, $3, 'NG', 'en', true)
            RETURNING id, did, display_name, bio, country_code, preferred_language,
                      avatar_url, public_profile, overall_score, created_at
            """,
            auth_id, did, display_name,
        )
    except Exception as e:
        logger.error("auth.me.provision_error", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to create user profile.")

    logger.info("auth.me.provisioned", auth_id=auth_id, did=did)
    return UserResponse(**{**dict(row), "id": str(row["id"])})

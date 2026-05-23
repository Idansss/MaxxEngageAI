import uuid
from fastapi import APIRouter, HTTPException
from app.models.users import CreateUserRequest, UserResponse
from app.core.database import get_pool
from app.core.logging import logger

router = APIRouter(prefix="/users", tags=["users"])


@router.post("", response_model=UserResponse, status_code=201, summary="Register a new user")
async def create_user(request: CreateUserRequest) -> UserResponse:
    did = request.did or f"did:proofos:{uuid.uuid4()}"
    pool = get_pool()
    try:
        row = await pool.fetchrow(
            """
            INSERT INTO public.users
                (did, display_name, bio, country_code, preferred_language, avatar_url, public_profile)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, did, display_name, bio, country_code, preferred_language,
                      avatar_url, public_profile, overall_score, created_at
            """,
            did,
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

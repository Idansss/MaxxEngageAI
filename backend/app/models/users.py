from pydantic import BaseModel, Field
from datetime import datetime


class CreateUserRequest(BaseModel):
    display_name: str = Field(..., min_length=2, max_length=100)
    country_code: str = Field(..., min_length=2, max_length=2, description="ISO 3166-1 alpha-2 country code.")
    preferred_language: str = Field("en", description="BCP-47 language tag.")
    bio: str | None = Field(None, max_length=140)
    avatar_url: str | None = None
    location: str | None = Field(None, max_length=80)
    public_profile: bool = True
    did: str | None = Field(
        None,
        description="W3C DID. If omitted, a did:key: identifier is auto-generated.",
    )


class UserResponse(BaseModel):
    id: str
    did: str
    display_name: str
    bio: str | None
    country_code: str
    location: str | None = None
    preferred_language: str
    avatar_url: str | None
    public_profile: bool
    overall_score: float
    created_at: datetime
    username: str | None = None
    proof_page_visibility: str = "public"

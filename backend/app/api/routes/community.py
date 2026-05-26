from fastapi import APIRouter

from app.services.github_collaboration import get_public_repo_status

router = APIRouter(prefix="/community", tags=["community"])


@router.get("/github", summary="Get public GitHub collaboration status")
async def github_status():
    return await get_public_repo_status()

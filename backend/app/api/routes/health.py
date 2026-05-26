from fastapi import APIRouter
from datetime import datetime, timezone

router = APIRouter(tags=["meta"])


@router.get("/health", summary="Liveness check")
async def health():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


@router.get("/", summary="API root")
async def root():
    return {
        "name": "Maxx Engage API",
        "version": "0.1.0",
        "description": "Verified Competence Engine — Engine 1 of Civilization OS",
        "docs": "/docs",
    }

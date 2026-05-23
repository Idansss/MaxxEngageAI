from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import get_settings
from app.core.logging import configure_logging, logger
from app.api.routes import assess, health


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    settings = get_settings()
    logger.info("proofos.startup", environment=settings.environment)
    yield
    logger.info("proofos.shutdown")


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="ProofOS API",
        description="Engine 1 of Civilization OS — Verified Competence for Global Digital Talent",
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins.split(","),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router)
    app.include_router(assess.router)

    return app


app = create_app()

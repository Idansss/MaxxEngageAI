from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import get_settings
from app.core.logging import configure_logging, logger
from app.core.database import init_pool, close_pool
from app.api.routes import assess, health, learn_path, skill_paths, users


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    settings = get_settings()
    logger.info("proofos.startup", environment=settings.environment)
    await init_pool()
    yield
    await close_pool()
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
    app.include_router(users.router)
    app.include_router(assess.router)
    app.include_router(learn_path.router)
    app.include_router(skill_paths.router)

    return app


app = create_app()

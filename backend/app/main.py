import time
import uuid

import structlog.contextvars
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.core.config import get_settings
from app.core.logging import configure_logging, logger
from app.core.observability import init_observability
from app.core.database import init_pool, close_pool
from app.core.limiter import limiter
from app.api.routes import admin, assess, auth, community, credentials, did_doc, health, identity, knowledge, learn_path, leaderboard, notifications, referrals, reviews, search, skill_paths, submissions, talent, users, verify, wallet

try:
    import sentry_sdk
except Exception:  # pragma: no cover - optional dependency
    sentry_sdk = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    settings = get_settings()
    logger.info("app.startup", environment=settings.environment)
    await init_pool()
    yield
    await close_pool()
    logger.info("app.shutdown")


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="Maxx Engage API",
        description="Engine 1 of Civilization OS — Verified Competence for Global Digital Talent",
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    init_observability(app)

    @app.middleware("http")
    async def request_context_middleware(request: Request, call_next):
        request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
        start = time.perf_counter()
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(
            request_id=request_id,
            method=request.method,
            path=request.url.path,
        )
        logger.info("request.start")
        try:
            response = await call_next(request)
        except Exception as exc:
            duration_ms = round((time.perf_counter() - start) * 1000, 2)
            logger.error("request.error", duration_ms=duration_ms, error=str(exc))
            if sentry_sdk:
                sentry_sdk.capture_exception(exc)
            raise

        duration_ms = round((time.perf_counter() - start) * 1000, 2)
        response.headers["x-request-id"] = request_id
        logger.info(
            "request.done",
            status_code=response.status_code,
            duration_ms=duration_ms,
        )
        return response

    app.include_router(health.router)
    app.include_router(did_doc.router)
    app.include_router(auth.router)
    app.include_router(admin.router)
    app.include_router(users.router)
    app.include_router(assess.router)
    app.include_router(learn_path.router)
    app.include_router(skill_paths.router)
    app.include_router(credentials.router)
    app.include_router(verify.router)
    app.include_router(submissions.router)
    app.include_router(reviews.router)
    app.include_router(wallet.router)
    app.include_router(identity.router)
    app.include_router(knowledge.router)
    app.include_router(community.router)
    app.include_router(leaderboard.router)
    app.include_router(talent.router)
    app.include_router(notifications.router)
    app.include_router(referrals.router)
    app.include_router(search.router)

    return app


app = create_app()

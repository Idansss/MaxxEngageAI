"""
Optional observability bootstrapping.

The API should run without Sentry, OpenTelemetry, or LangSmith installed or
configured. When the matching env vars are present, this module turns them on
at process startup.
"""

from __future__ import annotations

from fastapi import FastAPI

from app.core.config import get_settings
from app.core.logging import logger


def init_sentry() -> None:
    settings = get_settings()
    if not settings.sentry_dsn:
        logger.info("observability.sentry.skip", reason="SENTRY_DSN not set")
        return

    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.starlette import StarletteIntegration
    except Exception as exc:
        logger.warning("observability.sentry.unavailable", error=str(exc))
        return

    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.environment,
        traces_sample_rate=settings.sentry_traces_sample_rate,
        send_default_pii=False,
        integrations=[StarletteIntegration(), FastApiIntegration()],
    )
    logger.info("observability.sentry.ready")


def init_opentelemetry(app: FastAPI) -> None:
    settings = get_settings()
    if not settings.otel_enabled:
        logger.info("observability.otel.skip", reason="OTEL_ENABLED=false")
        return

    try:
        from opentelemetry import trace
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
        from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
        from opentelemetry.sdk.resources import Resource
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
    except Exception as exc:
        logger.warning("observability.otel.unavailable", error=str(exc))
        return

    resource = Resource.create(
        {
            "service.name": settings.otel_service_name,
            "deployment.environment": settings.environment,
        }
    )
    provider = TracerProvider(resource=resource)
    exporter_kwargs = {}
    if settings.otel_exporter_otlp_endpoint:
        exporter_kwargs["endpoint"] = settings.otel_exporter_otlp_endpoint
    provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(**exporter_kwargs)))

    try:
        trace.set_tracer_provider(provider)
    except Exception as exc:
        logger.warning("observability.otel.provider_already_set", error=str(exc))

    FastAPIInstrumentor.instrument_app(app)
    HTTPXClientInstrumentor().instrument()

    try:
        from opentelemetry.instrumentation.asyncpg import AsyncPGInstrumentor

        AsyncPGInstrumentor().instrument()
    except Exception as exc:
        logger.info("observability.otel.asyncpg.skip", error=str(exc))

    logger.info("observability.otel.ready")


def init_observability(app: FastAPI) -> None:
    init_sentry()
    init_opentelemetry(app)

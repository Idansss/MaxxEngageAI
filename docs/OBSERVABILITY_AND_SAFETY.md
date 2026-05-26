# Observability and Safety

Maxx Engage uses layered observability so grading decisions can be debugged,
audited, and improved without hiding score changes from users.

## Runtime Observability

Backend requests emit structured logs with:

- request ID
- HTTP method and path
- status code
- duration in milliseconds
- error message when a request fails

Every response includes `x-request-id`.

## Sentry

Set these backend variables:

```env
SENTRY_DSN=
SENTRY_TRACES_SAMPLE_RATE=0.10
```

When `SENTRY_DSN` is present, FastAPI/Starlette errors are reported to Sentry.
PII is disabled by default.

## OpenTelemetry

Set these backend variables:

```env
OTEL_ENABLED=true
OTEL_SERVICE_NAME=maxx-engage-api
OTEL_EXPORTER_OTLP_ENDPOINT=https://your-otel-collector/v1/traces
```

The API instruments FastAPI, HTTPX, and asyncpg when the OpenTelemetry packages
are installed.

## LangSmith

Set these backend variables:

```env
LANGSMITH_TRACING=true
LANGSMITH_API_KEY=
LANGSMITH_PROJECT=maxx-engage
```

Each grading call records a LangSmith run with sanitized inputs, model metadata,
the prompt hash, output score, confidence, and errors.

## Audit Log

Migration `011_observability_safety_audit.sql` creates `public.audit_log`.

Logged events include:

- `review.ai_created`
- `assessment.safety_check`
- `review.appealed`
- `review.admin_decision`
- `credential.issued`
- `credential.issued_by_admin`
- `credential.visibility_changed`

The table is append-only. Database triggers reject UPDATE and DELETE. Each event
stores `event_hash` and `previous_event_hash` to make tampering evident.

Admins can inspect events with:

```text
GET /admin/audit-log
GET /admin/audit-log?entity_type=review&entity_id=<review_id>
GET /admin/audit-log?action=review.admin_decision
```

## Bias and Adversarial Checks

Set these backend variables:

```env
SAFETY_CHECKS_ENABLED=true
SAFETY_FORCE_HUMAN_REVIEW=true
```

Assessment submissions are scanned for prompt-injection attempts and protected
class references. Flagged cases are recorded in the audit log. With
`SAFETY_FORCE_HUMAN_REVIEW=true`, medium/high-risk cases cannot receive an
automatic credential until a human reviews them.

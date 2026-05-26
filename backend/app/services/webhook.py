"""
Outbound webhook service.

Maxx Engage fires webhooks on key events so external systems (LMS, HR tools,
employer dashboards) can react without polling.

Configuration (all optional — if WEBHOOK_URL is unset, webhooks are skipped):
  WEBHOOK_URL     Receiver endpoint (e.g. https://example.com/hooks/maxx-engage)
  WEBHOOK_SECRET  HMAC-SHA256 signing secret; receiver validates with this

Event types fired:
  submission.human_review_queued   AI confidence low or score near threshold
  submission.appeal_received       Learner contested the AI score
  appeal.resolved                  Admin approved or rejected an appeal
  credential.issued                New W3C VC issued (passed assessment)

Payload shape (every event):
  {
    "event":      "<event_type>",
    "occurred_at": "<ISO 8601 UTC>",
    "data":       { ... event-specific fields ... }
  }

Signature: X-MaxxEngage-Signature: sha256=<hex_hmac>
Receiver should compute HMAC-SHA256(body_bytes, secret) and compare.
"""

import hashlib
import hmac
import json
from datetime import datetime, timezone

import httpx

from app.core.config import get_settings
from app.core.logging import logger


def _sign(payload_bytes: bytes, secret: str) -> str:
    return "sha256=" + hmac.new(secret.encode(), payload_bytes, hashlib.sha256).hexdigest()


async def fire(event: str, data: dict) -> None:
    """
    Fire a webhook for the given event. Non-blocking — errors are logged but
    never raised to the caller.
    """
    settings = get_settings()
    url = settings.webhook_url
    if not url:
        return

    body = {
        "event": event,
        "occurred_at": datetime.now(timezone.utc).isoformat(),
        "data": data,
    }
    payload_bytes = json.dumps(body, separators=(",", ":")).encode()
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "MaxxEngage-Webhook/1.0",
    }
    if settings.webhook_secret:
        headers["X-MaxxEngage-Signature"] = _sign(payload_bytes, settings.webhook_secret)

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(url, content=payload_bytes, headers=headers)
        if resp.status_code >= 400:
            logger.warning(
                "webhook.delivery_failed",
                event=event,
                status=resp.status_code,
                url=url,
            )
        else:
            logger.info("webhook.delivered", event=event, status=resp.status_code)
    except Exception as e:
        logger.warning("webhook.error", event=event, error=str(e), url=url)


# ── Typed event helpers ───────────────────────────────────────────────────────

async def on_human_review_queued(submission_id: str, review_id: str, skill_path: str, score: float, confidence: float) -> None:
    await fire("submission.human_review_queued", {
        "submission_id": submission_id,
        "review_id":     review_id,
        "skill_path":    skill_path,
        "score":         score,
        "confidence":    confidence,
    })


async def on_appeal_received(submission_id: str, review_id: str, reason: str) -> None:
    await fire("submission.appeal_received", {
        "submission_id": submission_id,
        "review_id":     review_id,
        "appeal_reason": reason,
    })


async def on_appeal_resolved(review_id: str, decision: str, admin_email: str) -> None:
    await fire("appeal.resolved", {
        "review_id": review_id,
        "decision":  decision,   # "approve" | "reject"
        "admin":     admin_email,
    })


async def on_credential_issued(credential_id: str, user_did: str, skill_path: str, level: int, score: float) -> None:
    await fire("credential.issued", {
        "credential_id": credential_id,
        "holder_did":    user_did,
        "skill_path":    skill_path,
        "level":         level,
        "score":         score,
    })

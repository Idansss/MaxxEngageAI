"""
Transactional email via Resend API.

Gracefully no-ops when RESEND_API_KEY is not set (dev/test).
All public send_* functions are fire-and-forget safe.
"""

import asyncio
import httpx

from app.core.config import get_settings
from app.core.logging import logger


_RESEND_URL = "https://api.resend.com/emails"


# ── Low-level send ────────────────────────────────────────────────────────────

async def _send(to: str, subject: str, html: str) -> bool:
    settings = get_settings()
    if not settings.resend_api_key:
        logger.debug("email.skipped_no_key", to=to, subject=subject)
        return False
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                _RESEND_URL,
                headers={"Authorization": f"Bearer {settings.resend_api_key}"},
                json={"from": settings.email_from, "to": [to], "subject": subject, "html": html},
            )
        if resp.status_code in (200, 201):
            logger.info("email.sent", to=to, subject=subject)
            return True
        logger.warning("email.api_error", to=to, status=resp.status_code, body=resp.text[:200])
        return False
    except Exception as exc:
        logger.warning("email.send_error", to=to, error=str(exc))
        return False


# ── Auth email lookup ─────────────────────────────────────────────────────────

async def get_email_by_auth_id(auth_id: str) -> str | None:
    """Fetch the auth user's email via Supabase admin client (runs in thread)."""
    from app.api.deps import _supabase
    try:
        def _fetch():
            resp = _supabase().auth.admin.get_user_by_id(auth_id)
            return resp.user.email if resp.user else None
        return await asyncio.to_thread(_fetch)
    except Exception as exc:
        logger.warning("email.lookup_failed", auth_id=auth_id, error=str(exc))
        return None


# ── HTML helpers ──────────────────────────────────────────────────────────────

def _button(href: str, label: str) -> str:
    return (
        f'<a href="{href}" style="display:inline-block;margin-top:22px;padding:12px 26px;'
        f'background:#4f46e5;color:#ffffff;border-radius:10px;font-weight:700;'
        f'font-size:14px;text-decoration:none">{label} &rarr;</a>'
    )


def _wrap(content: str) -> str:
    return f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(99,102,241,0.10)">
        <tr><td style="background:linear-gradient(135deg,#4338ca 0%,#6366f1 100%);padding:26px 32px">
          <span style="font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.5px">Maxx<span style="color:#fcd34d">Engage</span></span>
        </td></tr>
        <tr><td style="padding:32px">{content}</td></tr>
        <tr><td style="padding:18px 32px;border-top:1px solid #ebebf6;background:#fafafa">
          <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6">
            You received this because you have an account on Maxx Engage.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


# ── Email templates ───────────────────────────────────────────────────────────

async def send_credential_earned(
    to: str,
    display_name: str,
    skill_path_name: str,
    level_label: str,
    score: float,
    credential_id: str,
    site_url: str,
) -> bool:
    subject = f"You earned a verified credential: {skill_path_name}"
    cred_url = f"{site_url}/credentials/{credential_id}"
    content = f"""
      <h2 style="margin:0 0 4px;font-size:22px;font-weight:800;color:#1e1b4b">Credential earned</h2>
      <p style="margin:0 0 22px;font-size:14px;color:#9ca3af">Hi {display_name},</p>
      <p style="margin:0 0 8px;color:#374151;line-height:1.7">Your submission has been graded and a verified credential has been issued:</p>
      <div style="background:#f5f3ff;border-left:4px solid #6366f1;border-radius:0 10px 10px 0;padding:16px 20px;margin:16px 0 8px">
        <p style="margin:0;font-size:17px;font-weight:800;color:#4338ca">{skill_path_name}</p>
        <p style="margin:6px 0 0;font-size:13px;color:#7c3aed">{level_label}&nbsp;&nbsp;&middot;&nbsp;&nbsp;Score: <strong>{score:.0f} / 100</strong></p>
      </div>
      <p style="margin:16px 0 0;color:#374151;line-height:1.7;font-size:14px">
        This credential is cryptographically signed and verifiable by anyone. Share it on your proof page to let employers see your skills.
      </p>
      {_button(cred_url, "View credential")}
    """
    return await _send(to, subject, _wrap(content))


async def send_referral_milestone(
    to: str,
    display_name: str,
    referral_count: int,
    stamp_points: float,
    site_url: str,
) -> bool:
    subject = "You unlocked the Referral identity stamp!"
    content = f"""
      <h2 style="margin:0 0 4px;font-size:22px;font-weight:800;color:#1e1b4b">Referral stamp unlocked</h2>
      <p style="margin:0 0 22px;font-size:14px;color:#9ca3af">Hi {display_name},</p>
      <p style="margin:0 0 18px;color:#374151;line-height:1.7">
        You've successfully referred <strong>{referral_count}&nbsp;people</strong> to Maxx Engage.
        As a reward you've been awarded the <strong>Referral identity stamp</strong>.
      </p>
      <div style="background:#fffbeb;border-left:4px solid #f59e0b;border-radius:0 10px 10px 0;padding:16px 20px;margin:0 0 18px">
        <p style="margin:0;font-size:15px;font-weight:700;color:#92400e">Referral Stamp &nbsp;&middot;&nbsp; +{stamp_points:.0f} pts</p>
        <p style="margin:6px 0 0;font-size:13px;color:#a16207">Your humanity score has been updated. Credentials now carry more weight in employer searches.</p>
      </div>
      <p style="margin:0;color:#374151;line-height:1.7;font-size:14px">
        Keep inviting trusted peers — a higher humanity score boosts how your credentials rank.
      </p>
      {_button(f"{site_url}/identity", "View my identity")}
    """
    return await _send(to, subject, _wrap(content))


async def send_decay_reminder(
    to: str,
    display_name: str,
    overdue_skill_names: list[str],
    site_url: str,
) -> bool:
    count = len(overdue_skill_names)
    subject = (
        f"Your credential for {overdue_skill_names[0]} needs refreshing"
        if count == 1
        else f"{count} credentials need refreshing"
    )
    items_html = "".join(
        f'<li style="margin:5px 0;color:#374151;font-size:14px">{name}</li>'
        for name in overdue_skill_names[:6]
    )
    if count > 6:
        items_html += f'<li style="margin:5px 0;color:#9ca3af;font-size:13px">…and {count - 6} more</li>'
    content = f"""
      <h2 style="margin:0 0 4px;font-size:22px;font-weight:800;color:#1e1b4b">Time to refresh your skills</h2>
      <p style="margin:0 0 22px;font-size:14px;color:#9ca3af">Hi {display_name},</p>
      <p style="margin:0 0 18px;color:#374151;line-height:1.7">
        Skills evolve fast. The following credential{"s are" if count != 1 else " is"} past the recommended refresh window — retaking keeps your score current for employers:
      </p>
      <div style="background:#fff7ed;border-left:4px solid #f97316;border-radius:0 10px 10px 0;padding:16px 20px;margin:0 0 18px">
        <ul style="margin:0;padding-left:18px">{items_html}</ul>
      </div>
      <p style="margin:0;color:#374151;line-height:1.7;font-size:14px">
        Reassessments take 15–45 minutes and reset your decay clock. Your best-ever score is always preserved.
      </p>
      {_button(f"{site_url}/assess", "Retake an assessment")}
    """
    return await _send(to, subject, _wrap(content))

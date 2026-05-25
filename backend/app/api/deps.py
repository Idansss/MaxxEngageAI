from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client
from app.core.config import get_settings
from app.core.logging import logger

bearer_scheme = HTTPBearer(auto_error=False)


def _supabase():
    s = get_settings()
    return create_client(s.supabase_url, s.supabase_service_role_key)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict:
    """Validate Supabase JWT and return the auth user dict. Raises 401 if missing/invalid."""
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")
    try:
        response = _supabase().auth.get_user(credentials.credentials)
        if not response.user:
            raise ValueError("no user")
        return {"id": response.user.id, "email": response.user.email}
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token.")


def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict | None:
    """Like get_current_user but returns None instead of 401 when unauthenticated."""
    if not credentials:
        return None
    try:
        response = _supabase().auth.get_user(credentials.credentials)
        if not response.user:
            return None
        return {"id": response.user.id, "email": response.user.email}
    except Exception:
        return None


def get_admin_user(
    auth_user: dict = Depends(get_current_user),
) -> dict:
    """Requires authentication AND that the user's email is in ADMIN_EMAILS."""
    settings = get_settings()
    allowed = {e.strip().lower() for e in settings.admin_emails.split(",") if e.strip()}
    email = (auth_user.get("email") or "").lower()
    if not allowed or email not in allowed:
        logger.warning("admin.access_denied", email=email)
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required.")
    return auth_user

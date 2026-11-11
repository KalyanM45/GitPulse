"""FastAPI dependency that guards every non-public API route."""

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from ..config import ALLOWED_EMAILS
from . import users
from .firebase import AuthUnavailable, verify_id_token

_bearer = HTTPBearer(auto_error=False)


def _deny(status: int, code: str, message: str, www_auth: str | None = None):
    headers = {"WWW-Authenticate": www_auth} if www_auth else None
    raise HTTPException(status_code=status, detail={"code": code, "message": message}, headers=headers)


def require_user(creds: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> dict:
    if creds is None:
        _deny(401, "not_authenticated", "Sign in to continue.", "Bearer")
    try:
        claims = verify_id_token(creds.credentials)
    except AuthUnavailable:
        _deny(503, "auth_unavailable", "Sign-in is temporarily unavailable. Please try again.")
    if claims is None:
        _deny(401, "token_invalid", "Your session has expired.", 'Bearer error="invalid_token"')

    if not claims.get("email_verified"):
        _deny(403, "email_not_verified", "Verify your email address to continue.")
    email = (claims.get("email") or "").lower()
    if ALLOWED_EMAILS and email not in ALLOWED_EMAILS:
        _deny(403, "not_invited", "This account doesn't have access to GitPulse yet.")

    return users.get_or_create(claims)


async def require_tenant(user: dict = Depends(require_user)):
    """For GitHub-data routes: a signed-in user with a connected GitHub account.

    Async on purpose: it runs in the request's own context, so the tenant set here
    is visible to the (sync, thread-pooled) endpoint and everything it calls.
    """
    from ..github_account import tenant_for
    from ..tenant import set_current

    if not (user.get("github") or {}).get("token_enc"):
        _deny(409, "github_not_connected", "Connect your GitHub account to continue.")
    tenant = tenant_for(user)
    if tenant is None:
        _deny(409, "github_reconnect_required", "Reconnect your GitHub account to continue.")
    set_current(tenant)
    return tenant

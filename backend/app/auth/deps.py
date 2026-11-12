"""FastAPI dependencies that guard the API."""

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .. import access
from . import users
from .firebase import AuthUnavailable, verify_id_token

_bearer = HTTPBearer(auto_error=False)


def _deny(status: int, code: str, message: str, www_auth: str | None = None):
    headers = {"WWW-Authenticate": www_auth} if www_auth else None
    raise HTTPException(status_code=status, detail={"code": code, "message": message}, headers=headers)


def require_identity(creds: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> dict:
    """A valid Firebase token with a verified email. Says nothing about access:
    used where people without an invite are allowed (checking their request)."""
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
    return claims


def require_user(claims: dict = Depends(require_identity)) -> dict:
    """A signed-in, verified user who has been let in (invite-only program)."""
    if not access.has_access(claims.get("email") or ""):
        _deny(403, "not_invited", "GitPulse is invite-only, and this account hasn't been invited yet.")
    return users.get_or_create(claims)


def require_admin(user: dict = Depends(require_user)) -> dict:
    if not access.is_admin(user.get("email", "")):
        _deny(403, "not_admin", "Only admins can do this.")
    return user


async def require_tenant(user: dict = Depends(require_user)):
    """For GitHub-data routes: a signed-in user with a connected GitHub account.

    Async on purpose: it runs in the request's own context, so the tenant set here
    is visible to the (sync, thread-pooled) endpoint and everything it calls.
    """
    from ..github_account import tenant_for
    from ..tenant import set_current

    gh = user.get("github") or {}
    if not gh.get("token_enc"):
        _deny(409, "github_not_connected", "Connect your GitHub account to continue.")
    tenant = tenant_for(user)
    # No token we can read, or one GitHub has rejected (see mark_token_revoked).
    if tenant is None or gh.get("token_revoked_at"):
        _deny(409, "github_reconnect_required", "Reconnect your GitHub account to continue.")
    set_current(tenant)
    return tenant

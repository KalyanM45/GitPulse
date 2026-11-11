"""/api/auth/* and /api/github/* — who the user is, and their GitHub connection.

Sign-up, sign-in, verification and password reset happen in Firebase on the client.
"""

import requests
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from .. import access, database
from ..auth import users
from ..auth.crypto import EncryptionUnavailable
from ..auth.deps import require_user
from ..config import GITHUB_SCOPES
from ..github_account import (
    ConnectError,
    adopt_legacy_data,
    connect,
    disconnect,
    public_github,
    tenant_for,
)
from ..services import sync_runner
from ..services.github_service import fetch_viewer

router = APIRouter(tags=["auth"])


def _last_synced_at(user: dict) -> str | None:
    doc = database.get_db()["meta"].find_one({"_id": f"sync:{user['_id']}"}, {"last_sync_at": 1})
    at = (doc or {}).get("last_sync_at")
    return at.isoformat() if at else None


def _me(user: dict) -> dict:
    return {
        **users.public_user(user),
        "github": public_github(user),
        "sync": sync_runner.job_status(user["_id"]),
        # Set once any sync has completed: the dashboard has something to show.
        "last_synced_at": _last_synced_at(user),
        "is_admin": access.is_admin(user.get("email", "")),
    }


@router.get("/api/auth/me")
def me(user: dict = Depends(require_user)):
    return _me(user)


class ConnectBody(BaseModel):
    access_token: str = Field(min_length=10, max_length=500)


@router.post("/api/github/connect")
def connect_github(body: ConnectBody, user: dict = Depends(require_user)):
    """Store the GitHub token the browser received from the GitHub sign-in popup,
    then start the first sync. The token is checked against GitHub before saving."""
    try:
        viewer, scopes = fetch_viewer(body.access_token)
    except requests.HTTPError:
        raise HTTPException(400, {"code": "github_token_invalid", "message": "GitHub didn't accept that sign-in. Please try again."})
    except requests.RequestException:
        raise HTTPException(503, {"code": "github_unreachable", "message": "Couldn't reach GitHub. Please try again."})

    missing = set(GITHUB_SCOPES) - scopes
    if "repo" in missing:
        raise HTTPException(400, {
            "code": "github_scope_missing",
            "message": "GitPulse needs the 'repo' permission to read repository traffic. Please approve it on GitHub.",
        })
    try:
        user = connect(user, viewer, scopes, body.access_token)
    except ConnectError as e:
        raise HTTPException(e.status, {"code": e.code, "message": e.message})
    except EncryptionUnavailable:
        raise HTTPException(500, {"code": "server_misconfigured", "message": "The server can't store GitHub tokens yet (TOKEN_ENCRYPTION_KEY is missing)."})

    tenant = tenant_for(user)
    # The legacy account's existing history is usable straight away, before the
    # (possibly long) first sync finishes.
    adopt_legacy_data(tenant)
    sync_runner.start_job(tenant)
    return _me(user)


@router.post("/api/github/sync", status_code=202)
def start_sync(user: dict = Depends(require_user)):
    tenant = tenant_for(user)
    if tenant is None:
        raise HTTPException(409, {"code": "github_not_connected", "message": "Connect your GitHub account first."})
    if not sync_runner.start_job(tenant):
        raise HTTPException(409, {"code": "sync_running", "message": "A sync is already running."})
    return sync_runner.job_status(user["_id"])


@router.get("/api/github/sync")
def sync_progress(user: dict = Depends(require_user)):
    return sync_runner.job_status(user["_id"]) or {"status": "idle"}


@router.post("/api/github/disconnect")
def disconnect_github(user: dict = Depends(require_user)):
    disconnect(user)
    return {"status": "ok"}

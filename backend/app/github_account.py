"""A user's connection to their GitHub account."""

import logging
from datetime import datetime, timezone
from typing import Iterator

from pymongo.errors import DuplicateKeyError

from . import database
from .auth.crypto import decrypt, encrypt
from .config import GITHUB_SCOPES, GITHUB_USERNAME
from .tenant import Tenant

log = logging.getLogger(__name__)

# Collections holding per-user GitHub data (see tenant.py).
DATA_COLLECTIONS = [
    "follower_snapshots", "follower_events", "following_snapshots", "repo_snapshots",
    "star_snapshots", "traffic_daily", "contributions",
]


class ConnectError(Exception):
    def __init__(self, status: int, code: str, message: str):
        super().__init__(message)
        self.status, self.code, self.message = status, code, message


def _users():
    return database.get_db()["users"]


def connect(user: dict, viewer: dict, scopes: set[str], token: str) -> dict:
    """Store an (already verified) GitHub token for this user."""
    other = _users().find_one({"github.id": viewer["id"], "_id": {"$ne": user["_id"]}}, {"_id": 1})
    if other:
        raise ConnectError(
            409, "github_in_use",
            f"@{viewer['login']} is already connected to another GitPulse account.",
        )
    github = {
        "id": viewer["id"],
        "login": viewer["login"],
        "name": viewer.get("name") or "",
        "avatar_url": viewer.get("avatar_url") or "",
        "token_enc": encrypt(token),
        "scopes": sorted(scopes),
        "connected_at": datetime.now(timezone.utc),
    }
    try:
        _users().update_one({"_id": user["_id"]}, {"$set": {"github": github}})
    except DuplicateKeyError:
        raise ConnectError(
            409, "github_in_use",
            f"@{viewer['login']} is already connected to another GitPulse account.",
        )
    return {**user, "github": github}


def disconnect(user: dict) -> None:
    # The synced history stays, so reconnecting the same account picks up where it left off.
    _users().update_one({"_id": user["_id"]}, {"$unset": {"github": ""}})


def tenant_for(user: dict) -> Tenant | None:
    gh = user.get("github") or {}
    token = decrypt(gh["token_enc"]) if gh.get("token_enc") else None
    if not token:
        return None
    return Tenant(user_id=user["_id"], github_id=gh["id"], github_login=gh["login"], github_token=token)


def mark_token_revoked(user_id) -> None:
    """GitHub rejected this user's token (401): revoked, expired or replaced.

    Flagged so the app asks them to reconnect and scheduled syncs stop retrying a
    token that can't work. Connecting again rewrites `github`, clearing the flag.
    """
    _users().update_one(
        {"_id": user_id, "github.token_enc": {"$exists": True}},
        {"$set": {"github.token_revoked_at": datetime.now(timezone.utc)}},
    )


def iter_tenants() -> Iterator[Tenant]:
    """Every user with a usable GitHub connection — for scheduled syncs."""
    query = {"github.token_enc": {"$exists": True}, "github.token_revoked_at": {"$exists": False}}
    for user in _users().find(query):
        t = tenant_for(user)
        if t:
            yield t


def public_github(user: dict) -> dict:
    gh = user.get("github") or {}
    if not gh:
        return {"connected": False}
    missing = sorted(set(GITHUB_SCOPES) - set(gh.get("scopes", [])))
    return {
        "connected": True,
        "login": gh.get("login"),
        "name": gh.get("name"),
        "avatar_url": gh.get("avatar_url"),
        "missing_scopes": missing,
        # Token unreadable (encryption key changed) or rejected by GitHub: must reconnect.
        "needs_reconnect": bool(gh.get("token_revoked_at")) or decrypt(gh.get("token_enc", "")) is None,
    }


# ── Data from before multi-user support ──────────────────────────────────────

def adopt_legacy_data(tenant: Tenant) -> None:
    """Attach single-user-era data (no owner_id) to the owner of that GitHub account.

    Before multi-user support the app tracked exactly one account, GITHUB_USERNAME.
    Whoever connects that account (proving ownership through GitHub) inherits its
    history. Recorded once in `meta` so a later holder of the same username can't
    claim it. Repeated on every sync of the owner: cheap, and it also picks up any
    rows still being written by an older deployment.
    """
    if not GITHUB_USERNAME or tenant.github_login.lower() != GITHUB_USERNAME.lower():
        return
    db = database.get_db()
    meta = db["meta"]
    try:
        meta.insert_one({"_id": "legacy_owner", "user_id": tenant.user_id, "github_id": tenant.github_id})
    except DuplicateKeyError:
        pass
    claim = meta.find_one({"_id": "legacy_owner"})
    if claim["user_id"] != tenant.user_id:
        return

    moved = 0
    for name in DATA_COLLECTIONS:
        moved += db[name].update_many(
            {"owner_id": {"$exists": False}}, {"$set": {"owner_id": tenant.user_id}}
        ).modified_count
    for kind in ("sync", "profile"):
        old = meta.find_one({"_id": kind})
        if old and not meta.find_one({"_id": f"{kind}:{tenant.user_id}"}):
            old.pop("_id")
            meta.insert_one({**old, "_id": f"{kind}:{tenant.user_id}", "owner_id": tenant.user_id})
    if moved:
        log.info("Attached %d legacy records to @%s.", moved, tenant.github_login)

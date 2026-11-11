"""Invite-only access: who may use GitPulse, and requests from people who'd like to.

Anyone can create a Firebase account; whether they get past the door is decided
here. In "invite" mode an account gets in if its (verified) email is:
  - an admin (ADMIN_EMAILS), or
  - listed in ALLOWED_EMAILS, or
  - in the `invites` collection (approved from /admin, takes effect immediately).

Collections:
  invites          _id = email; who invited them and when
  access_requests  one per email: name, GitHub username, note, status
"""

import re
from datetime import datetime, timezone

from bson import ObjectId
from pymongo import ReturnDocument

from . import database
from .config import ACCESS_MODE, ADMIN_EMAILS, ALLOWED_EMAILS

_EMAIL_RE = re.compile(r"^[^@\s]{1,64}@[^@\s]+\.[^@\s]{2,}$")
_GITHUB_RE = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$")


class AccessError(Exception):
    def __init__(self, status: int, code: str, message: str):
        super().__init__(message)
        self.status, self.code, self.message = status, code, message


def _db():
    return database.get_db()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt) -> str | None:
    if not dt:
        return None
    return (dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)).isoformat()


def normalize_email(email: str) -> str:
    email = (email or "").strip().lower()
    if len(email) > 254 or not _EMAIL_RE.match(email):
        raise AccessError(422, "invalid_email", "Enter a valid email address.")
    return email


# ── Who gets in ──────────────────────────────────────────────────────────────

def is_admin(email: str) -> bool:
    return (email or "").lower() in ADMIN_EMAILS


def has_access(email: str) -> bool:
    email = (email or "").lower()
    if ACCESS_MODE == "open" or is_admin(email) or email in ALLOWED_EMAILS:
        return True
    return _db()["invites"].find_one({"_id": email}, {"_id": 1}) is not None


# ── Rate limiting for the public request form ──────────────────────────────

def _hit(key: str, limit: int, window_seconds: int) -> bool:
    bucket = int(_now().timestamp() // window_seconds)
    doc = _db()["rate_limits"].find_one_and_update(
        {"_id": f"{key}|{bucket}"},
        {
            "$inc": {"count": 1},
            "$setOnInsert": {
                "expires_at": datetime.fromtimestamp((bucket + 1) * window_seconds, tz=timezone.utc)
            },
        },
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return doc["count"] <= limit


# ── Requests ─────────────────────────────────────────────────────────────────

def submit_request(email: str, name: str, github: str, note: str, ip: str) -> dict:
    """Public. Always answers the same way, so it never reveals who is invited."""
    email = normalize_email(email)
    name = (name or "").strip()[:80]
    github = (github or "").strip().lstrip("@")
    note = (note or "").strip()[:500]
    if github and not _GITHUB_RE.match(github):
        raise AccessError(422, "invalid_github", "That doesn't look like a GitHub username.")
    if not _hit(f"access-request-ip:{ip}", 5, 3600):
        raise AccessError(429, "rate_limited", "Too many requests. Please try again later.")

    ok = {"status": "received", "message": "Thanks! Your request has been received."}
    if has_access(email):
        return ok  # already in; nothing to queue

    existing = _db()["access_requests"].find_one({"email": email})
    if existing and existing["status"] == "pending":
        # Let them update their details, but don't bump them up the queue.
        _db()["access_requests"].update_one(
            {"_id": existing["_id"]}, {"$set": {"name": name, "github": github, "note": note}}
        )
        return ok
    _db()["access_requests"].update_one(
        {"email": email},
        {
            "$set": {
                "name": name, "github": github, "note": note,
                "status": "pending", "created_at": _now(), "decided_at": None,
            }
        },
        upsert=True,
    )
    return ok


def my_request_status(email: str) -> str | None:
    doc = _db()["access_requests"].find_one({"email": email.lower()}, {"status": 1})
    return doc["status"] if doc else None


def _public_request(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "email": doc["email"],
        "name": doc.get("name", ""),
        "github": doc.get("github", ""),
        "note": doc.get("note", ""),
        "status": doc["status"],
        "created_at": _iso(doc.get("created_at")),
        "decided_at": _iso(doc.get("decided_at")),
    }


def list_requests(status: str | None) -> list[dict]:
    flt = {"status": status} if status in ("pending", "approved", "rejected") else {}
    docs = _db()["access_requests"].find(flt).sort("created_at", -1).limit(500)
    return [_public_request(d) for d in docs]


def decide_request(request_id: str, approve: bool, admin_email: str) -> dict:
    if not ObjectId.is_valid(request_id):
        raise AccessError(404, "not_found", "Request not found.")
    doc = _db()["access_requests"].find_one_and_update(
        {"_id": ObjectId(request_id)},
        {"$set": {"status": "approved" if approve else "rejected", "decided_at": _now()}},
        return_document=ReturnDocument.AFTER,
    )
    if not doc:
        raise AccessError(404, "not_found", "Request not found.")
    if approve:
        invite(doc["email"], admin_email, source="request")
    else:
        _db()["invites"].delete_one({"_id": doc["email"]})
    return _public_request(doc)


# ── Invites ──────────────────────────────────────────────────────────────────

def invite(email: str, admin_email: str, source: str = "direct") -> dict:
    email = normalize_email(email)
    _db()["invites"].update_one(
        {"_id": email},
        {"$setOnInsert": {"invited_at": _now(), "invited_by": admin_email, "source": source}},
        upsert=True,
    )
    # A direct invite also settles any open request from the same person.
    _db()["access_requests"].update_many(
        {"email": email, "status": "pending"}, {"$set": {"status": "approved", "decided_at": _now()}}
    )
    return {"email": email}


def revoke(email: str) -> None:
    email = (email or "").strip().lower()
    if is_admin(email):
        raise AccessError(400, "cannot_revoke_admin", "Admins can't be removed here (see ADMIN_EMAILS).")
    _db()["invites"].delete_one({"_id": email})
    _db()["access_requests"].update_many({"email": email}, {"$set": {"status": "rejected", "decided_at": _now()}})


def list_members() -> list[dict]:
    """Everyone with access, with whether they've signed up and connected GitHub."""
    db = _db()
    rows: dict[str, dict] = {}
    for e in ADMIN_EMAILS:
        rows[e] = {"email": e, "role": "admin", "invited_at": None}
    for e in ALLOWED_EMAILS - ADMIN_EMAILS:
        rows[e] = {"email": e, "role": "config", "invited_at": None}
    for inv in db["invites"].find():
        rows.setdefault(inv["_id"], {"email": inv["_id"], "role": "invited", "invited_at": _iso(inv.get("invited_at"))})

    users = {
        u["email"]: u
        for u in db["users"].find(
            {"email": {"$in": list(rows)}},
            {"email": 1, "github.login": 1, "github.avatar_url": 1, "last_seen_at": 1, "created_at": 1},
        )
    }
    out = []
    for email, row in rows.items():
        u = users.get(email) or {}
        gh = u.get("github") or {}
        out.append({
            **row,
            "signed_up": bool(u),
            "github_login": gh.get("login"),
            "avatar_url": gh.get("avatar_url"),
            "last_seen_at": _iso(u.get("last_seen_at")),
        })
    order = {"admin": 0, "config": 1, "invited": 2}
    return sorted(out, key=lambda r: (order[r["role"]], r["email"]))

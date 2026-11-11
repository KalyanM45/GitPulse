"""The app's own record of each Firebase account.

Firebase owns credentials (passwords, verification, resets). MongoDB keeps a row
per user so app data can hang off it — GitHub connection, plan, billing — which
is what multi-user support and payments will build on.
"""

from datetime import datetime, timedelta, timezone

from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from .. import database

# Writing last_seen_at on every request would turn every read into a write.
_SEEN_RESOLUTION = timedelta(hours=1)


def _col():
    return database.get_db()["users"]


def _aware(dt: datetime | None) -> datetime | None:
    if dt is None or dt.tzinfo is not None:
        return dt
    return dt.replace(tzinfo=timezone.utc)


def get_or_create(claims: dict) -> dict:
    uid = claims["sub"]
    email = (claims.get("email") or "").strip().lower()
    name = (claims.get("name") or "").strip()[:80]
    now = datetime.now(timezone.utc)

    user = _col().find_one({"firebase_uid": uid})
    if user is None:
        try:
            _col().insert_one(
                {
                    "firebase_uid": uid,
                    "email": email,
                    "name": name,
                    "created_at": now,
                    "last_seen_at": now,
                }
            )
        except DuplicateKeyError:
            # Either a parallel first request already created it, or a row with
            # this email already exists (from before Firebase, or from a Firebase
            # account that was deleted and re-created). Firebase allows one account
            # per email and has verified this one, so the row belongs to it.
            if not _col().find_one({"firebase_uid": uid}):
                _col().update_one(
                    {"email": email}, {"$set": {"firebase_uid": uid, "last_seen_at": now}}
                )
        user = _col().find_one({"firebase_uid": uid})
    else:
        seen = _aware(user.get("last_seen_at"))
        changes = {}
        if seen is None or now - seen > _SEEN_RESOLUTION:
            changes["last_seen_at"] = now
        if email and user.get("email") != email:
            changes["email"] = email  # email changed in Firebase
        if changes:
            user = _col().find_one_and_update(
                {"_id": user["_id"]}, {"$set": changes}, return_document=ReturnDocument.AFTER
            )
    return user


def public_user(user: dict) -> dict:
    return {
        "id": str(user["_id"]),
        "email": user.get("email", ""),
        "name": user.get("name", ""),
        "created_at": _aware(user["created_at"]).isoformat() if user.get("created_at") else None,
    }

"""Your GitHub profile — cached, because it sits on the critical path.

`GET /api/profile` is requested by the Topbar, so it renders on *every* page of the
app. It used to call `GET https://api.github.com/user` inline on each request, which
put a live third-party round trip between you and your first paint, and burned a
rate-limit unit doing it. The profile changes at most a few times a year.

So it is stored in a small `meta` collection and served from there. A read is a
single `_id` lookup against a database the API is already talking to. GitHub is
consulted only when the cached copy is missing or older than `PROFILE_TTL`, and a
failed refresh returns the stale copy rather than an error: a rate limit or a GitHub
outage should not blank out the avatar in the header.
"""

import logging
from datetime import datetime, timedelta, timezone

from ..database import get_db
from .github_service import fetch_my_profile

log = logging.getLogger(__name__)

PROFILE_TTL = timedelta(hours=6)

# Fixed _id: there is exactly one profile, so this is an upsert into one document
# rather than a collection that grows.
_DOC_ID = "profile"


def _col():
    return get_db()["meta"]


def _fresh(cached: dict | None) -> bool:
    fetched_at = (cached or {}).get("fetched_at")
    if not isinstance(fetched_at, datetime):
        return False
    # pymongo hands back naive datetimes; they are UTC by construction.
    if fetched_at.tzinfo is None:
        fetched_at = fetched_at.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) - fetched_at < PROFILE_TTL


def store_profile(profile: dict) -> dict:
    """Write a freshly fetched profile. Returns what was stored."""
    doc = {**profile, "fetched_at": datetime.now(timezone.utc)}
    _col().update_one({"_id": _DOC_ID}, {"$set": {"profile": doc}}, upsert=True)
    return doc


def get_profile(force: bool = False) -> dict:
    """Your profile, from cache unless it is stale (or `force`)."""
    row = _col().find_one({"_id": _DOC_ID}, {"profile": 1, "_id": 0}) or {}
    cached = row.get("profile")

    if cached and not force and _fresh(cached):
        return _public(cached)

    try:
        return _public(store_profile(fetch_my_profile()))
    except Exception:
        if cached:
            # Stale beats broken: the header keeps rendering while GitHub is
            # rate-limiting us or down.
            log.warning("Profile refresh failed; serving cached copy.", exc_info=True)
            return _public(cached)
        raise


def _public(doc: dict) -> dict:
    """Strip the bookkeeping field and make the response JSON-serialisable."""
    out = {k: v for k, v in doc.items() if k != "fetched_at"}
    for key, value in out.items():
        if isinstance(value, datetime):
            out[key] = value.isoformat()
    return out

"""When the data was last refreshed.

Syncs happen in three places — the Sync button, the in-process scheduler, and the
GitHub Actions cron — and two of those run nowhere near the browser. Without a
marker the frontend has no way to learn that the numbers on screen are now old, so
a tab left open shows the pre-sync data indefinitely.

This is one document holding one timestamp. The frontend polls it and refreshes
everything when it moves, which is far cheaper than polling the real endpoints.
"""

from datetime import datetime, timezone

from ..database import get_db

_DOC_ID = "sync"


def _col():
    return get_db()["meta"]


def status() -> dict:
    """Small enough to poll. Deliberately carries nothing but the timestamp."""
    doc = _col().find_one({"_id": _DOC_ID}, {"last_sync_at": 1, "_id": 0}) or {}
    at = doc.get("last_sync_at")
    return {"last_sync_at": at.isoformat() if isinstance(at, datetime) else None}


def mark_synced() -> str:
    """Record that a sync just finished. Returns the timestamp as `status()` reports it.

    Read back rather than returned from the value written, because the two do not
    match otherwise: BSON stores datetimes at millisecond precision and pymongo
    hands them back without a tzinfo, so `datetime.now(timezone.utc).isoformat()`
    and the stored value differ in both the microseconds and the trailing offset.

    That matters because the client compares the two as strings — it adopts the
    timestamp returned here so that its next poll of /api/sync-status sees no
    change. A near-miss would look like a second sync and trigger a pointless
    refetch of everything.
    """
    _col().update_one(
        {"_id": _DOC_ID},
        {"$set": {"last_sync_at": datetime.now(timezone.utc)}},
        upsert=True,
    )
    return status()["last_sync_at"]

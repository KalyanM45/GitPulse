import re
from datetime import datetime, timezone

from pymongo import UpdateOne

from ..database import get_db
from .github_service import fetch_all_following, fetch_user_profiles


def _col():
    return get_db()["following_snapshots"]


def sync_following() -> int:
    """Bring the stored following list in line with the current one.

    This used to `drop()` the collection and rebuild it from scratch on every run.
    That threw away `captured_at` — the "First seen" date the UI shows — so every
    account you follow was restamped with the time of the last sync and the whole
    column reported one identical, meaningless date. It also dropped and rebuilt
    the indexes each time, and left the collection empty for the duration.

    Now: upsert each account, and delete only the ones that are genuinely gone.
    """
    raw = fetch_all_following()

    col = _col()
    existing_count = col.count_documents({})
    if not raw and existing_count > 0:
        raise RuntimeError(
            f"GitHub returned 0 following but {existing_count} records exist — "
            "aborting to protect existing data"
        )

    if not raw:
        return 0

    now = datetime.now(timezone.utc)
    try:
        names = fetch_user_profiles([u["login"] for u in raw])
    except Exception:
        names = {}

    col.bulk_write([
        UpdateOne(
            {"github_id": u["id"]},
            {
                "$set": {
                    "github_id": u["id"],
                    "login": u["login"],
                    "name": names.get(u["login"], ""),
                    "avatar_url": u["avatar_url"],
                    "html_url": u["html_url"],
                    # Preserves GitHub's own ordering (most recently followed
                    # first), which the UI relies on — it is not a stable
                    # property of the user.
                    "position": idx,
                },
                # `captured_at` is "first seen", and the UI shows it as such, so it
                # must be written exactly once: on the sync that first saw this
                # account. Everything above is refreshed every run; this is not.
                "$setOnInsert": {"captured_at": now},
            },
            upsert=True,
        )
        for idx, u in enumerate(raw)
    ], ordered=False)

    # Anyone you have since unfollowed.
    col.delete_many({"github_id": {"$nin": [u["id"] for u in raw]}})

    return len(raw)


def get_following(page: int = 1, per_page: int = 30, search: str = "") -> dict:
    col = _col()
    # Escaped: an unescaped search box is a regex injection — a stray "(" is a
    # 500, and ".*" scans the collection.
    query = (
        {"login": {"$regex": re.escape(search.strip()), "$options": "i"}}
        if search.strip() else {}
    )
    total = col.count_documents(query)
    docs = list(col.find(query, {"_id": 0, "position": 0}).sort(
        [("position", 1), ("login", 1)]
    ).skip((page - 1) * per_page).limit(per_page))
    for d in docs:
        if isinstance(d.get("captured_at"), datetime):
            d["captured_at"] = d["captured_at"].isoformat()
    return {"total": total, "page": page, "per_page": per_page, "data": docs}

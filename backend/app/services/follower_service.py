from datetime import datetime, timezone
from pymongo.collection import Collection
from ..database import get_db
from ..models.follower import make_follower_snapshot, make_follower_event
from .github_service import fetch_all_followers


def _snapshots_col() -> Collection:
    return get_db()["follower_snapshots"]


def _events_col() -> Collection:
    return get_db()["follower_events"]


def _ensure_indexes():
    _snapshots_col().create_index("login", unique=True)
    _snapshots_col().create_index([("captured_at", -1), ("login", 1)])
    _events_col().create_index([("event_type", 1), ("event_at", -1), ("login", 1)])
    _events_col().create_index([("login", 1), ("event_at", -1)])


def _deduplicate_snapshots():
    """Remove duplicate login entries, keeping the earliest captured_at."""
    pipeline = [
        {"$group": {"_id": "$login", "count": {"$sum": 1}, "ids": {"$push": "$_id"}, "first": {"$min": "$captured_at"}}},
        {"$match": {"count": {"$gt": 1}}}
    ]
    for doc in _snapshots_col().aggregate(pipeline):
        # keep the document with earliest captured_at, delete the rest
        keep = _snapshots_col().find_one({"login": doc["_id"]}, sort=[("captured_at", 1)])
        if keep:
            _snapshots_col().delete_many({"login": doc["_id"], "_id": {"$ne": keep["_id"]}})


def sync_followers() -> dict:
    _ensure_indexes()
    _deduplicate_snapshots()
    now = datetime.now(timezone.utc)

    raw = fetch_all_followers()
    current_map = {u["login"]: u for u in raw}
    current_logins = set(current_map.keys())

    stored = {doc["login"]: doc for doc in _snapshots_col().find({}, {"_id": 0})}
    stored_logins = set(stored.keys())

    new_followers = current_logins - stored_logins
    lost_followers = stored_logins - current_logins
    is_first_sync = len(stored_logins) == 0

    events = []

    for login in new_followers:
        user = current_map[login]
        events.append(make_follower_event(
            login=login,
            avatar_url=user["avatar_url"],
            html_url=user["html_url"],
            event_type="followed",
            event_at=now,
        ))
        _snapshots_col().update_one(
            {"login": login},
            {"$set": {
                **make_follower_snapshot(login, user["avatar_url"], user["html_url"], now),
                "is_initial": is_first_sync,
            }},
            upsert=True,
        )

    for login in lost_followers:
        stored_user = stored[login]
        events.append(make_follower_event(
            login=login,
            avatar_url=stored_user.get("avatar_url", ""),
            html_url=stored_user.get("html_url", ""),
            event_type="unfollowed",
            event_at=now,
        ))
        _snapshots_col().delete_one({"login": login})

    if events:
        _events_col().insert_many(events)

    return {
        "synced_at": now.isoformat(),
        "total_followers": len(current_logins),
        "new_followers": len(new_followers),
        "lost_followers": len(lost_followers),
    }


def _search_filter(search: str) -> dict:
    if not search or not search.strip():
        return {}
    return {"login": {"$regex": search.strip(), "$options": "i"}}


def get_current_followers(page: int = 1, per_page: int = 30, search: str = "") -> dict:
    col = _snapshots_col()
    query = _search_filter(search)
    total = col.count_documents(query)
    docs = list(col.find(query, {"_id": 0}).sort(
        [("captured_at", -1), ("login", 1)]
    ).skip((page - 1) * per_page).limit(per_page))
    for d in docs:
        if isinstance(d.get("captured_at"), datetime):
            d["captured_at"] = d["captured_at"].isoformat()
    return {"total": total, "page": page, "per_page": per_page, "data": docs}


def get_current_unfollowed(page: int = 1, per_page: int = 30, search: str = "") -> dict:
    """
    Users who unfollowed and have NOT re-followed.
    Deduplicates by login — shows only the most recent unfollow event per user.
    """
    current_followers = {
        doc["login"] for doc in _snapshots_col().find({}, {"login": 1, "_id": 0})
    }

    search_match = {"$regex": search.strip(), "$options": "i"} if search.strip() else None

    base_match: dict = {"event_type": "unfollowed"}
    if search_match:
        base_match["login"] = search_match

    pipeline_base = [
        {"$match": base_match},
        # sort before grouping so $first picks the most recent event
        {"$sort": {"event_at": -1, "login": 1}},
        {"$group": {
            "_id": "$login",
            "login":      {"$first": "$login"},
            "avatar_url": {"$first": "$avatar_url"},
            "html_url":   {"$first": "$html_url"},
            "event_at":   {"$first": "$event_at"},
            "event_type": {"$first": "$event_type"},
        }},
        # exclude users who have since re-followed
        {"$match": {"_id": {"$nin": list(current_followers)}}},
        {"$sort": {"event_at": -1, "login": 1}},
    ]

    count_result = list(_events_col().aggregate(pipeline_base + [{"$count": "total"}]))
    total = count_result[0]["total"] if count_result else 0

    docs = list(_events_col().aggregate(
        pipeline_base + [
            {"$skip": (page - 1) * per_page},
            {"$limit": per_page},
            {"$project": {"_id": 0}},
        ]
    ))
    for d in docs:
        if isinstance(d.get("event_at"), datetime):
            d["event_at"] = d["event_at"].isoformat()

    return {"total": total, "page": page, "per_page": per_page, "data": docs}


def get_follower_history(login: str) -> list[dict]:
    col = _events_col()
    docs = list(col.find({"login": login}, {"_id": 0}).sort("event_at", 1))
    for d in docs:
        for key in ("event_at", "created_at"):
            if isinstance(d.get(key), datetime):
                d[key] = d[key].isoformat()
    return docs


def get_stats() -> dict:
    db = get_db()
    current_followers = {
        doc["login"] for doc in db["follower_snapshots"].find({}, {"login": 1, "_id": 0})
    }
    # count unique users who unfollowed and have NOT re-followed
    unique_unfollowed = db["follower_events"].aggregate([
        {"$match": {"event_type": "unfollowed"}},
        {"$group": {"_id": "$login"}},
        {"$match": {"_id": {"$nin": list(current_followers)}}},
        {"$count": "total"},
    ])
    unfollowed_count = next(unique_unfollowed, {}).get("total", 0)

    return {
        "total_followers": db["follower_snapshots"].count_documents({}),
        "total_followed_events": db["follower_events"].count_documents({"event_type": "followed"}),
        "total_unfollowed_events": unfollowed_count,
    }

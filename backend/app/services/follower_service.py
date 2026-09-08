import logging
import re
from datetime import datetime, timezone
from pymongo.collection import Collection
from ..database import get_db
from ..models.follower import make_follower_snapshot, make_follower_event
from .github_service import fetch_all_followers, fetch_user_by_login, fetch_user_profiles

log = logging.getLogger(__name__)

# GitHub avatar URLs embed the immutable numeric user id:
#   https://avatars.githubusercontent.com/u/12345?v=4
_AVATAR_ID_RE = re.compile(r"avatars\.githubusercontent\.com/u/(\d+)")


def _snapshots_col() -> Collection:
    return get_db()["follower_snapshots"]


def _events_col() -> Collection:
    return get_db()["follower_events"]


def _id_from_avatar(avatar_url: str) -> int | None:
    m = _AVATAR_ID_RE.search(avatar_url or "")
    return int(m.group(1)) if m else None


def resolve_github_id(login: str, avatar_url: str = "", by_login: dict = None) -> int | None:
    """Best-effort resolution of a legacy record to its immutable numeric id.

    Order matters: the live follower list is authoritative, the stored avatar URL
    works even for someone who has since renamed, and the API lookup is the last
    resort (it 404s for renamed logins, which is exactly the case we care about).
    """
    if by_login and login in by_login:
        return by_login[login]["id"]
    gid = _id_from_avatar(avatar_url)
    if gid:
        return gid
    user = fetch_user_by_login(login)
    return user["id"] if user else None


def _backfill_snapshot_ids(docs: list[dict], by_login: dict) -> None:
    col = _snapshots_col()
    for doc in docs:
        if doc.get("github_id"):
            continue
        gid = resolve_github_id(doc.get("login", ""), doc.get("avatar_url", ""), by_login)
        if gid:
            doc["github_id"] = gid
            col.update_one({"login": doc["login"]}, {"$set": {"github_id": gid}})


def sync_followers() -> dict:
    now = datetime.now(timezone.utc)

    raw = fetch_all_followers()
    current_map = {u["id"]: u for u in raw}
    current_ids = set(current_map)
    by_login = {u["login"]: u for u in raw}

    stored_docs = list(_snapshots_col().find({}, {"_id": 0}))

    if not current_ids and stored_docs:
        raise RuntimeError(
            f"GitHub returned 0 followers but {len(stored_docs)} are stored — "
            "aborting to protect existing data"
        )

    _backfill_snapshot_ids(stored_docs, by_login)

    stored = {d["github_id"]: d for d in stored_docs if d.get("github_id")}
    unresolved = [d for d in stored_docs if not d.get("github_id")]
    stored_ids = set(stored)

    new_ids = current_ids - stored_ids
    lost_ids = stored_ids - current_ids
    is_first_sync = len(stored_docs) == 0

    # Display names: resolve for people we haven't named yet — new followers, plus
    # anyone stored before the `name` field existed. One batched GraphQL call per
    # 100 users, so a steady-state sync costs nothing and the first one is cheap.
    needs_name = [
        current_map[gid]["login"]
        for gid in current_ids
        if gid in new_ids or not stored.get(gid, {}).get("name")
    ]
    names: dict[str, str] = {}
    if needs_name:
        try:
            names = fetch_user_profiles(needs_name)
        except Exception:
            log.warning("Could not resolve display names; falling back to logins.", exc_info=True)

    events = []
    renamed = 0

    for gid in new_ids:
        user = current_map[gid]
        events.append(make_follower_event(
            github_id=gid,
            login=user["login"],
            name=names.get(user["login"], ""),
            avatar_url=user["avatar_url"],
            html_url=user["html_url"],
            event_type="followed",
            event_at=now,
        ))
        _snapshots_col().update_one(
            {"github_id": gid},
            {"$set": {
                **make_follower_snapshot(
                    gid,
                    user["login"],
                    user["avatar_url"],
                    user["html_url"],
                    now,
                    name=names.get(user["login"], ""),
                ),
                "is_initial": is_first_sync,
            }},
            upsert=True,
        )

    # Backfill names onto existing followers without touching their captured_at.
    for gid in current_ids & stored_ids:
        login = current_map[gid]["login"]
        if login in names:
            _snapshots_col().update_one(
                {"github_id": gid}, {"$set": {"name": names[login]}}
            )

    # Same person, new username — refresh the record, emit no follow/unfollow event.
    for gid in current_ids & stored_ids:
        user = current_map[gid]
        old_login = stored[gid].get("login")
        if old_login == user["login"]:
            continue
        renamed += 1
        _snapshots_col().update_one(
            {"github_id": gid},
            {
                "$set": {
                    "login": user["login"],
                    "avatar_url": user["avatar_url"],
                    "html_url": user["html_url"],
                },
                "$addToSet": {"previous_logins": old_login},
            },
        )

    for gid in lost_ids:
        stored_user = stored[gid]
        events.append(make_follower_event(
            github_id=gid,
            login=stored_user.get("login", ""),
            name=stored_user.get("name", ""),
            avatar_url=stored_user.get("avatar_url", ""),
            html_url=stored_user.get("html_url", ""),
            event_type="unfollowed",
            event_at=now,
        ))
        _snapshots_col().delete_one({"github_id": gid})

    # Records we could not map to an id (deleted accounts / gravatar-era avatars).
    # They are not in the live follower list, so they are genuinely gone.
    for doc in unresolved:
        events.append(make_follower_event(
            github_id=None,
            login=doc.get("login", ""),
            avatar_url=doc.get("avatar_url", ""),
            html_url=doc.get("html_url", ""),
            event_type="unfollowed",
            event_at=now,
        ))
        _snapshots_col().delete_one({"login": doc["login"]})

    if events:
        _events_col().insert_many(events)

    return {
        "synced_at": now.isoformat(),
        "total_followers": len(current_ids),
        "new_followers": len(new_ids),
        "lost_followers": len(lost_ids) + len(unresolved),
        "renamed": renamed,
    }


def _search_filter(search: str) -> dict:
    if not search or not search.strip():
        return {}
    # Escaped: an unescaped search box is a regex injection — a stray "(" is a
    # 500, and ".*" scans the collection.
    return {"login": {"$regex": re.escape(search.strip()), "$options": "i"}}


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


def _unfollowed_candidates(search: str = "") -> list[dict]:
    """Latest unfollow event per person, newest first — before re-followers are removed.

    This is the expensive half of "who unfollowed me", so it is computed once and
    handed to both the listing and the count.
    """
    match: dict = {"event_type": "unfollowed"}
    if search.strip():
        match["login"] = {"$regex": re.escape(search.strip()), "$options": "i"}

    return list(_events_col().aggregate([
        {"$match": match},
        # sort before grouping so $first picks the most recent event
        {"$sort": {"event_at": -1, "login": 1}},
        # group on the identity key, falling back to login for un-backfilled events
        {"$group": {
            "_id": {"$ifNull": ["$github_id", "$login"]},
            "github_id": {"$first": "$github_id"},
            "login":      {"$first": "$login"},
            "name":       {"$first": "$name"},
            "avatar_url": {"$first": "$avatar_url"},
            "html_url":   {"$first": "$html_url"},
            "event_at":   {"$first": "$event_at"},
            "event_type": {"$first": "$event_type"},
        }},
        {"$sort": {"event_at": -1, "login": 1}},
        {"$project": {"_id": 0}},
    ]))


def _still_following(candidates: list[dict]) -> tuple[set, set]:
    """Which of `candidates` are in the current follower list — by id and by login.

    The exclusion used to work the other way round: pull *every* follower snapshot
    (1,400+ documents here) across the wire, build two big arrays out of them, and
    ship those back into the aggregation as `$nin` operands. That moved the largest
    payload in the app on every dashboard load and could not use an index — `$nin`
    against an array that size is a linear scan per document.

    Asking the opposite question is bounded by the number of people who have ever
    unfollowed, which is far smaller, and `$in` on `github_id` and `login` is
    served by the indexes that already exist.
    """
    ids = [c["github_id"] for c in candidates if c.get("github_id")]
    logins = [c["login"] for c in candidates if c.get("login")]
    if not ids and not logins:
        return set(), set()

    clauses = []
    if ids:
        clauses.append({"github_id": {"$in": ids}})
    if logins:
        clauses.append({"login": {"$in": logins}})

    docs = _snapshots_col().find({"$or": clauses}, {"github_id": 1, "login": 1, "_id": 0})
    found_ids, found_logins = set(), set()
    for d in docs:
        if d.get("github_id"):
            found_ids.add(d["github_id"])
        if d.get("login"):
            found_logins.add(d["login"])
    return found_ids, found_logins


def _unfollowed_rows(search: str = "") -> list[dict]:
    """Everyone who unfollowed and has NOT re-followed, newest unfollow first."""
    candidates = _unfollowed_candidates(search)
    if not candidates:
        return []

    # Matched by id first, login as fallback, so a rename can never leave a phantom
    # entry stranded here.
    following_ids, following_logins = _still_following(candidates)
    return [
        c for c in candidates
        if c.get("github_id") not in following_ids and c.get("login") not in following_logins
    ]


def get_current_unfollowed(page: int = 1, per_page: int = 30, search: str = "") -> dict:
    """
    Users who unfollowed and have NOT re-followed.
    Deduplicates by github_id — shows only the most recent unfollow event per user.
    """
    rows = _unfollowed_rows(search)

    # Sliced here rather than with $skip/$limit because the re-follower exclusion
    # decides what is on a page, and that is resolved above. It also means the count
    # and the page come from one pass instead of the two full runs this used to do.
    start = (page - 1) * per_page
    docs = [dict(d) for d in rows[start:start + per_page]]
    for d in docs:
        if isinstance(d.get("event_at"), datetime):
            d["event_at"] = d["event_at"].isoformat()

    return {"total": len(rows), "page": page, "per_page": per_page, "data": docs}


def get_follower_history(login: str) -> list[dict]:
    """History follows the person, not the name — spans username changes."""
    col = _events_col()

    snap = _snapshots_col().find_one(
        {"$or": [{"login": login}, {"previous_logins": login}]},
        {"github_id": 1, "avatar_url": 1, "_id": 0},
    )
    gid = (snap or {}).get("github_id")
    if not gid:
        ev = col.find_one({"login": login}, {"github_id": 1, "_id": 0})
        gid = (ev or {}).get("github_id")

    query = {"$or": [{"github_id": gid}, {"login": login}]} if gid else {"login": login}
    docs = list(col.find(query, {"_id": 0}).sort("event_at", 1))
    for d in docs:
        for key in ("event_at", "created_at"):
            if isinstance(d.get(key), datetime):
                d[key] = d[key].isoformat()
    return docs


def get_stats() -> dict:
    db = get_db()

    # unique users who unfollowed and have NOT re-followed
    unfollowed_count = len(_unfollowed_rows())

    return {
        "total_followers": db["follower_snapshots"].count_documents({}),
        "total_followed_events": db["follower_events"].count_documents({"event_type": "followed"}),
        "total_unfollowed_events": unfollowed_count,
    }

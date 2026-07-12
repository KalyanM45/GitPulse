import logging
from datetime import datetime, timezone

import requests

from ..database import get_db
from .github_service import (
    fetch_all_repos,
    fetch_repo_branch_count,
    fetch_repo_commit_count,
    fetch_repo_languages,
    fetch_repo_traffic_views,
    fetch_repo_traffic_clones,
    fetch_repo_commit_activity,
    fetch_repo_subscribers,
    fetch_repo_referrers,
    fetch_repo_popular_paths,
)

log = logging.getLogger(__name__)


def _traffic_col():
    return get_db()["traffic_daily"]


def _ensure_traffic_indexes():
    # One document per repo per day. The unique key is what makes re-syncing the
    # same 14-day window idempotent instead of double-counting.
    _traffic_col().create_index([("repo", 1), ("date", 1)], unique=True)
    _traffic_col().create_index([("date", -1)])


def _store_daily_traffic(repo: str, views_days: list, clones_days: list) -> None:
    """
    GitHub only ever returns the last 14 days. Persisting each day individually —
    keyed (repo, date) — means the history keeps growing past that window: days
    that scroll out of GitHub's response stay in our database forever.

    Upsert (not insert) so overlapping syncs correct a day rather than duplicate it;
    a partial day re-synced later simply lands on its final value.
    """
    ops = {}

    for d in views_days or []:
        day = d["timestamp"][:10]
        ops.setdefault(day, {})["views"] = d.get("count", 0)
        ops[day]["views_uniques"] = d.get("uniques", 0)

    for d in clones_days or []:
        day = d["timestamp"][:10]
        ops.setdefault(day, {})["clones"] = d.get("count", 0)
        ops[day]["clones_uniques"] = d.get("uniques", 0)

    col = _traffic_col()
    for day, vals in ops.items():
        col.update_one(
            {"repo": repo, "date": day},
            {
                "$set": {
                    "repo": repo,
                    "date": day,
                    "views": vals.get("views", 0),
                    "views_uniques": vals.get("views_uniques", 0),
                    "clones": vals.get("clones", 0),
                    "clones_uniques": vals.get("clones_uniques", 0),
                }
            },
            upsert=True,
        )


def _lifetime_traffic(repo: str) -> dict:
    """Everything we have ever recorded for this repo — not just GitHub's 14 days."""
    agg = list(
        _traffic_col().aggregate(
            [
                {"$match": {"repo": repo}},
                {
                    "$group": {
                        "_id": None,
                        "views": {"$sum": "$views"},
                        "views_uniques": {"$sum": "$views_uniques"},
                        "clones": {"$sum": "$clones"},
                        "clones_uniques": {"$sum": "$clones_uniques"},
                        "days": {"$sum": 1},
                    }
                },
            ]
        )
    )
    if not agg:
        return {"views": 0, "views_uniques": 0, "clones": 0, "clones_uniques": 0, "days": 0}
    return {k: v for k, v in agg[0].items() if k != "_id"}


def get_traffic_series(repo: str) -> list[dict]:
    """Day-wise traffic for one repo, oldest first — the accumulated history."""
    return list(
        _traffic_col()
        .find({"repo": repo}, {"_id": 0})
        .sort("date", 1)
    )


def sync_repos() -> dict:
    db = get_db()
    col = db["repo_snapshots"]
    synced_at = datetime.now(timezone.utc)
    _ensure_traffic_indexes()

    # Traffic needs push access on the token. A token without the `repo` /
    # `public_repo` scope gets a 403 on every repo — which used to be swallowed
    # and written as 0, making the dashboard look like nobody had ever visited.
    # Count the failures and report them so the cause is visible.
    traffic_denied = 0
    traffic_ok = 0
    commits_pending = 0

    repos = fetch_all_repos()
    for r in repos:
        full_name = r["full_name"]

        try:
            languages = fetch_repo_languages(full_name)
        except Exception:
            languages = {}

        try:
            vd = fetch_repo_traffic_views(full_name)
            views_total, views_unique = vd.get("count", 0), vd.get("uniques", 0)
            cd = fetch_repo_traffic_clones(full_name)
            clones_total, clones_unique = cd.get("count", 0), cd.get("uniques", 0)
            # Persist the day-wise breakdown, not just the 14-day rollup.
            _store_daily_traffic(r["name"], vd.get("views", []), cd.get("clones", []))
            traffic_ok += 1
        except requests.HTTPError as e:
            status = e.response.status_code if e.response is not None else None
            if status in (403, 404):
                traffic_denied += 1
            views_total = views_unique = clones_total = clones_unique = 0
        except Exception:
            views_total = views_unique = clones_total = clones_unique = 0

        # Lifetime figures come from what we've accumulated, so they keep growing
        # after a day falls out of GitHub's 14-day window.
        lifetime = _lifetime_traffic(r["name"])

        # What we already know about this repo. When a GitHub call fails or isn't
        # ready, we keep the previous value rather than clobbering it with 0 —
        # a failed fetch is not evidence that the number is zero.
        prev = col.find_one(
            {"name": r["name"]},
            {
                "_id": 0, "stars": 1, "commits_last_year": 1, "commits_total": 1,
                "branches": 1, "watchers": 1,
            },
        ) or {}

        try:
            activity = fetch_repo_commit_activity(full_name)
            if activity is None:
                # 202 after retries: stats still being computed. Keep what we had.
                commits_last_year = prev.get("commits_last_year", 0)
                commits_pending += 1
            else:
                commits_last_year = sum(w.get("total", 0) for w in activity)
        except Exception:
            commits_last_year = prev.get("commits_last_year", 0)

        # All-time commits. commits_last_year only covers the last 52 weeks, so a
        # repo that was finished a year ago reports 0 there despite having hundreds.
        try:
            commits_total = fetch_repo_commit_count(full_name)
        except Exception:
            commits_total = prev.get("commits_total", 0)

        try:
            branches = fetch_repo_branch_count(full_name)
        except Exception:
            branches = prev.get("branches", 0)

        try:
            watchers = fetch_repo_subscribers(full_name)
        except Exception:
            watchers = prev.get("watchers", 0)

        try:
            referrers = fetch_repo_referrers(full_name)
        except Exception:
            referrers = []

        try:
            popular_paths = fetch_repo_popular_paths(full_name)
        except Exception:
            popular_paths = []

        # Compute new stars since previous snapshot
        current_stars = r.get("stargazers_count", 0)
        stars_delta = current_stars - prev["stars"] if prev.get("stars") is not None else 0

        doc = {
            "name": r["name"],
            "full_name": full_name,
            "description": r.get("description") or "",
            "html_url": r["html_url"],
            "homepage": r.get("homepage") or "",
            "is_fork": r.get("fork", False),
            "is_archived": r.get("archived", False),
            "is_private": r.get("private", False),
            "language": r.get("language") or "",
            "languages": languages,
            "topics": r.get("topics", []),
            "stars": r.get("stargazers_count", 0),
            "forks": r.get("forks_count", 0),
            "watchers": watchers,
            "open_issues": r.get("open_issues_count", 0),
            "size": r.get("size", 0),
            "created_at": r.get("created_at"),
            "updated_at": r.get("updated_at"),
            # pushed_at is the last COMMIT push. updated_at moves on any metadata
            # change (a description edit, a star), so it is not "last updated" in
            # the sense anyone means.
            "pushed_at": r.get("pushed_at"),
            "commits_last_year": commits_last_year,
            "commits_total": commits_total,
            "branches": branches,
            # Last 14 days, straight from GitHub.
            "traffic_views_total": views_total,
            "traffic_views_unique": views_unique,
            "traffic_clones_total": clones_total,
            "traffic_clones_unique": clones_unique,
            # Everything we have ever recorded, accumulated day by day.
            "views_all_time": lifetime["views"],
            "views_uniques_all_time": lifetime["views_uniques"],
            "clones_all_time": lifetime["clones"],
            "clones_uniques_all_time": lifetime["clones_uniques"],
            "traffic_days_recorded": lifetime["days"],
            "referrers": referrers,
            "popular_paths": popular_paths,
            "stars_since_last_sync": stars_delta,
            "synced_at": synced_at,
        }
        col.replace_one({"name": r["name"]}, doc, upsert=True)

        # Append star snapshot for history tracking
        db["star_snapshots"].insert_one({
            "repo": r["name"],
            "stars": current_stars,
            "captured_at": synced_at,
        })

    # Remove repos no longer owned
    current_names = [r["name"] for r in repos]
    col.delete_many({"name": {"$nin": current_names}})

    if traffic_denied:
        log.warning(
            "Traffic denied for %d/%d repos (403/404). The GITHUB_TOKEN needs the "
            "`public_repo` scope (or `repo` for private repos) — GitHub requires push "
            "access for the traffic API. Views and clones will read 0 until this is fixed.",
            traffic_denied,
            len(repos),
        )

    if commits_pending:
        log.info(
            "Commit stats still being computed by GitHub for %d repo(s); kept the "
            "previous values rather than zeroing them. They'll fill in next sync.",
            commits_pending,
        )

    return {
        "synced_at": synced_at.isoformat(),
        "total_repos": len(repos),
        "traffic_ok": traffic_ok,
        "traffic_denied": traffic_denied,
        "commits_pending": commits_pending,
    }


# Whitelisted so a caller can't sort on an arbitrary field.
SORT_FIELDS = {
    "name",
    "stars",
    "pushed_at",
    "updated_at",
    "forks",
    "watchers",
    "branches",
    "commits_total",
    "commits_last_year",
    "views_all_time",
    "traffic_views_total",
}


def get_repos(
    page: int = 1,
    per_page: int = 30,
    search: str = "",
    sort: str = "pushed_at",
    order: str = "desc",
    visibility: str = "all",
) -> dict:
    col = get_db()["repo_snapshots"]
    query: dict = {}
    if search:
        query["name"] = {"$regex": search, "$options": "i"}

    if visibility == "public":
        query["is_private"] = False
    elif visibility == "private":
        query["is_private"] = True

    if sort not in SORT_FIELDS:
        sort = "stars"
    direction = 1 if order == "asc" else -1

    total = col.count_documents(query)
    skip = (page - 1) * per_page

    cursor = col.find(query, {"_id": 0})

    if sort == "name":
        # Collation strength 1 makes A–Z case- and accent-insensitive, so "Zebra"
        # doesn't sort before "apple" the way a raw bytewise sort would.
        cursor = cursor.collation({"locale": "en", "strength": 1})
        # No tie-break here: name is already unique, and appending ("name", 1)
        # would produce [("name", -1), ("name", 1)] — a duplicate key that
        # silently cancels the descending direction.
        spec = [("name", direction)]
    else:
        # Tie-break on name so pagination is stable when many repos share a value
        # (dozens sit at 0 stars) — otherwise rows repeat or vanish between pages.
        spec = [(sort, direction), ("name", 1)]

    docs = list(cursor.sort(spec).skip(skip).limit(per_page))

    return {"data": docs, "total": total, "page": page, "per_page": per_page}


def get_repo(name: str) -> dict | None:
    return get_db()["repo_snapshots"].find_one({"name": name}, {"_id": 0})


def get_star_history(repo_name: str) -> list:
    docs = list(
        get_db()["star_snapshots"]
        .find({"repo": repo_name}, {"_id": 0, "stars": 1, "captured_at": 1})
        .sort("captured_at", 1)
        .limit(100)
    )
    for d in docs:
        if hasattr(d.get("captured_at"), "isoformat"):
            d["captured_at"] = d["captured_at"].isoformat()
    return docs


def get_overview() -> dict:
    col = get_db()["repo_snapshots"]
    empty = {
        "total_repos": 0, "public_repos": 0, "private_repos": 0,
        "total_stars": 0, "total_forks": 0, "total_watchers": 0,
        "total_views": 0, "total_views_unique": 0, "total_clones": 0,
        "total_clones_unique": 0, "total_commits_year": 0, "total_commits": 0,
        "total_branches": 0, "traffic_days_recorded": 0,
        "top_languages": [], "most_starred": [], "most_viewed": [], "synced_at": None,
    }

    stats_agg = list(col.aggregate([{"$group": {
        "_id": None,
        "total_repos": {"$sum": 1},
        # $cond over the boolean rather than two extra count queries.
        "private_repos": {"$sum": {"$cond": ["$is_private", 1, 0]}},
        "total_stars": {"$sum": "$stars"},
        "total_forks": {"$sum": "$forks"},
        "total_watchers": {"$sum": "$watchers"},
        "total_branches": {"$sum": "$branches"},
        "total_commits_year": {"$sum": "$commits_last_year"},
        "total_commits": {"$sum": "$commits_total"},
    }}]))
    if not stats_agg:
        return empty

    stats = {k: v for k, v in stats_agg[0].items() if k != "_id"}
    stats["public_repos"] = stats["total_repos"] - stats["private_repos"]

    # Traffic totals come from the accumulated day-wise store, not from each repo's
    # 14-day rollup — so these keep climbing as history builds, and re-syncing the
    # same window doesn't double-count.
    traffic_agg = list(_traffic_col().aggregate([{"$group": {
        "_id": None,
        "total_views": {"$sum": "$views"},
        "total_views_unique": {"$sum": "$views_uniques"},
        "total_clones": {"$sum": "$clones"},
        "total_clones_unique": {"$sum": "$clones_uniques"},
    }}]))
    if traffic_agg:
        stats.update({k: v for k, v in traffic_agg[0].items() if k != "_id"})
    else:
        stats.update({
            "total_views": 0, "total_views_unique": 0,
            "total_clones": 0, "total_clones_unique": 0,
        })

    stats["traffic_days_recorded"] = len(_traffic_col().distinct("date"))

    lang_agg = list(col.aggregate([
        {"$project": {"languages": {"$objectToArray": "$languages"}}},
        {"$unwind": "$languages"},
        {"$group": {"_id": "$languages.k", "bytes": {"$sum": "$languages.v"}, "count": {"$sum": 1}}},
        {"$sort": {"bytes": -1}},
        {"$limit": 8},
    ]))
    top_languages = [{"name": d["_id"], "bytes": d["bytes"], "count": d["count"]} for d in lang_agg]

    proj = {
        "_id": 0, "name": 1, "stars": 1, "forks": 1, "language": 1,
        "html_url": 1, "description": 1, "is_private": 1, "watchers": 1,
        "commits_last_year": 1, "commits_total": 1, "branches": 1, "pushed_at": 1,
        "traffic_views_total": 1, "traffic_views_unique": 1, "views_all_time": 1,
    }
    most_starred = list(col.find({}, proj).sort("stars", -1).limit(10))
    most_viewed = list(col.find({}, proj).sort("views_all_time", -1).limit(10))

    latest = col.find_one({}, {"synced_at": 1}, sort=[("synced_at", -1)])
    synced_at = latest["synced_at"].isoformat() if latest and latest.get("synced_at") else None

    return {**stats, "top_languages": top_languages, "most_starred": most_starred,
            "most_viewed": most_viewed, "synced_at": synced_at}

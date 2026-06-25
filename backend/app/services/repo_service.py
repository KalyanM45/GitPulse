from datetime import datetime, timezone
from ..database import get_db
from .github_service import (
    fetch_all_repos,
    fetch_repo_languages,
    fetch_repo_traffic_views,
    fetch_repo_traffic_clones,
    fetch_repo_commit_activity,
    fetch_repo_subscribers,
    fetch_repo_referrers,
    fetch_repo_popular_paths,
)


def sync_repos() -> dict:
    db = get_db()
    col = db["repo_snapshots"]
    synced_at = datetime.now(timezone.utc)

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
        except Exception:
            views_total = views_unique = 0

        try:
            cd = fetch_repo_traffic_clones(full_name)
            clones_total, clones_unique = cd.get("count", 0), cd.get("uniques", 0)
        except Exception:
            clones_total = clones_unique = 0

        try:
            activity = fetch_repo_commit_activity(full_name)
            commits_last_year = sum(w.get("total", 0) for w in activity)
        except Exception:
            commits_last_year = 0

        try:
            watchers = fetch_repo_subscribers(full_name)
        except Exception:
            watchers = 0

        try:
            referrers = fetch_repo_referrers(full_name)
        except Exception:
            referrers = []

        try:
            popular_paths = fetch_repo_popular_paths(full_name)
        except Exception:
            popular_paths = []

        # Compute new stars since previous snapshot
        prev = col.find_one({"name": r["name"]}, {"stars": 1, "_id": 0})
        current_stars = r.get("stargazers_count", 0)
        stars_delta = current_stars - prev["stars"] if prev and prev.get("stars") is not None else 0

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
            "commits_last_year": commits_last_year,
            "traffic_views_total": views_total,
            "traffic_views_unique": views_unique,
            "traffic_clones_total": clones_total,
            "traffic_clones_unique": clones_unique,
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

    return {"synced_at": synced_at.isoformat(), "total_repos": len(repos)}


def get_repos(page: int = 1, per_page: int = 30, search: str = "") -> dict:
    col = get_db()["repo_snapshots"]
    query = {}
    if search:
        query["name"] = {"$regex": search, "$options": "i"}
    total = col.count_documents(query)
    skip = (page - 1) * per_page
    docs = list(col.find(query, {"_id": 0}).sort("stars", -1).skip(skip).limit(per_page))
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
        "total_repos": 0, "total_stars": 0, "total_forks": 0, "total_watchers": 0,
        "total_views": 0, "total_views_unique": 0, "total_clones": 0,
        "total_clones_unique": 0, "total_commits_year": 0,
        "top_languages": [], "most_starred": [], "most_viewed": [], "synced_at": None,
    }

    stats_agg = list(col.aggregate([{"$group": {
        "_id": None,
        "total_repos": {"$sum": 1},
        "total_stars": {"$sum": "$stars"},
        "total_forks": {"$sum": "$forks"},
        "total_watchers": {"$sum": "$watchers"},
        "total_views": {"$sum": "$traffic_views_total"},
        "total_views_unique": {"$sum": "$traffic_views_unique"},
        "total_clones": {"$sum": "$traffic_clones_total"},
        "total_clones_unique": {"$sum": "$traffic_clones_unique"},
        "total_commits_year": {"$sum": "$commits_last_year"},
    }}]))
    if not stats_agg:
        return empty

    stats = {k: v for k, v in stats_agg[0].items() if k != "_id"}

    lang_agg = list(col.aggregate([
        {"$project": {"languages": {"$objectToArray": "$languages"}}},
        {"$unwind": "$languages"},
        {"$group": {"_id": "$languages.k", "bytes": {"$sum": "$languages.v"}, "count": {"$sum": 1}}},
        {"$sort": {"bytes": -1}},
        {"$limit": 8},
    ]))
    top_languages = [{"name": d["_id"], "bytes": d["bytes"], "count": d["count"]} for d in lang_agg]

    proj = {"_id": 0, "name": 1, "stars": 1, "forks": 1, "language": 1,
            "html_url": 1, "description": 1, "traffic_views_total": 1, "traffic_views_unique": 1}
    most_starred = list(col.find({}, proj).sort("stars", -1).limit(10))
    most_viewed = list(col.find({}, proj).sort("traffic_views_total", -1).limit(10))

    latest = col.find_one({}, {"synced_at": 1}, sort=[("synced_at", -1)])
    synced_at = latest["synced_at"].isoformat() if latest and latest.get("synced_at") else None

    return {**stats, "top_languages": top_languages, "most_starred": most_starred,
            "most_viewed": most_viewed, "synced_at": synced_at}

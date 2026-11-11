"""Index definitions for every collection, created once at startup.

Every GitHub-data collection is per user (`owner_id`, see tenant.py), so each index
leads with owner_id: it both serves the always-present owner filter and makes
uniqueness per user. Two users can each have a repo called "portfolio" or share a
follower; the old global unique indexes would have rejected the second one, so they
are dropped here.
"""

import logging

from .database import get_db

log = logging.getLogger(__name__)

# Fields the repositories table can sort on. Each needs its own index: a sort that
# cannot use one forces MongoDB to load the whole collection and sort in memory,
# which it will refuse outright past 32MB.
_REPO_SORT_FIELDS = [
    "stars", "pushed_at", "updated_at", "forks", "watchers",
    "branches", "commits_total", "commits_last_year",
    "views_all_time", "traffic_views_total",
]

# Single-user-era unique indexes, by key. Any of these left in place would stop a
# second user from storing a row the first user already has.
_LEGACY_UNIQUE_KEYS = {
    "follower_snapshots": [[("github_id", 1)], [("login", 1)]],
    "following_snapshots": [[("github_id", 1)]],
    "repo_snapshots": [[("name", 1)]],
    "traffic_daily": [[("repo", 1), ("date", 1)]],
    "contributions": [[("year", 1)]],
}


def _drop_legacy_unique_indexes(db) -> None:
    for col_name, keys in _LEGACY_UNIQUE_KEYS.items():
        col = db[col_name]
        for name, spec in col.index_information().items():
            if spec.get("unique") and spec.get("key") in keys:
                col.drop_index(name)
                log.info("Dropped legacy unique index %s on %s.", name, col_name)


def ensure_indexes() -> None:
    db = get_db()
    _drop_legacy_unique_indexes(db)

    O = ("owner_id", 1)
    # Unique only among documents that have the field (not sparse: with owner_id
    # always present a sparse compound index would still index missing github_ids).
    has_gid = {"github_id": {"$exists": True}}

    followers = db["follower_snapshots"]
    followers.create_index([O, ("github_id", 1)], unique=True, partialFilterExpression=has_gid)
    followers.create_index([O, ("login", 1)])
    followers.create_index([O, ("captured_at", -1), ("login", 1)])

    events = db["follower_events"]
    events.create_index([O, ("event_type", 1), ("event_at", -1), ("github_id", 1)])
    events.create_index([O, ("github_id", 1), ("event_at", -1)])
    events.create_index([O, ("login", 1), ("event_at", -1)])

    following = db["following_snapshots"]
    following.create_index([O, ("github_id", 1)], unique=True)
    following.create_index([O, ("login", 1)])
    # The Following tab is ordered by GitHub's most-recently-followed-first order.
    following.create_index([O, ("position", 1), ("login", 1)])

    repos = db["repo_snapshots"]
    repos.create_index([O, ("name", 1)], unique=True)
    for field in _REPO_SORT_FIELDS:
        repos.create_index([O, (field, -1), ("name", 1)])

    db["star_snapshots"].create_index([O, ("repo", 1), ("captured_at", 1)])

    db["traffic_daily"].create_index([O, ("repo", 1), ("date", 1)], unique=True)
    db["traffic_daily"].create_index([O, ("date", -1)])

    db["contributions"].create_index([O, ("year", 1)], unique=True)

    # ── Users and jobs ──
    db["users"].create_index("firebase_uid", unique=True, sparse=True)
    # One GitPulse account per GitHub account.
    db["users"].create_index(
        "github.id", unique=True, partialFilterExpression={"github.id": {"$exists": True}}
    )
    db["sync_jobs"].create_index("status")

    # ── Invite-only program ──
    db["access_requests"].create_index("email", unique=True)
    db["access_requests"].create_index([("status", 1), ("created_at", -1)])
    db["rate_limits"].create_index("expires_at", expireAfterSeconds=0)

    log.info("Indexes ensured.")

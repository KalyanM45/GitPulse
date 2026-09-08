"""Index definitions for every collection, created once at startup.

These used to be created inside `sync_followers`, which meant every sync re-issued
the whole set — including the legacy-index cleanup, which only ever has something
to do once. Startup is the right place for it, and it keeps schema concerns out of
the hot path.

Several collections had no indexes at all beyond `_id`. `star_snapshots` in
particular holds tens of thousands of rows and is queried per repository on every
drawer open, and `repo_snapshots` is sorted on nine different fields by the
repositories table — both were full collection scans.
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


def _drop_legacy_login_unique_index(col) -> None:
    """The old schema keyed identity on login with a unique index.

    Identity now lives on github_id, and a login must be free to change — a unique
    index on it makes a rename collide with the renamer's own record.
    """
    for name, spec in col.index_information().items():
        if spec.get("key") == [("login", 1)] and spec.get("unique"):
            col.drop_index(name)
            log.info("Dropped legacy unique index %s on follower_snapshots.", name)


def ensure_indexes() -> None:
    db = get_db()

    followers = db["follower_snapshots"]
    _drop_legacy_login_unique_index(followers)
    # github_id is the identity key — login is a mutable display attribute.
    # sparse so pre-backfill documents (no github_id yet) don't collide.
    followers.create_index("github_id", unique=True, sparse=True)
    followers.create_index("login")
    followers.create_index([("captured_at", -1), ("login", 1)])

    events = db["follower_events"]
    events.create_index([("event_type", 1), ("event_at", -1), ("github_id", 1)])
    events.create_index([("github_id", 1), ("event_at", -1)])
    events.create_index([("login", 1), ("event_at", -1)])

    following = db["following_snapshots"]
    following.create_index("github_id", unique=True)
    following.create_index("login")
    # The Following tab is ordered by GitHub's own most-recently-followed-first
    # ordering, which is what `position` preserves.
    following.create_index([("position", 1), ("login", 1)])

    repos = db["repo_snapshots"]
    repos.create_index("name", unique=True)
    for field in _REPO_SORT_FIELDS:
        # Tie-broken on name, matching the sort the repositories table issues —
        # a prefix-only index would still leave the tie-break to an in-memory sort.
        repos.create_index([(field, -1), ("name", 1)])

    # Read once per repository whenever a repo drawer is opened, out of a
    # collection with tens of thousands of rows.
    db["star_snapshots"].create_index([("repo", 1), ("captured_at", 1)])

    db["traffic_daily"].create_index([("repo", 1), ("date", 1)], unique=True)
    db["traffic_daily"].create_index([("date", -1)])

    db["contributions"].create_index("year", unique=True)

    log.info("Indexes ensured.")

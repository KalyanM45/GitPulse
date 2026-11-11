"""Running a full sync for one user — inline, or as a background job with progress.

The first sync after connecting GitHub can take minutes for an account with many
repositories (several GitHub calls per repo), far longer than an HTTP request should
be held open. So connecting starts a background job, and the app polls its progress.
"""

import logging
import threading
from datetime import datetime, timedelta, timezone
from typing import Callable

import requests
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from .. import database
from ..tenant import Tenant, current, use
from . import contributions_service, follower_service, following_service
from . import profile_service, repo_service, sync_state

log = logging.getLogger(__name__)

STEPS = [
    ("profile", "Profile"),
    ("followers", "Followers"),
    ("following", "Following"),
    ("repos", "Repositories & traffic"),
    ("contributions", "Contributions"),
]

# A job still marked running after this long died with its process (a restart or a
# deploy); a new one may start.
_STALE_AFTER = timedelta(minutes=30)


def run_full_sync(progress: Callable[[str], None] = lambda step: None) -> dict:
    """Sync everything for the user in scope. Raises on failure."""
    from ..github_account import adopt_legacy_data

    adopt_legacy_data(current())

    progress("profile")
    profile_service.get_profile(force=True)
    progress("followers")
    followers = follower_service.sync_followers()
    progress("following")
    following_count = following_service.sync_following()
    progress("repos")
    repos = repo_service.sync_repos()
    progress("contributions")
    contrib = contributions_service.sync_contributions()

    # Stamped last, so it only moves when every step above actually finished.
    synced_at = sync_state.mark_synced()
    return {
        **followers,
        "synced_at": synced_at,
        "total_following": following_count,
        "total_repos": repos["total_repos"],
        "total_contributions": contrib["total_contributions"],
    }


# ── Background jobs ──────────────────────────────────────────────────────────

def _jobs():
    return database.get_db()["sync_jobs"]


def _iso(dt):
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def job_status(user_id) -> dict | None:
    doc = _jobs().find_one({"_id": user_id})
    if not doc:
        return None
    return {
        "status": doc["status"],
        "step": doc.get("step"),
        "steps": [{"id": s, "label": label} for s, label in STEPS],
        "started_at": _iso(doc.get("started_at")),
        "finished_at": _iso(doc.get("finished_at")),
        "error": doc.get("error"),
    }


def start_job(tenant: Tenant) -> bool:
    """Start a background sync. False if one is already running for this user."""
    now = datetime.now(timezone.utc)
    try:
        _jobs().find_one_and_update(
            {
                "_id": tenant.user_id,
                "$or": [{"status": {"$ne": "running"}}, {"started_at": {"$lt": now - _STALE_AFTER}}],
            },
            {
                "$set": {
                    "status": "running",
                    "step": STEPS[0][0],
                    "started_at": now,
                    "finished_at": None,
                    "error": None,
                }
            },
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
    except DuplicateKeyError:
        return False  # a running job exists, so the upsert collided with it
    threading.Thread(target=_run, args=(tenant,), name=f"sync-{tenant.github_login}", daemon=True).start()
    return True


def _run(tenant: Tenant) -> None:
    jobs = _jobs()

    def progress(step: str) -> None:
        jobs.update_one({"_id": tenant.user_id}, {"$set": {"step": step}})

    with use(tenant):
        try:
            run_full_sync(progress)
            jobs.update_one(
                {"_id": tenant.user_id},
                {"$set": {"status": "done", "step": None, "finished_at": datetime.now(timezone.utc)}},
            )
            log.info("Sync finished for %s", tenant.github_login)
        except Exception as e:
            log.exception("Sync failed for %s", tenant.github_login)
            message = "Something went wrong while syncing. Please try again."
            if isinstance(e, requests.HTTPError) and e.response is not None:
                if e.response.status_code == 401:
                    message = "GitHub access was revoked. Reconnect your GitHub account."
                elif e.response.status_code == 403:
                    message = "GitHub's rate limit was hit. The sync will work again within an hour."
            jobs.update_one(
                {"_id": tenant.user_id},
                {"$set": {"status": "failed", "error": message, "finished_at": datetime.now(timezone.utc)}},
            )

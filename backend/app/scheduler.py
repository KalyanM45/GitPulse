"""In-process periodic follower sync.

Note this syncs followers only — repos, traffic and contributions come from the
GitHub Actions cron in .github/workflows/auto_sync.yml.
"""

import logging

from apscheduler.schedulers.background import BackgroundScheduler

from .config import SYNC_INTERVAL_MINUTES
from .services.follower_service import sync_followers
from .services.sync_state import mark_synced

log = logging.getLogger(__name__)

_scheduler = BackgroundScheduler()


def _run_follower_sync():
    """Wrapped so a failure is logged rather than swallowed by APScheduler, and so
    the sync marker only moves when the sync actually succeeded."""
    try:
        result = sync_followers()
        mark_synced()
        log.info("Scheduled follower sync: %s", result)
    except Exception:
        log.exception("Scheduled follower sync failed.")


def start_scheduler():
    _scheduler.add_job(
        _run_follower_sync, "interval", minutes=SYNC_INTERVAL_MINUTES, id="follower_sync"
    )
    _scheduler.start()


def stop_scheduler():
    if _scheduler.running:
        _scheduler.shutdown()

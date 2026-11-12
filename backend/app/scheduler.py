"""In-process periodic follower sync.

Note this syncs followers only — repos, traffic and contributions come from the
GitHub Actions cron in .github/workflows/auto_sync.yml.
"""

import logging

from apscheduler.schedulers.background import BackgroundScheduler

from .config import SYNC_INTERVAL_MINUTES
from .github_account import iter_tenants, mark_token_revoked
from .services.follower_service import sync_followers
from .services.sync_runner import is_unauthorized
from .services.sync_state import mark_synced
from .tenant import use

log = logging.getLogger(__name__)

_scheduler = BackgroundScheduler()


def _run_follower_sync():
    """Wrapped so a failure is logged rather than swallowed by APScheduler, and so
    the sync marker only moves when the sync actually succeeded."""
    for tenant in iter_tenants():
        with use(tenant):
            try:
                result = sync_followers()
                mark_synced()
                log.info("Scheduled follower sync for @%s: %s", tenant.github_login, result)
            except Exception as e:
                if is_unauthorized(e):
                    mark_token_revoked(tenant.user_id)
                    log.warning("GitHub rejected @%s's token; they need to reconnect.", tenant.github_login)
                else:
                    log.exception("Scheduled follower sync failed for @%s.", tenant.github_login)


def start_scheduler():
    _scheduler.add_job(
        _run_follower_sync, "interval", minutes=SYNC_INTERVAL_MINUTES, id="follower_sync"
    )
    _scheduler.start()


def stop_scheduler():
    if _scheduler.running:
        _scheduler.shutdown()

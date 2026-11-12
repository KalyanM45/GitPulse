"""
Scheduled sync for every connected user, without the web server.

    python -m app.cron          (from backend/)

Runs as the Cloud Run Job triggered by Cloud Scheduler (infra/), or from the
GitHub Actions cron. Needs MONGODB_URI, DB_NAME and TOKEN_ENCRYPTION_KEY (the same
key as the API, to decrypt each user's stored GitHub token).
"""
import logging
import os
import sys
from datetime import datetime, timezone

from .github_account import iter_tenants
from .indexes import ensure_indexes
from .services.sync_runner import is_unauthorized, run_full_sync
from .tenant import use

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)s  %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%SZ",
)
log = logging.getLogger(__name__)


def main():
    missing = [k for k in ["MONGODB_URI", "TOKEN_ENCRYPTION_KEY"] if not os.getenv(k)]
    if missing:
        log.error("Missing required environment variables: %s", ", ".join(missing))
        sys.exit(1)

    log.info("Starting sync at %s UTC", datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"))
    # The API creates these at startup; this process never boots the API.
    ensure_indexes()

    ok = failed = revoked = 0
    for tenant in iter_tenants():
        with use(tenant):
            try:
                r = run_full_sync()
                ok += 1
                log.info(
                    "@%s synced — followers %d (+%d / -%d), repos %d",
                    tenant.github_login, r["total_followers"], r["new_followers"],
                    r["lost_followers"], r["total_repos"],
                )
            except Exception as e:
                # One user's revoked token or rate limit must not stop everyone else.
                if is_unauthorized(e):
                    # Not a fault in the sync: run_full_sync flagged the account, the
                    # app asks the user to reconnect, and later runs skip it.
                    revoked += 1
                    log.warning("GitHub rejected @%s's token; skipped until they reconnect.", tenant.github_login)
                else:
                    failed += 1
                    log.exception("Sync failed for @%s", tenant.github_login)

    log.info("Sync complete: %d succeeded, %d failed, %d need to reconnect GitHub.", ok, failed, revoked)
    if failed and not ok:
        sys.exit(1)


if __name__ == "__main__":
    main()

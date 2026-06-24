"""
Standalone sync script — runs without the FastAPI server.
Used by GitHub Actions for scheduled midnight IST syncs.
"""
import os
import sys
import logging
from datetime import datetime, timezone

# Allow importing from backend/
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "backend", ".env"))

from app.services.follower_service import sync_followers
from app.services.following_service import sync_following

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)s  %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%SZ",
)
log = logging.getLogger(__name__)


def main():
    required = ["GITHUB_TOKEN", "GITHUB_USERNAME", "MONGODB_URI"]
    missing = [k for k in required if not os.getenv(k)]
    if missing:
        log.error("Missing required environment variables: %s", ", ".join(missing))
        sys.exit(1)

    log.info("Starting sync at %s UTC", datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"))

    try:
        result = sync_followers()
        log.info(
            "Followers synced — total: %d  new: %d  lost: %d",
            result["total_followers"],
            result["new_followers"],
            result["lost_followers"],
        )
    except Exception as e:
        log.error("Follower sync failed: %s", e)
        sys.exit(1)

    try:
        following_count = sync_following()
        log.info("Following synced — total: %d", following_count)
    except Exception as e:
        log.error("Following sync failed: %s", e)
        sys.exit(1)

    log.info("Sync complete.")


if __name__ == "__main__":
    main()

from apscheduler.schedulers.background import BackgroundScheduler
from .config import SYNC_INTERVAL_MINUTES
from .services.follower_service import sync_followers

_scheduler = BackgroundScheduler()


def start_scheduler():
    _scheduler.add_job(sync_followers, "interval", minutes=SYNC_INTERVAL_MINUTES, id="follower_sync")
    _scheduler.start()


def stop_scheduler():
    if _scheduler.running:
        _scheduler.shutdown()

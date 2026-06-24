from datetime import datetime, timezone
from typing import Literal


def make_follower_snapshot(login: str, avatar_url: str, html_url: str, captured_at: datetime) -> dict:
    return {
        "login": login,
        "avatar_url": avatar_url,
        "html_url": html_url,
        "captured_at": captured_at,
    }


def make_follower_event(
    login: str,
    avatar_url: str,
    html_url: str,
    event_type: Literal["followed", "unfollowed"],
    event_at: datetime,
) -> dict:
    return {
        "login": login,
        "avatar_url": avatar_url,
        "html_url": html_url,
        "event_type": event_type,
        "event_at": event_at,
    }

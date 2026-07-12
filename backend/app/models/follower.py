from datetime import datetime, timezone
from typing import Literal


def make_follower_snapshot(
    github_id: int,
    login: str,
    avatar_url: str,
    html_url: str,
    captured_at: datetime,
    name: str = "",
) -> dict:
    return {
        "github_id": github_id,
        "login": login,
        # GitHub's follower list carries no display name — it's resolved separately
        # in one batched GraphQL call. "" means the profile has no name set, which
        # is common; it does not mean "unknown".
        "name": name,
        "avatar_url": avatar_url,
        "html_url": html_url,
        "captured_at": captured_at,
    }


def make_follower_event(
    github_id: int,
    login: str,
    avatar_url: str,
    html_url: str,
    event_type: Literal["followed", "unfollowed"],
    event_at: datetime,
    name: str = "",
) -> dict:
    return {
        "github_id": github_id,
        "login": login,
        "name": name,
        "avatar_url": avatar_url,
        "html_url": html_url,
        "event_type": event_type,
        "event_at": event_at,
    }

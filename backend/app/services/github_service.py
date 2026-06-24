import requests
from ..config import GITHUB_TOKEN, GITHUB_USERNAME

HEADERS = {
    "Accept": "application/vnd.github+json",
    "Authorization": f"Bearer {GITHUB_TOKEN}",
    "X-GitHub-Api-Version": "2022-11-28",
}


def _paginate(url: str) -> list[dict]:
    results, page = [], 1
    while True:
        resp = requests.get(url, headers=HEADERS, params={"per_page": 100, "page": page}, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        if not data:
            break
        results.extend(data)
        page += 1
    return results


def fetch_all_followers() -> list[dict]:
    return _paginate(f"https://api.github.com/users/{GITHUB_USERNAME}/followers")


def fetch_all_following() -> list[dict]:
    return _paginate("https://api.github.com/user/following")


def fetch_my_profile() -> dict:
    resp = requests.get("https://api.github.com/user", headers=HEADERS, timeout=15)
    resp.raise_for_status()
    p = resp.json()
    return {
        "login": p.get("login"),
        "name": p.get("name") or p.get("login"),
        "avatar_url": p.get("avatar_url"),
        "html_url": p.get("html_url"),
        "bio": p.get("bio"),
        "public_repos": p.get("public_repos", 0),
        "followers": p.get("followers", 0),
        "following": p.get("following", 0),
    }

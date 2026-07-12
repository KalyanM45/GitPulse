import re
import time

import requests

from ..config import GITHUB_TOKEN, GITHUB_USERNAME

HEADERS = {
    "Accept": "application/vnd.github+json",
    "Authorization": f"Bearer {GITHUB_TOKEN}",
    "X-GitHub-Api-Version": "2022-11-28",
}


def _paginate(url: str, extra_params: dict = None) -> list[dict]:
    results, page = [], 1
    while True:
        params = {"per_page": 100, "page": page}
        if extra_params:
            params.update(extra_params)
        resp = requests.get(url, headers=HEADERS, params=params, timeout=15)
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


def fetch_user_by_login(login: str) -> dict | None:
    """Returns None if the login no longer resolves (renamed or deleted account)."""
    resp = requests.get(f"https://api.github.com/users/{login}", headers=HEADERS, timeout=15)
    if resp.status_code == 404:
        return None
    resp.raise_for_status()
    return resp.json()


def fetch_user_by_id(user_id: int) -> dict | None:
    """Resolve a user by immutable numeric id — survives username changes."""
    resp = requests.get(f"https://api.github.com/user/{user_id}", headers=HEADERS, timeout=15)
    if resp.status_code == 404:
        return None
    resp.raise_for_status()
    return resp.json()


def fetch_my_profile() -> dict:
    resp = requests.get("https://api.github.com/user", headers=HEADERS, timeout=15)
    resp.raise_for_status()
    p = resp.json()

    blog = (p.get("blog") or "").strip()
    if blog and not blog.startswith(("http://", "https://")):
        blog = f"https://{blog}"

    return {
        "login": p.get("login"),
        "name": p.get("name") or p.get("login"),
        "avatar_url": p.get("avatar_url"),
        "html_url": p.get("html_url"),
        "bio": p.get("bio"),
        "public_repos": p.get("public_repos", 0),
        "followers": p.get("followers", 0),
        "following": p.get("following", 0),
        # Everything below is optional on a GitHub profile — "" when unset, so the
        # UI can skip the row rather than render an empty slot.
        "company": p.get("company") or "",
        "location": p.get("location") or "",
        "blog": blog,
        "email": p.get("email") or "",
        "twitter_username": p.get("twitter_username") or "",
        "created_at": p.get("created_at"),
        "public_gists": p.get("public_gists", 0),
    }


def fetch_all_repos() -> list[dict]:
    return _paginate(
        "https://api.github.com/user/repos",
        {"type": "owner", "sort": "updated", "direction": "desc"},
    )


def fetch_repo_languages(full_name: str) -> dict:
    resp = requests.get(f"https://api.github.com/repos/{full_name}/languages", headers=HEADERS, timeout=15)
    resp.raise_for_status()
    return resp.json()


def fetch_repo_traffic_views(full_name: str) -> dict:
    resp = requests.get(f"https://api.github.com/repos/{full_name}/traffic/views", headers=HEADERS, timeout=15)
    resp.raise_for_status()
    return resp.json()


def fetch_repo_traffic_clones(full_name: str) -> dict:
    resp = requests.get(f"https://api.github.com/repos/{full_name}/traffic/clones", headers=HEADERS, timeout=15)
    resp.raise_for_status()
    return resp.json()


def fetch_repo_subscribers(full_name: str) -> int:
    resp = requests.get(f"https://api.github.com/repos/{full_name}", headers=HEADERS, timeout=15)
    resp.raise_for_status()
    return resp.json().get("subscribers_count", 0)


def fetch_repo_referrers(full_name: str) -> list:
    resp = requests.get(f"https://api.github.com/repos/{full_name}/traffic/referrers", headers=HEADERS, timeout=15)
    resp.raise_for_status()
    return resp.json() or []


def fetch_repo_popular_paths(full_name: str) -> list:
    resp = requests.get(f"https://api.github.com/repos/{full_name}/traffic/popular/paths", headers=HEADERS, timeout=15)
    resp.raise_for_status()
    return resp.json() or []


def fetch_user_created_year() -> int:
    resp = requests.post(
        "https://api.github.com/graphql",
        headers={**HEADERS, "Accept": "application/json"},
        json={"query": "{ viewer { createdAt } }"},
        timeout=15,
    )
    resp.raise_for_status()
    created = resp.json()["data"]["viewer"]["createdAt"]  # e.g. "2019-03-15T10:30:00Z"
    return int(created[:4])


def fetch_contributions_graphql(username: str, year: int = None) -> dict:
    date_args = ""
    if year:
        date_args = f'(from: "{year}-01-01T00:00:00Z", to: "{year}-12-31T23:59:59Z")'

    query = (
        "query ($login: String!) { user(login: $login) {"
        " contributionsCollection" + date_args + " {"
        "  totalCommitContributions totalIssueContributions"
        "  totalPullRequestContributions totalPullRequestReviewContributions"
        "  restrictedContributionsCount"
        "  contributionCalendar { totalContributions weeks {"
        "    contributionDays { contributionCount date weekday } } } } } }"
    )
    resp = requests.post(
        "https://api.github.com/graphql",
        headers={**HEADERS, "Accept": "application/json"},
        json={"query": query, "variables": {"login": username}},
        timeout=30,
    )
    resp.raise_for_status()
    result = resp.json()
    if "errors" in result:
        raise ValueError(result["errors"][0]["message"])
    col = result["data"]["user"]["contributionsCollection"]
    cal = col["contributionCalendar"]
    return {
        "total_contributions": cal["totalContributions"],
        "total_commits": col["totalCommitContributions"],
        "total_issues": col["totalIssueContributions"],
        "total_prs": col["totalPullRequestContributions"],
        "total_reviews": col["totalPullRequestReviewContributions"],
        "restricted": col.get("restrictedContributionsCount", 0),
        "weeks": cal["weeks"],
    }


def fetch_repo_commit_count(full_name: str) -> int:
    """
    Total commits on the default branch — the number GitHub shows on the repo page.

    Asking for one commit per page makes the `last` link's page number the commit
    count, so this is a single request instead of paging through every commit.

    (`stats/commit_activity` cannot answer this: it only covers the last 52 weeks.
    A repo with 111 lifetime commits and none this year reports 0 there.)
    """
    resp = requests.get(
        f"https://api.github.com/repos/{full_name}/commits",
        headers=HEADERS,
        params={"per_page": 1},
        timeout=20,
    )
    # An empty repository has no commits and 409s rather than returning [].
    if resp.status_code == 409:
        return 0
    resp.raise_for_status()

    m = re.search(r'[?&]page=(\d+)>;\s*rel="last"', resp.headers.get("Link", ""))
    if m:
        return int(m.group(1))
    return len(resp.json())


def fetch_repo_branch_count(full_name: str) -> int:
    """Branch count via the pagination header — avoids pulling every branch object."""
    resp = requests.get(
        f"https://api.github.com/repos/{full_name}/branches",
        headers=HEADERS,
        params={"per_page": 1},
        timeout=15,
    )
    resp.raise_for_status()

    # With per_page=1 the `last` link's page number IS the total count.
    link = resp.headers.get("Link", "")
    m = re.search(r'[?&]page=(\d+)>;\s*rel="last"', link)
    if m:
        return int(m.group(1))
    return len(resp.json())


def fetch_user_profiles(logins: list[str]) -> dict[str, str]:
    """
    Display names for many users at once.

    The REST followers/following lists carry only `login` — no name. Fetching
    /users/{login} one at a time would be 1,200+ requests; GraphQL aliases let us
    ask for ~100 users per request instead. Returns {login: name}, skipping any
    user whose name is unset.
    """
    names: dict[str, str] = {}

    for i in range(0, len(logins), 100):
        chunk = logins[i : i + 100]
        # Aliases must be valid GraphQL names; logins can contain '-'.
        fields = " ".join(
            f'u{n}: user(login: "{login}") {{ login name }}' for n, login in enumerate(chunk)
        )
        resp = requests.post(
            "https://api.github.com/graphql",
            headers={**HEADERS, "Accept": "application/json"},
            json={"query": f"{{ {fields} }}"},
            timeout=30,
        )
        resp.raise_for_status()
        payload = resp.json()

        # A deleted/suspended account returns null for its alias plus a top-level
        # error — the other aliases in the batch still resolve, so don't bail out.
        for value in (payload.get("data") or {}).values():
            if value and value.get("name"):
                names[value["login"]] = value["name"]

    return names


def fetch_repo_commit_activity(full_name: str, retries: int = 3) -> list | None:
    """
    Weekly commit activity for the last year.

    GitHub answers 202 with an EMPTY body the first time it's asked — it computes
    the statistics asynchronously and expects you to come back. Returning [] for
    that is a trap: the caller can't tell "no commits" from "not ready yet", and
    writing 0 destroys the real number.

    Returns None when the stats genuinely aren't available, so the caller can keep
    whatever it already had. Only [] means "really no activity".
    """
    for attempt in range(retries):
        resp = requests.get(
            f"https://api.github.com/repos/{full_name}/stats/commit_activity",
            headers=HEADERS,
            timeout=30,
        )
        if resp.status_code == 202:
            # Give GitHub a moment to finish, then ask again.
            time.sleep(2 * (attempt + 1))
            continue
        resp.raise_for_status()
        return resp.json() or []

    return None

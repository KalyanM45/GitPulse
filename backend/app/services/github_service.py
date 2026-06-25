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


def fetch_repo_commit_activity(full_name: str) -> list:
    resp = requests.get(
        f"https://api.github.com/repos/{full_name}/stats/commit_activity",
        headers=HEADERS,
        timeout=30,
    )
    if resp.status_code == 202:  # GitHub is computing stats, not ready yet
        return []
    resp.raise_for_status()
    return resp.json() or []

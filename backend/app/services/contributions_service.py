from datetime import datetime, timezone
from ..tenant import tenant_db as get_db
from .github_service import fetch_contributions_graphql, fetch_user_created_year
from ..tenant import current


def sync_contributions() -> dict:
    db  = get_db()
    col = db["contributions"]
    username = current().github_login
    synced_at    = datetime.now(timezone.utc)
    current_year = synced_at.year

    # Remove legacy docs that have no year field
    col.delete_many({"year": {"$exists": False}})

    created_year   = fetch_user_created_year()
    total_all_time = 0
    years_synced   = 0

    for year in range(created_year, current_year + 1):
        try:
            data = fetch_contributions_graphql(username, year)
        except Exception:
            continue
        total_all_time += data["total_contributions"]
        doc = {
            "username":            username,
            "year":                year,
            "synced_at":           synced_at,
            "total_contributions": data["total_contributions"],
            "total_commits":       data["total_commits"],
            "total_issues":        data["total_issues"],
            "total_prs":           data["total_prs"],
            "total_reviews":       data["total_reviews"],
            "restricted":          data.get("restricted", 0),
            "weeks":               data["weeks"],
        }
        col.replace_one({"year": year}, doc, upsert=True)
        years_synced += 1

    return {
        "synced_at":           synced_at.isoformat(),
        "years_synced":        years_synced,
        "total_all_time":      total_all_time,
        "total_contributions": total_all_time,
    }


def get_contributions_summary(with_latest: bool = False) -> dict:
    """Per-year totals, newest first.

    `with_latest` additionally embeds the full document for the most recent year.
    The dashboard cannot know which year to ask for until this response tells it,
    so fetching the heatmap was strictly sequential: summary, then year. Returning
    the year the dashboard is certain to open with collapses that into one request.
    """
    docs = list(
        get_db()["contributions"]
        .find(
            {"year": {"$exists": True}},
            {"_id": 0, "year": 1, "total_contributions": 1, "total_commits": 1,
             "total_issues": 1, "total_prs": 1, "total_reviews": 1, "synced_at": 1},
        )
        .sort("year", -1)
    )
    if not docs:
        return {"years": [], "total_all_time": 0, "synced_at": None}

    total_all_time = sum(d.get("total_contributions", 0) for d in docs)
    for d in docs:
        if hasattr(d.get("synced_at"), "isoformat"):
            d["synced_at"] = d["synced_at"].isoformat()

    summary = {
        "years":          docs,
        "total_all_time": total_all_time,
        "synced_at":      docs[0]["synced_at"] if docs else None,
    }
    if with_latest:
        # docs is sorted newest-first, so docs[0] is the year the dashboard opens on.
        summary["latest"] = get_contributions_year(docs[0]["year"])
    return summary


def get_contributions_year(year: int) -> dict | None:
    doc = get_db()["contributions"].find_one(
        {"year": year}, {"_id": 0, "owner_id": 0}
    )
    if doc and doc.get("synced_at"):
        doc["synced_at"] = doc["synced_at"].isoformat()
    return doc

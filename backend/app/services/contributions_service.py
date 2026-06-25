from datetime import datetime, timezone
from ..database import get_db
from .github_service import fetch_contributions_graphql, fetch_user_created_year
from ..config import GITHUB_USERNAME


def sync_contributions() -> dict:
    db  = get_db()
    col = db["contributions"]
    synced_at    = datetime.now(timezone.utc)
    current_year = synced_at.year

    # Remove legacy docs that have no year field
    col.delete_many({"username": GITHUB_USERNAME, "year": {"$exists": False}})

    created_year   = fetch_user_created_year()
    total_all_time = 0
    years_synced   = 0

    for year in range(created_year, current_year + 1):
        try:
            data = fetch_contributions_graphql(GITHUB_USERNAME, year)
        except Exception:
            continue
        total_all_time += data["total_contributions"]
        doc = {
            "username":            GITHUB_USERNAME,
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
        col.replace_one({"username": GITHUB_USERNAME, "year": year}, doc, upsert=True)
        years_synced += 1

    return {
        "synced_at":           synced_at.isoformat(),
        "years_synced":        years_synced,
        "total_all_time":      total_all_time,
        "total_contributions": total_all_time,
    }


def get_contributions_summary() -> dict:
    docs = list(
        get_db()["contributions"]
        .find(
            {"username": GITHUB_USERNAME, "year": {"$exists": True}},
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

    return {
        "years":          docs,
        "total_all_time": total_all_time,
        "synced_at":      docs[0]["synced_at"] if docs else None,
    }


def get_contributions_year(year: int) -> dict | None:
    doc = get_db()["contributions"].find_one(
        {"username": GITHUB_USERNAME, "year": year}, {"_id": 0}
    )
    if doc and doc.get("synced_at"):
        doc["synced_at"] = doc["synced_at"].isoformat()
    return doc

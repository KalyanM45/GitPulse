from datetime import datetime, timezone
from ..database import get_db
from .github_service import fetch_all_following, fetch_user_profiles


def _col():
    return get_db()["following_snapshots"]


def sync_following() -> int:
    raw = fetch_all_following()

    col = _col()
    existing_count = col.count_documents({})
    if not raw and existing_count > 0:
        raise RuntimeError(
            f"GitHub returned 0 following but {existing_count} records exist — "
            "aborting to protect existing data"
        )

    col.drop()
    if raw:
        now = datetime.now(timezone.utc)
        try:
            names = fetch_user_profiles([u["login"] for u in raw])
        except Exception:
            names = {}
        col.insert_many([
            {
                "github_id": u["id"],
                "login": u["login"],
                "name": names.get(u["login"], ""),
                "avatar_url": u["avatar_url"],
                "html_url": u["html_url"],
                "captured_at": now,
                "position": idx,
            }
            for idx, u in enumerate(raw)
        ])
    col.create_index("github_id", unique=True)
    col.create_index("login")
    return len(raw)


def get_following(page: int = 1, per_page: int = 30, search: str = "") -> dict:
    col = _col()
    query = {"login": {"$regex": search.strip(), "$options": "i"}} if search.strip() else {}
    total = col.count_documents(query)
    docs = list(col.find(query, {"_id": 0, "position": 0}).sort(
        [("position", 1), ("login", 1)]
    ).skip((page - 1) * per_page).limit(per_page))
    for d in docs:
        if isinstance(d.get("captured_at"), datetime):
            d["captured_at"] = d["captured_at"].isoformat()
    return {"total": total, "page": page, "per_page": per_page, "data": docs}

from datetime import datetime, timezone
from ..database import get_db
from .github_service import fetch_all_following


def _col():
    return get_db()["following_snapshots"]


def sync_following() -> int:
    raw = fetch_all_following()
    col = _col()
    col.drop()
    if raw:
        now = datetime.now(timezone.utc)
        col.insert_many([
            {
                "login": u["login"],
                "avatar_url": u["avatar_url"],
                "html_url": u["html_url"],
                "captured_at": now,
                "position": idx,
            }
            for idx, u in enumerate(raw)
        ])
    col.create_index("login", unique=True)
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

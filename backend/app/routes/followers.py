from fastapi import APIRouter, Query, HTTPException
from ..services import follower_service, following_service
from ..services.github_service import fetch_my_profile

router = APIRouter(prefix="/api", tags=["analytics"])


@router.get("/profile")
def get_profile():
    try:
        return fetch_my_profile()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sync")
def trigger_sync():
    try:
        followers_result = follower_service.sync_followers()
        following_count = following_service.sync_following()
        return {**followers_result, "total_following": following_count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Followers ──────────────────────────────────────────────────────────────

@router.get("/followers")
def list_followers(page: int = Query(1, ge=1), per_page: int = Query(30, ge=1, le=100), search: str = Query("")):
    return follower_service.get_current_followers(page=page, per_page=per_page, search=search)


@router.get("/followers/stats")
def stats():
    return follower_service.get_stats()


@router.get("/followers/unfollowed")
def unfollowed(page: int = Query(1, ge=1), per_page: int = Query(30, ge=1, le=100), search: str = Query("")):
    return follower_service.get_current_unfollowed(page=page, per_page=per_page, search=search)


@router.get("/followers/{login}/history")
def follower_history(login: str):
    return follower_service.get_follower_history(login)


# ── Following ──────────────────────────────────────────────────────────────

@router.get("/following")
def list_following(page: int = Query(1, ge=1), per_page: int = Query(30, ge=1, le=100), search: str = Query("")):
    return following_service.get_following(page=page, per_page=per_page, search=search)

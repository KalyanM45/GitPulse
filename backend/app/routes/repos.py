from fastapi import APIRouter, Query, HTTPException
from ..services import repo_service

router = APIRouter(prefix="/api", tags=["repos"])


@router.post("/repos/sync")
def sync_repos():
    try:
        return repo_service.sync_repos()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/repos/overview")
def repos_overview():
    try:
        return repo_service.get_overview()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/repos")
def list_repos(
    page: int = Query(1, ge=1),
    per_page: int = Query(30, ge=1, le=100),
    search: str = Query(""),
    sort: str = Query("pushed_at"),
    order: str = Query("desc", pattern="^(asc|desc)$"),
    visibility: str = Query("all", pattern="^(all|public|private)$"),
):
    return repo_service.get_repos(
        page=page,
        per_page=per_page,
        search=search,
        sort=sort,
        order=order,
        visibility=visibility,
    )


@router.get("/repos/{name}/traffic")
def repo_traffic(name: str):
    """Day-wise traffic history — everything we have accumulated, not just 14 days."""
    return repo_service.get_traffic_series(name)


@router.get("/repos/{name}/star-history")
def star_history(name: str):
    return repo_service.get_star_history(name)


@router.get("/repos/{name}")
def get_repo(name: str):
    repo = repo_service.get_repo(name)
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
    return repo

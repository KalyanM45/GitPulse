from fastapi import APIRouter, HTTPException
from ..services import contributions_service

router = APIRouter(prefix="/api", tags=["contributions"])


@router.post("/contributions/sync")
def sync_contributions():
    try:
        return contributions_service.sync_contributions()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/contributions/{year}")
def get_contributions_year(year: int):
    try:
        data = contributions_service.get_contributions_year(year)
        if not data:
            raise HTTPException(status_code=404, detail=f"No data for {year} — sync first")
        return data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/contributions")
def get_contributions_summary():
    try:
        return contributions_service.get_contributions_summary()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

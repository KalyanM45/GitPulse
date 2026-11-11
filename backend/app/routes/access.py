"""Invite-only program: public access requests, and the admin's controls."""

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field

from .. import access, notify
from ..access import AccessError
from ..auth.deps import require_admin, require_identity

router = APIRouter(tags=["access"])


def _raise(e: AccessError):
    raise HTTPException(e.status, {"code": e.code, "message": e.message})


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()[:64]
    return request.client.host if request.client else "unknown"


class RequestBody(BaseModel):
    email: str = Field(max_length=254)
    name: str = Field(default="", max_length=80)
    github: str = Field(default="", max_length=40)
    note: str = Field(default="", max_length=500)


@router.post("/api/access/request")
def request_access(body: RequestBody, request: Request, background: BackgroundTasks):
    """Public: anyone can ask for an invite. The owner is emailed (in the
    background, after responding) and the request appears on /admin."""
    try:
        response, should_notify = access.submit_request(
            body.email, body.name, body.github, body.note, _client_ip(request)
        )
    except AccessError as e:
        _raise(e)
    if should_notify:
        background.add_task(notify.access_request_received, body.email.strip().lower(), body.note.strip())
    return response


@router.get("/api/access/status")
def my_status(claims: dict = Depends(require_identity)):
    """For a signed-in user: do they have access, and have they asked for it?"""
    email = (claims.get("email") or "").lower()
    return {
        "email": email,
        "has_access": access.has_access(email),
        "request": access.my_request_status(email),
    }


# ── Admin ────────────────────────────────────────────────────────────────────

@router.get("/api/admin/requests")
def admin_requests(status: str | None = Query(None), admin: dict = Depends(require_admin)):
    return access.list_requests(status)


@router.post("/api/admin/requests/{request_id}/approve")
def admin_approve(request_id: str, admin: dict = Depends(require_admin)):
    try:
        return access.decide_request(request_id, True, admin["email"])
    except AccessError as e:
        _raise(e)


@router.post("/api/admin/requests/{request_id}/reject")
def admin_reject(request_id: str, admin: dict = Depends(require_admin)):
    try:
        return access.decide_request(request_id, False, admin["email"])
    except AccessError as e:
        _raise(e)


@router.get("/api/admin/members")
def admin_members(admin: dict = Depends(require_admin)):
    return access.list_members()


class InviteBody(BaseModel):
    email: str = Field(max_length=254)


@router.post("/api/admin/invites")
def admin_invite(body: InviteBody, admin: dict = Depends(require_admin)):
    try:
        return access.invite(body.email, admin["email"])
    except AccessError as e:
        _raise(e)


@router.delete("/api/admin/invites/{email}")
def admin_revoke(email: str, admin: dict = Depends(require_admin)):
    try:
        access.revoke(email)
    except AccessError as e:
        _raise(e)
    return {"status": "ok"}

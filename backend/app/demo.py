"""Public, read-only demo of one account's dashboard (DEMO_GITHUB_LOGIN).

Anyone with a GitPulse account, invited or not, can browse a real dashboard
before requesting access. It reuses the dashboard's own read endpoints, mounted a
second time under /demo (see main.py), with a guard that:
  - requires sign-in (a verified Firebase account; no invite needed),
  - allows GET only: no syncs, no changes,
  - scopes every query to the demo account (tenant.py), never the visitor's,
  - hides private repositories unless DEMO_HIDE_PRIVATE_REPOS is off.
"""

import re
import time
from dataclasses import replace

from fastapi import Depends, HTTPException, Request
from starlette.concurrency import run_in_threadpool

from . import database
from .config import DEMO_GITHUB_LOGIN, DEMO_HIDE_PRIVATE_REPOS
from .auth.deps import require_identity
from .github_account import tenant_for
from .tenant import Tenant, set_current

# The demo account barely changes; resolving it once a minute instead of on every
# request saves a few database round trips per page view.
_CACHE_SECONDS = 60
_cache: tuple[float, Tenant | None, dict | None] = (0.0, None, None)


def _load() -> tuple[Tenant | None, dict | None]:
    if not DEMO_GITHUB_LOGIN:
        return None, None
    db = database.get_db()
    user = db["users"].find_one(
        {"github.login": {"$regex": f"^{re.escape(DEMO_GITHUB_LOGIN)}$", "$options": "i"}}
    )
    tenant = tenant_for(user) if user else None
    if tenant is None:
        return None, None

    hidden = 0
    if DEMO_HIDE_PRIVATE_REPOS:
        repos = db["repo_snapshots"].find({"owner_id": tenant.user_id}, {"name": 1, "is_private": 1})
        public, hidden = set(), 0
        for r in repos:
            if r.get("is_private"):
                hidden += 1
            else:
                public.add(r["name"])
        tenant = replace(tenant, public_repos=frozenset(public))

    gh = user.get("github") or {}
    info = {
        "available": True,
        "login": gh.get("login"),
        "name": gh.get("name") or gh.get("login"),
        "avatar_url": gh.get("avatar_url"),
        "private_repos_hidden": hidden,
    }
    return tenant, info


def _resolve() -> tuple[Tenant | None, dict | None]:
    global _cache
    at, tenant, info = _cache
    if time.monotonic() - at > _CACHE_SECONDS:
        tenant, info = _load()
        _cache = (time.monotonic(), tenant, info)
    return tenant, info


def demo_info() -> dict:
    """For the demo banner. Never exposes anything beyond the public profile."""
    _, info = _resolve()
    return info or {"available": False}


async def require_demo_tenant(request: Request, claims: dict = Depends(require_identity)) -> Tenant:
    """Guard for /demo/api/*: signed in, read-only, scoped to the demo account."""
    if request.method != "GET":
        raise HTTPException(403, {"code": "demo_read_only", "message": "The demo is read-only."})
    tenant, _ = await run_in_threadpool(_resolve)
    if tenant is None:
        raise HTTPException(404, {"code": "demo_unavailable", "message": "The demo isn't available right now."})
    set_current(tenant)
    return tenant

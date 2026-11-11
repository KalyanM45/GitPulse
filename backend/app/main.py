import logging
import threading
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from .auth.deps import require_tenant
from .config import ACCESS_MODE, ADMIN_EMAILS, CORS_ORIGINS, ENABLE_SCHEDULER, FIREBASE_PROJECT_ID
from .database import close_db, connect
from .demo import demo_info, require_demo_tenant
from .indexes import ensure_indexes
from .routes.access import router as access_router
from .routes.auth import router as auth_router
from .routes.contributions import router as contributions_router
from .routes.followers import router as followers_router
from .routes.repos import router as repos_router
from .scheduler import start_scheduler, stop_scheduler

log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Open the pool before serving. pymongo connects lazily, so skipping this just
    # moves the handshake onto whichever request arrives first — and on a service
    # that spins down when idle, that is the request someone is waiting on.
    connect()

    # Off the startup path: create_index is a round trip per index and there are
    # over twenty of them, which on a cold boot is time the platform spends holding
    # the service out of rotation. They are idempotent and already exist in any
    # running deployment, so a few seconds of overlap is harmless.
    threading.Thread(target=_ensure_indexes_quietly, name="ensure-indexes", daemon=True).start()

    _warn_about_auth_config()
    if ENABLE_SCHEDULER:
        start_scheduler()
    yield
    stop_scheduler()
    close_db()


def _warn_about_auth_config() -> None:
    if not FIREBASE_PROJECT_ID:
        log.error("FIREBASE_PROJECT_ID is not set: every API request will be rejected as unauthenticated.")
    if ACCESS_MODE == "invite" and not ADMIN_EMAILS:
        log.warning("Invite-only mode with no ADMIN_EMAILS: nobody can approve access requests.")


def _ensure_indexes_quietly() -> None:
    try:
        ensure_indexes()
    except Exception:
        # A failure here must not take the API down — every query still returns
        # correct results without an index, just more slowly.
        log.exception("Background index creation failed.")


app = FastAPI(title="GitHub Analytics API", version="1.0.0", lifespan=lifespan)

# Order matters and is the reverse of the order added: the LAST middleware added is
# the outermost. CORS must be outermost so its headers are attached to every
# response, including ones that fail inside an inner layer — a 500 without
# Access-Control-Allow-Origin reaches the browser as an opaque CORS error, which
# hides the actual failure from the frontend.

# The dashboard's payloads are JSON full of repeated keys — a contribution year is
# 366 day objects, the repo list is 30 objects of ~15 fields. They compress by
# roughly 8-10x, which is the difference between one packet and twenty on a slow
# connection. 700 bytes is above the point where a response fits in a single
# segment anyway, so smaller bodies skip the CPU.
app.add_middleware(GZipMiddleware, minimum_size=700)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Auth/GitHub-connection routes check the user themselves. Everything else under
# /api is GitHub data: it needs a signed-in user with GitHub connected, and is
# scoped to that user's data (see tenant.py).
app.include_router(auth_router)
app.include_router(access_router)
_protected = [Depends(require_tenant)]
app.include_router(followers_router, dependencies=_protected)
app.include_router(repos_router, dependencies=_protected)
app.include_router(contributions_router, dependencies=_protected)

# Public read-only demo: the same read endpoints again under /demo/api/*, scoped
# to the demo account and limited to GET (see demo.py).
_demo = [Depends(require_demo_tenant)]
for _router in (followers_router, repos_router, contributions_router):
    app.include_router(_router, prefix="/demo", dependencies=_demo)


@app.get("/api/demo")
def demo():
    """Whose dashboard the demo shows (public profile only), for the demo banner."""
    return demo_info()


@app.get("/health")
def health():
    """Deliberately does not touch the database.

    This is the platform's liveness probe and the target of any keep-warm ping, so
    it runs constantly — it needs to answer in microseconds and must not report the
    service as unhealthy (and get it restarted) because Atlas hiccuped.
    """
    return {"status": "ok"}

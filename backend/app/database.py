"""MongoDB connection.

The client is a module-level singleton because `MongoClient` is already a pool:
constructing one per request would mean a fresh TCP + TLS handshake and a fresh
topology scan every time, which against a hosted Atlas cluster is the single most
expensive thing a request can do.
"""

import logging

from pymongo import MongoClient

from .config import DB_NAME, MONGODB_URI

log = logging.getLogger(__name__)

_client: MongoClient | None = None


def _new_client() -> MongoClient:
    return MongoClient(
        MONGODB_URI,
        # Bound the pool. The default (100) lets a burst of slow queries open far
        # more sockets than Atlas' shared tiers allow, and every one of them costs
        # a TLS handshake; FastAPI serves sync endpoints from a 40-thread pool, so
        # there is no benefit past that anyway.
        maxPoolSize=50,
        # Keep a few sockets warm. Without this the pool drains while the service
        # is idle and the next request pays to re-establish TLS — which on Render's
        # free plan (spins down when idle) is exactly the request a user is
        # watching.
        minPoolSize=5,
        maxIdleTimeMS=300_000,
        # Fail fast and visibly rather than hanging the request thread for the
        # 30s default while a user stares at a skeleton.
        serverSelectionTimeoutMS=8_000,
        connectTimeoutMS=8_000,
        socketTimeoutMS=45_000,
        # Retries are what make a dropped socket invisible to the user instead of
        # a 500 — relevant here because idle connections to Atlas do get reaped.
        retryWrites=True,
        retryReads=True,
    )


def get_db():
    global _client
    if _client is None:
        _client = _new_client()
    return _client[DB_NAME]


def connect() -> bool:
    """Open the connection eagerly at startup.

    pymongo connects lazily, so without this the *first user request* after a boot
    pays for DNS, the TLS handshake and the replica-set topology scan — a second or
    more on a cold service. Doing it during startup moves that cost into the boot
    the platform is already waiting on. Returns whether the ping succeeded; a
    failure is logged, not raised, so the API still starts and can report the
    problem on /health rather than crash-looping.
    """
    try:
        get_db().command("ping")
        log.info("MongoDB connection established.")
        return True
    except Exception:
        log.exception("MongoDB not reachable at startup; will retry on first use.")
        return False


def close_db():
    global _client
    if _client:
        _client.close()
        _client = None

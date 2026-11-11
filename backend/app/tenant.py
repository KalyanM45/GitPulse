"""Per-user data isolation.

Every piece of GitHub data belongs to one GitPulse user (`owner_id`). Rather than
trusting every query in every service to remember that filter — one forgotten
`{"owner_id": ...}` would show one user another user's followers — the services get
their collections through `tenant_db()`, which adds it to every read and write.

The current user ("tenant") lives in a context variable, set once per request by
the API guard (app.auth.deps.require_tenant) or per job by the sync runner. Using
tenant_db() with no tenant set raises instead of silently reading everyone's data.
"""

from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass

from bson import ObjectId
from pymongo import UpdateOne
from pymongo.collection import Collection

from .database import get_db


@dataclass(frozen=True)
class Tenant:
    user_id: ObjectId
    github_id: int
    github_login: str
    github_token: str


_current: ContextVar[Tenant | None] = ContextVar("gitpulse_tenant", default=None)


class NoTenant(RuntimeError):
    pass


def current() -> Tenant:
    t = _current.get()
    if t is None:
        raise NoTenant("No user in scope: tenant-scoped data accessed outside a request or job.")
    return t


def set_current(tenant: Tenant) -> None:
    """For the request guard: lives until the request's context ends."""
    _current.set(tenant)


@contextmanager
def use(tenant: Tenant):
    """For background jobs: scope a block of work to one user."""
    token = _current.set(tenant)
    try:
        yield tenant
    finally:
        _current.reset(token)


class ScopedCollection:
    """A pymongo collection restricted to the current tenant's documents.

    Only the operations the services use are exposed — anything else fails loudly
    rather than bypassing the scope.
    """

    def __init__(self, col: Collection):
        self._col = col

    @property
    def _owner(self) -> ObjectId:
        return current().user_id

    def _f(self, flt: dict | None) -> dict:
        flt = dict(flt or {})
        if "owner_id" in flt and flt["owner_id"] != self._owner:
            raise PermissionError("Query tried to reach another user's data.")
        flt["owner_id"] = self._owner
        return flt

    def _d(self, doc: dict) -> dict:
        return {**doc, "owner_id": self._owner}

    # reads
    def find(self, flt=None, *args, **kwargs):
        return self._col.find(self._f(flt), *args, **kwargs)

    def find_one(self, flt=None, *args, **kwargs):
        return self._col.find_one(self._f(flt), *args, **kwargs)

    def count_documents(self, flt=None, **kwargs):
        return self._col.count_documents(self._f(flt), **kwargs)

    def aggregate(self, pipeline: list, **kwargs):
        return self._col.aggregate([{"$match": {"owner_id": self._owner}}, *pipeline], **kwargs)

    # writes (filter equality on owner_id means upserts insert it too)
    def update_one(self, flt, update, **kwargs):
        return self._col.update_one(self._f(flt), update, **kwargs)

    def update_many(self, flt, update, **kwargs):
        return self._col.update_many(self._f(flt), update, **kwargs)

    def replace_one(self, flt, doc, **kwargs):
        return self._col.replace_one(self._f(flt), self._d(doc), **kwargs)

    def delete_one(self, flt, **kwargs):
        return self._col.delete_one(self._f(flt), **kwargs)

    def delete_many(self, flt, **kwargs):
        return self._col.delete_many(self._f(flt), **kwargs)

    def insert_one(self, doc, **kwargs):
        return self._col.insert_one(self._d(doc), **kwargs)

    def insert_many(self, docs, **kwargs):
        return self._col.insert_many([self._d(d) for d in docs], **kwargs)

    def bulk_upsert(self, pairs: list[tuple[dict, dict]], **kwargs):
        """bulk_write of UpdateOne(filter, update, upsert=True), scoped."""
        if not pairs:
            return None
        return self._col.bulk_write(
            [UpdateOne(self._f(f), u, upsert=True) for f, u in pairs], **kwargs
        )


class ScopedDB:
    def __getitem__(self, name: str) -> ScopedCollection:
        return ScopedCollection(get_db()[name])


_scoped = ScopedDB()


def tenant_db() -> ScopedDB:
    current()  # fail fast, before any query is built
    return _scoped

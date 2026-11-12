"""Multi-user isolation, GitHub connection, and legacy-data adoption.

Uses the same signed-token setup as test_auth.py; MongoDB is mongomock and GitHub
is never called (fetch_viewer and the background job are stubbed).
"""

import time

import jwt
import mongomock
import pytest
from bson import ObjectId
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient

from app import database, github_account, tenant
from app.auth import crypto, firebase
from app.main import app
from app.routes import auth as auth_routes
from app.services import sync_runner

KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)


class FakeJwks:
    def get_signing_key_from_jwt(self, token):
        return type("K", (), {"key": KEY.public_key()})()


def token_for(uid: str, email: str) -> str:
    now = int(time.time())
    return jwt.encode(
        {
            "iss": "https://securetoken.google.com/test-project", "aud": "test-project",
            "auth_time": now - 5, "sub": uid, "iat": now - 5, "exp": now + 3600,
            "email": email, "email_verified": True,
        },
        KEY, algorithm="RS256", headers={"kid": "t"},
    )


@pytest.fixture(autouse=True)
def setup(monkeypatch):
    monkeypatch.setattr(firebase, "_jwks", FakeJwks())
    database._client = mongomock.MongoClient()
    started = []
    monkeypatch.setattr(sync_runner, "_run", lambda t: started.append(t))
    yield started
    database._client = None


@pytest.fixture
def client():
    return TestClient(app)


def h(uid, email):
    return {"Authorization": f"Bearer {token_for(uid, email)}"}


def make_connected_user(uid: str, email: str, gh_id: int, login: str) -> ObjectId:
    users = database.get_db()["users"]
    _id = users.insert_one({
        "firebase_uid": uid, "email": email, "name": "", "created_at": None,
        "github": {"id": gh_id, "login": login, "token_enc": crypto.encrypt(f"tok-{login}"),
                   "scopes": ["read:user", "repo"]},
    }).inserted_id
    return _id


# ── Isolation ──────────────────────────────────────────────────────────────

def test_users_only_see_their_own_data(client):
    a = make_connected_user("uid-a", "a@x.com", 1, "alice")
    b = make_connected_user("uid-b", "b@x.com", 2, "bob")
    repos = database.get_db()["repo_snapshots"]
    repos.insert_one({"owner_id": a, "name": "alice-repo", "stars": 5})
    repos.insert_one({"owner_id": b, "name": "bob-repo", "stars": 9})
    repos.insert_one({"name": "unowned-legacy", "stars": 1})

    ra = client.get("/api/repos", headers=h("uid-a", "a@x.com")).json()
    rb = client.get("/api/repos", headers=h("uid-b", "b@x.com")).json()
    assert [r["name"] for r in ra["data"]] == ["alice-repo"]
    assert [r["name"] for r in rb["data"]] == ["bob-repo"]
    assert "owner_id" not in ra["data"][0]

    # Same repo name for two users is fine, and one can't open the other's.
    assert client.get("/api/repos/bob-repo", headers=h("uid-a", "a@x.com")).status_code == 404


def test_aggregations_are_scoped(client):
    a = make_connected_user("uid-a", "a@x.com", 1, "alice")
    b = make_connected_user("uid-b", "b@x.com", 2, "bob")
    repos = database.get_db()["repo_snapshots"]
    repos.insert_one({"owner_id": a, "name": "r1", "stars": 5, "is_private": False, "languages": {}})
    repos.insert_one({"owner_id": b, "name": "r2", "stars": 100, "is_private": False, "languages": {}})
    ov = client.get("/api/repos/overview", headers=h("uid-a", "a@x.com")).json()
    assert ov["total_repos"] == 1 and ov["total_stars"] == 5


def test_data_routes_need_github_connected(client):
    r = client.get("/api/repos", headers=h("uid-new", "new@x.com"))
    assert r.status_code == 409 and r.json()["detail"]["code"] == "github_not_connected"


def test_scoped_collection_refuses_other_owner():
    t = tenant.Tenant(ObjectId(), 1, "alice", "tok")
    with tenant.use(t):
        col = tenant.tenant_db()["repo_snapshots"]
        with pytest.raises(PermissionError):
            col.find_one({"owner_id": ObjectId()})


def test_tenant_db_without_user_fails_closed():
    with pytest.raises(tenant.NoTenant):
        tenant.tenant_db()


# ── Connecting GitHub ──────────────────────────────────────────────────────

def stub_viewer(monkeypatch, gh_id=42, login="alice", scopes=("repo", "read:user")):
    monkeypatch.setattr(
        auth_routes, "fetch_viewer",
        lambda token: ({"id": gh_id, "login": login, "avatar_url": "a"}, set(scopes)),
    )


def test_connect_stores_encrypted_token_and_starts_sync(client, monkeypatch, setup):
    stub_viewer(monkeypatch)
    me = client.get("/api/auth/me", headers=h("uid-a", "a@x.com")).json()
    assert me["github"] == {"connected": False}

    r = client.post("/api/github/connect", json={"access_token": "gho_secret_token_123"},
                    headers=h("uid-a", "a@x.com"))
    assert r.status_code == 200, r.text
    assert r.json()["github"]["login"] == "alice" and r.json()["github"]["connected"]

    stored = database.get_db()["users"].find_one({"firebase_uid": "uid-a"})["github"]
    assert "gho_secret_token_123" not in str(stored)
    assert crypto.decrypt(stored["token_enc"]) == "gho_secret_token_123"
    assert len(setup) == 1 and setup[0].github_login == "alice"
    assert client.get("/api/github/sync", headers=h("uid-a", "a@x.com")).json()["status"] == "running"


def test_connect_requires_repo_scope(client, monkeypatch):
    stub_viewer(monkeypatch, scopes=("read:user",))
    r = client.post("/api/github/connect", json={"access_token": "gho_secret_token_123"},
                    headers=h("uid-a", "a@x.com"))
    assert r.status_code == 400 and r.json()["detail"]["code"] == "github_scope_missing"


def test_github_account_cannot_be_shared(client, monkeypatch):
    stub_viewer(monkeypatch)
    client.post("/api/github/connect", json={"access_token": "gho_secret_token_123"},
                headers=h("uid-a", "a@x.com"))
    r = client.post("/api/github/connect", json={"access_token": "gho_other_token_456"},
                    headers=h("uid-b", "b@x.com"))
    assert r.status_code == 409 and r.json()["detail"]["code"] == "github_in_use"


def test_only_one_sync_job_at_a_time(client, monkeypatch, setup):
    a = make_connected_user("uid-a", "a@x.com", 1, "alice")
    assert client.post("/api/github/sync", headers=h("uid-a", "a@x.com")).status_code == 202
    assert client.post("/api/github/sync", headers=h("uid-a", "a@x.com")).status_code == 409
    assert len(setup) == 1


# ── Legacy data ────────────────────────────────────────────────────────────

def test_legacy_data_goes_to_owner_of_legacy_account():
    db = database.get_db()
    db["repo_snapshots"].insert_one({"name": "old-repo"})
    db["meta"].insert_one({"_id": "sync", "last_sync_at": None})

    owner = tenant.Tenant(ObjectId(), 7, "LegacyUser", "tok")  # GITHUB_USERNAME=legacyuser
    stranger = tenant.Tenant(ObjectId(), 8, "someoneelse", "tok")

    github_account.adopt_legacy_data(stranger)
    assert "owner_id" not in db["repo_snapshots"].find_one({"name": "old-repo"})

    github_account.adopt_legacy_data(owner)
    assert db["repo_snapshots"].find_one({"name": "old-repo"})["owner_id"] == owner.user_id
    assert db["meta"].find_one({"_id": f"sync:{owner.user_id}"})

    # A later account using the same username (e.g. after a rename) gets nothing.
    db["repo_snapshots"].insert_one({"name": "written-by-old-deploy"})
    impostor = tenant.Tenant(ObjectId(), 99, "legacyuser", "tok")
    github_account.adopt_legacy_data(impostor)
    assert "owner_id" not in db["repo_snapshots"].find_one({"name": "written-by-old-deploy"})


# ── Token rejected by GitHub ─────────────────────────────────────────────────


def _unauthorized():
    import requests

    resp = requests.Response()
    resp.status_code = 401
    return requests.HTTPError("401 Client Error: Unauthorized", response=resp)


def test_rejected_token_asks_to_reconnect_and_is_skipped(client, monkeypatch):
    _id = make_connected_user("uid-a", "a@x.com", 42, "alice")
    t = github_account.tenant_for(database.get_db()["users"].find_one({"_id": _id}))

    def boom():
        raise _unauthorized()

    monkeypatch.setattr(sync_runner, "_run_full_sync", lambda progress: boom())
    with tenant.use(t), pytest.raises(Exception):
        sync_runner.run_full_sync()

    me = client.get("/api/auth/me", headers=h("uid-a", "a@x.com")).json()
    assert me["github"]["needs_reconnect"] is True
    assert list(github_account.iter_tenants()) == []  # scheduled syncs skip it
    # GitHub data routes send the app to the reconnect screen... until they reconnect.
    stub_viewer(monkeypatch)
    client.post("/api/github/connect", json={"access_token": "gho_new_token_456"}, headers=h("uid-a", "a@x.com"))
    me = client.get("/api/auth/me", headers=h("uid-a", "a@x.com")).json()
    assert me["github"]["needs_reconnect"] is False
    assert [x.github_login for x in github_account.iter_tenants()] == ["alice"]


def test_cron_does_not_fail_for_a_rejected_token(monkeypatch):
    from app import cron

    make_connected_user("uid-a", "a@x.com", 42, "alice")
    monkeypatch.setattr(cron, "ensure_indexes", lambda: None)
    monkeypatch.setattr(cron, "run_full_sync", lambda: (_ for _ in ()).throw(_unauthorized()))
    monkeypatch.setenv("MONGODB_URI", "mongodb://x")
    cron.main()  # no SystemExit: a user needing to reconnect isn't a broken sync


def test_sync_button_reports_reconnect_and_data_routes_follow(client, monkeypatch):
    make_connected_user("uid-a", "a@x.com", 42, "alice")
    monkeypatch.setattr(sync_runner, "_run_full_sync", lambda progress: (_ for _ in ()).throw(_unauthorized()))

    r = client.post("/api/sync", headers=h("uid-a", "a@x.com"))
    assert r.status_code == 409 and r.json()["detail"]["code"] == "github_reconnect_required"
    r = client.get("/api/repos", headers=h("uid-a", "a@x.com"))
    assert r.status_code == 409 and r.json()["detail"]["code"] == "github_reconnect_required"
    assert client.get("/api/auth/me", headers=h("uid-a", "a@x.com")).json()["github"]["needs_reconnect"] is True

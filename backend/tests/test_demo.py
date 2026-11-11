"""Read-only demo (/demo/api/*): any signed-in account can view it (no invite
needed), scoped to the demo account, GET only, private repositories hidden."""

import time

import jwt
import mongomock
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient

from app import access, database, demo
from app.auth import crypto, firebase
from app.main import app

KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)


class FakeJwks:
    def get_signing_key_from_jwt(self, token):
        return type("K", (), {"key": KEY.public_key()})()


def signed_in(email="visitor@x.com") -> dict:
    """Headers for a verified account that is NOT invited."""
    now = int(time.time())
    token = jwt.encode(
        {"iss": "https://securetoken.google.com/test-project", "aud": "test-project",
         "auth_time": now - 5, "sub": f"uid-{email}", "iat": now - 5, "exp": now + 3600,
         "email": email, "email_verified": True},
        KEY, algorithm="RS256", headers={"kid": "t"},
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(autouse=True)
def setup(monkeypatch):
    monkeypatch.setattr(firebase, "_jwks", FakeJwks())
    monkeypatch.setattr(access, "ACCESS_MODE", "invite")  # the visitor isn't invited
    database._client = mongomock.MongoClient()
    monkeypatch.setattr(demo, "DEMO_GITHUB_LOGIN", "Showcase")
    monkeypatch.setattr(demo, "DEMO_HIDE_PRIVATE_REPOS", True)
    monkeypatch.setattr(demo, "_cache", (0.0, None, None))
    yield
    database._client = None


class Client:
    """TestClient that sends a signed-in, non-invited visitor's token by default."""

    def __init__(self):
        self._c = TestClient(app)

    def get(self, path, **kw):
        return self._c.get(path, headers=kw.pop("headers", signed_in()), **kw)

    def post(self, path, **kw):
        return self._c.post(path, headers=kw.pop("headers", signed_in()), **kw)


@pytest.fixture
def client():
    return Client()


def seed():
    db = database.get_db()
    owner = db["users"].insert_one({
        "email": "owner@x.com", "created_at": None,
        "github": {"id": 1, "login": "showcase", "name": "Show Case", "avatar_url": "a",
                   "token_enc": crypto.encrypt("tok"), "scopes": ["repo", "read:user"]},
    }).inserted_id
    other = db["users"].insert_one({
        "email": "other@x.com", "created_at": None,
        "github": {"id": 2, "login": "someone", "token_enc": crypto.encrypt("tok2"), "scopes": ["repo"]},
    }).inserted_id
    repos = db["repo_snapshots"]
    repos.insert_one({"owner_id": owner, "name": "public-repo", "is_private": False, "stars": 10, "languages": {}})
    repos.insert_one({"owner_id": owner, "name": "secret-repo", "is_private": True, "stars": 99, "languages": {}})
    repos.insert_one({"owner_id": other, "name": "not-mine", "is_private": False, "stars": 1, "languages": {}})
    traffic = db["traffic_daily"]
    traffic.insert_one({"owner_id": owner, "repo": "public-repo", "date": "2026-11-01", "views": 5})
    traffic.insert_one({"owner_id": owner, "repo": "secret-repo", "date": "2026-11-01", "views": 500})
    return owner


def test_demo_shows_only_the_demo_accounts_public_repos(client):
    seed()
    names = [r["name"] for r in client.get("/demo/api/repos").json()["data"]]
    assert names == ["public-repo"]
    ov = client.get("/demo/api/repos/overview").json()
    assert ov["total_repos"] == 1 and ov["total_stars"] == 10 and ov["total_views"] == 5


def test_private_repo_is_unreachable_by_name(client):
    seed()
    assert client.get("/demo/api/repos/secret-repo").status_code == 404
    assert client.get("/demo/api/repos/secret-repo/traffic").json() == []
    assert client.get("/demo/api/repos/public-repo/traffic").json()[0]["views"] == 5


def test_demo_is_read_only(client):
    seed()
    assert client.post("/demo/api/sync").status_code == 403
    assert client.post("/demo/api/repos/sync").status_code == 403


def test_demo_info_is_public_profile_only(client):
    seed()
    info = client.get("/api/demo").json()
    assert info == {"available": True, "login": "showcase", "name": "Show Case",
                    "avatar_url": "a", "private_repos_hidden": 1}


def test_no_demo_configured(client, monkeypatch):
    seed()
    monkeypatch.setattr(demo, "DEMO_GITHUB_LOGIN", "")
    assert client.get("/demo/api/repos").status_code == 404
    assert client.get("/api/demo").json() == {"available": False}


def test_private_repos_shown_when_allowed(client, monkeypatch):
    seed()
    monkeypatch.setattr(demo, "DEMO_HIDE_PRIVATE_REPOS", False)
    names = sorted(r["name"] for r in client.get("/demo/api/repos").json()["data"])
    assert names == ["public-repo", "secret-repo"]


def test_demo_needs_sign_in_but_not_an_invite(client):
    seed()
    assert client.get("/demo/api/repos", headers={}).status_code == 401
    assert client.get("/demo/api/repos").status_code == 200  # not invited: still fine


def test_uninvited_visitor_cannot_use_real_dashboard(client):
    seed()
    r = client.get("/api/repos")
    assert r.status_code == 403 and r.json()["detail"]["code"] == "not_invited"

"""Tests for Firebase ID-token verification and the API guard.

Tokens are signed with a throwaway RSA key standing in for Google's, so every check
in app.auth.firebase runs for real, without network access. MongoDB is mongomock.

Run from backend/:   venv/Scripts/python -m pytest tests -q
"""

import os
import time

import jwt  # noqa: E402
import mongomock  # noqa: E402
import pytest  # noqa: E402
from cryptography.hazmat.primitives.asymmetric import rsa  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import database  # noqa: E402
from app.auth import deps, firebase  # noqa: E402
from app.main import app  # noqa: E402

PROJECT = "test-project"
GOOGLE_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
OTHER_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)


class FakeJwks:
    def get_signing_key_from_jwt(self, token):
        return type("K", (), {"key": GOOGLE_KEY.public_key()})()


@pytest.fixture(autouse=True)
def setup(monkeypatch):
    monkeypatch.setattr(firebase, "_jwks", FakeJwks())
    database._client = mongomock.MongoClient()
    database.get_db()["users"].create_index("firebase_uid", unique=True, sparse=True)
    yield
    database._client = None


@pytest.fixture
def client():
    return TestClient(app)  # no `with`: skip lifespan (real Mongo, scheduler)


def make_token(key=GOOGLE_KEY, alg="RS256", **overrides) -> str:
    now = int(time.time())
    claims = {
        "iss": f"https://securetoken.google.com/{PROJECT}",
        "aud": PROJECT,
        "auth_time": now - 10,
        "sub": "uid-123",
        "user_id": "uid-123",
        "iat": now - 10,
        "exp": now + 3600,
        "email": "Dev@Example.com",
        "email_verified": True,
        "name": "Dev",
    }
    claims.update(overrides)
    claims = {k: v for k, v in claims.items() if v is not None}
    return jwt.encode(claims, key, algorithm=alg, headers={"kid": "test"})


def get(client, path, token=None):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    return client.get(path, headers=headers)


def test_valid_token_creates_user_once(client):
    r = get(client, "/api/auth/me", make_token())
    assert r.status_code == 200
    assert r.json()["email"] == "dev@example.com"
    get(client, "/api/auth/me", make_token())
    assert database.get_db()["users"].count_documents({}) == 1


def test_protected_routes_need_token(client):
    for path in ["/api/sync-status", "/api/repos", "/api/followers", "/api/contributions"]:
        assert get(client, path).status_code == 401, path
    assert client.post("/api/sync").status_code == 401
    assert client.get("/health").status_code == 200
    # Signed in but no GitHub connected yet: told to connect (see test_tenancy.py).
    r = get(client, "/api/sync-status", make_token())
    assert r.status_code == 409 and r.json()["detail"]["code"] == "github_not_connected"


@pytest.mark.parametrize(
    "token",
    [
        pytest.param(lambda: make_token(key=OTHER_KEY), id="signed-by-someone-else"),
        pytest.param(lambda: make_token(aud="other-project"), id="other-project-audience"),
        pytest.param(lambda: make_token(iss="https://securetoken.google.com/other"), id="wrong-issuer"),
        pytest.param(lambda: make_token(exp=int(time.time()) - 120), id="expired"),
        pytest.param(lambda: make_token(iat=int(time.time()) + 3600), id="issued-in-future"),
        pytest.param(lambda: make_token(auth_time=int(time.time()) + 3600), id="auth-in-future"),
        pytest.param(lambda: make_token(sub=""), id="empty-subject"),
        pytest.param(lambda: make_token(auth_time=None), id="no-auth-time"),
        pytest.param(lambda: make_token(key="hmac-secret", alg="HS256"), id="hs256-downgrade"),
        pytest.param(lambda: jwt.encode({"sub": "x"}, None, algorithm="none"), id="unsigned"),
        pytest.param(lambda: "not-a-jwt", id="garbage"),
    ],
)
def test_bad_tokens_rejected(client, token):
    assert get(client, "/api/auth/me", token()).status_code == 401


def test_unverified_email_rejected(client):
    r = get(client, "/api/auth/me", make_token(email_verified=False))
    assert r.status_code == 403 and r.json()["detail"]["code"] == "email_not_verified"


def test_allowlist(client, monkeypatch):
    monkeypatch.setattr(deps, "ALLOWED_EMAILS", {"owner@example.com"})
    r = get(client, "/api/auth/me", make_token())
    assert r.status_code == 403 and r.json()["detail"]["code"] == "not_invited"
    r = get(client, "/api/auth/me", make_token(email="Owner@Example.com"))
    assert r.status_code == 200


def test_google_keys_unreachable_is_503_not_401(client, monkeypatch):
    class Down:
        def get_signing_key_from_jwt(self, token):
            raise jwt.exceptions.PyJWKClientConnectionError("down")

    monkeypatch.setattr(firebase, "_jwks", Down())
    assert get(client, "/api/auth/me", make_token()).status_code == 503


def test_existing_row_with_same_email_is_linked(client):
    users = database.get_db()["users"]
    users.create_index("email", unique=True)
    users.insert_one({"email": "dev@example.com", "name": "Old", "created_at": None})
    assert get(client, "/api/auth/me", make_token()).status_code == 200
    assert users.count_documents({}) == 1
    assert users.find_one({"email": "dev@example.com"})["firebase_uid"] == "uid-123"

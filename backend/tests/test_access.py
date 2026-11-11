"""Invite-only program: requests, approval, admin-only routes, revocation."""

import time

import jwt
import mongomock
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient

from app import access, database
from app.auth import firebase
from app.main import app

KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
ADMIN = "admin@example.com"


class FakeJwks:
    def get_signing_key_from_jwt(self, token):
        return type("K", (), {"key": KEY.public_key()})()


def h(email: str, uid: str | None = None) -> dict:
    now = int(time.time())
    token = jwt.encode(
        {
            "iss": "https://securetoken.google.com/test-project", "aud": "test-project",
            "auth_time": now - 5, "sub": uid or f"uid-{email}", "iat": now - 5, "exp": now + 3600,
            "email": email, "email_verified": True,
        },
        KEY, algorithm="RS256", headers={"kid": "t"},
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(autouse=True)
def setup(monkeypatch):
    monkeypatch.setattr(firebase, "_jwks", FakeJwks())
    monkeypatch.setattr(access, "ACCESS_MODE", "invite")
    monkeypatch.setattr(access, "ADMIN_EMAILS", {ADMIN})
    database._client = mongomock.MongoClient()
    database.get_db()["access_requests"].create_index("email", unique=True)
    yield
    database._client = None


@pytest.fixture
def client():
    return TestClient(app)


def test_full_invite_flow(client):
    guest = "guest@example.com"
    # Not invited: blocked, but can see their (empty) request status.
    assert client.get("/api/auth/me", headers=h(guest)).status_code == 403
    assert client.get("/api/access/status", headers=h(guest)).json() == {
        "email": guest, "has_access": False, "request": None,
    }

    # Request access (public, no login needed).
    r = client.post("/api/access/request", json={"email": guest, "name": "Guest", "github": "@octocat", "note": "hi"})
    assert r.status_code == 200
    assert client.get("/api/access/status", headers=h(guest)).json()["request"] == "pending"

    # Admin sees it and approves.
    reqs = client.get("/api/admin/requests?status=pending", headers=h(ADMIN)).json()
    assert [x["email"] for x in reqs] == [guest] and reqs[0]["github"] == "octocat"
    assert client.post(f"/api/admin/requests/{reqs[0]['id']}/approve", headers=h(ADMIN)).status_code == 200

    # Guest is in immediately.
    me = client.get("/api/auth/me", headers=h(guest))
    assert me.status_code == 200 and me.json()["is_admin"] is False
    members = {m["email"]: m for m in client.get("/api/admin/members", headers=h(ADMIN)).json()}
    assert members[guest]["role"] == "invited" and members[guest]["signed_up"] is True

    # Revoked: out again on the next request.
    assert client.delete(f"/api/admin/invites/{guest}", headers=h(ADMIN)).status_code == 200
    assert client.get("/api/auth/me", headers=h(guest)).status_code == 403


def test_admin_always_has_access_and_flag(client):
    me = client.get("/api/auth/me", headers=h(ADMIN))
    assert me.status_code == 200 and me.json()["is_admin"] is True


def test_admin_routes_are_admin_only(client):
    client.post("/api/admin/invites", json={"email": "friend@example.com"}, headers=h(ADMIN))
    # An invited non-admin still can't reach admin routes.
    for method, path in [("get", "/api/admin/requests"), ("get", "/api/admin/members"),
                         ("post", "/api/admin/invites")]:
        r = getattr(client, method)(path, headers=h("friend@example.com"), **({"json": {"email": "x@y.com"}} if method == "post" else {}))
        assert r.status_code == 403, path
    # And nobody without a token.
    assert client.get("/api/admin/requests").status_code == 401


def test_direct_invite_settles_pending_request(client):
    client.post("/api/access/request", json={"email": "pal@example.com"})
    client.post("/api/admin/invites", json={"email": "Pal@Example.com"}, headers=h(ADMIN))
    assert client.get("/api/admin/requests?status=pending", headers=h(ADMIN)).json() == []
    assert client.get("/api/auth/me", headers=h("pal@example.com")).status_code == 200


def test_reject(client):
    client.post("/api/access/request", json={"email": "no@example.com"})
    rid = client.get("/api/admin/requests", headers=h(ADMIN)).json()[0]["id"]
    client.post(f"/api/admin/requests/{rid}/reject", headers=h(ADMIN))
    assert client.get("/api/auth/me", headers=h("no@example.com")).status_code == 403
    assert client.get("/api/access/status", headers=h("no@example.com")).json()["request"] == "rejected"


def test_request_does_not_reveal_membership(client):
    client.post("/api/admin/invites", json={"email": "member@example.com"}, headers=h(ADMIN))
    a = client.post("/api/access/request", json={"email": "member@example.com"}).json()
    b = client.post("/api/access/request", json={"email": "stranger@example.com"}).json()
    assert a == b


def test_request_validation_and_rate_limit(client):
    assert client.post("/api/access/request", json={"email": "not-an-email"}).status_code == 422
    assert client.post("/api/access/request", json={"email": "a@b.com", "github": "bad name!"}).status_code == 422
    codes = [client.post("/api/access/request", json={"email": f"u{i}@x.com"}).status_code for i in range(7)]
    assert codes[:5] == [200] * 5 and codes[-1] == 429


def test_admin_cannot_be_revoked(client):
    r = client.delete(f"/api/admin/invites/{ADMIN}", headers=h(ADMIN))
    assert r.status_code == 400

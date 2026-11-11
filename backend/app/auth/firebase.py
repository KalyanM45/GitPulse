"""Verifies Firebase ID tokens.

Firebase signs every ID token with Google's rotating RS256 keys and publishes the
public halves. Verifying against those (Firebase's documented method for
third-party JWT libraries) means this API needs only the project ID: no service
account and no private key to store or leak.

Checks, per https://firebase.google.com/docs/auth/admin/verify-id-tokens:
  signature (RS256, Google key)  aud = project id   iss = securetoken/<project id>
  exp in the future  iat and auth_time in the past  sub non-empty
"""

import time

import jwt
from jwt import PyJWKClient
from jwt.exceptions import PyJWKClientConnectionError

from ..config import FIREBASE_PROJECT_ID

_JWKS_URL = (
    "https://www.googleapis.com/service_accounts/v1/jwk/"
    "securetoken@system.gserviceaccount.com"
)

# Keys rotate every few hours and are published ahead of use, so an hour of
# caching is safe and keeps verification to a local signature check.
_jwks = PyJWKClient(_JWKS_URL, cache_jwk_set=True, lifespan=3600, timeout=10)

# Tolerate small clock differences between this server and Google's.
_LEEWAY = 30


class AuthUnavailable(Exception):
    """Google's keys couldn't be fetched: a server problem, not a bad token."""


def verify_id_token(token: str) -> dict | None:
    """Return the token's claims if it is a valid ID token for this project."""
    if not FIREBASE_PROJECT_ID or not token or len(token) > 4096:
        return None
    try:
        signing_key = _jwks.get_signing_key_from_jwt(token).key
        claims = jwt.decode(
            token,
            signing_key,
            algorithms=["RS256"],  # pinned: the token header never picks the algorithm
            audience=FIREBASE_PROJECT_ID,
            issuer=f"https://securetoken.google.com/{FIREBASE_PROJECT_ID}",
            leeway=_LEEWAY,
            options={"require": ["exp", "iat", "aud", "iss", "sub"]},
        )
    except PyJWKClientConnectionError as e:
        raise AuthUnavailable from e
    except jwt.PyJWTError:
        return None

    sub = claims.get("sub")
    if not isinstance(sub, str) or not sub or len(sub) > 128:
        return None
    auth_time = claims.get("auth_time")
    if not isinstance(auth_time, (int, float)) or auth_time > time.time() + _LEEWAY:
        return None
    return claims

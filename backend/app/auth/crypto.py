"""Encryption for secrets stored in MongoDB (users' GitHub tokens).

A GitHub token with the `repo` scope can read a user's private code, so it is never
stored in plain text: a database leak alone must not hand out access to anyone's
GitHub. Fernet = AES-128-CBC + HMAC-SHA256, authenticated, from `cryptography`.
"""

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from ..config import TOKEN_ENCRYPTION_KEY

# Any string works as the configured secret; it is stretched to a Fernet key here so
# a platform's random "generate a value" secret can be used directly.
_fernet = (
    Fernet(base64.urlsafe_b64encode(hashlib.sha256(TOKEN_ENCRYPTION_KEY.encode()).digest()))
    if TOKEN_ENCRYPTION_KEY
    else None
)


class EncryptionUnavailable(RuntimeError):
    pass


def encrypt(plaintext: str) -> str:
    if _fernet is None:
        raise EncryptionUnavailable("TOKEN_ENCRYPTION_KEY is not set.")
    return _fernet.encrypt(plaintext.encode()).decode()


def decrypt(ciphertext: str) -> str | None:
    """None if the key is missing/changed or the value was tampered with."""
    if _fernet is None:
        return None
    try:
        return _fernet.decrypt(ciphertext.encode()).decode()
    except InvalidToken:
        return None

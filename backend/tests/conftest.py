"""Test settings, applied before the app (and its config) is imported.

Explicit values win over backend/.env (python-dotenv never overrides variables that
are already set), so tests never pick up real secrets or the real database.
"""

import os

os.environ.update(
    {
        "FIREBASE_PROJECT_ID": "test-project",
        "ALLOWED_EMAILS": "",
        # Most tests aren't about the invite program; test_access.py switches it on.
        "ACCESS_MODE": "open",
        "ADMIN_EMAILS": "admin@example.com",
        "TOKEN_ENCRYPTION_KEY": "test-encryption-key",
        "GITHUB_USERNAME": "legacyuser",
        "MONGODB_URI": "mongodb://localhost:1/never-used",
    }
)

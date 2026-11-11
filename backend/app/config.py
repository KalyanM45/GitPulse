import os
from dotenv import load_dotenv

load_dotenv()

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")
GITHUB_USERNAME = os.getenv("GITHUB_USERNAME", "")
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "github_analytics")
SYNC_INTERVAL_MINUTES = int(os.getenv("SYNC_INTERVAL_MINUTES", "60"))

# Comma-separated list of origins allowed to call this API, e.g.
#   CORS_ORIGINS=https://gitpulse.vercel.app,http://localhost:3000
# Defaults to "*" so local development and the existing deploy keep working.
CORS_ORIGINS = [
    o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()
]


# ── Authentication (Firebase) ──────────────────────────────────────────────

# Firebase project whose sign-ins this API accepts. ID tokens are verified against
# Google's public keys, so no service-account private key is needed.
FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "")

# Comma-separated emails allowed to use the dashboard. Empty = any verified user.
# The dashboard data is still single-user, so in production set this to your own
# email until the app is multi-tenant. (Firebase lets anyone create an account;
# this is where access is actually decided.)
ALLOWED_EMAILS = {
    e.strip().lower() for e in os.getenv("ALLOWED_EMAILS", "").split(",") if e.strip()
}

# Encrypts users' GitHub tokens at rest. Any long random string; MUST stay the same
# once set (changing it makes every stored token unreadable, so users would have to
# reconnect GitHub). Render generates one — see render.yaml.
TOKEN_ENCRYPTION_KEY = os.getenv("TOKEN_ENCRYPTION_KEY", "")

# GitHub permissions requested when a user connects their account. `repo` is what
# GitHub requires for repository traffic (views/clones) and private repositories.
GITHUB_SCOPES = ["repo", "read:user"]


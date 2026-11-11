import os
from dotenv import load_dotenv

load_dotenv()

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")
GITHUB_USERNAME = os.getenv("GITHUB_USERNAME", "")
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "github_analytics")
SYNC_INTERVAL_MINUTES = int(os.getenv("SYNC_INTERVAL_MINUTES", "60"))
# In-process hourly follower sync. Off on Cloud Run: an instance that scales to zero
# isn't running to fire it, and Cloud Scheduler runs `python -m app.cron` instead.
ENABLE_SCHEDULER = os.getenv("ENABLE_SCHEDULER", "true").lower() in ("1", "true", "yes")

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

# ── Access (invite-only program) ──
# "invite": only admins and invited emails get in; everyone else can request access.
# "open":   any verified user gets in (each still sees only their own data).
ACCESS_MODE = os.getenv("ACCESS_MODE", "invite").strip().lower()

# Comma-separated emails that can approve requests and manage invites (/admin).
# Admins always have access.
ADMIN_EMAILS = {
    e.strip().lower() for e in os.getenv("ADMIN_EMAILS", "").split(",") if e.strip()
}

# Optional extra invitees set in config rather than from the admin page.
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


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

# ── Public demo ──
# The GitHub account whose dashboard anyone can browse, read-only, at /demo
# (normally the owner's). Empty = no demo.
DEMO_GITHUB_LOGIN = os.getenv("DEMO_GITHUB_LOGIN", "").strip()
# Hide private repositories (names, traffic, stars) from the demo. On by default.
DEMO_HIDE_PRIVATE_REPOS = os.getenv("DEMO_HIDE_PRIVATE_REPOS", "true").lower() in ("1", "true", "yes")

# ── Email notifications (new access requests) ──
# Any SMTP provider. Gmail: host smtp.gmail.com, port 587, your address as user,
# and an App Password (Google Account → Security → 2-Step Verification → App
# passwords). Unset = requests are still saved and shown on /admin, just not emailed.
SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", "") or SMTP_USER
# Who gets the emails. Defaults to the admins.
NOTIFY_EMAILS = [
    e.strip() for e in os.getenv("NOTIFY_EMAILS", ",".join(sorted(ADMIN_EMAILS))).split(",") if e.strip()
]
# Public URL of the frontend, for links in emails.
APP_URL = os.getenv("APP_URL", "http://localhost:3000").rstrip("/")


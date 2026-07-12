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

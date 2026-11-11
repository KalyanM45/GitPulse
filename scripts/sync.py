"""Run the scheduled sync locally or from GitHub Actions: python scripts/sync.py

The logic lives in backend/app/cron.py so the Docker image (Cloud Run Job) can run
it too, as `python -m app.cron`.
"""
import os
import sys

BACKEND = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend")
sys.path.insert(0, BACKEND)

from dotenv import load_dotenv  # noqa: E402

load_dotenv(os.path.join(BACKEND, ".env"))

from app.cron import main  # noqa: E402

if __name__ == "__main__":
    main()

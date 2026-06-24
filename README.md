# GitPulse

Track your GitHub audience — who followed you, who dropped off, and when.

![Stack](https://img.shields.io/badge/backend-FastAPI-009688?style=flat-square&logo=fastapi)
![Stack](https://img.shields.io/badge/database-MongoDB-47A248?style=flat-square&logo=mongodb)
![Stack](https://img.shields.io/badge/frontend-HTML%20%2F%20CSS%20%2F%20JS-f7df1e?style=flat-square)
![Deploy](https://img.shields.io/badge/backend_host-Render-46E3B7?style=flat-square)
![Deploy](https://img.shields.io/badge/frontend_host-Vercel-000000?style=flat-square&logo=vercel)

---

## Features

- **Following You** — all current followers, newest first
- **You Follow** — everyone you follow, in GitHub order
- **Lost Followers** — people who unfollowed and haven't come back
- **Activity history** — full timeline of follows and unfollows per user
- **Search** — server-side search across all three sections
- **Auto sync** — nightly sync at midnight IST via GitHub Actions (no server required)
- **Manual sync** — Sync Now button in the UI

---

## Project Structure

```
├── backend/              # FastAPI server (API + sync logic)
│   ├── app/
│   │   ├── main.py       # App entry point, CORS, scheduler
│   │   ├── config.py     # Reads env vars
│   │   ├── database.py   # MongoDB connection
│   │   ├── routes/       # API route definitions
│   │   ├── services/     # GitHub API + follower/following logic
│   │   └── models/       # Document shape helpers
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/             # Static web app (no build step)
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── config.js     # ← set your Render URL here after deploy
│       └── app.js
│
├── scripts/
│   └── sync.py           # Standalone sync — used by GitHub Actions
│
├── .github/
│   └── workflows/
│       └── auto_sync.yml # Runs sync.py at midnight IST daily
│
├── render.yaml           # Render deploy config (backend)
├── vercel.json           # Vercel deploy config (frontend)
└── notebooks/
    └── explore_followers.ipynb
```

---

## Local Setup

### Prerequisites

- Python 3.11+
- MongoDB running locally **or** a MongoDB Atlas URI

### 1. Clone and install

```bash
git clone https://github.com/your-username/gitpulse.git
cd gitpulse
python -m venv backend/venv
# Windows
backend\venv\Scripts\activate
# macOS/Linux
source backend/venv/bin/activate

pip install -r backend/requirements.txt
```

### 2. Configure environment

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```env
GITHUB_TOKEN=ghp_your_token_here
GITHUB_USERNAME=your_github_username
MONGODB_URI=mongodb://localhost:27017
DB_NAME=github_analytics
SYNC_INTERVAL_MINUTES=60
```

> **GitHub token scopes needed:** `read:user`, `read:org` (for following list)

### 3. Run the backend

```bash
cd backend
uvicorn app.main:app --reload
```

API is now live at `http://localhost:8000`.

### 4. Open the frontend

Open `frontend/index.html` directly in your browser — no dev server needed.

---

## Deployment

### MongoDB Atlas (required for GitHub Actions sync)

1. Create a free cluster at [cloud.mongodb.com](https://cloud.mongodb.com)
2. Database Access → create a user with read/write
3. Network Access → Allow access from anywhere (`0.0.0.0/0`)
4. Copy the connection URI: `mongodb+srv://user:pass@cluster.mongodb.net/github_analytics`

### Backend → Render

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → New → **Web Service** → connect your repo
3. Set the following in the form:

| Field | Value |
|-------|-------|
| Runtime | Python 3 |
| Build Command | `pip install -r backend/requirements.txt` |
| Start Command | `cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT` |

4. Add these environment variables:

| Key | Value |
|-----|-------|
| `GITHUB_TOKEN` | Your GitHub personal access token |
| `GITHUB_USERNAME` | Your GitHub username |
| `MONGODB_URI` | Your MongoDB Atlas URI |
| `DB_NAME` | `github_analytics` |

5. Click Deploy — Render gives you a URL like `https://gitpulse-api.onrender.com`

### Frontend → Vercel

1. Go to [vercel.com](https://vercel.com) → New Project → import this repo
2. Vercel reads `vercel.json` automatically — no extra config needed
3. Open `frontend/js/config.js` and set your Render URL:

```js
window.API_BASE = 'https://gitpulse-api.onrender.com'
```

4. Push the change — Vercel redeploys automatically

---

## GitHub Actions — Nightly Sync

The workflow at `.github/workflows/auto_sync.yml` runs `scripts/sync.py` at **midnight IST** (18:30 UTC) every day. It connects directly to MongoDB — no backend server needs to be running.

Add these secrets to your GitHub repo (Settings → Secrets → Actions):

| Secret | Value |
|--------|-------|
| `GH_ANALYTICS_TOKEN` | Your GitHub personal access token |
| `GH_USERNAME` | Your GitHub username |
| `MONGODB_URI` | Your MongoDB Atlas URI |
| `DB_NAME` | `github_analytics` |

> `GH_ANALYTICS_TOKEN` not `GITHUB_TOKEN` — the latter is reserved by GitHub Actions.

You can also trigger a manual sync from the Actions tab → **GitPulse — Nightly Sync** → Run workflow.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python, FastAPI, PyMongo |
| Database | MongoDB (Atlas for production) |
| Frontend | HTML, CSS, JavaScript (no framework) |
| Scheduler | APScheduler (in-process) + GitHub Actions (cloud) |
| Backend host | Render |
| Frontend host | Vercel |

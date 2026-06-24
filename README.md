# GitPulse — GitHub Audience Tracker

<div align="center">

[![Stars](https://img.shields.io/github/stars/KalyanM45/GitPulse?style=flat&logo=github&color=yellow)](https://github.com/KalyanM45/GitPulse/stargazers) [![Issues](https://img.shields.io/github/issues/KalyanM45/GitPulse?style=flat&logo=github)](https://github.com/KalyanM45/GitPulse/issues) [![Live Demo](https://img.shields.io/badge/Live-Demo-4f8ef7?style=flat&logo=vercel&logoColor=white)](https://gitpulse.vercel.app) [![Deployment](https://img.shields.io/badge/Deployment-success-brightgreen?style=flat&logo=render&logoColor=white)](https://gitpulse-api-tznz.onrender.com/health) [![Version](https://img.shields.io/badge/Version-0.1.0-a371f7?style=flat)](https://github.com/KalyanM45/GitPulse/releases)

</div>

## About The Project

GitHub is one of the most active developer communities in the world, yet the platform provides almost no visibility into your social graph. You can see a count of your followers, but you cannot see when someone followed you, when someone unfollowed you, or track how your audience has grown or shrunk over time. There is no notification when someone unfollows you, no history of changes, and no way to distinguish between someone who followed you last year and someone who followed you this morning. For developers who actively share projects, write technical content, or build in public, this lack of visibility is a real gap.

GitPulse is a self-hosted, full-stack audience analytics tool built specifically to close that gap. It connects to the GitHub REST API using your personal access token, pulls your complete followers and following lists, and stores a snapshot of the state in MongoDB. Every time a sync runs — either manually via the dashboard or automatically via GitHub Actions at 11:45 PM IST every day — GitPulse compares the live GitHub data against the stored snapshot. Anyone new is recorded as a "followed" event with a precise timestamp. Anyone missing from the new snapshot is recorded as an "unfollowed" event and removed from the current view. This event log is permanent and never deleted, giving you a complete and auditable history of every change to your audience over time.

The dashboard is organized into three views. **Following You** shows every person currently in your audience, sorted so the most recently followed appear at the top — new followers are highlighted with a green border so they stand out immediately. **You Follow** shows everyone you are currently following, in the exact order GitHub returns them. **Lost Followers** shows people who unfollowed you and have not come back, each with the date they dropped off. Every user in every view has a history button that opens a timeline of all their activity — if someone followed, unfollowed, and followed again, all three events appear in chronological order with timestamps in IST.

The sync architecture is designed to be reliable without requiring the backend server to always be running. The nightly GitHub Actions workflow runs a standalone Python script that imports the sync logic directly and talks to MongoDB Atlas without making any HTTP requests to the backend. This means the sync happens reliably at 11:45 PM IST every single day regardless of whether Render has spun down the free-tier server due to inactivity. The backend only needs to be awake when you open the dashboard in your browser. When you do open it, Render wakes the server within about 30 seconds and all data loads from MongoDB.

The frontend is intentionally built as plain HTML, CSS, and JavaScript with no framework and no build step. This keeps the deployment simple — Vercel serves the static files as-is — and means the project has zero frontend dependencies that can go stale. The backend is FastAPI with PyMongo, chosen for their simplicity and performance. All timestamps are stored as UTC in MongoDB and converted to IST at display time, so the data is timezone-correct regardless of where the server is hosted.

## Library Requirements

- FastAPI
- Uvicorn
- PyMongo
- Requests
- Python-dotenv
- APScheduler

## Getting Started

This will help you understand how to set up GitPulse to track your own GitHub followers. To get a local copy up and running follow these simple steps.

## Installation Steps

### Option 1: Installation from GitHub

1. **Clone the Repository**

   ```bash
   git clone https://github.com/KalyanM45/GitPulse.git
   cd GitPulse
   ```

2. **Create a Virtual Environment**

   ```bash
   python -m venv backend/venv
   ```

3. **Activate the Virtual Environment**

   Windows:
   ```bash
   backend\venv\Scripts\activate
   ```

   macOS / Linux:
   ```bash
   source backend/venv/bin/activate
   ```

4. **Install Dependencies**

   ```bash
   pip install -r backend/requirements.txt
   ```

5. **Configure Environment Variables**

   ```bash
   cp backend/.env.example backend/.env
   ```

   Open `backend/.env` and fill in your values — see the [API Key Setup](#api-key-setup) section below.

6. **Run the Backend**

   ```bash
   cd backend
   uvicorn app.main:app --reload
   ```

7. **Open the Frontend**

   Open `frontend/index.html` directly in your browser. No build step or dev server needed.

   Click **Sync Now** to pull in your GitHub followers for the first time.

## API Key Setup

GitPulse needs two credentials to run — a GitHub token and a MongoDB connection string.

### 1. GitHub Personal Access Token (`GITHUB_TOKEN`)

This is required. Without it, GitHub blocks the following list endpoint entirely (authentication required) and applies strict rate limits on all other endpoints.

**Steps to create one:**

1. Go to [github.com/settings/tokens](https://github.com/settings/tokens)
2. Click **Generate new token (classic)**
3. Set a name like `gitpulse` and choose an expiration
4. Select the following scope:
   - `read:user` — to read your profile and your own following list
5. Click **Generate token** and copy it immediately — you cannot see it again

Add it to `backend/.env`:
```dotenv
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Note:** Keep your token private. Never commit it to a public repository.

### 2. MongoDB Connection URI (`MONGODB_URI`)

GitPulse stores all follower snapshots and event history in MongoDB.

**For local development**, a local MongoDB instance works:
```dotenv
MONGODB_URI=mongodb://localhost:27017
```

**For production** (required for GitHub Actions nightly sync), use MongoDB Atlas:

1. Create a free account at [cloud.mongodb.com](https://cloud.mongodb.com)
2. Create a free **M0 cluster**
3. Go to **Database Access** → create a user with read/write access
4. Go to **Network Access** → Add IP `0.0.0.0/0` (allow from anywhere — needed for GitHub Actions dynamic IPs)
5. Go to your cluster → **Connect** → **Drivers** → copy the URI

```dotenv
MONGODB_URI=mongodb+srv://db-user:password@cluster0.xxxxx.mongodb.net/?appName=Cluster0
```

### Complete `.env` file

```dotenv
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GITHUB_USERNAME=your-github-username
MONGODB_URI=mongodb+srv://db-user:password@cluster0.xxxxx.mongodb.net/?appName=Cluster0
DB_NAME=github_analytics
SYNC_INTERVAL_MINUTES=60
```

## Deployment

### Backend → Render

1. Go to [render.com](https://render.com) → **New +** → **Web Service** → connect your repo
2. Fill in the form:

   | Field | Value |
   |-------|-------|
   | Runtime | Python 3 |
   | Build Command | `pip install -r backend/requirements.txt` |
   | Start Command | `cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
   | Instance Type | Free |

3. Add environment variables: `GITHUB_TOKEN`, `GITHUB_USERNAME`, `MONGODB_URI`, `DB_NAME`
4. Deploy — copy the URL you receive (e.g. `https://gitpulse-api.onrender.com`)

### Frontend → Vercel

1. Open `frontend/js/config.js` and set your Render URL:
   ```js
   window.API_BASE = 'https://gitpulse-api.onrender.com'
   ```
2. Push the change to GitHub
3. Go to [vercel.com](https://vercel.com) → **New Project** → import your repo → **Deploy**

### Nightly Sync → GitHub Actions

The workflow at `.github/workflows/auto_sync.yml` syncs at **11:45 PM IST** daily. It imports the backend Python code directly and talks to MongoDB Atlas — the Render server does not need to be awake.

Go to your repo → **Settings** → **Secrets and variables** → **Actions** → add:

| Secret Name | Value |
|-------------|-------|
| `GH_ANALYTICS_TOKEN` | Your GitHub personal access token |
| `GH_USERNAME` | Your GitHub username |
| `MONGODB_URI` | Your MongoDB Atlas URI |
| `DB_NAME` | `github_analytics` |

> Use `GH_ANALYTICS_TOKEN` — not `GITHUB_TOKEN`, which is reserved by GitHub Actions itself.

To test immediately: Actions tab → **GitPulse — Nightly Sync** → **Run workflow**.

## Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

- **Report bugs**: Open an issue and describe the problem clearly.
- **Contribute code**: Follow the steps below to get started.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

- **Suggestions**: Have ideas for new features? Open an issue and describe what you'd like to see!

#### Don't forget to give the project a star! Thanks again!

## License

This project is licensed under the [MIT License](LICENSE).

## Contact Details

Hema Kalyan Murapaka — [kalyanmurapaka274@gmail.com](mailto:kalyanmurapaka274@gmail.com)

## Acknowledgements

Thanks to the GitHub REST API for making follower data accessible, MongoDB Atlas for a generous free tier, Render and Vercel for free hosting, and the open-source community for the libraries that power this project.

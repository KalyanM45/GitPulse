# GitPulse: GitHub Audience & Traffic Analytics

<div align="center">

[![Stars](https://img.shields.io/github/stars/KalyanM45/GitPulse?style=flat&logo=github&color=yellow)](https://github.com/KalyanM45/GitPulse/stargazers) [![Issues](https://img.shields.io/github/issues/KalyanM45/GitPulse?style=flat&logo=github)](https://github.com/KalyanM45/GitPulse/issues) [![Live](https://img.shields.io/badge/Live-gitpulse.vercel.app-4f8ef7?style=flat&logo=vercel&logoColor=white)](https://gitpulse.vercel.app) [![Version](https://img.shields.io/badge/Version-2.0-a371f7?style=flat)](https://github.com/KalyanM45/GitPulse/releases)

**GitHub forgets. GitPulse doesn't.**

</div>

GitPulse keeps the GitHub history that GitHub itself throws away. It records your
repository **views and clones every day** (GitHub only keeps 14 days), tracks
**who followed and unfollowed you, and when**, and puts your stars, commits,
languages and contribution history on one dashboard.

It's an **invite-only** app: anyone can sign in to explore a live, read-only demo,
request access from the landing page, and invited users connect their own GitHub
account to get their own private dashboard.

## Features

| | |
|---|---|
| **Audience tracking** | Every follower and unfollower with timestamps. Identity is GitHub's immutable user id, so a username change is never counted as a loss. |
| **Traffic history** | Daily views and clones per repository, stored forever, with referrers and popular paths. |
| **Repository insights** | Stars over time, commits, branches, languages, top repositories. |
| **Contributions** | Year-by-year contribution heatmaps and totals. |
| **Invite-only access** | Public "Request access" form (emailed to the owner), an admin page to approve, invite and remove people. |
| **Live demo** | Signed-in visitors browse the owner's real dashboard, read-only, with private repositories hidden. |
| **Multi-user** | Each user connects their own GitHub account; every query is scoped to that user. |

## How it works

```
 Browser (Next.js on Vercel)
   │  Firebase Auth: sign up, verify email, reset password, GitHub OAuth
   │  every API call carries a Firebase ID token
   ▼
 FastAPI backend (Render, or Cloud Run via infra/)
   │  verifies the token → checks invite → scopes all data to that user
   │  syncs each user's GitHub with their own (encrypted) token
   ▼
 MongoDB Atlas: snapshots, events, daily traffic, users, invites

 Scheduled sync (GitHub Actions cron, or Cloud Scheduler): every connected user, 4× a day
```

More detail, including the data model and security design, is in
**[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS 4, TanStack Query, Recharts, Framer Motion |
| Auth | Firebase Authentication (email/password, email verification, GitHub OAuth) |
| Backend | Python 3.13, FastAPI, PyMongo, PyJWT (Firebase token verification), cryptography (token encryption) |
| Database | MongoDB Atlas |
| Hosting | Vercel (frontend), Render (backend); Terraform for Google Cloud in [`infra/`](infra/README.md) |
| Tests | pytest + mongomock (no real database or GitHub needed) |

## Project structure

```
backend/
  app/
    main.py              App setup: middleware, routers, the demo mount
    config.py            Every setting, read from environment variables
    tenant.py            Per-user data isolation (scoped MongoDB collections)
    access.py            Invite-only program: who gets in, requests, invites
    demo.py              Read-only demo of one account (/demo/api/*)
    github_account.py    Connecting GitHub, encrypted tokens, legacy data
    notify.py            Email to the owner on new access requests
    cron.py              Scheduled sync of every connected user
    auth/                Firebase token checks, API guards, encryption
    routes/              HTTP endpoints
    services/            GitHub API client and the sync logic per data type
  tests/                 Backend test suite
frontend/
  src/app/
    page.tsx             Landing page
    (auth)/              Sign in, sign up, verify email, forgot password
    connect/             Connect GitHub + first-sync progress
    (app)/               Your dashboard: overview, audience, repositories, admin
    demo/                The same pages, read-only, showing the demo account
  src/components/        UI (landing, dashboard, auth, access, demo, shell)
  src/lib/               API clients, Firebase, hooks, formatting
infra/                   Terraform for Google Cloud (optional)
docs/                    Architecture, configuration and deployment guides
.github/workflows/       Scheduled sync and keep-warm ping
```

## Running locally

**Prerequisites:** Python 3.13, Node.js 20+, a MongoDB database (Atlas free tier
works), and a Firebase project. First-time Firebase and GitHub OAuth setup is in
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md#1-firebase).

**1. Backend** (terminal 1)

```bash
cd backend
python -m venv venv
venv\Scripts\activate            # macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env             # then fill it in, see docs/CONFIGURATION.md
uvicorn app.main:app --reload
```

**2. Frontend** (terminal 2)

```bash
cd frontend
npm install
cp .env.example .env.local       # Firebase web config + NEXT_PUBLIC_API_BASE=http://localhost:8000
npm run dev
```

Open **http://localhost:3000**, sign up with an email listed in `ADMIN_EMAILS`,
connect GitHub, and your first sync starts.

**Tests**

```bash
cd backend
pip install -r requirements-dev.txt
python -m pytest tests -q
cd ../frontend && npm run typecheck
```

## Documentation

| Guide | What's in it |
|---|---|
| [Architecture](docs/ARCHITECTURE.md) | Components, request flow, data model, security model, sync design |
| [Configuration](docs/CONFIGURATION.md) | Every environment variable for the backend, frontend and GitHub Actions |
| [Deployment](docs/DEPLOYMENT.md) | Firebase, GitHub OAuth, Render, Vercel, Actions secrets, email, going live |
| [Google Cloud (Terraform)](infra/README.md) | Optional: deploy the backend to Cloud Run with Terraform |

## Contributing

Contributions are welcome:

1. Fork the project and create a branch (`git checkout -b feature/my-change`).
2. Make your change and run the tests (see above).
3. Open a pull request describing what changed and why.

Found a bug or have an idea? [Open an issue](https://github.com/KalyanM45/GitPulse/issues).

## License

This project is licensed under the [MIT License](LICENSE).

## Acknowledgements

Thanks to the GitHub REST and GraphQL APIs, Firebase, MongoDB Atlas, Render and
Vercel for their free tiers, and the open-source libraries this project is built on.

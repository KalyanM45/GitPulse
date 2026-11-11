# Configuration

Every setting GitPulse reads, where it goes, and whether it's a secret.

- **Local development:** `backend/.env` and `frontend/.env.local` (both
  gitignored). Templates: `backend/.env.example`, `frontend/.env.example`.
- **Production:** Render → Environment, Vercel → Environment Variables,
  GitHub → Settings → Secrets and variables → Actions.

🔒 = secret. Never commit it, paste it into chat, or put it in the frontend.

## Backend (`backend/.env`, Render)

### Core

| Variable | Required | Example | What it does |
|---|---|---|---|
| `MONGODB_URI` 🔒 | yes | `mongodb+srv://user:pass@cluster…` | MongoDB connection string |
| `DB_NAME` | no | `github_analytics` | Database name |
| `FIREBASE_PROJECT_ID` | yes | `gitpulse2026` | Only tokens from this Firebase project are accepted |
| `TOKEN_ENCRYPTION_KEY` 🔒 | yes | 48+ random characters | Encrypts users' GitHub tokens in MongoDB. **Never change it once set**, and use the same value everywhere the backend runs. |
| `CORS_ORIGINS` | prod | `https://gitpulse.vercel.app,http://localhost:3000` | Browser origins allowed to call the API |

Generate a key: `python -c "import secrets; print(secrets.token_urlsafe(48))"`

### Invite-only program

| Variable | Default | What it does |
|---|---|---|
| `ACCESS_MODE` | `invite` | `invite`: only admins and invited emails get a dashboard. `open`: any verified account does. |
| `ADMIN_EMAILS` | none | Comma-separated sign-in emails that can use `/admin`. Admins always have access. |
| `ALLOWED_EMAILS` | none | Optional extra invitees set in config (most invites are made at `/admin`). |

### Demo

| Variable | Default | What it does |
|---|---|---|
| `DEMO_GITHUB_LOGIN` | none | GitHub account shown read-only at `/demo` to any signed-in visitor. Empty = no demo. That account must be connected in GitPulse. |
| `DEMO_HIDE_PRIVATE_REPOS` | `true` | Hide private repositories (names, traffic, stars) from the demo |

### Access-request emails (optional)

| Variable | Default | What it does |
|---|---|---|
| `SMTP_HOST` | none | e.g. `smtp.gmail.com`. Unset = no emails (requests still appear at `/admin`). |
| `SMTP_PORT` | `587` | `587` = STARTTLS, `465` = SSL |
| `SMTP_USER` | none | e.g. your Gmail address |
| `SMTP_PASSWORD` 🔒 | none | Gmail: an **App Password** (not your normal password) |
| `SMTP_FROM` | `SMTP_USER` | Sender address |
| `NOTIFY_EMAILS` | `ADMIN_EMAILS` | Who receives the emails |
| `APP_URL` | `http://localhost:3000` | Frontend URL, for the "Review" link in emails |

### Scheduling and legacy

| Variable | Default | What it does |
|---|---|---|
| `ENABLE_SCHEDULER` | `true` | Hourly in-process follower sync. Set `false` when Cloud Scheduler runs `python -m app.cron`. |
| `SYNC_INTERVAL_MINUTES` | `60` | Interval for the in-process sync |
| `GITHUB_USERNAME` | none | The account tracked before multi-user support. Whoever connects it inherits its history. |

## Frontend (`frontend/.env.local`, Vercel)

All are public: they're compiled into the browser bundle. On Vercel, choose type
**Config** (not Secret) and redeploy after changing them.

| Variable | Example |
|---|---|
| `NEXT_PUBLIC_API_BASE` | `https://gitpulse-api-xxxx.onrender.com` (local: `http://localhost:8000`) |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | from Firebase → Project settings → Your apps |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `gitpulse2026.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `gitpulse2026` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | from Firebase |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | from Firebase |

## GitHub Actions secrets (scheduled sync)

Repository → Settings → Secrets and variables → Actions.

| Secret | Value |
|---|---|
| `MONGODB_URI` 🔒 | same as the backend |
| `DB_NAME` | same as the backend |
| `TOKEN_ENCRYPTION_KEY` 🔒 | **same value** as the backend |
| `GH_USERNAME` | legacy account (optional) |

Variable (not secret) for the keep-warm ping: `API_BASE_URL` = your Render URL.

## Where each secret lives

| Secret | Backend host | GitHub Actions | Frontend |
|---|---|---|---|
| `MONGODB_URI` | ✅ | ✅ | ❌ never |
| `TOKEN_ENCRYPTION_KEY` | ✅ | ✅ | ❌ never |
| `SMTP_PASSWORD` | ✅ | ❌ | ❌ never |
| GitHub OAuth client secret | ❌ (it lives in Firebase) | ❌ | ❌ never |

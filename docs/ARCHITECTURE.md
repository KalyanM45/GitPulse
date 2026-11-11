# Architecture

How GitPulse is put together: the pieces, how a request flows through them, where
data lives, and how users are kept apart.

## Components

| Component | Where it runs | Responsibility |
|---|---|---|
| **Frontend** (`frontend/`) | Vercel | Next.js app: landing page, auth screens, dashboard, demo, admin. Talks to Firebase for sign-in and to the API for data. |
| **Firebase Authentication** | Google | Accounts, passwords, email verification, password reset, and the GitHub OAuth popup. |
| **API** (`backend/app/`) | Render (or Cloud Run) | FastAPI. Verifies Firebase ID tokens, decides access, serves dashboard data, runs syncs. |
| **Scheduled sync** (`backend/app/cron.py`) | GitHub Actions (or Cloud Scheduler + Cloud Run Job) | Syncs every connected user 4× a day, without the web server. |
| **MongoDB Atlas** | MongoDB | All stored data. |
| **SMTP** (optional) | e.g. Gmail | Emails the owner when someone requests access. |

## Request flow

```
Browser ──(1) sign in──────────────▶ Firebase Auth
   │        ◀── ID token (JWT, ~1h, auto-refreshed by the SDK)
   │
   └─(2) GET /api/repos   Authorization: Bearer <ID token>
          │
          ▼
   require_identity   auth/deps.py      token signature (Google's public keys), audience,
          │                             issuer, expiry; email must be verified
   require_user       auth/deps.py      invite check (access.py) → 403 "not_invited"
          │                             loads/creates the user's row in `users`
   require_tenant     auth/deps.py      GitHub connected? → decrypts their token and
          │                             sets the "current tenant" for this request
          ▼
   service code       services/*.py     reads through tenant_db(): every query is
                                        automatically limited to this user's data
```

The demo uses the same endpoints mounted again under `/demo/api/*`, with
`require_demo_tenant` (`demo.py`) in place of the last two steps: any verified
account, GET only, tenant = the demo account.

## Who can do what

| Visitor | Landing | `/demo/*` | `/dashboard` etc. | `/admin` |
|---|---|---|---|---|
| Not signed in | ✅ | → sign in first | → sign in first | → sign in first |
| Signed in, not invited | ✅ | ✅ read-only | "Invite-only" screen: request access, view demo | ❌ |
| Invited | ✅ | ✅ | ✅ their own data (after connecting GitHub) | ❌ |
| Admin (`ADMIN_EMAILS`) | ✅ | ✅ | ✅ | ✅ |

Access is checked on **every request**, so approving or removing someone at
`/admin` takes effect immediately.

## Data model (MongoDB)

**Per-user GitHub data.** Every document carries `owner_id` (the user's `_id`),
and every index starts with it.

| Collection | One document per | Notes |
|---|---|---|
| `follower_snapshots` | current follower | keyed by GitHub user id, so renames aren't losses |
| `follower_events` | follow / unfollow | append-only history |
| `following_snapshots` | account the user follows | keeps GitHub's order |
| `repo_snapshots` | repository | latest stats, 14-day traffic, lifetime totals |
| `traffic_daily` | repository × day | the long-term traffic history GitHub doesn't keep |
| `star_snapshots` | repository × sync | star history |
| `contributions` | year | contribution calendar |
| `meta` | `sync:<user>`, `profile:<user>` | last sync time, cached GitHub profile |

**Accounts and access**

| Collection | Contents |
|---|---|
| `users` | Firebase uid, email, and `github`: id, login, **encrypted** token, scopes |
| `invites` | `_id` = invited email; who invited them and when |
| `access_requests` | one per email: note, status (`pending` / `approved` / `rejected`) |
| `sync_jobs` | background sync status per user (drives the progress screen) |
| `rate_limits` | short-lived counters (TTL index) for the public request form |

## Security model

- **Authentication:** Firebase ID tokens, verified against Google's published keys
  (`auth/firebase.py`). The algorithm is pinned (RS256), and audience, issuer,
  expiry and `auth_time` are all checked. No service-account key is needed.
- **Isolation between users:** services never touch a raw collection. They go
  through `tenant_db()` (`tenant.py`), which adds `owner_id` to every query,
  insert and aggregation, and refuses queries for another owner. With no user in
  scope it raises instead of reading everyone's data. Tests in
  `tests/test_tenancy.py` check that one user can never see another's data.
- **GitHub tokens:** stored encrypted (Fernet: AES + HMAC) with
  `TOKEN_ENCRYPTION_KEY`. A database leak alone doesn't expose anyone's GitHub.
  The `repo` scope is requested only because GitHub requires it for traffic data.
  GitPulse never writes to GitHub.
- **Invite-only:** Firebase lets anyone create an account; the API decides who
  gets a dashboard (`access.py`). The public request form never reveals whether an
  email is already invited, and it's rate-limited per IP.
- **Demo:** GET-only, scoped to one account, and private repositories are filtered
  out at the query layer (`tenant.py` visibility filter), not just hidden in the UI.
- **Secrets** live in environment variables or a secret manager, never in the repo.
  `NEXT_PUBLIC_*` frontend values are public identifiers by design.

## Syncing

A full sync for one user runs, in order: **profile → followers → following →
repositories & traffic → contributions** (`services/sync_runner.py`).

| Trigger | Where it runs |
|---|---|
| First sync after "Connect GitHub" | Background thread in the API; the `/connect` page polls its progress |
| "Sync" button | Inline in the API request |
| Hourly follower refresh | In-process scheduler (`ENABLE_SCHEDULER`) |
| 4× daily, everyone | `python -m app.cron` from GitHub Actions or a Cloud Run Job |

Syncs never overwrite good data with zeros when GitHub is slow or rate-limited.
They keep the previous value and fill it in next time. GitHub's 14-day traffic
window is stored day by day (`traffic_daily`), which is how the history outlives it.

**Scaling note:** syncs currently run one after another in a single process,
which is fine for an invite-only group. For many users, move them to a queue
with parallel workers (e.g. Cloud Tasks) and skip unchanged repositories.

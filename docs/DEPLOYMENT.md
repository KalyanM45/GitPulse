# Deployment

Step-by-step setup for a live, invite-only GitPulse on free tiers: **Firebase**
(auth), **MongoDB Atlas** (data), **Render** (API), **Vercel** (frontend) and
**GitHub Actions** (scheduled sync). Every variable is explained in
[CONFIGURATION.md](CONFIGURATION.md).

Prefer Google Cloud for the API? See [infra/README.md](../infra/README.md).

## 1. Firebase

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com).
2. **Authentication → Get started → Sign-in method:** enable **Email/Password**
   (leave "Email link" off).
3. **Authentication → Settings:**
   - **User actions:** keep *Email enumeration protection* on.
   - **Password policy:** set your rules. The sign-up page reads them automatically.
   - **Authorized domains:** add your Vercel domain (e.g. `gitpulse.vercel.app`).
4. **Project settings → Your apps → Web (`</>`):** register an app and copy its
   config values for the frontend's `NEXT_PUBLIC_FIREBASE_*` variables.

## 2. GitHub sign-in (the "Connect GitHub" button)

1. GitHub → **Settings → Developer settings → OAuth Apps → New OAuth App**
   - Homepage URL: your Vercel URL
   - Authorization callback URL: `https://<project-id>.firebaseapp.com/__/auth/handler`
2. Copy the **Client ID** and generate a **Client secret**.
3. Firebase → **Authentication → Sign-in method → Add new provider → GitHub:**
   enable it and paste both values. (The secret stays in Firebase. GitPulse never
   sees it.)

This is a one-time setup by the app owner. Users just click **Connect GitHub**
and **Authorize**.

## 3. MongoDB Atlas

1. Create a free **M0** cluster, ideally in the same region as your API.
2. **Database Access:** create a user with read/write access.
3. **Network Access:** allow `0.0.0.0/0`. Render, GitHub Actions and Cloud Run
   have no fixed IPs; access is still protected by the password.
4. **Connect → Drivers:** copy the URI into `MONGODB_URI`.

Indexes are created automatically when the API starts.

## 4. Backend on Render

1. Render → **New → Blueprint** → select this repository. `render.yaml` defines
   the service.
2. In **Environment**, set the values marked "sync: false" in `render.yaml`:

   | Variable | Value |
   |---|---|
   | `MONGODB_URI` | your Atlas URI |
   | `TOKEN_ENCRYPTION_KEY` | your key. If Render generated one, replace it with the value from your local `.env` so already-connected accounts keep working. |
   | `ADMIN_EMAILS` | the email you sign in with |
   | `SMTP_USER`, `SMTP_PASSWORD` | optional, see [section 7](#7-access-request-emails-optional) |

3. Check `CORS_ORIGINS` includes your Vercel URL, and `DEMO_GITHUB_LOGIN` is the
   GitHub account to show in the demo.
4. Deploy, and check `https://<service>.onrender.com/health` returns `{"status":"ok"}`.

The free plan sleeps after ~15 minutes idle (first request then takes ~50 s). The
`keep_warm.yml` workflow pings it every 10 minutes once the `API_BASE_URL`
repository variable is set.

## 5. Frontend on Vercel

1. Vercel → **New Project** → import the repository, root directory `frontend`.
2. **Settings → Environment Variables** (type **Config**):
   `NEXT_PUBLIC_API_BASE` (your Render URL) and the five `NEXT_PUBLIC_FIREBASE_*` values.
3. Deploy. After changing any of these later, **redeploy**: they're baked in at build time.

## 6. Scheduled sync (GitHub Actions)

Add the repository secrets `MONGODB_URI`, `DB_NAME` and `TOKEN_ENCRYPTION_KEY`
(the same key as Render), plus `GH_USERNAME` if you're carrying over legacy data.
`auto_sync.yml` then syncs every connected user at 5 & 11 AM and 5 & 11 PM IST.
To run it by hand: **Actions → Sync Workflow → Run workflow**.

## 7. Access-request emails (optional)

To get an email whenever someone requests access, using Gmail:

1. Turn on **2-Step Verification** for your Google account.
2. Google Account → **Security → App passwords** → create one called "GitPulse".
3. On Render set `SMTP_USER` = your Gmail address and `SMTP_PASSWORD` = the
   16-character app password (`SMTP_HOST`/`SMTP_PORT` are already in `render.yaml`).

Each email includes the requester's address and note, a link to `/admin`, and
Reply-To set to the requester, so you can answer them directly. Without SMTP,
requests still appear at `/admin`.

## 8. Go live checklist

- [ ] `/health` on Render returns ok
- [ ] Landing page loads and shows **Request access** and **View demo**
- [ ] Sign up with your `ADMIN_EMAILS` address → verify email → **Connect GitHub** → first sync completes
- [ ] **Access** appears in your sidebar (`/admin`)
- [ ] From a private window: sign up with another email → **View demo** works → **request access** shows up at `/admin` (and in your inbox, with SMTP)
- [ ] Approve it → that account now gets its own dashboard
- [ ] Actions → **Sync Workflow** runs green

## Day-to-day

| Task | How |
|---|---|
| Let someone in | `/admin` → approve their request, or invite by email |
| Remove someone | `/admin` → Members → Remove (immediate) |
| Change the demo account | `DEMO_GITHUB_LOGIN` on Render (that account must have connected GitHub) |
| Open sign-ups to everyone | `ACCESS_MODE=open` on Render |
| Deploy changes | push to `main`; Render and Vercel redeploy automatically |

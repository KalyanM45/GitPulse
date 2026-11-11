# GitPulse on Google Cloud (Terraform)

| Piece | Where |
|---|---|
| Backend API | Cloud Run service `gitpulse-api` (scales to zero) |
| Scheduled sync of all users | Cloud Run job `gitpulse-sync`, started by Cloud Scheduler 4× a day |
| Secrets | Secret Manager: `mongodb-uri`, `token-encryption-key` |
| Images | Artifact Registry `gitpulse` (old images deleted automatically) |
| Budget | Optional monthly email alert |
| Frontend | Stays on Vercel |
| Database | Stays on MongoDB Atlas |
| Login | Stays on Firebase (same project, `gitpulse2026`) |

All commands below are PowerShell, run from the repo root.

## One-time setup

**1. Billing.** In the Google Cloud console, select project `gitpulse2026` →
Billing → link a billing account (the free trial is fine).

**2. Sign in** (opens the browser twice):

```powershell
gcloud auth login
gcloud auth application-default login
gcloud config set project gitpulse2026
```

**3. Settings (optional).** Copy `infra\terraform.tfvars.example` to
`infra\terraform.tfvars` and add your billing account ID for the budget alert.

**4. Create the infrastructure:**

```powershell
cd infra
terraform init
terraform apply
cd ..
```

This creates everything with a placeholder container. The secrets exist but are
still empty.

**5. Add the secret values.** They're piped in from `backend\.env`, so nothing is
pasted or stored in shell history:

```powershell
$envFile = Get-Content backend\.env
function EnvValue($name) { ($envFile | Where-Object { $_ -match "^$name=" }) -replace "^$name=", "" }
(EnvValue MONGODB_URI) | gcloud secrets versions add mongodb-uri --data-file=-
(EnvValue TOKEN_ENCRYPTION_KEY) | gcloud secrets versions add token-encryption-key --data-file=-
```

Use the **same** `TOKEN_ENCRYPTION_KEY` as your local `.env`. Local and cloud use
the same database, and tokens already stored there were encrypted with that key.

**6. MongoDB Atlas network access.** Cloud Run has no fixed outgoing IP, so in
Atlas → Network Access the list must allow `0.0.0.0/0`. If Render could connect,
this is probably already set. Access is still protected by the database
username and password.

## Deploying

Start Docker Desktop, then:

```powershell
powershell -ExecutionPolicy Bypass -File infra\deploy.ps1
```

This builds the backend image, pushes it, and points the API and the sync job at
it. It prints the API URL at the end.

## Pointing the app at it

- **Vercel:** set `NEXT_PUBLIC_API_BASE` to the API URL and redeploy.
- **GitHub repo:** the GitHub Actions sync (`auto_sync.yml`) and keep-warm ping
  aren't needed any more. Disable them under Actions so users aren't synced twice.

## Everyday commands

```powershell
gcloud run jobs execute gitpulse-sync --region asia-south1           # run the sync now
gcloud run services logs read gitpulse-api --region asia-south1      # API logs
terraform -chdir=infra plan                                          # preview changes
```

## Costs

- **The API scales to zero:** nothing runs and nothing is billed while nobody is
  using the app.
- **While an instance is up, its CPU stays allocated** (`cpu_idle = false`), so
  the first sync after "Connect GitHub" keeps running in the background. Moving
  that sync to Cloud Tasks would allow cheaper request-only billing.
- **`max_instances` (default 2)** caps how far it can scale.
- **Budget alerts** only warn you; they don't stop spending.

## Tearing it all down

```powershell
terraform -chdir=infra destroy
```

This deletes every GCP resource above. Atlas, Vercel and Firebase are untouched.

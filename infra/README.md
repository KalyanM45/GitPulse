# infra/: Google Cloud deployment (Terraform)

Optional infrastructure-as-code for running the GitPulse backend on Google Cloud
instead of Render. The frontend, database and auth stay where they are
(Vercel, MongoDB Atlas, Firebase).

| Resource | Purpose |
|---|---|
| Cloud Run service `gitpulse-api` | The FastAPI backend; scales to zero when idle |
| Cloud Run job `gitpulse-sync` | `python -m app.cron`: syncs every connected user |
| Cloud Scheduler `gitpulse-sync` | Runs that job 4× a day |
| Secret Manager | `mongodb-uri`, `token-encryption-key` (values added outside Terraform, so never in state) |
| Artifact Registry `gitpulse` | Backend images, old ones cleaned up automatically |
| Service accounts | Least privilege: the runtime reads only its two secrets; the scheduler can only start the job |
| Billing budget (optional) | Email alerts at 50 / 90 / 100 % |

| File | Contents |
|---|---|
| `versions.tf` | Terraform and Google provider versions |
| `variables.tf` | Every setting, with defaults (region `asia-south1`) |
| `main.tf` | The resources above |
| `outputs.tf` | API URL, image repository, sync job name |
| `terraform.tfvars.example` | Template for local overrides (`terraform.tfvars` is gitignored) |
| `deploy.ps1` | Build the image, push it, roll it out |

Usage, in short: `terraform init && terraform apply`, add the two secret values
with `gcloud secrets versions add`, then run `deploy.ps1`. The design behind it
is described in the [High-Level Design](../docs/hld.md#6-deployment-topology).

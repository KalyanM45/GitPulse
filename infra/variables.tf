variable "project_id" {
  description = "Google Cloud project. The Firebase project is a GCP project, so this is the same ID."
  type        = string
  default     = "gitpulse2026"
}

variable "region" {
  description = "Region for everything. Keep MongoDB Atlas in the same region (Mumbai) for speed and to avoid cross-region traffic charges."
  type        = string
  default     = "asia-south1"
}

variable "image" {
  description = "Backend container image. Set by deploy.ps1 after each build; the default is Google's placeholder so the very first apply works before any image exists."
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "frontend_origins" {
  description = "Browser origins allowed to call the API (CORS)."
  type        = list(string)
  default     = ["https://gitpulse.vercel.app", "http://localhost:3000"]
}

variable "legacy_github_username" {
  description = "The account the app tracked before multi-user support; whoever connects it inherits that history."
  type        = string
  default     = "KalyanM45"
}

variable "db_name" {
  type    = string
  default = "github_analytics"
}

variable "allowed_emails" {
  description = "Comma-separated sign-up allowlist. Empty = open sign-up (each user only sees their own data)."
  type        = string
  default     = ""
}

variable "max_instances" {
  description = "Upper bound on API instances. The main protection against a runaway bill."
  type        = number
  default     = 2
}

variable "sync_schedule" {
  description = "When the scheduled sync of every connected user runs (cron, in sync_time_zone)."
  type        = string
  default     = "0 5,11,17,23 * * *"
}

variable "sync_time_zone" {
  type    = string
  default = "Asia/Kolkata"
}

# ── Budget alert (optional) ─────────────────────────────────────────────────

variable "billing_account_id" {
  description = "Billing account ID (Billing → Overview, like 012345-6789AB-CDEF01). Empty = no budget alert is created."
  type        = string
  default     = ""
}

variable "budget_amount" {
  description = "Monthly budget that triggers email alerts at 50%, 90% and 100%. Alerts only warn; they don't stop spending."
  type        = number
  default     = 500
}

variable "budget_currency" {
  description = "Must match your billing account's currency (Indian accounts are usually INR)."
  type        = string
  default     = "INR"
}

# GitPulse on Google Cloud.
#
#   Cloud Run service  gitpulse-api   the FastAPI backend (scales to zero when idle)
#   Cloud Run job      gitpulse-sync  `python -m app.cron`: syncs every connected user
#   Cloud Scheduler    runs that job on a schedule
#   Secret Manager     MONGODB_URI, TOKEN_ENCRYPTION_KEY (values added with gcloud)
#   Artifact Registry  backend images, old ones cleaned up automatically
#   Budget             optional monthly email alert
#
# The frontend stays on Vercel; MongoDB stays on Atlas; login stays on Firebase
# (same project).

data "google_project" "this" {}

locals {
  services = [
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "secretmanager.googleapis.com",
    "cloudscheduler.googleapis.com",
    "iam.googleapis.com",
    "billingbudgets.googleapis.com",
  ]

  image_repo = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.gitpulse.repository_id}"

  # Plain settings shared by the API and the sync job.
  env = {
    FIREBASE_PROJECT_ID = var.project_id
    DB_NAME             = var.db_name
    GITHUB_USERNAME     = var.legacy_github_username
    ALLOWED_EMAILS      = var.allowed_emails
    CORS_ORIGINS        = join(",", var.frontend_origins)
    ENABLE_SCHEDULER    = "false" # Cloud Scheduler + the sync job do this instead
  }

  # Secret settings: env var name => Secret Manager secret.
  secret_env = {
    MONGODB_URI          = google_secret_manager_secret.secrets["mongodb-uri"].secret_id
    TOKEN_ENCRYPTION_KEY = google_secret_manager_secret.secrets["token-encryption-key"].secret_id
  }
}

resource "google_project_service" "apis" {
  for_each           = toset(local.services)
  service            = each.value
  disable_on_destroy = false
}

# ── Container images ─────────────────────────────────────────────────────────

resource "google_artifact_registry_repository" "gitpulse" {
  repository_id = "gitpulse"
  location      = var.region
  format        = "DOCKER"
  description   = "GitPulse backend images"

  # Storage is billed per GB: keep the latest few images, drop the rest.
  cleanup_policies {
    id     = "keep-recent"
    action = "KEEP"
    most_recent_versions {
      keep_count = 5
    }
  }
  cleanup_policies {
    id     = "delete-old"
    action = "DELETE"
    condition {
      older_than = "2592000s" # 30 days
    }
  }

  depends_on = [google_project_service.apis]
}

# ── Identities ───────────────────────────────────────────────────────────────

# What the API and the sync job run as. Least privilege: it can read the two
# secrets below and nothing else in the project.
resource "google_service_account" "runtime" {
  account_id   = "gitpulse-runtime"
  display_name = "GitPulse API and sync job"
}

# What Cloud Scheduler uses to start the sync job.
resource "google_service_account" "scheduler" {
  account_id   = "gitpulse-scheduler"
  display_name = "GitPulse scheduled sync trigger"
}

# ── Secrets ──────────────────────────────────────────────────────────────────
# Terraform creates the secrets but never sees their values, so the values are
# never in Terraform state. Add them with gcloud (see infra/README.md).

resource "google_secret_manager_secret" "secrets" {
  for_each  = toset(["mongodb-uri", "token-encryption-key"])
  secret_id = each.value

  replication {
    auto {}
  }

  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_iam_member" "runtime_reads" {
  for_each  = google_secret_manager_secret.secrets
  secret_id = each.value.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.runtime.email}"
}

# ── API ──────────────────────────────────────────────────────────────────────

resource "google_cloud_run_v2_service" "api" {
  name                = "gitpulse-api"
  location            = var.region
  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = false

  template {
    service_account = google_service_account.runtime.email
    timeout         = "300s"

    scaling {
      # 0 = nothing runs (and nothing is billed) while nobody is using the app.
      min_instance_count = 0
      max_instance_count = var.max_instances
    }

    containers {
      image = var.image

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        # CPU stays allocated between requests while an instance is alive. Needed
        # for now: the first sync after "Connect GitHub" runs in a background thread
        # after the response is sent, and would stall without CPU. Instances still
        # shut down when idle (min_instance_count = 0). Moving that sync to Cloud
        # Tasks will allow request-only billing (cpu_idle = true).
        cpu_idle          = false
        startup_cpu_boost = true
      }

      dynamic "env" {
        for_each = local.env
        content {
          name  = env.key
          value = env.value
        }
      }

      dynamic "env" {
        for_each = local.secret_env
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = env.value
              version = "latest"
            }
          }
        }
      }

      startup_probe {
        http_get {
          path = "/health"
        }
        period_seconds    = 3
        failure_threshold = 20
      }
    }
  }

  depends_on = [google_project_service.apis, google_secret_manager_secret_iam_member.runtime_reads]
}

# The API is public: it does its own authentication (Firebase ID tokens).
resource "google_cloud_run_v2_service_iam_member" "public" {
  name     = google_cloud_run_v2_service.api.name
  location = var.region
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# ── Scheduled sync ───────────────────────────────────────────────────────────

resource "google_cloud_run_v2_job" "sync" {
  name                = "gitpulse-sync"
  location            = var.region
  deletion_protection = false

  template {
    task_count = 1

    template {
      service_account = google_service_account.runtime.email
      # A job isn't bound by a request timeout; a big account can take a while.
      timeout     = "3600s"
      max_retries = 1

      containers {
        image   = var.image
        command = ["python"]
        args    = ["-m", "app.cron"]

        resources {
          limits = {
            cpu    = "1"
            memory = "512Mi"
          }
        }

        dynamic "env" {
          for_each = local.env
          content {
            name  = env.key
            value = env.value
          }
        }

        dynamic "env" {
          for_each = local.secret_env
          content {
            name = env.key
            value_source {
              secret_key_ref {
                secret  = env.value
                version = "latest"
              }
            }
          }
        }
      }
    }
  }

  depends_on = [google_project_service.apis, google_secret_manager_secret_iam_member.runtime_reads]
}

resource "google_cloud_run_v2_job_iam_member" "scheduler_runs_sync" {
  name     = google_cloud_run_v2_job.sync.name
  location = var.region
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.scheduler.email}"
}

resource "google_cloud_scheduler_job" "sync" {
  name        = "gitpulse-sync"
  region      = var.region
  description = "Sync every connected GitPulse user"
  schedule    = var.sync_schedule
  time_zone   = var.sync_time_zone

  http_target {
    http_method = "POST"
    uri         = "https://run.googleapis.com/v2/projects/${var.project_id}/locations/${var.region}/jobs/${google_cloud_run_v2_job.sync.name}:run"

    oauth_token {
      service_account_email = google_service_account.scheduler.email
      scope                 = "https://www.googleapis.com/auth/cloud-platform"
    }
  }

  retry_config {
    retry_count = 1
  }

  depends_on = [google_project_service.apis, google_cloud_run_v2_job_iam_member.scheduler_runs_sync]
}

# ── Budget alert ─────────────────────────────────────────────────────────────

resource "google_billing_budget" "monthly" {
  count           = var.billing_account_id == "" ? 0 : 1
  billing_account = var.billing_account_id
  display_name    = "GitPulse monthly budget"

  budget_filter {
    projects = ["projects/${data.google_project.this.number}"]
  }

  amount {
    specified_amount {
      currency_code = var.budget_currency
      units         = tostring(var.budget_amount)
    }
  }

  # Emails the billing account's admins at each threshold. Alerts only: nothing
  # is switched off automatically.
  threshold_rules {
    threshold_percent = 0.5
  }
  threshold_rules {
    threshold_percent = 0.9
  }
  threshold_rules {
    threshold_percent = 1.0
  }

  depends_on = [google_project_service.apis]
}

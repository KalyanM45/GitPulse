terraform {
  required_version = ">= 1.6"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 6.0, < 8.0"
    }
  }

  # State is kept locally in infra/terraform.tfstate (gitignored). It holds no
  # secret values: secrets are created here but their values are added with
  # gcloud, outside Terraform. Move to a GCS backend if more than one person
  # will run Terraform.
}

provider "google" {
  project = var.project_id
  region  = var.region

  # Bill API calls made with your own (user) credentials to this project. The
  # budget API needs this when Terraform runs with `gcloud auth` credentials.
  user_project_override = true
  billing_project       = var.project_id
}

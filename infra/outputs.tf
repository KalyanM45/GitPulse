output "api_url" {
  description = "Backend URL. Set it as NEXT_PUBLIC_API_BASE in Vercel (then redeploy the frontend)."
  value       = google_cloud_run_v2_service.api.uri
}

output "image_repo" {
  description = "Where deploy.ps1 pushes backend images."
  value       = local.image_repo
}

output "sync_job" {
  description = "Run the scheduled sync by hand: gcloud run jobs execute <this> --region <region>"
  value       = google_cloud_run_v2_job.sync.name
}

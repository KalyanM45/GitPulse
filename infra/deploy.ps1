# Build the backend image, push it to Artifact Registry, and roll it out with
# Terraform (API + sync job). Run from anywhere:
#
#   powershell -ExecutionPolicy Bypass -File infra\deploy.ps1
#
# Needs: Docker Desktop running, gcloud signed in, `terraform apply` done once.

$ErrorActionPreference = "Stop"

function Invoke-Checked([string]$what, [scriptblock]$cmd) {
    & $cmd
    if ($LASTEXITCODE -ne 0) { throw "$what failed (exit code $LASTEXITCODE)" }
}

Push-Location $PSScriptRoot
try {
    $repo = (terraform output -raw image_repo)
    if ($LASTEXITCODE -ne 0 -or -not $repo) { throw "Run 'terraform apply' once before deploying." }
    $registry = $repo.Split("/")[0]

    # Unique per build, so Cloud Run always sees a new image (even for
    # uncommitted changes) and old images stay identifiable.
    $tag = "$(git rev-parse --short HEAD)-$(Get-Date -Format yyyyMMddHHmmss)"
    $image = "$repo/api:$tag"

    Invoke-Checked "Docker login" { gcloud auth configure-docker $registry --quiet }
    Invoke-Checked "Image build" { docker build --platform linux/amd64 -t $image ..\backend }
    Invoke-Checked "Image push" { docker push $image }
    Invoke-Checked "Terraform apply" { terraform apply -var "image=$image" }

    Write-Host ""
    Write-Host "Deployed $image"
    Write-Host "API: $(terraform output -raw api_url)"
}
finally {
    Pop-Location
}

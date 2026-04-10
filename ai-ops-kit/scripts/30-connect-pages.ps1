param(
  [string]$ConfigPath = "./ai-ops-kit/project.config.example.json",
  [string]$OwnerId = "",
  [string]$RepoId = ""
)

. "$PSScriptRoot/common.ps1"

$repoRoot = Get-RepoRoot
Set-Location $repoRoot
$config = Load-JsonConfig -Path (Resolve-Path $ConfigPath)
$statePath = Ensure-StateFile -RepoRoot $repoRoot -Config $config

$accountId = $config.cloudflare.accountId
$projectName = $config.cloudflare.pagesProject
$owner = $config.git.owner
$repo = $config.git.repo
$branch = $config.git.defaultBranch

Write-Step "Checking Cloudflare Pages Git connection"
$reposResp = Invoke-CfApi -Method "GET" -AccountId $accountId -Path "pages/connections/github/$owner/repos?page=1&per_page=100"
if (-not $reposResp.success) {
  throw "Cloudflare Pages Git connection is not ready. Reconnect GitHub in Cloudflare dashboard."
}

$repoEntry = $reposResp.result | Where-Object { $_.repo_name -eq $repo } | Select-Object -First 1
if (-not $repoEntry) {
  throw "Repo $owner/$repo not found in Cloudflare Pages Git connections."
}
Write-Ok "Git connection ready for $owner/$repo"

if (-not $RepoId) { $RepoId = $repoEntry.repo_id }
if (-not $OwnerId) { $OwnerId = Ensure-GitHubOwnerId -Owner $owner }

Write-Step "Ensuring Pages project exists"
$projectExists = $false
try {
  $existing = Invoke-CfApi -Method "GET" -AccountId $accountId -Path "pages/projects/$projectName"
  if ($existing.success -and $existing.result.name -eq $projectName) {
    $projectExists = $true
    Write-Ok "Pages project already exists: $projectName"
  }
} catch {}

if (-not $projectExists) {
  $createBody = @{
    name = $projectName
    production_branch = $branch
    build_config = @{
      build_command = $config.build.command
      destination_dir = $config.build.outputDir
      root_dir = $config.build.rootDir
    }
    source = @{
      type = "github"
      config = @{
        owner = $owner
        owner_id = $OwnerId
        repo_name = $repo
        repo_id = "$RepoId"
        production_branch = $branch
        deployments_enabled = $true
        production_deployments_enabled = $true
        pr_comments_enabled = $false
        preview_deployment_setting = "all"
      }
    }
  }
  $createResp = Invoke-CfApi -Method "POST" -AccountId $accountId -Path "pages/projects" -Body $createBody
  if (-not $createResp.success) { throw "Failed to create Pages project." }
  Write-Ok "Pages project created: $projectName"
}

Write-Step "Syncing Pages build config"
$buildPatchBody = @{
  production_branch = $branch
  build_config = @{
    build_command = $config.build.command
    destination_dir = $config.build.outputDir
    root_dir = $config.build.rootDir
  }
}
$buildPatchResp = Invoke-CfApi -Method "PATCH" -AccountId $accountId -Path "pages/projects/$projectName" -Body $buildPatchBody
if (-not $buildPatchResp.success) { throw "Failed to patch Pages build config." }
Write-Ok "Pages build config synced"

Write-Step "Setting Pages env variable for API base"
$state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
$apiBase = $state.cloudflare.workerUrl
if (-not $apiBase) {
  $apiBase = $config.verify.apiUrl
}
if (-not $apiBase) {
  throw "Cannot set VITE_API_BASE. Missing Worker URL in state/config."
}

$envName = $config.app.apiBaseEnvName
$patchBody = @{
  deployment_configs = @{
    production = @{
      env_vars = @{
        $envName = @{
          type = "plain_text"
          value = $apiBase
        }
      }
    }
    preview = @{
      env_vars = @{
        $envName = @{
          type = "plain_text"
          value = $apiBase
        }
      }
    }
  }
}
$patchResp = Invoke-CfApi -Method "PATCH" -AccountId $accountId -Path "pages/projects/$projectName" -Body $patchBody
if (-not $patchResp.success) { throw "Failed to patch Pages environment variables." }

$pagesUrl = "https://$projectName.pages.dev"
$state.cloudflare.pagesUrl = $pagesUrl
Save-Json -Data $state -Path $statePath
Update-State -StatePath $statePath -Step "pagesConnect" -Status "done" -Note "Pages project connected and env set"
Write-Ok "Pages connected: $pagesUrl"

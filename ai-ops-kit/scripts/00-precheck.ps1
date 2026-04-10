param(
  [string]$ConfigPath = "./ai-ops-kit/project.config.example.json"
)

. "$PSScriptRoot/common.ps1"

$repoRoot = Get-RepoRoot
Set-Location $repoRoot
$config = Load-JsonConfig -Path (Resolve-Path $ConfigPath)
$statePath = Ensure-StateFile -RepoRoot $repoRoot -Config $config

Write-Step "Checking local tooling"
Assert-Command -Name "node" -Required | Out-Null
Assert-Command -Name "npm" -Required | Out-Null
Assert-Command -Name "npx" -Required | Out-Null
Assert-Command -Name "git" -Required | Out-Null
$hasGh = Assert-Command -Name "gh"
Write-Ok "Core commands are available"

Write-Step "Checking Cloudflare auth"
try {
  $who = npx wrangler whoami --json | ConvertFrom-Json
  if (-not $who.email) { throw "wrangler whoami returned empty profile." }
  Write-Ok "Cloudflare login: $($who.email)"
} catch {
  Update-State -StatePath $statePath -Step "precheck" -Status "failed" -Note "Cloudflare auth failed"
  throw "Cloudflare not authenticated. Run: npx wrangler login"
}

Write-Step "Checking GitHub auth"
if ($hasGh) {
  try {
    gh auth status 1>$null 2>$null
    if ($LASTEXITCODE -eq 0) {
      Write-Ok "GitHub auth is ready"
    } else {
      Write-WarnLine "GitHub auth missing (run: gh auth login)"
    }
  } catch {
    Write-WarnLine "GitHub auth check failed (run: gh auth login)"
  }
} else {
  Write-WarnLine "gh is missing. Install GitHub CLI for full automation."
}

Update-State -StatePath $statePath -Step "precheck" -Status "done" -Note "Precheck completed"
Write-Ok "Precheck finished"

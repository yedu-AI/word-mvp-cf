Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-RepoRoot {
  param([string]$StartPath = (Get-Location).Path)
  try {
    $root = git -C $StartPath rev-parse --show-toplevel 2>$null
    if ($LASTEXITCODE -eq 0 -and $root) { return $root.Trim() }
  } catch {}
  return $StartPath
}

function Write-Step {
  param([string]$Message)
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Ok {
  param([string]$Message)
  Write-Host "OK  $Message" -ForegroundColor Green
}

function Write-WarnLine {
  param([string]$Message)
  Write-Host "WARN $Message" -ForegroundColor Yellow
}

function Assert-Command {
  param([string]$Name, [switch]$Required)
  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  if ($cmd) { return $true }
  if ($Required) { throw "Missing command: $Name" }
  Write-WarnLine "Command not found: $Name"
  return $false
}

function Load-JsonConfig {
  param([Parameter(Mandatory=$true)][string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) { throw "Config not found: $Path" }
  return (Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json)
}

function Save-Json {
  param([Parameter(Mandatory=$true)]$Data, [Parameter(Mandatory=$true)][string]$Path)
  $json = $Data | ConvertTo-Json -Depth 50
  Set-Content -LiteralPath $Path -Encoding UTF8 -Value $json
}

function Ensure-StateFile {
  param(
    [Parameter(Mandatory=$true)][string]$RepoRoot,
    [Parameter(Mandatory=$true)]$Config
  )
  $statePath = Join-Path $RepoRoot "ai-ops-kit/STATE.json"
  if (-not (Test-Path -LiteralPath $statePath)) {
    $tplPath = Join-Path $RepoRoot "ai-ops-kit/STATE.template.json"
    if (-not (Test-Path -LiteralPath $tplPath)) { throw "Missing template: $tplPath" }
    Copy-Item -LiteralPath $tplPath -Destination $statePath -Force
  }

  $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
  $state.projectName = $Config.projectName
  $state.git.owner = $Config.git.owner
  $state.git.repo = $Config.git.repo
  $state.git.defaultBranch = $Config.git.defaultBranch
  $state.cloudflare.accountId = $Config.cloudflare.accountId
  $state.cloudflare.workerName = $Config.cloudflare.workerName
  $state.cloudflare.pagesProject = $Config.cloudflare.pagesProject
  $state.cloudflare.d1Name = $Config.cloudflare.d1Name
  $state.updatedAt = (Get-Date).ToString("s")
  Save-Json -Data $state -Path $statePath
  return $statePath
}

function Update-State {
  param(
    [Parameter(Mandatory=$true)][string]$StatePath,
    [Parameter(Mandatory=$true)][string]$Step,
    [Parameter(Mandatory=$true)][string]$Status,
    [string]$Note = ""
  )
  $state = Get-Content -LiteralPath $StatePath -Raw | ConvertFrom-Json
  $state.updatedAt = (Get-Date).ToString("s")
  if (-not ($state.status.PSObject.Properties.Name -contains $Step)) {
    $state.status | Add-Member -NotePropertyName $Step -NotePropertyValue $Status
  }
  $state.status.$Step = $Status
  if ($Note) { $state.notes += "$((Get-Date).ToString('s')) ${Step}: $Note" }
  Save-Json -Data $state -Path $StatePath
}

function Get-WranglerOAuthToken {
  if ($env:CLOUDFLARE_API_TOKEN) { return $env:CLOUDFLARE_API_TOKEN }

  $candidatePaths = @(
    "$env:USERPROFILE\.wrangler\config\default.toml",
    "$env:APPDATA\xdg.config\.wrangler\config\default.toml",
    "$env:USERPROFILE\AppData\Roaming\xdg.config\.wrangler\config\default.toml"
  )

  foreach ($path in $candidatePaths) {
    if (-not (Test-Path -LiteralPath $path)) { continue }
    $line = Get-Content -LiteralPath $path | Where-Object { $_ -match '^oauth_token\s*=' } | Select-Object -First 1
    if (-not $line) { continue }
    if ($line -match '"([^"]+)"') { return $Matches[1] }
  }

  throw "Cloudflare token not found. Run `npx wrangler login` or set CLOUDFLARE_API_TOKEN."
}

function Invoke-CfApi {
  param(
    [Parameter(Mandatory=$true)][string]$Method,
    [Parameter(Mandatory=$true)][string]$AccountId,
    [Parameter(Mandatory=$true)][string]$Path,
    [object]$Body = $null
  )
  $token = Get-WranglerOAuthToken
  $headers = @{
    Authorization = "Bearer $token"
    "Content-Type" = "application/json"
  }
  $uri = "https://api.cloudflare.com/client/v4/accounts/$AccountId/$Path"
  if ($Body -eq $null) {
    return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers
  }
  $json = $Body | ConvertTo-Json -Depth 30
  return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers -Body $json
}

function Ensure-GitHubRepoId {
  param(
    [Parameter(Mandatory=$true)][string]$Owner,
    [Parameter(Mandatory=$true)][string]$Repo
  )
  if (-not (Assert-Command -Name "gh")) {
    throw "gh is required to discover repo_id. Install gh or pass repo_id manually in script extension."
  }
  $raw = gh api "/repos/$Owner/$Repo" 2>$null
  if (-not $raw) { throw "Unable to fetch repo info via gh for $Owner/$Repo" }
  return ((ConvertFrom-Json $raw).id.ToString())
}

function Ensure-GitHubOwnerId {
  param([Parameter(Mandatory=$true)][string]$Owner)
  if (-not (Assert-Command -Name "gh")) {
    throw "gh is required to discover owner_id. Install gh or pass owner_id manually in script extension."
  }
  $raw = gh api "/users/$Owner" 2>$null
  if (-not $raw) { throw "Unable to fetch owner info via gh for $Owner" }
  return ((ConvertFrom-Json $raw).id.ToString())
}

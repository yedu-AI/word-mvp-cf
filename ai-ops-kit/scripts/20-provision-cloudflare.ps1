param(
  [string]$ConfigPath = "./ai-ops-kit/project.config.example.json"
)

. "$PSScriptRoot/common.ps1"

$repoRoot = Get-RepoRoot
Set-Location $repoRoot
$config = Load-JsonConfig -Path (Resolve-Path $ConfigPath)
$statePath = Ensure-StateFile -RepoRoot $repoRoot -Config $config

$workerDir = Join-Path $repoRoot "apps/api"
$wranglerPath = Join-Path $workerDir "wrangler.toml"
$d1Name = $config.cloudflare.d1Name
$workerName = $config.cloudflare.workerName

Write-Step "Provisioning Cloudflare D1 database"

$dbId = $null
try {
  $infoRaw = npx wrangler d1 info $d1Name --json 2>$null
  if ($LASTEXITCODE -eq 0 -and $infoRaw) {
    $info = $infoRaw | ConvertFrom-Json
    $dbId = $info.uuid
    Write-Ok "D1 exists: $d1Name ($dbId)"
  }
} catch {}

if (-not $dbId) {
  npx wrangler d1 create $d1Name | Out-Host
  $infoRaw = npx wrangler d1 info $d1Name --json
  if ($LASTEXITCODE -ne 0 -or -not $infoRaw) { throw "D1 created but unable to query info for database_id." }
  $dbId = (($infoRaw | ConvertFrom-Json).uuid)
  if (-not $dbId) { throw "D1 created but uuid is empty." }
  Write-Ok "D1 created: $d1Name ($dbId)"
}

Write-Step "Updating wrangler.toml with D1 database_id"
$wranglerText = Get-Content -LiteralPath $wranglerPath -Raw
$wranglerText = [Regex]::Replace($wranglerText, 'database_name\s*=\s*".*?"', "database_name = `"$d1Name`"")
$wranglerText = [Regex]::Replace($wranglerText, 'database_id\s*=\s*".*?"', "database_id = `"$dbId`"")
Set-Content -LiteralPath $wranglerPath -Value $wranglerText -Encoding UTF8
Write-Ok "wrangler.toml updated"

Write-Step "Applying remote migrations"
npx wrangler d1 migrations apply $d1Name --remote --config $wranglerPath | Out-Host
Write-Ok "Remote migrations applied"

Write-Step "Setting JWT secret"
$bytes = New-Object byte[] 48
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$secret = [Convert]::ToBase64String($bytes)
$secret | npx wrangler secret put JWT_SECRET --name $workerName --config $wranglerPath | Out-Host
Write-Ok "JWT_SECRET configured"

Write-Step "Deploying Worker"
$deployOut = (npx wrangler deploy --config $wranglerPath 2>&1 | Out-String)
$workerUrl = ""
if ($deployOut -match 'https://[a-zA-Z0-9\.-]+\.workers\.dev') {
  $workerUrl = $Matches[0]
  Write-Ok "Worker deployed: $workerUrl"
} else {
  try {
    $subdomainResp = Invoke-CfApi -Method "GET" -AccountId $config.cloudflare.accountId -Path "workers/subdomain"
    if ($subdomainResp.success -and $subdomainResp.result.subdomain) {
      $workerUrl = "https://$workerName.$($subdomainResp.result.subdomain).workers.dev"
      Write-Ok "Worker URL derived from account subdomain: $workerUrl"
    } else {
      Write-WarnLine "Worker deployed but URL not resolved."
    }
  } catch {
    Write-WarnLine "Worker deployed but URL not resolved."
  }
}

if ($workerUrl) {
  Write-Step "Verifying deployed Worker health"
  $healthOk = $false
  for ($i = 1; $i -le 10; $i++) {
    try {
      $health = Invoke-RestMethod -Method Get -Uri "$workerUrl/health" -TimeoutSec 10
      if ($health.ok) {
        $healthOk = $true
        Write-Ok "Health check passed: $workerUrl/health"
        break
      }
    } catch {}

    Start-Sleep -Seconds 3
  }

  if (-not $healthOk) {
    throw "Worker deployed but health check did not pass: $workerUrl/health"
  }
}

$state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
$state.cloudflare.d1DatabaseId = $dbId
if ($workerUrl) { $state.cloudflare.workerUrl = $workerUrl }
Save-Json -Data $state -Path $statePath
Update-State -StatePath $statePath -Step "provision" -Status "done" -Note "D1 and Worker provisioned"

Write-Ok "Provision finished"

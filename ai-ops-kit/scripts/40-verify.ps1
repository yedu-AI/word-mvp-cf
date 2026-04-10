param(
  [string]$ConfigPath = "./ai-ops-kit/project.config.example.json",
  [switch]$SkipWebCheck
)

. "$PSScriptRoot/common.ps1"

$repoRoot = Get-RepoRoot
Set-Location $repoRoot
$config = Load-JsonConfig -Path (Resolve-Path $ConfigPath)
$statePath = Ensure-StateFile -RepoRoot $repoRoot -Config $config
$state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json

$apiUrl = $state.cloudflare.workerUrl
if (-not $apiUrl) { $apiUrl = $config.verify.apiUrl }
$webUrl = $state.cloudflare.pagesUrl
if (-not $webUrl) { $webUrl = $config.verify.webUrl }
$username = $config.verify.username
$password = $config.verify.password

if (-not $apiUrl) {
  throw "Missing apiUrl for verification."
}

Write-Step "Verifying API health"
$health = Invoke-RestMethod -Method Get -Uri "$apiUrl/health"
if (-not $health.ok) { throw "Health check failed at $apiUrl/health" }
Write-Ok "API health check passed"

if (-not $SkipWebCheck) {
  if (-not $webUrl) {
    throw "Missing webUrl for verification. Use -SkipWebCheck or provide verify.webUrl."
  }

  Write-Step "Verifying web homepage"
  $webResp = Invoke-WebRequest -Method Get -Uri $webUrl -UseBasicParsing
  if ($webResp.StatusCode -ne 200) { throw "Web status is not 200: $($webResp.StatusCode)" }
  Write-Ok "Web status: 200"
}

Write-Step "Verifying login success"
$loginBody = @{ username = $username; password = $password } | ConvertTo-Json
$loginResp = Invoke-RestMethod -Method Post -Uri "$apiUrl/api/auth/login" -ContentType "application/json" -Body $loginBody
if (-not $loginResp.token) { throw "Login response missing token" }
Write-Ok "Login success path passed"

Write-Step "Verifying login failure"
$invalidBody = @{ username = $username; password = "$password#invalid" } | ConvertTo-Json
try {
  Invoke-RestMethod -Method Post -Uri "$apiUrl/api/auth/login" -ContentType "application/json" -Body $invalidBody | Out-Null
  throw "Invalid password unexpectedly succeeded"
} catch {
  $statusCode = $null
  try {
    $statusCode = [int]$_.Exception.Response.StatusCode
  } catch {}

  if ($statusCode -ne 401) {
    throw "Expected 401 on invalid credentials, got: $statusCode"
  }
}
Write-Ok "Login failure path passed"

Write-Step "Verifying login payload validation"
$payloadBody = @{ username = $username } | ConvertTo-Json
try {
  Invoke-RestMethod -Method Post -Uri "$apiUrl/api/auth/login" -ContentType "application/json" -Body $payloadBody | Out-Null
  throw "Invalid payload unexpectedly succeeded"
} catch {
  $statusCode = $null
  try {
    $statusCode = [int]$_.Exception.Response.StatusCode
  } catch {}

  if ($statusCode -ne 400) {
    throw "Expected 400 on invalid payload, got: $statusCode"
  }
}
Write-Ok "Login payload validation path passed"

Update-State -StatePath $statePath -Step "verify" -Status "done" -Note "Health + auth verification passed"

Write-Host ""
Write-Host "Verification Summary" -ForegroundColor Cyan
Write-Host "API: $apiUrl"
if (-not $SkipWebCheck) { Write-Host "WEB: $webUrl" }
Write-Host "User: $($loginResp.user.id) ($($loginResp.user.role))"

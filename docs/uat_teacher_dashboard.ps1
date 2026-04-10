param(
  [string]$WebUrl = "http://127.0.0.1:5173/src/teacher/index.html",
  [string]$ApiBase = "http://127.0.0.1:8787",
  [string]$TeacherUsername = "",
  [string]$TeacherPassword = ""
)

$ErrorActionPreference = "Stop"
$failed = @()

function Pass([string]$name) {
  Write-Host "[PASS] $name" -ForegroundColor Green
}

function Fail([string]$name, [string]$reason) {
  Write-Host "[FAIL] $name - $reason" -ForegroundColor Red
  $script:failed += "${name}: $reason"
}

try {
  $webResp = Invoke-WebRequest -Uri $WebUrl -UseBasicParsing -TimeoutSec 8
  $hasRoot = $webResp.Content -match 'id="root"'
  $hasEntry = $webResp.Content -match "main.tsx"
  if ($webResp.StatusCode -eq 200 -and $hasRoot -and $hasEntry) {
    Pass "teacher-page-available"
  } else {
    Fail "teacher-page-available" "status=$($webResp.StatusCode) or page markers missing"
  }
} catch {
  Fail "teacher-page-available" $_.Exception.Message
}

try {
  $ping = Invoke-RestMethod -Uri "$ApiBase/api/auth/ping" -Method Get -TimeoutSec 8
  if ($ping.ok -eq $true) {
    Pass "api-auth-ping"
  } else {
    Fail "api-auth-ping" "unexpected response body"
  }
} catch {
  Fail "api-auth-ping" $_.Exception.Message
}

if ($TeacherUsername -and $TeacherPassword) {
  try {
    $body = @{
      username = $TeacherUsername
      password = $TeacherPassword
    } | ConvertTo-Json

    $login = Invoke-RestMethod -Uri "$ApiBase/api/auth/login" -Method Post -ContentType "application/json" -Body $body -TimeoutSec 8
    if (-not $login.token) {
      Fail "teacher-login" "token missing"
    } elseif ($login.user.role -ne "teacher" -and $login.user.role -ne "admin") {
      Fail "teacher-login" "role=$($login.user.role), expected teacher/admin"
    } else {
      Pass "teacher-login"
    }
  } catch {
    Fail "teacher-login" $_.Exception.Message
  }
} else {
  Write-Host "[SKIP] teacher-login (TeacherUsername/TeacherPassword not provided)" -ForegroundColor Yellow
}

if ($failed.Count -eq 0) {
  Write-Host ""
  Write-Host "UAT RESULT: GO-LIVE READY (script checks all passed)" -ForegroundColor Green
  exit 0
}

Write-Host ""
Write-Host "UAT RESULT: NOT READY (failed checks found)" -ForegroundColor Red
$failed | ForEach-Object { Write-Host ("- {0}" -f $_) -ForegroundColor Red }
exit 1

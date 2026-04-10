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

Write-Step "Applying local D1 migrations (pass 1)"
npx wrangler d1 migrations apply $d1Name --local --config $wranglerPath | Out-Host
if ($LASTEXITCODE -ne 0) { throw "Local migration pass 1 failed" }

Write-Step "Applying local D1 migrations again (pass 2 / replay check)"
npx wrangler d1 migrations apply $d1Name --local --config $wranglerPath | Out-Host
if ($LASTEXITCODE -ne 0) { throw "Local migration pass 2 failed" }

Write-Step "Checking required tables in local D1"
$schemaRaw = npx wrangler d1 execute $d1Name --local --config $wranglerPath --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;" | Out-String
$jsonStart = $schemaRaw.IndexOf("[")
if ($jsonStart -lt 0) {
  throw "Unable to parse local schema output."
}
$schemaJson = $schemaRaw.Substring($jsonStart)
$schema = $schemaJson | ConvertFrom-Json
$tableNames = @($schema[0].results | ForEach-Object { $_.name })
$requiredTables = @("users", "words", "learning_records", "daily_tasks", "reading_tasks")
foreach ($table in $requiredTables) {
  if ($tableNames -notcontains $table) {
    throw "Missing table after migrations: $table"
  }
}
Write-Ok "Required tables are present"

Update-State -StatePath $statePath -Step "migrationReplay" -Status "done" -Note "Local D1 migration replay check passed"
Write-Ok "Local migration replay verification finished"

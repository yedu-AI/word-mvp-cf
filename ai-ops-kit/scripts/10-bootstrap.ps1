param(
  [string]$ConfigPath = "./ai-ops-kit/project.config.example.json"
)

. "$PSScriptRoot/common.ps1"

$repoRoot = Get-RepoRoot
Set-Location $repoRoot
$config = Load-JsonConfig -Path (Resolve-Path $ConfigPath)
$statePath = Ensure-StateFile -RepoRoot $repoRoot -Config $config

Write-Step "Bootstrapping project metadata"

# Root package name
$rootPackagePath = Join-Path $repoRoot "package.json"
$rootPackage = Get-Content -LiteralPath $rootPackagePath -Raw | ConvertFrom-Json
$rootPackage.name = $config.projectName
if ($rootPackage.scripts."dev:api") { $rootPackage.scripts."dev:api" = "npm run dev -w @$($config.projectName)/api" }
if ($rootPackage.scripts."dev:web") { $rootPackage.scripts."dev:web" = "npm run dev -w @$($config.projectName)/web" }
Save-Json -Data $rootPackage -Path $rootPackagePath
Write-Ok "Updated root package name to $($config.projectName)"

# API package name
$apiPackagePath = Join-Path $repoRoot "apps/api/package.json"
$apiPackage = Get-Content -LiteralPath $apiPackagePath -Raw | ConvertFrom-Json
$apiPackage.name = "@$($config.projectName)/api"
if ($apiPackage.scripts."drizzle:migrate:local") {
  $apiPackage.scripts."drizzle:migrate:local" = "wrangler d1 migrations apply $($config.cloudflare.d1Name) --local"
}
if ($apiPackage.scripts."drizzle:migrate:remote") {
  $apiPackage.scripts."drizzle:migrate:remote" = "wrangler d1 migrations apply $($config.cloudflare.d1Name) --remote"
}
Save-Json -Data $apiPackage -Path $apiPackagePath
Write-Ok "Updated API workspace metadata"

# Web package name
$webPackagePath = Join-Path $repoRoot "apps/web/package.json"
$webPackage = Get-Content -LiteralPath $webPackagePath -Raw | ConvertFrom-Json
$webPackage.name = "@$($config.projectName)/web"
Save-Json -Data $webPackage -Path $webPackagePath
Write-Ok "Updated Web workspace metadata"

# Wrangler name + database name reset
$wranglerPath = Join-Path $repoRoot "apps/api/wrangler.toml"
$wranglerText = Get-Content -LiteralPath $wranglerPath -Raw
$wranglerText = [Regex]::Replace($wranglerText, 'name\s*=\s*".*?"', "name = `"$($config.cloudflare.workerName)`"", 1)
$wranglerText = [Regex]::Replace($wranglerText, 'database_name\s*=\s*".*?"', "database_name = `"$($config.cloudflare.d1Name)`"")
$wranglerText = [Regex]::Replace($wranglerText, 'database_id\s*=\s*".*?"', 'database_id = "00000000-0000-0000-0000-000000000000"')
Set-Content -LiteralPath $wranglerPath -Value $wranglerText -Encoding UTF8
Write-Ok "Updated wrangler.toml placeholders"

# Ensure .env.local exists in web app
$webEnvLocalPath = Join-Path $repoRoot "apps/web/.env.local"
if (-not (Test-Path -LiteralPath $webEnvLocalPath)) {
  Set-Content -LiteralPath $webEnvLocalPath -Encoding UTF8 -Value "VITE_API_BASE=http://127.0.0.1:8787"
  Write-Ok "Created apps/web/.env.local"
}

Update-State -StatePath $statePath -Step "bootstrap" -Status "done" -Note "Bootstrap completed"
Write-Ok "Bootstrap finished"

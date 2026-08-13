# Deploys hubspot-sync-sbx and injects worker env from repo .env.local.
# Does not print secret values.
param(
  [string]$Profile = "hubspot-sync-sbx",
  [string]$Region = "us-east-1",
  [string]$StackName = "hubspot-sync-sbx"
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$envFile = Join-Path $repoRoot ".env.local"

if (-not (Test-Path $envFile)) {
  throw ".env.local not found at $envFile"
}

function Get-DotEnvValue([string]$path, [string]$key) {
  $line = Get-Content $path | Where-Object { $_ -match "^$key=" } | Select-Object -First 1
  if (-not $line) { return "" }
  return $line.Substring($key.Length + 1).Trim().Trim('"').Trim("'")
}

$supabaseUrl = Get-DotEnvValue $envFile "NEXT_PUBLIC_SUPABASE_URL"
$supabaseKey = Get-DotEnvValue $envFile "SUPABASE_SERVICE_ROLE_KEY"
$tokenKey = Get-DotEnvValue $envFile "TOKEN_ENCRYPTION_KEY"
$hsId = Get-DotEnvValue $envFile "HUBSPOT_CLIENT_ID"
$hsSecret = Get-DotEnvValue $envFile "HUBSPOT_CLIENT_SECRET"
$appUrl = Get-DotEnvValue $envFile "NEXT_PUBLIC_APP_URL"

if (-not $supabaseUrl -or -not $supabaseKey -or -not $tokenKey -or -not $hsId -or -not $hsSecret) {
  throw "Missing one of NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TOKEN_ENCRYPTION_KEY, HUBSPOT_CLIENT_ID, HUBSPOT_CLIENT_SECRET in .env.local"
}

Write-Host "Loaded worker env from .env.local (values not printed)."
Write-Host "Building SAM..."

$env:PATH = (Join-Path $repoRoot "node_modules\.bin") + ";" + $env:PATH
Set-Location $PSScriptRoot
sam build
if ($LASTEXITCODE -ne 0) { throw "sam build failed" }

$overrides = @(
  "ResourcePrefix=hubspot-sync-sbx",
  "EnvironmentName=sandbox",
  "SupabaseUrl=$supabaseUrl",
  "SupabaseServiceRoleKey=$supabaseKey",
  "TokenEncryptionKey=$tokenKey",
  "HubspotClientId=$hsId",
  "HubspotClientSecret=$hsSecret",
  "AppUrl=$appUrl"
) -join " "

Write-Host "Deploying stack $StackName to $Region (parameter values hidden)..."
sam deploy `
  --profile $Profile `
  --region $Region `
  --stack-name $StackName `
  --capabilities CAPABILITY_IAM `
  --resolve-s3 `
  --no-confirm-changeset `
  --no-fail-on-empty-changeset `
  --parameter-overrides $overrides

if ($LASTEXITCODE -ne 0) { throw "sam deploy failed" }
Write-Host "Deploy complete."

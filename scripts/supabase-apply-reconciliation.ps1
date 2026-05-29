$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

$files = @(
  "migration_reconciliation_biblioteca_seed.sql",
  "migration_reconciliation_rpc.sql"
)

foreach ($name in $files) {
  $path = Join-Path "supabase" $name
  Write-Host ">> $name"
  supabase db query --linked -f $path
  if ($LASTEXITCODE -ne 0) {
    throw "Falló: $name"
  }
}

Write-Host "OK - migraciones reconciliación aplicadas."

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

$files = @(
  "migration_reportes_quemado.sql",
  "migration_unique_nomina_registros.sql",
  "migration_fix_stock_trigger.sql",
  "migration_fix_rpc_grants.sql",
  "migration_fix_indexes.sql",
  "migration_optimize_rpc_rentabilidad.sql"
)

foreach ($name in $files) {
  $path = Join-Path "supabase" $name
  if (-not (Test-Path $path)) {
    throw "No existe: $path"
  }
  Write-Host ">>> $name ..." -NoNewline
  supabase db query --linked -f $path
  if ($LASTEXITCODE -ne 0) {
    throw "Falló: $name (exit $LASTEXITCODE)"
  }
  Write-Host " OK"
}

Write-Host "`n✅ 6 migraciones aplicadas correctamente."

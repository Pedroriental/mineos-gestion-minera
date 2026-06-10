# Permite carga_total = 0 en reportes_acarreo (informes incompletos).
# Requisitos: supabase login + supabase link (npm run supabase:link)

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

$path = Join-Path "supabase" "migration_informes_borrador.sql"
if (-not (Test-Path $path)) {
  throw "No existe: $path"
}

Write-Host ">> migration_informes_borrador.sql"
supabase db query --linked --yes -f $path
if ($LASTEXITCODE -ne 0) {
  throw "Falló migration_informes_borrador.sql (exit $LASTEXITCODE)"
}

Write-Host "OK - informes de acarreo pueden guardarse con carga 0."

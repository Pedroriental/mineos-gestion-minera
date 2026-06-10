# Crea el bucket público "reportes" en Supabase Storage.
# Requisitos: supabase login + supabase link (npm run supabase:link)

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

$path = Join-Path "supabase" "migration_reportes_storage.sql"
if (-not (Test-Path $path)) {
  throw "No existe: $path"
}

Write-Host ">> migration_reportes_storage.sql"
supabase db query --linked --yes -f $path
if ($LASTEXITCODE -ne 0) {
  throw "Falló migration_reportes_storage.sql (exit $LASTEXITCODE)"
}

Write-Host "OK - bucket reportes listo para fotos de informes."

# Aplica migration_acarreo_fotos.sql al proyecto Supabase enlazado.
# Requisitos: supabase login + supabase link (npm run supabase:link)

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

$path = Join-Path "supabase" "migration_acarreo_fotos.sql"
if (-not (Test-Path $path)) {
  throw "No existe: $path"
}

Write-Host ">> migration_acarreo_fotos.sql"
supabase db query --linked --yes -f $path
if ($LASTEXITCODE -ne 0) {
  throw "Falló migration_acarreo_fotos.sql (exit $LASTEXITCODE)"
}

Write-Host "OK - columna reportes_acarreo.fotos lista."

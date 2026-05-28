# Aplica migraciones de Plataforma (fiscal + biblioteca) al proyecto enlazado.
# Requisitos: supabase login, supabase link, y SUPABASE_DB_PASSWORD o contraseña al enlazar.

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

$files = @(
  "migration_personal_ubicacion_laboral.sql",
  "migration_datos_fiscales.sql",
  "migration_biblioteca_variables.sql",
  "migration_biblioteca_variables_ext.sql"
)

foreach ($name in $files) {
  $path = Join-Path "supabase" $name
  if (-not (Test-Path $path)) {
    throw "No existe: $path"
  }
  Write-Host ">> $name"
  supabase db query --linked -f $path
  if ($LASTEXITCODE -ne 0) {
    throw "Falló: $name (exit $LASTEXITCODE)"
  }
}

Write-Host "OK - migraciones de plataforma aplicadas."

# Aplica migraciones de plantillas de rotación (diseño + cuadrillas + operativa)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

$files = @(
  "supabase/migration_rotacion_plantillas.sql",
  "supabase/migration_rotacion_plantillas_cuadrillas.sql",
  "supabase/migration_rotacion_operativa.sql",
  "supabase/migration_rotacion_periodos.sql",
  "supabase/migration_rotacion_semanas_unique_cuadrilla.sql",
  "supabase/migration_rotacion_plantilla_columnas_vista.sql",
  "supabase/migration_rotacion_cuadrilla_columnas_vista.sql",
  "supabase/migration_rotacion_bono_transporte_estatus.sql"
)

foreach ($f in $files) {
  Write-Host "Applying $f ..."
  supabase db query --linked -f $f
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host "Rotacion migrations applied."

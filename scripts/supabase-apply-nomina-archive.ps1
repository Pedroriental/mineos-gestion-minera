# Aplica migración V5 — archivo histórico de nómina
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

$sql = Join-Path $Root "supabase\migration_nomina_archive_v5.sql"
if (-not (Test-Path $sql)) {
  Write-Error "No se encontró $sql"
}

Write-Host "Aplicando migration_nomina_archive_v5.sql..."
Get-Content $sql -Raw | supabase db query --linked

$cierreMes = Join-Path $Root "supabase\migration_nomina_cierre_mes.sql"
if (Test-Path $cierreMes) {
  Write-Host "Aplicando migration_nomina_cierre_mes.sql..."
  Get-Content $cierreMes -Raw | supabase db query --linked
}

Write-Host "Listo."

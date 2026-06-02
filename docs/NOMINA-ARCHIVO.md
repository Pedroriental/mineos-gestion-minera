# Archivo e import histórico de nómina (MineOS V5)

## Flujos

### Operación semanal (sin cambios de uso)
- `/mina/nomina`, `/planta/nomina`, `/admin/nomina`
- Cierre V3 guarda snapshot en `nomina_registros.personal_snapshot`, bonificaciones, vales y `gasto_id`.

### Import histórico multi-semana
1. Ir a `/operaciones/nomina-importar`
2. Subir Excel (`.xlsx`) con matriz de semanas (como documento mayo 2026)
3. Revisar totales por sección e inferencia de rotación
4. Confirmar → crea `nomina_periodos`, `nomina_semanas`, `nomina_registros` con origen `import_historico`

### Archivo
- `/operaciones/nomina-archivo` — lista periodos y consolidación manual de semanas cerradas

### Vista previa
- `/operaciones/nomina-vista-previa` — semanas cerradas = archivo; futuro = proyección (`NominaEngine`)

## CLI (parse sin persistir)

```bash
npx tsx scripts/nomina-import-historico.ts ./nomina-mayo-2026.xlsx
```

## Migración Supabase

```bash
npm run supabase:migrate:nomina-archive
```

O aplicar manualmente `supabase/migration_nomina_archive_v5.sql`.

## Validación mayo 2026

Total esperado del documento de referencia: **USD 7.566,16** en cuatro bloques:
- Admin Molinos, Molinos, Admin Mina, Mina Belén

Tras import, la vista previa del rango 2026-05-04 — 2026-05-24 debe coincidir celda a celda.

# Sandbox — Plantillas de rotación (Nómina)

## UI

- **Modal:** botón **Rotación** en toolbar o pestaña **Plantillas Rotación** → **Abrir sandbox**
- **Columna izquierda:** nombre, descripción, semanas del ciclo, estatus por semana, personal
- **Columna derecha:** preview reactivo (`bg-white`) con matriz trabajador × semana y subtotales

## Presets

| Preset | Semanas |
|--------|---------|
| 14×14 | Libre pagada → Libre $0 → Trab 1 → Trab 2 |
| 2×1 | Libre → Trab 1 → Trab 2 |
| Molino 2×2 | Trab 1 → Trab 2 → Libre pag. → Libre $0 |
| Admin | Semana continua |

## Cierre semanal (reglas)

Implementado en `src/lib/rotacion-plantillas/semana-cierre.ts`:

- Cada semana del ciclo es un bloque aislado vinculable a `nomina_semanas`
- **No traspaso automático** a la siguiente semana hasta `CERRADA_AUDITADA`
- Subtotales (`subtotal_usd`, `subtotal_dias`, `subtotal_bonos`) exportables vía `buildBalanceExport()`

## Base de datos

Migración: `supabase/migration_rotacion_plantillas.sql`

## Cuadrillas (secciones)

Una plantilla puede incluir **varias cuadrillas**, cada una con su propio ciclo de semanas:

| Cuadrilla | Ejemplo patrón |
|-----------|----------------|
| Vertical 1, 2, 3 | 14×14 o 2×1 |
| Cocina | Semana continua |
| Administración | Semana continua |
| Técnicos | 2×1 |

Migración cuadrillas: `supabase/migration_rotacion_plantillas_cuadrillas.sql`

| Tabla | Propósito |
|-------|-----------|
| `rotacion_plantilla_cuadrillas` | Secciones dentro de la plantilla |
| `rotacion_plantilla_semanas` | Columnas/semanas del ciclo |
| `rotacion_plantilla_asignaciones` | Personal × semana (override opcional) |
| `rotacion_plantilla_instancias` | Ejecución activa del ciclo |
| `rotacion_instancia_semanas` | Cierre semanal + link `nomina_semanas` |

Aplicar:

```bash
supabase db query --linked -f supabase/migration_rotacion_plantillas.sql
supabase db query --linked -f supabase/migration_rotacion_plantillas_cuadrillas.sql
```

## Tests

```bash
npm run test:rotacion-plantillas
```

Operación en nómina: ver [ROTACION-PLANTILLAS-OPERATIVA.md](./ROTACION-PLANTILLAS-OPERATIVA.md)

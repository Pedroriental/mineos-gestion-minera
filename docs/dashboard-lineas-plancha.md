# Dashboard — Líneas de plancha dinámicas

Documento para el desarrollador que implemente o mantenga la configuración de **balances por plancha** en el Command Center (`/dashboard`).

## Objetivo

El rail **Indicadores consolidados** debe mostrar una tarjeta por cada línea de plancha **sin cambiar código** cuando el negocio agrega una plancha nueva. Los valores siguen siendo **datos reales** de `reportes_produccion` (módulo Producción → `/planta/produccion`), campo `oro_recuperado_g`, filtrados por el rango `desde` / `hasta` del selector global del topbar.

## Modelo de datos

### Tabla `lineas_plancha`

Migración: `supabase/migration_lineas_plancha.sql`

| Columna    | Tipo        | Descripción |
|-----------|-------------|-------------|
| `id`      | UUID        | PK |
| `numero`  | INTEGER     | Orden lógico / identificador numérico (único) |
| `nombre`  | VARCHAR     | Texto de la tarjeta, ej. `Balance plancha 4` |
| `molinos` | TEXT[]      | Molinos que suman a esta línea (mismo texto que en Producción) |
| `activo`  | BOOLEAN     | Solo filas `activo = true` se muestran |
| `orden`   | INTEGER     | Orden de visualización en el rail (ascendente) |

RLS: acceso completo para usuarios autenticados (mismo patrón que el resto del esquema).

### Semilla inicial

La migración inserta planchas 1–3 si la tabla está vacía:

- **Plancha 1:** Molino 1, 2, 3, 1-2, 1-3, 2-3, 1-2-3  
- **Plancha 2:** Molino Continuo  
- **Plancha 3:** Molino Coco  

## Código relevante

| Archivo | Rol |
|---------|-----|
| `src/lib/dashboard-planchas.ts` | `resolvePlanchaLines()` lee BD; `computePlanchaBalances()` agrupa oro por línea |
| `src/app/(app)/dashboard/page.tsx` | Carga reportes del periodo, resuelve líneas y arma `globalData.balancesPlanchas` |
| `src/components/dashboard/DashboardMetricsRail.tsx` | Renderiza tarjetas; `kpiRowCount` dinámico según cantidad de planchas |
| `src/components/dashboard/types.ts` | `PlanchaBalance` incluye `id` estable para React keys |

### Normalización de nombres de molino

`normalizeMolinoKey()` en `dashboard-planchas.ts` debe coincidir con lo que se escribe en Producción (insensible a mayúsculas, espacios). Ejemplos válidos en `molinos[]`:

- `Molino 1`, `Molino 1-2`, `Molino Continuo`, `Molino Coco`

### Respaldo (fallback)

Si la tabla no existe, falla la query o no hay filas activas, se usan las 3 líneas hardcodeadas en `FALLBACK_LINES` dentro de `dashboard-planchas.ts`.

### Molinos huérfanos (automático)

Si en el periodo hay reportes de un molino que **no** está en ningún `molinos[]` de `lineas_plancha`, el dashboard agrega una tarjeta extra:

- Label: `Balance {Molino X}`  
- `id`: `molino-{clave-normalizada}`  
- No requiere fila en BD; sirve hasta que operaciones definan la línea formal.

## Alta de una plancha nueva (operaciones / DBA)

1. Ejecutar migración en Supabase si no está aplicada.  
2. Insertar fila:

```sql
INSERT INTO lineas_plancha (numero, nombre, molinos, orden, activo)
VALUES (
  4,
  'Balance plancha 4',
  ARRAY['Molino 4', 'Molino 4-2'],  -- mismos strings que en reportes_produccion.molino
  4,
  true
);
```

3. Recargar `/dashboard` (revalidate del page: 60 s o hard refresh).

Para desactivar una línea sin borrarla: `UPDATE lineas_plancha SET activo = false WHERE numero = 4;`

## Trabajo sugerido para el desarrollador (UI de administración)

Pantalla recomendada (ej. bajo Administración o Molino):

- Listar `lineas_plancha` (orden, nombre, molinos, activo).  
- CRUD con validación: `numero` único, al menos un molino en el array.  
- Autocompletado de molinos desde `SELECT DISTINCT molino FROM reportes_produccion` (mismo patrón que `molinosSug` en `ProduccionGerencialClient.tsx`).  
- Opcional: arrastrar para cambiar `orden`.

No es obligatorio para que el dashboard funcione; hoy la configuración puede hacerse solo en Supabase.

## Qué no alimenta estos KPIs

- **Quemado de planchas** (`reportes_quemado`, `/mina/quemado`): planchas físicas por quemada (JSON `planchas[]`), distinto concepto. Si el negocio pide balances desde quemado, hay que definir regla de negocio y cambiar `computePlanchaBalances` o añadir fuente dual.  
- Los otros indicadores del rail tienen orígenes propios: `gastos`, `inventario_items`, `personal`, `reportes_voladuras` (ver `dashboard/page.tsx`).

## Comportamiento del layout

- Filas del rail: `1 (oro total) + N (planchas) + 4 (consumo, inventario, gastos periodo, personal)`.  
- `gridTemplateRows` se setea inline en `DashboardMetricsRail` con `kpiRowCount`.  
- Más planchas implican filas más bajas; validar en viewports bajos (sin scroll del panel si es requisito).

## Checklist de prueba

- [ ] Migración aplicada; existen 3 filas semilla.  
- [ ] Insertar plancha 4 → aparece tarjeta sin deploy.  
- [ ] Reporte en Producción con molino nuevo no listado → tarjeta huérfana temporal.  
- [ ] Asignar ese molino a una línea en BD → desaparece huérfana y suma en la línea correcta.  
- [ ] Cambiar rango de fechas en topbar → gramos de planchas cambian según `reportes_produccion.fecha`.  
- [ ] `activo = false` oculta la línea.

## Mapa — líneas de fusión entre nodos

Archivo: `src/lib/dashboard-node-connections.ts`

Las líneas amarillas **no** vienen de una lista fija en el componente. Se calculan con `deriveNodeConnectionPairs(locations)` a partir de los **nombres de molino** que existen en el mapa (nodos en `locations`, alimentados por `reportes_produccion` del periodo).

Reglas:

- Si existe un molino fusionado `Molino 1-3`, se enlaza con cada componente presente (`Molino 1`, `Molino 3`) y con los pasos intermedios de la cadena (`Molino 1` ↔ `Molino 1-3` ↔ `Molino 3`).
- Al registrar producción con un molino fusionado nuevo (ej. `Molino 2-3`), el nodo aparece en el mapa y las líneas se generan solas en la siguiente carga.
- **No** se dibuja línea directa entre `Molino 2` y `Molino 3` salvo que exista el nodo fusionado `Molino 2-3` (u otro fusionado que los una en la cadena).
- Sin selección: líneas tenues; al seleccionar un nodo: sus conexiones se resaltan.

### Nodos siempre visibles vs registrados

- Siempre en el mapa (aunque no tengan reportes en el periodo): Molino 1, 2, 3, Molino Continuo, Mantenimiento.
- Aparecen solo si hay reportes en Producción en el rango de fechas: molinos fusionados (`Molino 1-2`, `Molino 2-3`, etc.) y cualquier otro nombre de molino usado en un reporte.

Posición de las líneas: coordenadas `x`/`y` de cada nodo (`NODE_DICT` en `dashboard/page.tsx` o posición por defecto si el molino es nuevo).

## Contacto / contexto producto

Requisito de negocio: dashboard como vista **veraz y rápida**; las planchas son **líneas de producción** (agrupación de molinos), no las planchas individuales del módulo Quemado salvo que se rediseñe el origen de datos.

---
name: mineos-visual-tokens
description: Uniformidad visual MineOS — tokens CSS, tonos semánticos (oro/verde/rojo), helpers en mineos-visual.ts. Usar al crear o editar UI, componentes, KPIs, modales, tablas, PDFs, o cuando el usuario pida consistencia visual, tokens, colores, tema claro/oscuro.
---

# MineOS — tokens visuales

## Fuente de verdad (en este orden)

1. `src/app/globals.css` — variables `:root`, `[data-theme="light"]`, `@theme inline`
2. `src/lib/mineos-visual.ts` — helpers de clases por tono
3. Componentes base en `src/components/ui/` — reutilizar antes de inventar estilos

**No** introduzcas colores hex/rgb sueltos en JSX si ya existe un token o helper.

## Tonos semánticos

| Tono | Significado | Variables base |
|------|-------------|----------------|
| `general` | Marca / acción principal / oro | `--mineos-general-*` |
| `benefit` | Positivo / ingreso / verde | `--mineos-benefit-*` |
| `expense` | Negativo / egreso / rojo | `--mineos-expense-*` |
| `neutral` | Sin carga semántica | `--mineos-neutral-muted`, zinc tokens |

Variantes por tono: `-bright`, `-deep`, `-soft`, `-border`, gradientes `--mineos-gradient-kpi-*`.

## Tokens de layout y superficie

Usar variables semánticas, no zinc arbitrario:

- Texto: `--text-primary`, `--text-secondary`, `--text-muted`
- Superficies: `--card-bg`, `--card-border`, `--surface-elevated`, `--sidebar-bg`
- Acento global: `--accent`, `--positive`, `--negative`
- Ancho app: `--app-canvas-max-width` + clase `.app-viewport-canvas`

## Helpers obligatorios (`mineos-visual.ts`)

Preferir funciones exportadas sobre clases ad hoc:

- `mineosGlow`, `mineosIcon`, `mineosIconRing`
- `mineosKpiValue`, `mineosKpiGlow`
- `mineosPanel`, `mineosModalHeading`, `mineosBtnSubtleClass`
- `mineosLabelAccent`, `mineosCell`
- `MINEOS_BTN_PRIMARY` — botón primario modal / acciones globales
- `MINEOS_BTN_GERENCIAL_NEW` — toolbar gerencial “Nuevo registro” (oro + texto negro)
- `MINEOS_BTN_GERENCIAL_BALANCE` — toolbar gerencial secundario oro
- `MINEOS_BTN_VOLADURAS_NEW`, `MINEOS_BTN_NOMINA_PRIMARY` — variantes por módulo
- `MINEOS_DAY_PILL`, `MINEOS_DAY_PILL_ACTIVE` — píldoras de día
- `MINEOS_TABLE_ACTION_EDIT`, `MINEOS_TABLE_ACTION_DELETE` — iconos en tablas

Si necesitas un patrón nuevo que se repite ≥2 veces, **añádelo aquí** en lugar de copiar strings.

## Controles de formulario (desplegables y horas)

**Siempre** usar los componentes canónicos; los estilos viven en `globals.css`:

| Control | Componente | Clases CSS |
|---------|------------|------------|
| Selección | `AppSelect` | `.app-select__*` |
| Hora (12h AM/PM) | `AppTimePicker` | `.app-time-picker__*` |
| Texto + lista | `AppCombobox` | reutiliza `.app-select__menu` / `__option` |
| Fecha | `AppDatePicker` | `.app-date-picker__*` |

### Reglas

- **Prohibido** en pantallas nuevas: `<select className="input-field">`, `<input type="time">`, clases sueltas tipo `border-white/5 bg-zinc-900/40` en filtros.
- **No** poner colores Tailwind (`slate-*`, `zinc-*`, `amber-*`) en `AppSelect` / `AppTimePicker`; el estilo va en CSS, no en el `.tsx`.
- Tema claro en modales: `theme="light"` en el componente (propaga `data-theme` al menú portal).
- Variante compacta: solo overrides con `[&_.app-select__trigger]:…` documentados; no reescribir colores.
- Si hace falta un tamaño nuevo (ej. `sm`), añadir modificador en `globals.css` (`.app-select--sm`), no copiar estilos por archivo.

### Reportes y filtros

- Filtros dinámicos / presets / reconciliación: `reportesUi` en `src/components/reportes/reportes-ui.ts` (`input`, `sectionTitle`, `fieldLabel`, `kpiCard`, …)
- No usar `FIELD_CLASSES` ni `border-zinc` / `bg-zinc-900` en paneles de reportes

### Excepción intencional — vista previa nómina (modo blanco)

**No migrar** a tokens oscuros ni gerencial inline:

- `NominaVistaPreviaContent.tsx`, `NominaVistaPreviaModal.tsx`, `NominaVistaPreviaClient.tsx`
- `NominaPreviewOptionsMenu.tsx`, `NominaPreviewReport.tsx`, `NominaDivisionesToolbar.tsx`

El resto de nómina (toolbar, modales, registro) sí usa tokens canónicos.

## Tailwind y Tremor

- Mapeos Tremor en `@theme inline` de `globals.css` — no duplicar paleta Tremor en componentes.
- Parches `.tremor-Card-root` y charts viven en `globals.css`; no overrides locales salvo excepción documentada.
- Tailwind 4: preferir `var(--token)` en arbitrary values solo cuando no hay utility; mejor extender `@theme` si es recurrente.

## Tema claro / oscuro

- Oscuro: `:root` por defecto
- Claro: `html[data-theme="light"]` — **mismos** acentos oro/verde/rojo; cambian superficies y texto
- Al editar colores, validar **ambos** temas

## Anti-patrones (corregir si los ves)

- `text-zinc-400` donde debería ser `text-[var(--text-secondary)]` o clase del design system
- `#d4af37`, `#34d399`, `#f87171` hardcodeados
- Mezclar estilos inline `style={{ color: ... }}` con tokens CSS
- Nuevas familias de sombra/borde por componente sin alinear a `--card-border`
- KPIs con colores que no usan `mineosKpiValue` / `mineosKpiGlow`

## Auditoría rápida (invocar con `/mineos-visual-tokens <archivo>`)

1. Listar colores/clases que **no** vienen de tokens o `mineos-visual.ts`
2. Proponer reemplazo concreto (variable o helper)
3. Señalar inconsistencias light/dark
4. Indicar si el patrón debería moverse a `mineos-visual.ts`

## Salida esperada

Tabla: **línea · problema · fix (token/helper)** — luego ofrecer aplicar fixes si el usuario quiere.

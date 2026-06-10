/** Identidad visual MineOS: oro (general) · verde (beneficio) · rojo (egreso) */

export type MineosTone = 'general' | 'benefit' | 'expense' | 'neutral';

const GLOW_BY_TONE = {
  general: 'amber',
  benefit: 'emerald',
  expense: 'red',
  neutral: 'neutral',
} as const;

export function mineosGlow(tone: MineosTone): (typeof GLOW_BY_TONE)[MineosTone] {
  return GLOW_BY_TONE[tone];
}

export function mineosIcon(tone: MineosTone): string {
  return tone === 'neutral' ? 'mineos-icon-muted' : `mineos-icon-${tone}`;
}

export function mineosIconRing(tone: MineosTone): string {
  return `mineos-icon-ring mineos-icon-ring--${tone}`;
}

export function mineosKpiValue(tone: MineosTone): string {
  return `gerencial-kpi-value gerencial-kpi-value--${mineosGlow(tone)}`;
}

export function mineosKpiGlow(tone: MineosTone): string {
  return `gerencial-kpi-glow gerencial-kpi-glow--${mineosGlow(tone)}`;
}

export function mineosModalTitle(tone: MineosTone): string {
  return `produccion-page__modal-col-title produccion-page__modal-col-title--${tone}`;
}

export function mineosModalRule(tone: MineosTone): string {
  return `produccion-page__modal-col-rule produccion-page__modal-col-rule--${tone}`;
}

export function mineosPanel(tone: MineosTone): string {
  return `mineos-panel border rounded-xl p-3 mineos-panel--${tone}`;
}

export function mineosModalHeading(tone: MineosTone): string {
  return `${mineosModalTitle(tone)} flex items-center gap-2 text-sm font-semibold`;
}

export function mineosModalHeadingBetween(tone: MineosTone): string {
  return `${mineosModalTitle(tone)} flex flex-1 items-center gap-2 text-sm font-semibold`;
}

export function mineosModalDivider(tone: MineosTone): string {
  return `h-px flex-1 ${mineosModalRule(tone)}`;
}

/** Botón secundario del modal (borde + fondo semántico) */
export function mineosBtnSubtleClass(tone: MineosTone = 'general'): string {
  if (tone === 'benefit') {
    return 'flex items-center gap-1 rounded-lg border border-[var(--mineos-benefit-border)] bg-[var(--mineos-benefit-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--mineos-benefit)] transition-colors hover:opacity-90';
  }
  if (tone === 'expense') {
    return 'flex items-center gap-1 rounded-lg border border-[var(--mineos-expense-border)] bg-[var(--mineos-expense-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--mineos-expense)] transition-colors hover:opacity-90';
  }
  return 'flex items-center gap-1 rounded-lg border border-[var(--mineos-general-border)] bg-[var(--mineos-general-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--mineos-general-bright)] transition-colors hover:opacity-90';
}

export function mineosLabelAccent(tone: MineosTone = 'general'): string {
  const color =
    tone === 'neutral'
      ? 'var(--mineos-neutral-muted)'
      : tone === 'general'
        ? 'var(--mineos-general-bright)'
        : tone === 'benefit'
          ? 'var(--mineos-benefit)'
          : 'var(--mineos-expense)';
  return `input-label ![color:${color}]`;
}

export function mineosCell(tone: MineosTone): string {
  return `mineos-cell-${tone}`;
}

/** Botón primario (toolbar) — oro */
export const MINEOS_BTN_PRIMARY =
  'rounded-lg bg-[var(--mineos-general)] px-4 font-bold text-black shadow-lg shadow-black/20 transition-colors hover:bg-[var(--mineos-general-bright)]';

/** Toolbar gerencial — “Nuevo registro” (estilos en globals.css) */
export const MINEOS_BTN_GERENCIAL_NEW = 'gerencial-page__new-btn produccion-page__toolbar-btn';

/** Toolbar nómina — acción primaria oro (misma base que gerencial) */
export const MINEOS_BTN_NOMINA_PRIMARY = 'gerencial-page__new-btn nomina-page__toolbar-btn';

/** Toolbar voladuras — “Nuevo reporte” */
export const MINEOS_BTN_VOLADURAS_NEW =
  'voladuras-page__new-btn voladuras-page__toolbar-btn produccion-page__toolbar-btn';

/** Toolbar gerencial — acción secundaria oro (balance, export…) */
export const MINEOS_BTN_GERENCIAL_BALANCE = 'gerencial-page__balance-btn produccion-page__toolbar-btn';

/** Píldora de día en vistas gerenciales */
export const MINEOS_DAY_PILL =
  'produccion-day-pill snap-center flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] transition-all lg:gap-2 lg:px-3.5 lg:py-2 lg:text-xs';

export const MINEOS_DAY_PILL_ACTIVE = 'produccion-day-pill--active';

/** Acciones icono en tablas */
export const MINEOS_TABLE_ACTION_EDIT = 'mineos-table-action mineos-table-action--edit';
export const MINEOS_TABLE_ACTION_DELETE = 'mineos-table-action mineos-table-action--danger';

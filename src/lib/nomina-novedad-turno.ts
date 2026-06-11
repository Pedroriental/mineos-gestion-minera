import { defaultDiasTrabajados, type EstadoAsistenciaNomina } from '@/lib/nomina-calculo';
import type { PoliticaReposo } from '@/lib/types';

export type NominaNovedadTurno =
  | 'ACTIVO'
  | 'REPOSO'
  | 'VACACIONES'
  | 'AUSENCIA'
  | 'OTRO';

export const NOVEDAD_TURNO_OPTIONS: NominaNovedadTurno[] = [
  'ACTIVO',
  'REPOSO',
  'VACACIONES',
  'AUSENCIA',
  'OTRO',
];

export const NOVEDAD_TURNO_LABEL: Record<NominaNovedadTurno, string> = {
  ACTIVO: 'Activo',
  REPOSO: 'Reposo',
  VACACIONES: 'Vacaciones',
  AUSENCIA: 'Ausencia',
  OTRO: 'Otro',
};

export const NOVEDAD_TURNO_PREVIEW_LABEL: Record<NominaNovedadTurno, string> = {
  ACTIVO: 'Activo',
  REPOSO: 'Reposo / ausencia',
  VACACIONES: 'Vacaciones',
  AUSENCIA: 'Ausencia en turno',
  OTRO: 'Otra novedad',
};

export function parseNovedadTurno(value: unknown): NominaNovedadTurno {
  if (!value) return 'ACTIVO';
  const val = String(value).trim().toUpperCase();
  if (val === 'REPOSO' || val === 'VACACIONES' || val === 'AUSENCIA' || val === 'OTRO') {
    return val;
  }
  if (val === 'RETIRADO' || val === 'DESPEDIDO' || val === 'INACTIVO') return 'AUSENCIA';
  return 'ACTIVO';
}

export function novedadTurnoTone(estado: NominaNovedadTurno): string {
  if (estado === 'ACTIVO') return 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25';
  if (estado === 'REPOSO') return 'text-amber-300 bg-amber-500/10 border-amber-500/25';
  if (estado === 'VACACIONES') return 'text-cyan-300 bg-cyan-500/10 border-cyan-500/25';
  if (estado === 'AUSENCIA') return 'text-red-300 bg-red-500/10 border-red-500/25';
  return 'text-orange-300 bg-orange-500/10 border-orange-500/25';
}

export function hasNovedadTurno(
  novedad: NominaNovedadTurno | undefined,
  obs?: string | null,
): boolean {
  return (novedad && novedad !== 'ACTIVO') || !!obs?.trim();
}

export const REPOSO_CONDICION_OPTIONS: PoliticaReposo[] = [
  'SIN_PAGO',
  'PARCIAL',
  'PAGO_COMPLETO',
];

/** Modo de sueldo por reposo en la semana (incluye pago único, solo borrador/cierre). */
export type ReposoModoSueldoSemana = PoliticaReposo | 'PAGO_UNICO';

export const REPOSO_MODO_SUELDO_OPTIONS: ReposoModoSueldoSemana[] = [
  'SIN_PAGO',
  'PARCIAL',
  'PAGO_COMPLETO',
  'PAGO_UNICO',
];

export const REPOSO_CONDICION_LABEL: Record<PoliticaReposo, string> = {
  SIN_PAGO: 'Sin pago ($0)',
  PARCIAL: 'Pago proporcional',
  PAGO_COMPLETO: 'Pago completo',
};

export const REPOSO_MODO_SUELDO_LABEL: Record<ReposoModoSueldoSemana, string> = {
  SIN_PAGO: 'Sin pago ($0)',
  PARCIAL: 'Pago proporcional',
  PAGO_COMPLETO: 'Pago completo',
  PAGO_UNICO: 'Pago único',
};

/** Etiquetas cortas para el desplegable compacto de la UI. */
export const REPOSO_MODO_SUELDO_LABEL_SHORT: Record<ReposoModoSueldoSemana, string> = {
  SIN_PAGO: 'Sin pago',
  PARCIAL: 'Parcial',
  PAGO_COMPLETO: 'Completo',
  PAGO_UNICO: 'Pago único',
};

/** @deprecated Usar REPOSO_MODO_SUELDO_LABEL_SHORT */
export const REPOSO_CONDICION_LABEL_SHORT: Record<PoliticaReposo, string> = {
  SIN_PAGO: 'Sin pago',
  PARCIAL: 'Parcial',
  PAGO_COMPLETO: 'Completo',
};

export function parseReposoModoSueldoSemana(value: unknown): ReposoModoSueldoSemana | undefined {
  if (
    value === 'SIN_PAGO' ||
    value === 'PARCIAL' ||
    value === 'PAGO_COMPLETO' ||
    value === 'PAGO_UNICO'
  ) {
    return value;
  }
  return undefined;
}

export function parseReposoCondicion(value: unknown): PoliticaReposo | undefined {
  if (value === 'SIN_PAGO' || value === 'PARCIAL' || value === 'PAGO_COMPLETO') return value;
  return undefined;
}

/** Condición de sueldo por defecto al marcar reposo en la semana. */
export function defaultReposoCondicionSemana(): ReposoModoSueldoSemana {
  return 'SIN_PAGO';
}

export function reposoPagoUnicoMontoFromRow(row: {
  novedadTurno?: NominaNovedadTurno;
  reposoCondicion?: ReposoModoSueldoSemana | null;
  reposoCompensacionMonto?: number;
}): number {
  if (row.novedadTurno !== 'REPOSO' || row.reposoCondicion !== 'PAGO_UNICO') return 0;
  return Number(row.reposoCompensacionMonto) || 0;
}

export function describeNovedadTurnoSemana(row: {
  novedadTurno: NominaNovedadTurno;
  novedadTurnoObs?: string;
  reposoCondicion?: ReposoModoSueldoSemana | null;
  reposoDiasPagados?: number;
}): string {
  const parts: string[] = [NOVEDAD_TURNO_PREVIEW_LABEL[row.novedadTurno]];
  if (row.novedadTurno === 'REPOSO' && row.reposoCondicion) {
    parts.push(REPOSO_MODO_SUELDO_LABEL_SHORT[row.reposoCondicion]);
    if (row.reposoCondicion === 'PARCIAL' && (row.reposoDiasPagados ?? 0) > 0) {
      parts.push(`${row.reposoDiasPagados} días`);
    }
  }
  const note = row.novedadTurnoObs?.trim();
  if (note) parts.push(note);
  return parts.join(' · ');
}

/** Al elegir Reposo: falta + condición de sueldo explícita para la semana. */
export function patchAlMarcarNovedadTurno(
  prev: {
    novedadTurnoObs: string;
    reposoCondicion?: ReposoModoSueldoSemana | null;
    reposoDiasPagados?: number;
    reposoCompensacionMonto?: number;
  },
  novedadTurno: NominaNovedadTurno,
): {
  novedadTurno: NominaNovedadTurno;
  novedadTurnoObs: string;
  reposoCondicion: ReposoModoSueldoSemana | null;
  reposoDiasPagados: number;
  reposoCompensacionMonto: number;
  estadoAsistencia?: EstadoAsistenciaNomina;
  diasTrabajados?: number;
} {
  if (novedadTurno === 'REPOSO') {
    return {
      novedadTurno,
      novedadTurnoObs: prev.novedadTurnoObs,
      reposoCondicion: prev.reposoCondicion ?? defaultReposoCondicionSemana(),
      reposoDiasPagados: prev.reposoDiasPagados ?? 0,
      reposoCompensacionMonto: prev.reposoCompensacionMonto ?? 0,
      estadoAsistencia: 'no_laborado',
      diasTrabajados: 0,
    };
  }
  return {
    novedadTurno,
    novedadTurnoObs: novedadTurno === 'ACTIVO' ? '' : prev.novedadTurnoObs,
    reposoCondicion: null,
    reposoDiasPagados: 0,
    reposoCompensacionMonto: 0,
  };
}

/** Al cambiar Turno/Libre/Falta: limpia reposo y aplica asistencia explícita (pago normal). */
export function patchAlCambiarAsistencia(estadoAsistencia: EstadoAsistenciaNomina): {
  novedadTurno: 'ACTIVO';
  novedadTurnoObs: string;
  reposoCondicion: null;
  reposoDiasPagados: number;
  reposoCompensacionMonto: number;
  estadoAsistencia: EstadoAsistenciaNomina;
  diasTrabajados: number;
} {
  return {
    novedadTurno: 'ACTIVO',
    novedadTurnoObs: '',
    reposoCondicion: null,
    reposoDiasPagados: 0,
    reposoCompensacionMonto: 0,
    estadoAsistencia,
    diasTrabajados: defaultDiasTrabajados(estadoAsistencia),
  };
}

const REPOSO_OBS_TAG_LEGACY =
  /^\[Reposo:\s*(Sin pago \(\$0\)|Pago proporcional|Pago completo|Pago único)\]\s*/;
const REPOSO_OBS_TAG_EXTENDED =
  /^\[Reposo:\s*([^;\]]+?)(?:;\s*d=(\d+))?(?:;\s*comp=([\d.]+))?\]\s*/;

export type ReposoObsExtras = {
  reposoDiasPagados?: number;
  reposoCompensacionMonto?: number;
};

function buildReposoObsTag(
  reposoCondicion: ReposoModoSueldoSemana,
  extras?: ReposoObsExtras,
): string {
  let inner = REPOSO_MODO_SUELDO_LABEL[reposoCondicion];
  const dias =
    extras?.reposoDiasPagados !== undefined && reposoCondicion === 'PARCIAL'
      ? Math.max(0, Math.min(7, Math.round(extras.reposoDiasPagados)))
      : undefined;
  const compMonto =
    reposoCondicion === 'PAGO_UNICO' ? Number(extras?.reposoCompensacionMonto) || 0 : 0;
  if (dias !== undefined && dias > 0) inner += `; d=${dias}`;
  if (compMonto > 0) inner += `; comp=${compMonto.toFixed(2)}`;
  return `[Reposo: ${inner}]`;
}

export function formatNovedadTurnoObsForSave(
  novedadTurno: NominaNovedadTurno,
  obs: string,
  reposoCondicion?: ReposoModoSueldoSemana | null,
  extras?: ReposoObsExtras,
): string {
  const note = obs.trim();
  if (novedadTurno !== 'REPOSO' || !reposoCondicion) return note;
  const tag = buildReposoObsTag(reposoCondicion, extras);
  return note ? `${tag} ${note}` : tag;
}

function resolveReposoModoFromObsLabel(label: string): ReposoModoSueldoSemana | undefined {
  return REPOSO_MODO_SUELDO_OPTIONS.find((opt) => REPOSO_MODO_SUELDO_LABEL[opt] === label);
}

export function parseReposoCondicionFromObs(obs: string): {
  reposoCondicion?: ReposoModoSueldoSemana;
  reposoDiasPagados?: number;
  reposoCompensacionMonto?: number;
  novedadTurnoObs: string;
} {
  const trimmed = obs.trim();
  const extended = trimmed.match(REPOSO_OBS_TAG_EXTENDED);
  if (extended) {
    const label = extended[1].trim();
    let reposoCondicion = resolveReposoModoFromObsLabel(label);
    const reposoDiasPagados = extended[2] ? Number(extended[2]) : undefined;
    const compRaw = extended[3] ? Number(extended[3]) : 0;
    if (!reposoCondicion && compRaw > 0) reposoCondicion = 'PAGO_UNICO';
    return {
      reposoCondicion,
      reposoDiasPagados:
        reposoDiasPagados !== undefined && Number.isFinite(reposoDiasPagados)
          ? reposoDiasPagados
          : undefined,
      reposoCompensacionMonto: compRaw > 0 ? compRaw : undefined,
      novedadTurnoObs: trimmed.slice(extended[0].length).trim(),
    };
  }
  const legacy = trimmed.match(REPOSO_OBS_TAG_LEGACY);
  if (!legacy) return { novedadTurnoObs: trimmed };
  const reposoCondicion = resolveReposoModoFromObsLabel(legacy[1]);
  return {
    reposoCondicion,
    novedadTurnoObs: trimmed.slice(legacy[0].length).trim(),
  };
}

export function nominaNovedadDraftKey(area: string, weekStart: string): string {
  return `mineos-nomina-novedad-turno-v1:${area}:${weekStart}`;
}

/** Borrador semanal por trabajador (novedad + asistencia + ajustes de pago). */
export type NominaWeekRowDraft = {
  novedadTurno: NominaNovedadTurno;
  novedadTurnoObs: string;
  reposoCondicion?: ReposoModoSueldoSemana | null;
  reposoDiasPagados?: number;
  reposoCompensacionMonto?: number;
  estadoAsistencia?: EstadoAsistenciaNomina;
  diasTrabajados?: number;
  bonificaciones?: number;
  bonoTransporte?: number;
};

export type NominaWeekDraft = Record<string, NominaWeekRowDraft>;

/** @deprecated Alias de NominaWeekDraft */
export type NominaNovedadDraft = NominaWeekDraft;

export function parseEstadoAsistenciaDraft(value: unknown): EstadoAsistenciaNomina | undefined {
  if (value === 'trabajada' || value === 'libre' || value === 'no_laborado') return value;
  return undefined;
}

function normalizeWeekRowDraft(raw: unknown): NominaWeekRowDraft | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const out: NominaWeekRowDraft = {
    novedadTurno: parseNovedadTurno(row.novedadTurno),
    novedadTurnoObs: String(row.novedadTurnoObs || ''),
  };
  const reposoCond = parseReposoModoSueldoSemana(row.reposoCondicion);
  if (reposoCond) out.reposoCondicion = reposoCond;
  else if (row.reposoCondicion === null) out.reposoCondicion = null;
  // Migración borrador previo: compensación separada → PAGO_UNICO
  if (
    !out.reposoCondicion &&
    (row as Record<string, unknown>).reposoCompensacion === 'PAGO_UNICO'
  ) {
    out.reposoCondicion = 'PAGO_UNICO';
  }
  if (row.reposoDiasPagados !== undefined && row.reposoDiasPagados !== null) {
    const dias = Number(row.reposoDiasPagados);
    if (Number.isFinite(dias)) out.reposoDiasPagados = dias;
  }
  if (row.reposoCompensacionMonto !== undefined && row.reposoCompensacionMonto !== null) {
    const monto = Number(row.reposoCompensacionMonto);
    if (Number.isFinite(monto)) out.reposoCompensacionMonto = monto;
  }
  const estado = parseEstadoAsistenciaDraft(row.estadoAsistencia);
  if (estado) out.estadoAsistencia = estado;
  if (row.diasTrabajados !== undefined && row.diasTrabajados !== null) {
    const dias = Number(row.diasTrabajados);
    if (Number.isFinite(dias)) out.diasTrabajados = dias;
  }
  if (row.bonificaciones !== undefined && row.bonificaciones !== null) {
    const bon = Number(row.bonificaciones);
    if (Number.isFinite(bon)) out.bonificaciones = bon;
  }
  if (row.bonoTransporte !== undefined && row.bonoTransporte !== null) {
    const bono = Number(row.bonoTransporte);
    if (Number.isFinite(bono)) out.bonoTransporte = bono;
  }
  return out;
}

export function readNominaWeekDraft(key: string): NominaWeekDraft {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as NominaWeekDraft;
    if (!parsed || typeof parsed !== 'object') return {};
    const out: NominaWeekDraft = {};
    for (const [id, row] of Object.entries(parsed)) {
      const normalized = normalizeWeekRowDraft(row);
      if (normalized) out[id] = normalized;
    }
    return out;
  } catch {
    return {};
  }
}

export function writeNominaWeekDraft(key: string, draft: NominaWeekDraft): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(draft));
  } catch {
    /* quota / private mode */
  }
}

export function readNominaNovedadDraft(key: string): NominaWeekDraft {
  return readNominaWeekDraft(key);
}

export function writeNominaNovedadDraft(key: string, draft: NominaWeekDraft): void {
  writeNominaWeekDraft(key, draft);
}

export function weekDraftToRowOverrides(
  draft: NominaWeekRowDraft | undefined,
): {
  novedadTurno?: NominaNovedadTurno;
  novedadTurnoObs?: string;
  reposoCondicion?: ReposoModoSueldoSemana | null;
  reposoDiasPagados?: number;
  reposoCompensacionMonto?: number;
  estadoAsistencia?: EstadoAsistenciaNomina;
  diasTrabajados?: number;
  bonificaciones?: number;
  bonoTransporte?: number;
} {
  if (!draft) return {};
  const overrides: ReturnType<typeof weekDraftToRowOverrides> = {
    novedadTurno: draft.novedadTurno,
    novedadTurnoObs: draft.novedadTurnoObs,
  };
  if (draft.reposoCondicion !== undefined) overrides.reposoCondicion = draft.reposoCondicion;
  if (draft.reposoDiasPagados !== undefined) overrides.reposoDiasPagados = draft.reposoDiasPagados;
  if (draft.reposoCompensacionMonto !== undefined) {
    overrides.reposoCompensacionMonto = draft.reposoCompensacionMonto;
  }
  if (draft.estadoAsistencia) overrides.estadoAsistencia = draft.estadoAsistencia;
  if (draft.diasTrabajados !== undefined) overrides.diasTrabajados = draft.diasTrabajados;
  if (draft.bonificaciones !== undefined) overrides.bonificaciones = draft.bonificaciones;
  if (draft.bonoTransporte !== undefined) overrides.bonoTransporte = draft.bonoTransporte;
  return overrides;
}

export function preNominaRowToWeekDraft(row: {
  novedadTurno: NominaNovedadTurno;
  novedadTurnoObs: string;
  reposoCondicion?: ReposoModoSueldoSemana | null;
  reposoDiasPagados?: number;
  reposoCompensacionMonto?: number;
  estadoAsistencia: EstadoAsistenciaNomina;
  diasTrabajados: number;
  bonificaciones: number;
  bonoTransporte: number;
}): NominaWeekRowDraft {
  return {
    novedadTurno: row.novedadTurno,
    novedadTurnoObs: row.novedadTurnoObs,
    reposoCondicion: row.reposoCondicion ?? null,
    reposoDiasPagados: row.reposoDiasPagados ?? 0,
    reposoCompensacionMonto: row.reposoCompensacionMonto ?? 0,
    estadoAsistencia: row.estadoAsistencia,
    diasTrabajados: row.diasTrabajados,
    bonificaciones: row.bonificaciones,
    bonoTransporte: row.bonoTransporte,
  };
}

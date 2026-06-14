import { endOfMonth, format, parseISO, startOfMonth } from 'date-fns';
import { getWeekEnd, listWeekStartsInRange } from '@/lib/nomina/week-utils';
import { nominaNovedadDraftKey } from '@/lib/nomina-novedad-turno';
import { clearManualWeekRoster } from '@/lib/nomina/manual-period-roster';
import type { NominaPeriodoSummary } from '@/lib/nomina/types';

export function createManualPeriodId(): string {
  return `mp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Inferencia heurística de sección según el nombre del ciclo (mina vs molino/planta). */
export function inferPayrollSectionFromLabel(label: string): 'mina' | 'planta' | null {
  const l = label.toLowerCase();
  if (/\bmolino?s?\b|\bplanta\b|\bl[\s.-]?f[eé]\b/.test(l) && !/\bmina\b/.test(l)) return 'planta';
  if (/\bmina\b|\bbel[eé]n\b/.test(l)) return 'mina';
  return null;
}

export function isManualPeriodCompatibleWithArea(
  period: Pick<ManualNominaPeriod, 'label'>,
  area: string,
): boolean {
  const implied = inferPayrollSectionFromLabel(period.label);
  return implied == null || implied === area;
}

export function stripCrossAreaPeriodoDbIds(
  period: ManualNominaPeriod,
  area: string,
): ManualNominaPeriod {
  if (isManualPeriodCompatibleWithArea(period, area)) return period;
  return {
    ...period,
    periodoArchivoId: undefined,
    periodoVistaId: undefined,
  };
}

export type ManualNominaPeriod = {
  id: string;
  label: string;
  rangeStart: string;
  rangeEnd: string;
  plantillaId: string;
  plantillaNombre: string;
  /** Por columna de rotación (índice) → semana calendario (lunes ISO) asignada */
  weekColumnAssignment?: string[];
  /** Por columna de rotación (índice) → ids de cuadrillas activas en ese intervalo */
  weekColumnCuadrillas?: string[][];
  /** Nombres de cuadrilla por columna (persistencia estable si cambian los UUID) */
  weekColumnCuadrillaNombres?: string[][];
  /** Registro archivado en nomina_periodos (vista manual o consolidado). */
  periodoArchivoId?: string;
  /** Periodo DB creado al activar el ciclo (aisla cierres por ciclo). */
  periodoVistaId?: string;
  /** Semanas cerradas que pertenecen solo a este ciclo. */
  semanaIds?: string[];
  /** Total USD archivado del periodo consolidado. */
  periodoTotalUsd?: number;
};

export type ManualPeriodSemanaRow = {
  id?: string;
  semana_inicio: string;
  total_pagado?: number | string;
  area?: string;
  periodo_id?: string | null;
};

export type ManualPeriodProgress = {
  weeks: string[];
  closedWeeks: string[];
  openWeeks: string[];
  closedCount: number;
  totalWeeks: number;
  totalUsd: number;
  /** Total USD por semana_inicio (solo semanas cerradas en el periodo). */
  weekTotalsUsd: Record<string, number>;
  allClosed: boolean;
};

export function resolveClosedOperationalSemana<T extends ManualPeriodSemanaRow>(
  semanas: T[],
  weekStart: string,
  area: string,
): T | undefined {
  const scoped = semanas.filter((s) => s.semana_inicio === weekStart && s.area === area);
  if (scoped.length) {
    const operativa = scoped.find((s) => s.periodo_id == null);
    return operativa ?? scoped[0];
  }
  return semanas.find((s) => s.semana_inicio === weekStart && !s.area);
}

/**
 * Semana histórica dentro de un ciclo manual (no la semana de curso operativa).
 * La semana de curso sigue el cierre operativo V3 aunque tenga plantilla vinculada.
 */
export function isHistoricalManualPeriodWeek(
  weekStart: string,
  workingWeekStart: string,
  manualPeriod: ManualNominaPeriod | null | undefined,
): boolean {
  if (!manualPeriod || !weekInManualPeriod(weekStart, manualPeriod)) return false;
  return weekStart !== workingWeekStart;
}

/** Resuelve la semana cerrada visible: operativa (V3) en curso; manual solo en histórico. */
export function resolveClosedSemanaForWeekView<T extends ManualPeriodSemanaRow>(
  manualPeriod: ManualNominaPeriod | null | undefined,
  semanas: T[],
  weekStart: string,
  workingWeekStart: string,
  area: string,
): T | undefined {
  if (isHistoricalManualPeriodWeek(weekStart, workingWeekStart, manualPeriod)) {
    return resolveClosedSemanaForManualPeriod(manualPeriod, semanas, weekStart, area);
  }
  return resolveClosedOperationalSemana(semanas, weekStart, area);
}

export function manualPeriodStorageKey(area: string): string {
  return `nomina-manual-period-v2-${area}`;
}

/** Limpia periodo activo y borradores locales del área para iniciar un ciclo nuevo. */
export function resetManualPeriodSession(area: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(manualPeriodStorageKey(area));
    localStorage.removeItem(`nomina-manual-periods-v3-${area}`);
    localStorage.removeItem(`nomina-manual-period-${area}`);
    const rosterPrefix = `nomina-manual-week-roster-v2-${area}-`;
    const rosterLegacyPrefix = `nomina-manual-week-roster-v1-${area}-`;
    const draftPrefix = `mineos-nomina-novedad-turno-v2:${area}:`;
    const draftLegacyPrefix = `mineos-nomina-novedad-turno-v1:${area}:`;
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (
        key.startsWith(rosterPrefix) ||
        key.startsWith(rosterLegacyPrefix) ||
        key.startsWith(draftPrefix) ||
        key.startsWith(draftLegacyPrefix)
      ) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    /* quota / private mode */
  }
}

/** Limpia roster y borradores locales de las semanas de un ciclo en desarrollo. */
export function clearLocalDraftsForPeriod(area: string, period: ManualNominaPeriod): void {
  if (typeof window === 'undefined') return;
  for (const w of manualPeriodWeekStarts(period.rangeStart, period.rangeEnd)) {
    clearManualWeekRoster(area, w, period.id);
    try {
      localStorage.removeItem(nominaNovedadDraftKey(area, w, period.id));
    } catch {
      /* ignore */
    }
  }
}

export function defaultManualPeriod(
  refIso?: string,
  plantilla?: { id: string; nombre: string },
): ManualNominaPeriod {
  const d = refIso ? parseISO(refIso) : new Date();
  const rangeStart = format(startOfMonth(d), 'yyyy-MM-dd');
  const rangeEnd = format(endOfMonth(d), 'yyyy-MM-dd');
  return {
    id: createManualPeriodId(),
    label: '',
    rangeStart,
    rangeEnd,
    plantillaId: plantilla?.id ?? '',
    plantillaNombre: plantilla?.nombre ?? '',
  };
}

/** Semanas de nómina (lunes) cuyo inicio cae dentro del rango del periodo. */
export function manualPeriodWeekStarts(rangeStart: string, rangeEnd: string): string[] {
  return listWeekStartsInRange(rangeStart, rangeEnd).filter(
    (ws) => ws >= rangeStart && ws <= rangeEnd,
  );
}

export function weekInManualPeriod(weekStart: string, period: ManualNominaPeriod | null): boolean {
  if (!period) return false;
  return weekStart >= period.rangeStart && weekStart <= period.rangeEnd;
}

export function weekIndexInManualPeriod(
  periodStart: string,
  periodEnd: string,
  weekStart: string,
): number {
  const weeks = manualPeriodWeekStarts(periodStart, periodEnd);
  const idx = weeks.indexOf(weekStart);
  return idx >= 0 ? idx : 0;
}

/** Índice de columna de rotación para una semana calendario (fallback: orden secuencial). */
export function resolveManualPeriodWeekColumn(
  weekStart: string,
  rangeStart: string,
  rangeEnd: string,
  weekColumnAssignment?: string[],
): number {
  if (weekColumnAssignment?.length) {
    const idx = weekColumnAssignment.indexOf(weekStart);
    if (idx >= 0) return idx;
  }
  return weekIndexInManualPeriod(rangeStart, rangeEnd, weekStart);
}

export function buildDefaultWeekColumnAssignment(
  calendarWeeks: string[],
  columnCount: number,
): string[] {
  const out: string[] = [];
  for (let i = 0; i < columnCount; i++) {
    out.push(calendarWeeks[i] ?? '');
  }
  return out;
}

/** Semana cerrada que pertenece a este ciclo (no a otro con las mismas fechas). */
export function resolveClosedSemanaForManualPeriod<T extends ManualPeriodSemanaRow>(
  period: ManualNominaPeriod | null | undefined,
  semanas: T[],
  weekStart: string,
  area?: string,
): T | undefined {
  const candidates = semanas.filter((s) => {
    if (s.semana_inicio !== weekStart) return false;
    if (area && s.area && s.area !== area) return false;
    return true;
  });
  if (!candidates.length) return undefined;
  if (!period) return candidates[0];

  if (period.semanaIds !== undefined) {
    const allowed = new Set(period.semanaIds);
    return candidates.find((s) => s.id && allowed.has(s.id));
  }

  if (area && !isManualPeriodCompatibleWithArea(period, area)) {
    return undefined;
  }

  const periodoDbId = period.periodoVistaId ?? period.periodoArchivoId;
  if (periodoDbId) {
    return candidates.find((s) => s.periodo_id === periodoDbId);
  }

  return undefined;
}

function filterSemanasForManualPeriod(
  period: ManualNominaPeriod,
  semanas: ManualPeriodSemanaRow[],
  area?: string,
): ManualPeriodSemanaRow[] {
  let scoped = semanas.filter((s) => {
    if (s.semana_inicio < period.rangeStart || s.semana_inicio > period.rangeEnd) return false;
    if (area && s.area && s.area !== area) return false;
    return true;
  });

  if (period.semanaIds !== undefined) {
    const allowed = new Set(period.semanaIds);
    scoped = scoped.filter((s) => s.id && allowed.has(s.id));
    return scoped;
  }

  if (period.periodoArchivoId) {
    scoped = scoped.filter((s) => s.periodo_id === period.periodoArchivoId);
  }

  return scoped;
}

export function attachSemanaToManualPeriod(
  period: ManualNominaPeriod,
  semanaId: string,
  periodoArchivoId?: string,
): ManualNominaPeriod {
  const ids = new Set(period.semanaIds ?? []);
  ids.add(semanaId);
  const periodoDbId = periodoArchivoId ?? period.periodoArchivoId ?? period.periodoVistaId;
  return {
    ...period,
    semanaIds: [...ids],
    periodoArchivoId: periodoDbId,
    periodoVistaId: periodoDbId,
  };
}

export function detachSemanaFromManualPeriod(
  period: ManualNominaPeriod,
  semanaId: string,
): ManualNominaPeriod {
  if (!period.semanaIds?.length) return period;
  return { ...period, semanaIds: period.semanaIds.filter((id) => id !== semanaId) };
}

export function computeManualPeriodProgress(
  period: ManualNominaPeriod,
  semanas: ManualPeriodSemanaRow[],
  area?: string,
): ManualPeriodProgress {
  const weeks = manualPeriodWeekStarts(period.rangeStart, period.rangeEnd);
  const closedInRange = filterSemanasForManualPeriod(period, semanas, area);
  const closedSet = new Set(closedInRange.map((s) => s.semana_inicio));
  const closedWeeks = weeks.filter((w) => closedSet.has(w));
  const openWeeks = weeks.filter((w) => !closedSet.has(w));
  const weekTotalsUsd: Record<string, number> = {};
  for (const s of closedInRange) {
    weekTotalsUsd[s.semana_inicio] = parseFloat(Number(s.total_pagado ?? 0).toFixed(2));
  }
  const totalUsd = closedInRange.reduce((sum, s) => sum + Number(s.total_pagado ?? 0), 0);

  return {
    weeks,
    closedWeeks,
    openWeeks,
    closedCount: closedWeeks.length,
    totalWeeks: weeks.length,
    totalUsd: parseFloat(totalUsd.toFixed(2)),
    weekTotalsUsd,
    allClosed: weeks.length > 0 && openWeeks.length === 0,
  };
}

export function firstOpenWeekInPeriod(
  period: ManualNominaPeriod,
  semanas: Array<{ semana_inicio: string; area?: string }>,
  area?: string,
): string | null {
  const progress = computeManualPeriodProgress(period, semanas, area);
  return progress.openWeeks[0] ?? progress.weeks[0] ?? null;
}

export function nextWeekInManualPeriod(
  period: ManualNominaPeriod,
  weekStart: string,
): string | null {
  const weeks = manualPeriodWeekStarts(period.rangeStart, period.rangeEnd);
  const idx = weeks.indexOf(weekStart);
  if (idx < 0 || idx >= weeks.length - 1) return null;
  return weeks[idx + 1] ?? null;
}

export function previousWeekInManualPeriod(
  period: ManualNominaPeriod,
  weekStart: string,
): string | null {
  const weeks = manualPeriodWeekStarts(period.rangeStart, period.rangeEnd);
  const idx = weeks.indexOf(weekStart);
  if (idx <= 0) return null;
  return weeks[idx - 1] ?? null;
}

/** Quita prefijos legacy ([Manual], [Histórico], etc.) del nombre archivado. */
export function stripPeriodoLabelPrefix(label: string): string {
  return label.replace(/^\[(Histórico|Operativo|Manual)\]\s*/i, '').trim();
}

export function manualPeriodConsolidateLabel(period: ManualNominaPeriod): string {
  return stripPeriodoLabelPrefix(period.label.trim()) || `Periodo ${period.rangeStart}`;
}

/** Clave estable para deduplicar periodos consolidados manualmente. */
export function manualPeriodoDedupKey(input: {
  rangeStart: string;
  rangeEnd: string;
  area?: string | null;
  origen?: string;
}): string {
  return `${input.origen ?? 'consolidacion_manual'}|${input.area ?? ''}|${input.rangeStart}|${input.rangeEnd}`;
}

/** Conserva un solo registro por ciclo equivalente (el más reciente). */
export function dedupeNominaPeriodoSummaries(
  periodos: NominaPeriodoSummary[],
): NominaPeriodoSummary[] {
  const byKey = new Map<string, NominaPeriodoSummary>();
  for (const p of periodos) {
    const area = typeof p.metadata?.area === 'string' ? p.metadata.area : '';
    const key = manualPeriodoDedupKey({
      rangeStart: p.rangeStart,
      rangeEnd: p.rangeEnd,
      area,
      origen: p.origen,
    });
    const prev = byKey.get(key);
    if (!prev || p.createdAt > prev.createdAt) {
      byKey.set(key, p);
    }
  }
  return [...byKey.values()].sort((a, b) => b.rangeStart.localeCompare(a.rangeStart));
}

export function formatManualWeekLabel(weekStart: string): string {
  const end = getWeekEnd(weekStart);
  const [y1, m1, d1] = weekStart.split('-');
  const [y2, m2, d2] = end.split('-');
  if (m1 === m2 && y1 === y2) {
    return `${d1}/${m1} – ${d2}/${m2}/${y2}`;
  }
  return `${d1}/${m1}/${y1} – ${d2}/${m2}/${y2}`;
}

export function manualPeriodFromPeriodoSummary(p: NominaPeriodoSummary): ManualNominaPeriod {
  const meta = p.metadata ?? {};
  const weekColumnAssignment = Array.isArray(meta.week_column_assignment)
    ? meta.week_column_assignment.filter((w): w is string => typeof w === 'string')
    : undefined;
  const weekColumnCuadrillas = Array.isArray(meta.week_column_cuadrillas)
    ? meta.week_column_cuadrillas.map((col) =>
        Array.isArray(col) ? col.filter((id): id is string => typeof id === 'string') : [],
      )
    : undefined;
  const weekColumnCuadrillaNombres = Array.isArray(meta.week_column_cuadrilla_nombres)
    ? meta.week_column_cuadrilla_nombres.map((col) =>
        Array.isArray(col) ? col.filter((n): n is string => typeof n === 'string' && n.trim().length > 0) : [],
      )
    : undefined;

  const semanaIds = Array.isArray(meta.semana_ids)
    ? meta.semana_ids.filter((id): id is string => typeof id === 'string')
    : undefined;

  return normalizeManualPeriod({
    id: `arch-${p.id}`,
    label: stripPeriodoLabelPrefix(p.label),
    rangeStart: p.rangeStart,
    rangeEnd: p.rangeEnd,
    plantillaId: typeof meta.plantilla_id === 'string' ? meta.plantilla_id : '',
    plantillaNombre: typeof meta.plantilla_nombre === 'string' ? meta.plantilla_nombre : '',
    weekColumnAssignment,
    weekColumnCuadrillas,
    weekColumnCuadrillaNombres,
    periodoArchivoId: p.id,
    semanaIds,
    periodoTotalUsd:
      p.totalUsd > 0 && p.semanaCount > 0 ? p.totalUsd : undefined,
  })!;
}

/** Migra periodo guardado sin plantilla (v1 localStorage) */
export function normalizeManualPeriod(
  raw: Partial<ManualNominaPeriod> | null,
): ManualNominaPeriod | null {
  if (!raw?.rangeStart || !raw?.rangeEnd) return null;
  const id =
    typeof raw.id === 'string' && raw.id.trim()
      ? raw.id
      : createManualPeriodId();
  return {
    id,
    label: raw.label ?? '',
    rangeStart: raw.rangeStart,
    rangeEnd: raw.rangeEnd,
    plantillaId: raw.plantillaId ?? '',
    plantillaNombre: raw.plantillaNombre ?? '',
    weekColumnAssignment: Array.isArray(raw.weekColumnAssignment)
      ? raw.weekColumnAssignment.filter((w): w is string => typeof w === 'string')
      : undefined,
    weekColumnCuadrillas: Array.isArray(raw.weekColumnCuadrillas)
      ? raw.weekColumnCuadrillas.map((col) =>
          Array.isArray(col) ? col.filter((id): id is string => typeof id === 'string') : [],
        )
      : undefined,
    weekColumnCuadrillaNombres: Array.isArray(raw.weekColumnCuadrillaNombres)
      ? raw.weekColumnCuadrillaNombres.map((col) =>
          Array.isArray(col)
            ? col.filter((n): n is string => typeof n === 'string' && n.trim().length > 0)
            : [],
        )
      : undefined,
    periodoArchivoId:
      typeof raw.periodoArchivoId === 'string' && raw.periodoArchivoId.trim()
        ? raw.periodoArchivoId
        : undefined,
    periodoVistaId:
      typeof raw.periodoVistaId === 'string' && raw.periodoVistaId.trim()
        ? raw.periodoVistaId
        : undefined,
    semanaIds: Array.isArray(raw.semanaIds)
      ? raw.semanaIds.filter((id): id is string => typeof id === 'string')
      : raw.periodoArchivoId
        ? undefined
        : [],
    periodoTotalUsd:
      typeof raw.periodoTotalUsd === 'number' && raw.periodoTotalUsd > 0
        ? raw.periodoTotalUsd
        : undefined,
  };
}

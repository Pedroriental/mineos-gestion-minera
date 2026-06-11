import {
  buildDefaultWeekColumnAssignment,
  manualPeriodStorageKey,
  manualPeriodWeekStarts,
  normalizeManualPeriod,
  weekInManualPeriod,
  createManualPeriodId,
  type ManualNominaPeriod,
} from '@/lib/nomina/manual-period';
import { referenceRotationSemanas } from '@/lib/rotacion-plantillas/manual-plantilla-projection';
import type { RotacionPlantillaRecord } from '@/lib/rotacion-plantillas/types';

export type ManualPeriodsSession = {
  periods: ManualNominaPeriod[];
  /** Ciclo abierto en Vista por Ciclo */
  editorPeriodId: string | null;
  /** Ciclo que aplica plantilla en la semana de curso (Vista Semanal) */
  workingWeekPeriodId: string | null;
  /** Ciclo preferido al navegar semanas históricas */
  historicalPeriodId: string | null;
};

export function manualPeriodsSessionKey(area: string): string {
  return `nomina-manual-periods-v3-${area}`;
}

export { createManualPeriodId };

export function emptyManualPeriodsSession(): ManualPeriodsSession {
  return {
    periods: [],
    editorPeriodId: null,
    workingWeekPeriodId: null,
    historicalPeriodId: null,
  };
}

export function getPeriodById(
  session: ManualPeriodsSession,
  id: string | null | undefined,
): ManualNominaPeriod | null {
  if (!id) return null;
  return session.periods.find((p) => p.id === id) ?? null;
}

export function getEditorPeriod(session: ManualPeriodsSession): ManualNominaPeriod | null {
  return getPeriodById(session, session.editorPeriodId);
}

/** Periodos cuyo rango incluye la semana de curso. */
export function periodsContainingWeek(
  session: ManualPeriodsSession,
  weekStart: string,
): ManualNominaPeriod[] {
  return session.periods.filter((p) => weekInManualPeriod(weekStart, p));
}

export function resolveManualPeriodForWeek(
  session: ManualPeriodsSession,
  weekStart: string,
  workingWeekStart: string,
): ManualNominaPeriod | null {
  const contains = (id: string | null) => {
    const p = getPeriodById(session, id);
    return p && weekInManualPeriod(weekStart, p) ? p : null;
  };

  if (weekStart === workingWeekStart) {
    return contains(session.workingWeekPeriodId);
  }

  return (
    contains(session.historicalPeriodId) ??
    contains(session.editorPeriodId) ??
    session.periods.find((p) => weekInManualPeriod(weekStart, p)) ??
    null
  );
}

export function upsertPeriodInSession(
  session: ManualPeriodsSession,
  period: ManualNominaPeriod,
): ManualPeriodsSession {
  const idx = session.periods.findIndex((p) => p.id === period.id);
  const periods =
    idx >= 0
      ? session.periods.map((p, i) => (i === idx ? period : p))
      : [...session.periods, period];
  return { ...session, periods };
}

export function removePeriodFromSession(
  session: ManualPeriodsSession,
  periodId: string,
): ManualPeriodsSession {
  const periods = session.periods.filter((p) => p.id !== periodId);
  return {
    periods,
    editorPeriodId: session.editorPeriodId === periodId ? null : session.editorPeriodId,
    workingWeekPeriodId:
      session.workingWeekPeriodId === periodId ? null : session.workingWeekPeriodId,
    historicalPeriodId:
      session.historicalPeriodId === periodId ? null : session.historicalPeriodId,
  };
}

/** Asegura que la semana de curso esté asignada a una columna del ciclo. */
export function ensureWorkingWeekInPeriodAssignment(
  period: ManualNominaPeriod,
  workingWeekStart: string,
  plantilla?: RotacionPlantillaRecord | null,
): ManualNominaPeriod {
  if (!weekInManualPeriod(workingWeekStart, period)) return period;

  const calendarWeeks = manualPeriodWeekStarts(period.rangeStart, period.rangeEnd);
  const columnCount = plantilla
    ? referenceRotationSemanas(plantilla).length
    : calendarWeeks.length;
  let assignment = period.weekColumnAssignment?.length
    ? [...period.weekColumnAssignment]
    : buildDefaultWeekColumnAssignment(calendarWeeks, columnCount || calendarWeeks.length);

  while (assignment.length < columnCount) assignment.push('');

  if (assignment.includes(workingWeekStart)) {
    return { ...period, weekColumnAssignment: assignment };
  }

  const emptyIdx = assignment.findIndex((w) => !w);
  if (emptyIdx >= 0) {
    assignment[emptyIdx] = workingWeekStart;
  } else {
    assignment[0] = workingWeekStart;
  }

  return { ...period, weekColumnAssignment: assignment };
}

export function loadManualPeriodsSession(area: string): ManualPeriodsSession {
  if (typeof window === 'undefined') return emptyManualPeriodsSession();
  try {
    const v3 = localStorage.getItem(manualPeriodsSessionKey(area));
    if (v3) {
      const parsed = JSON.parse(v3) as Partial<ManualPeriodsSession>;
      const periods = (parsed.periods ?? [])
        .map((p) => normalizeManualPeriod(p as Partial<ManualNominaPeriod>))
        .filter(Boolean) as ManualNominaPeriod[];
      return {
        periods,
        editorPeriodId: parsed.editorPeriodId ?? periods[0]?.id ?? null,
        workingWeekPeriodId: parsed.workingWeekPeriodId ?? null,
        historicalPeriodId: parsed.historicalPeriodId ?? null,
      };
    }

    const v2 = localStorage.getItem(manualPeriodStorageKey(area));
    const legacy = !v2 ? localStorage.getItem(`nomina-manual-period-${area}`) : null;
    const raw = v2 ?? legacy;
    if (raw) {
      const single = normalizeManualPeriod(JSON.parse(raw) as Partial<ManualNominaPeriod>);
      if (single) {
        return {
          periods: [single],
          editorPeriodId: single.id,
          workingWeekPeriodId: null,
          historicalPeriodId: single.id,
        };
      }
    }
  } catch {
    /* ignore */
  }
  return emptyManualPeriodsSession();
}

export function saveManualPeriodsSession(area: string, session: ManualPeriodsSession): void {
  if (typeof window === 'undefined') return;
  try {
    if (!session.periods.length) {
      localStorage.removeItem(manualPeriodsSessionKey(area));
      return;
    }
    localStorage.setItem(manualPeriodsSessionKey(area), JSON.stringify(session));
  } catch {
    /* quota */
  }
}

import { addDays, format, parseISO } from 'date-fns';
import { getWeekEnd, getWeekStart } from '@/lib/nomina/week-utils';

export type NominaSemanaRef = { semana_inicio: string; semana_fin?: string };

export type NominaTemporalContext = {
  calendarWeekStart: string;
  calendarWeekEnd: string;
  lastClosedWeekStart: string | null;
  workingWeekStart: string;
  workingWeekEnd: string;
  isWorkingWeekClosed: boolean;
  pendingOpenWeeks: string[];
};

function closedWeekStarts(semanas: NominaSemanaRef[]): Set<string> {
  return new Set(semanas.map((s) => s.semana_inicio));
}

/** Primera semana abierta desde el último cierre hasta la semana calendario (inclusive). */
export function resolveWorkingWeek(semanas: NominaSemanaRef[]): { inicio: string; fin: string } {
  const calendarStart = getWeekStart();
  const closed = closedWeekStarts(semanas);

  if (!closed.has(calendarStart)) {
    return { inicio: calendarStart, fin: getWeekEnd(calendarStart) };
  }

  const sorted = [...semanas].sort((a, b) => b.semana_inicio.localeCompare(a.semana_inicio));
  const lastClosed = sorted[0]?.semana_inicio ?? calendarStart;
  let candidate = format(addDays(parseISO(lastClosed), 7), 'yyyy-MM-dd');

  while (candidate <= calendarStart) {
    if (!closed.has(candidate)) {
      return { inicio: candidate, fin: getWeekEnd(candidate) };
    }
    candidate = format(addDays(parseISO(candidate), 7), 'yyyy-MM-dd');
  }

  const next = format(addDays(parseISO(calendarStart), 7), 'yyyy-MM-dd');
  return { inicio: next, fin: getWeekEnd(next) };
}

/** Siguiente semana de trabajo tras cerrar una semana operativa (incluye la recién cerrada si aún no está en la lista). */
export function resolveWeekRangeAfterOperationalCierre(
  semanas: NominaSemanaRef[],
  closedWeekStart: string,
  closedWeekEnd?: string,
): { inicio: string; fin: string } {
  const alreadyListed = semanas.some((s) => s.semana_inicio === closedWeekStart);
  const withClosed = alreadyListed
    ? semanas
    : [...semanas, { semana_inicio: closedWeekStart, semana_fin: closedWeekEnd }];
  return resolveWorkingWeek(withClosed);
}

export function resolveNominaTemporalContext(semanas: NominaSemanaRef[]): NominaTemporalContext {
  const calendarWeekStart = getWeekStart();
  const calendarWeekEnd = getWeekEnd(calendarWeekStart);
  const closed = closedWeekStarts(semanas);
  const sorted = [...semanas].sort((a, b) => b.semana_inicio.localeCompare(a.semana_inicio));
  const lastClosedWeekStart = sorted[0]?.semana_inicio ?? null;
  const working = resolveWorkingWeek(semanas);

  const pendingOpenWeeks: string[] = [];
  if (lastClosedWeekStart) {
    let cur = format(addDays(parseISO(lastClosedWeekStart), 7), 'yyyy-MM-dd');
    while (cur <= calendarWeekStart) {
      if (!closed.has(cur)) pendingOpenWeeks.push(cur);
      cur = format(addDays(parseISO(cur), 7), 'yyyy-MM-dd');
    }
  } else if (!closed.has(calendarWeekStart)) {
    pendingOpenWeeks.push(calendarWeekStart);
  }

  return {
    calendarWeekStart,
    calendarWeekEnd,
    lastClosedWeekStart,
    workingWeekStart: working.inicio,
    workingWeekEnd: working.fin,
    isWorkingWeekClosed: closed.has(working.inicio),
    pendingOpenWeeks,
  };
}

export function formatTemporalContextHint(ctx: NominaTemporalContext): string {
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };
  if (!ctx.lastClosedWeekStart) {
    return `Semana de curso: ${fmt(ctx.workingWeekStart)} — ${fmt(ctx.workingWeekEnd)}`;
  }
  if (ctx.pendingOpenWeeks.length > 1) {
    return `Último cierre: ${fmt(ctx.lastClosedWeekStart)} · ${ctx.pendingOpenWeeks.length} semanas pendientes · Trabajando: ${fmt(ctx.workingWeekStart)}`;
  }
  if (ctx.isWorkingWeekClosed) {
    return `Semana ${fmt(ctx.workingWeekStart)} cerrada · Siguiente: ${fmt(ctx.workingWeekStart)}`;
  }
  return `Último cierre: ${fmt(ctx.lastClosedWeekStart)} · Semana de curso: ${fmt(ctx.workingWeekStart)} — ${fmt(ctx.workingWeekEnd)}`;
}

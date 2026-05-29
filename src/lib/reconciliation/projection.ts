import { differenceInCalendarDays, parseISO } from 'date-fns';

export function periodCalendarDays(from: string, to: string): number {
  const start = parseISO(from);
  const end = parseISO(to);
  const d = differenceInCalendarDays(end, start) + 1;
  return Math.max(1, d);
}

export function elapsedDaysInPeriod(from: string, to: string, asOf: Date = new Date()): number {
  const start = parseISO(from);
  const end = parseISO(to);
  const cap = asOf > end ? end : asOf < start ? start : asOf;
  return Math.max(1, differenceInCalendarDays(cap, start) + 1);
}

/** Proyección lineal al cierre del periodo. */
export function projectToPeriodEnd(real: number, from: string, to: string, asOf: Date = new Date()): number {
  const total = periodCalendarDays(from, to);
  const elapsed = elapsedDaysInPeriod(from, to, asOf);
  if (elapsed <= 0 || real <= 0) return 0;
  return (real / elapsed) * total;
}

export function metaForPeriod(dailyMeta: number, from: string, to: string): number {
  return dailyMeta * periodCalendarDays(from, to);
}

export function cumplimientoPct(real: number, meta: number): number {
  if (meta <= 0) return real > 0 ? 100 : 0;
  return Math.round((real / meta) * 1000) / 10;
}

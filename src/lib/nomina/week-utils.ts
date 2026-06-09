import { addDays, format, parseISO } from 'date-fns';
import { getWeekStart as rotacionGetWeekStart } from '@/lib/rotacion-personal';

export { getWeekStart } from '@/lib/rotacion-personal';

export function getWeekEnd(weekStart: string): string {
  return format(addDays(parseISO(weekStart), 6), 'yyyy-MM-dd');
}

export function normalizeWeekStart(isoDate: string): string {
  return rotacionGetWeekStart(parseISO(isoDate));
}

export function normalizePreviewRange(
  rangeStart: string,
  rangeEnd: string,
): { start: string; end: string } {
  const start = rangeStart <= rangeEnd ? rangeStart : rangeEnd;
  const end = rangeStart <= rangeEnd ? rangeEnd : rangeStart;
  return { start, end };
}

export function listWeekStartsInRange(rangeStart: string, rangeEnd: string): string[] {
  const { start, end } = normalizePreviewRange(rangeStart, rangeEnd);
  const weeks: string[] = [];
  let cur = rotacionGetWeekStart(parseISO(start));
  const endDate = parseISO(end);
  let guard = 0;
  while (cur <= format(endDate, 'yyyy-MM-dd') && guard < 520) {
    weeks.push(cur);
    cur = format(addDays(parseISO(cur), 7), 'yyyy-MM-dd');
    guard += 1;
  }
  return weeks;
}

import type { ParsedWeekColumn } from '@/lib/nomina/types';

/** Columnas de semana laboral (excluye bono de transporte u otros auxiliares). */
export function getPayrollWeekColumns(weekColumns: ParsedWeekColumn[]): ParsedWeekColumn[] {
  return weekColumns.filter((c) => c.columnKind !== 'bono');
}

/** Semanas laborales en el rango del documento (p. ej. 13 abr–3 may → 3 semanas). */
export function countPayrollWeeksInRange(rangeStart: string, rangeEnd: string): number {
  if (!rangeStart || !rangeEnd) return 0;
  return listWeekStartsInRange(rangeStart, rangeEnd).length;
}

export function describePayrollWeekCount(period: {
  rangeStart: string;
  rangeEnd: string;
  weekColumns: ParsedWeekColumn[];
}): { payrollWeeks: number; hasBonoColumn: boolean } {
  const inRange = countPayrollWeeksInRange(period.rangeStart, period.rangeEnd);
  const payrollWeeks =
    inRange > 0 ? inRange : getPayrollWeekColumns(period.weekColumns).length;
  const hasBonoColumn = period.weekColumns.some((c) => c.columnKind === 'bono');
  return { payrollWeeks, hasBonoColumn };
}

export function inferColumnKind(header: string): 'libre' | 'trabajada' | 'bono' | 'unknown' {
  const h = header.toLowerCase();
  if (/bono.*transporte|transporte.*bono|^bono\b/i.test(h)) return 'bono';
  if (/libre|reposo|vacacion/i.test(h)) return 'libre';
  if (/trabajad|1ra|2da|primera|segunda/i.test(h)) return 'trabajada';
  return 'unknown';
}

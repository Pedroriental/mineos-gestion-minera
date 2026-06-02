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

export function inferColumnKind(header: string): 'libre' | 'trabajada' | 'unknown' {
  const h = header.toLowerCase();
  if (/libre|reposo|vacacion/i.test(h)) return 'libre';
  if (/trabajad|1ra|2da|primera|segunda/i.test(h)) return 'trabajada';
  return 'unknown';
}

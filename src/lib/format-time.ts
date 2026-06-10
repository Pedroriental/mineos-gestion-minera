export type Meridiem = 'AM' | 'PM';

export const HOURS_12 = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;
export const MERIDIEMS: Meridiem[] = ['AM', 'PM'];

export function pad2(n: number) {
  return String(n).padStart(2, '0');
}

export function normalizeTime(value?: string | null) {
  if (!value?.trim()) return '';
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!match) return '';
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return '';
  return `${pad2(hour)}:${pad2(minute)}`;
}

export function from24h(hour24: number): { hour12: number; period: Meridiem } {
  const period: Meridiem = hour24 < 12 ? 'AM' : 'PM';
  const hour12 = hour24 % 12 || 12;
  return { hour12, period };
}

export function to24h(hour12: number, period: Meridiem): number {
  if (period === 'AM') return hour12 === 12 ? 0 : hour12;
  return hour12 === 12 ? 12 : hour12 + 12;
}

export function formatTime12h(value?: string | null, fallback = '—'): string {
  const normalized = normalizeTime(value);
  if (!normalized) return fallback;
  const [h, m] = normalized.split(':').map(Number);
  const { hour12, period } = from24h(h);
  return `${hour12}:${pad2(m)} ${period}`;
}

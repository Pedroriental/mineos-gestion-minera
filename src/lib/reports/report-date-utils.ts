import { parseISO, format, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';

export function safeFormatDate(dateStr: string, pattern: string): string {
  try {
    const date = parseISO(dateStr);
    return format(date, pattern, { locale: es });
  } catch {
    return dateStr;
  }
}

export function getWeekRangeLabel(dateStr: string): string {
  try {
    const date = parseISO(dateStr);
    const start = startOfWeek(date, { weekStartsOn: 1 });
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return `${format(start, 'dd/MM')} al ${format(end, 'dd/MM/yyyy')}`;
  } catch {
    return dateStr;
  }
}

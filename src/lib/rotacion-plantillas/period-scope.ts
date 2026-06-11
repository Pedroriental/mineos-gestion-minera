import { endOfMonth, format, parseISO, startOfMonth } from 'date-fns';

export type PeriodoOperativo = {
  label: string;
  inicio: string;
  fin: string;
};

/** Deriva periodo mensual desde el lunes de inicio de ciclo. */
export function periodoOperativoDesdeSemana(weekStartIso: string): PeriodoOperativo {
  const d = parseISO(weekStartIso);
  const inicio = format(startOfMonth(d), 'yyyy-MM-dd');
  const fin = format(endOfMonth(d), 'yyyy-MM-dd');
  const label = format(d, 'MMMM yyyy');
  return { label, inicio, fin };
}

export function semanaEnPeriodoOperativo(
  weekStart: string,
  periodo: Pick<PeriodoOperativo, 'inicio' | 'fin'> | null | undefined,
): boolean {
  if (!periodo?.inicio || !periodo?.fin) return true;
  return weekStart >= periodo.inicio && weekStart <= periodo.fin;
}

export type ModoCargaNomina = 'historico' | 'operativo';

export function labelImportPeriodo(input: {
  modo: ModoCargaNomina;
  rangeStart: string;
  rangeEnd: string;
  customLabel?: string;
}): string {
  if (input.customLabel?.trim()) {
    const prefix = input.modo === 'historico' ? '[Histórico] ' : '[Operativo] ';
    return `${prefix}${input.customLabel.trim()}`;
  }
  const prefix = input.modo === 'historico' ? '[Histórico] ' : '[Operativo] ';
  return `${prefix}${input.rangeStart} — ${input.rangeEnd}`;
}

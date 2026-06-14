import type { NominaPeriodoSummary } from '@/lib/nomina/types';

export type NominaMesResumen = {
  id: string;
  label: string;
  rangeStart: string;
  rangeEnd: string;
  totalUsd: number;
  createdAt: string;
  cicloCount: number;
  semanaCount: number;
  cicloPeriodoIds: string[];
};

export const ORIGEN_CIERRE_MES = 'cierre_mes';

export const ORIGENES_CICLO_CONSOLIDABLE = [
  'consolidacion_manual',
  'cierre_operativo',
] as const;

export function periodoEsCierreMes(p: Pick<NominaPeriodoSummary, 'origen'>): boolean {
  return p.origen === ORIGEN_CIERRE_MES;
}

export function periodoEsCicloConsolidado(p: Pick<NominaPeriodoSummary, 'origen'>): boolean {
  return (ORIGENES_CICLO_CONSOLIDABLE as readonly string[]).includes(p.origen);
}

export function periodoArea(p: NominaPeriodoSummary): string | null {
  const area = p.metadata?.area;
  return typeof area === 'string' && area.trim() ? area.trim() : null;
}

/** Rango calendario que cubren los ciclos seleccionados. */
export function rangoDesdeCiclos(
  ciclos: Array<Pick<NominaPeriodoSummary, 'rangeStart' | 'rangeEnd'>>,
): { rangeStart: string; rangeEnd: string } | null {
  if (!ciclos.length) return null;
  let rangeStart = ciclos[0]!.rangeStart;
  let rangeEnd = ciclos[0]!.rangeEnd;
  for (const c of ciclos.slice(1)) {
    if (c.rangeStart < rangeStart) rangeStart = c.rangeStart;
    if (c.rangeEnd > rangeEnd) rangeEnd = c.rangeEnd;
  }
  return { rangeStart, rangeEnd };
}

export function totalUsdDesdeCiclos(
  ciclos: Array<Pick<NominaPeriodoSummary, 'totalUsd'>>,
): number {
  return parseFloat(ciclos.reduce((s, c) => s + Number(c.totalUsd || 0), 0).toFixed(2));
}

export function semanaCountDesdeCiclos(
  ciclos: Array<Pick<NominaPeriodoSummary, 'semanaCount'>>,
): number {
  return ciclos.reduce((s, c) => s + Number(c.semanaCount || 0), 0);
}

export function sugerirEtiquetaMes(
  ciclos: Array<Pick<NominaPeriodoSummary, 'rangeStart' | 'rangeEnd' | 'label'>>,
): string {
  const rango = rangoDesdeCiclos(ciclos);
  if (!rango) return 'Cierre de mes';
  const mid = ciclos.length === 1 ? ciclos[0]!.rangeStart : rango.rangeStart;
  const [y, m] = mid.split('-');
  const meses = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ];
  const idx = Number(m) - 1;
  const nombreMes = meses[idx] ?? m;
  return `Nómina ${nombreMes} ${y}`;
}

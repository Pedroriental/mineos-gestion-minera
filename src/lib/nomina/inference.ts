import { addDays, format, parseISO } from 'date-fns';
import { calculateExpectedAttendance } from '@/lib/rotacion-personal';
import type { EstadoAsistenciaNomina } from '@/lib/nomina-calculo';
import type { Personal } from '@/lib/types';
import type { InferredWorkerProfile, ParsedWorkerCell, ParsedWorkerRow } from '@/lib/nomina/types';
import { getWeekStart, inferColumnKind } from '@/lib/nomina/week-utils';

const ESQUEMAS: Personal['esquema_rotacion'][] = [
  'FIJO_SEMANAL',
  'MINA_2X1',
  'MOLINO_ROTATIVO',
  'MINA_ROTATIVA_3G',
  'MOLINO_15X15',
  'MOLINO_FIJO',
];

const AMOUNT_TOLERANCE = 0.5;

function clusterAmounts(amounts: number[]): number[] {
  const sorted = [...amounts].filter((a) => a > 0).sort((a, b) => a - b);
  if (!sorted.length) return [];
  const clusters: number[] = [];
  for (const amt of sorted) {
    const existing = clusters.find((c) => Math.abs(c - amt) <= AMOUNT_TOLERANCE);
    if (!existing) clusters.push(amt);
  }
  return clusters.sort((a, b) => b - a);
}

function nearestCluster(amount: number, clusters: number[]): number | null {
  if (amount <= 0) return null;
  let best: number | null = null;
  let bestDiff = Infinity;
  for (const c of clusters) {
    const diff = Math.abs(c - amount);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = c;
    }
  }
  return bestDiff <= AMOUNT_TOLERANCE ? best : null;
}

type WeekColumnKind = 'libre' | 'trabajada' | 'bono' | 'unknown';

function inferEstadoFromCell(
  cell: ParsedWorkerCell,
  columnKind: WeekColumnKind,
  clusters: number[],
  salarioLibre: number,
  salarioBase: number,
): EstadoAsistenciaNomina {
  if (cell.amount <= 0) return 'no_laborado';
  if (columnKind === 'libre') return 'libre';
  if (columnKind === 'trabajada') return 'trabajada';

  const nearest = nearestCluster(cell.amount, clusters);
  if (nearest !== null && salarioLibre > 0 && Math.abs(nearest - salarioLibre) <= AMOUNT_TOLERANCE) {
    return 'libre';
  }
  if (nearest !== null && salarioBase > 0 && Math.abs(nearest - salarioBase) <= AMOUNT_TOLERANCE) {
    return 'trabajada';
  }
  if (salarioLibre > 0 && Math.abs(cell.amount - salarioLibre) <= AMOUNT_TOLERANCE) return 'libre';
  return 'trabajada';
}

function scoreEsquema(
  esquema: string,
  rotacionInicio: string,
  weekStarts: string[],
  estados: EstadoAsistenciaNomina[],
): number {
  let matches = 0;
  for (let i = 0; i < weekStarts.length; i++) {
    const expected = calculateExpectedAttendance(esquema, rotacionInicio, weekStarts[i]);
    if (expected === estados[i]) matches += 1;
    else if (expected === 'no_laborado' && estados[i] === 'libre') matches += 0.5;
  }
  return weekStarts.length ? matches / weekStarts.length : 0;
}

function findBestRotation(
  weekStarts: string[],
  estados: EstadoAsistenciaNomina[],
): { esquema: Personal['esquema_rotacion']; rotacion_inicio_fecha: string | null; score: number } {
  if (weekStarts.length === 0) {
    return { esquema: 'FIJO_SEMANAL', rotacion_inicio_fecha: null, score: 1 };
  }

  const anchor = weekStarts[0];
  let best = { esquema: 'FIJO_SEMANAL' as Personal['esquema_rotacion'], rotacion_inicio_fecha: anchor as string | null, score: 0 };

  for (const esquema of ESQUEMAS) {
    if (esquema === 'FIJO_SEMANAL' || esquema === 'MOLINO_FIJO') {
      const allTrabajada = estados.every((e) => e === 'trabajada' || e === 'no_laborado');
      const score = allTrabajada ? 0.85 : 0.3;
      if (score > best.score) {
        best = { esquema, rotacion_inicio_fecha: esquema === 'FIJO_SEMANAL' ? null : anchor, score };
      }
      continue;
    }

    for (let offset = 0; offset < 52; offset++) {
      const rotStart = format(addDays(parseISO(anchor), -7 * offset), 'yyyy-MM-dd');
      const rotStartMonday = getWeekStart(rotStart);
      const score = scoreEsquema(esquema, rotStartMonday, weekStarts, estados);
      if (score > best.score) {
        best = { esquema, rotacion_inicio_fecha: rotStartMonday, score };
      }
    }
  }

  return best;
}

export function inferWorkerProfile(
  row: ParsedWorkerRow,
  weekStarts: string[],
  columnKinds: Record<string, WeekColumnKind>,
): InferredWorkerProfile {
  const amounts = weekStarts.map((w) => row.weeks[w]?.amount ?? 0);
  const clusters = clusterAmounts(amounts);
  const salario_base = clusters[0] ?? 0;
  const salario_libre = clusters.length > 1 ? clusters[clusters.length - 1] : salario_base;

  const weekEstados: Record<string, EstadoAsistenciaNomina> = {};
  for (const w of weekStarts) {
    const cell = row.weeks[w] ?? { amount: 0 };
    const kind = columnKinds[w] ?? 'unknown';
    weekEstados[w] = inferEstadoFromCell(cell, kind, clusters, salario_libre, salario_base);
    if (cell.estado) weekEstados[w] = cell.estado;
  }

  const estadoList = weekStarts.map((w) => weekEstados[w]);
  const rotation = findBestRotation(weekStarts, estadoList);
  const hasLibre = estadoList.some((e) => e === 'libre');
  const confidence = parseFloat(
    Math.min(1, rotation.score * (clusters.length ? 1 : 0.5) * (hasLibre || rotation.esquema === 'FIJO_SEMANAL' ? 1 : 0.9)).toFixed(2),
  );

  const notes: string[] = [];
  if (confidence < 0.85) notes.push('Revisar esquema de rotación inferido');
  if (clusters.length > 2) notes.push('Múltiples tarifas detectadas');

  return {
    cedula: row.cedula,
    salario_base,
    salario_libre: hasLibre ? salario_libre : salario_base,
    esquema_rotacion: rotation.esquema,
    rotacion_inicio_fecha: rotation.rotacion_inicio_fecha,
    confidence,
    needsReview: confidence < 0.85,
    weekEstados,
    notes,
  };
}

export function buildColumnKinds(
  weekColumns: Array<{ weekStart: string; rawHeader: string; header: string }>,
): Record<string, WeekColumnKind> {
  const out: Record<string, WeekColumnKind> = {};
  for (const col of weekColumns) {
    out[col.weekStart] = inferColumnKind(col.rawHeader || col.header);
  }
  return out;
}

export function inferAllProfiles(
  rows: ParsedWorkerRow[],
  weekStarts: string[],
  weekColumns: Array<{ weekStart: string; rawHeader: string; header: string }>,
): InferredWorkerProfile[] {
  const columnKinds = buildColumnKinds(weekColumns);
  return rows.filter((r) => r._valid).map((r) => inferWorkerProfile(r, weekStarts, columnKinds));
}

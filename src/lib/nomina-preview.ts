import {
  differenceInCalendarDays,
  differenceInCalendarMonths,
  format,
  isSameDay,
  parseISO,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { getGrupoNominaKey } from '@/lib/personal-master';
import { predictWeekPay, type EstadoAsistenciaNomina } from '@/lib/nomina-calculo';
import {
  NOVEDAD_TURNO_LABEL,
  NOVEDAD_TURNO_PREVIEW_LABEL,
  hasNovedadTurno,
  parseNovedadTurno,
  type NominaNovedadTurno,
} from '@/lib/nomina-novedad-turno';
import { getWeekStart } from '@/lib/rotacion-personal';
import type { Personal } from '@/lib/types';

export type NominaPreviewPeriodKind = 'day' | 'days' | 'week' | 'weeks' | 'long';

export type NominaPreviewWeekCol = {
  weekStart: string;
  weekEnd: string;
  /** Fechas visibles acotadas al rango elegido por el usuario */
  displayStart: string;
  displayEnd: string;
  header: string;
  /** Semana de nómina solo parcialmente dentro del rango */
  isPartialInRange: boolean;
};

export type NominaPreviewWeekCell = {
  amount: number;
  estado: EstadoAsistenciaNomina;
  source: 'cerrada' | 'calculada';
};

export type NominaPreviewWorkerRow = {
  personal: Personal;
  weeks: Record<string, NominaPreviewWeekCell>;
  total: number;
  observaciones: string;
};

export type NominaPreviewNovedad = {
  id: string;
  fecha: string | null;
  nombre: string;
  cedula: string;
  area: string;
  tipo: string;
  detalle: string;
};

export type NominaPreviewSection = {
  id: string;
  title: string;
  subtitle: string;
  rows: NominaPreviewWorkerRow[];
  sectionTotal: number;
};

export type NominaPreviewReport = {
  periodLabel: string;
  periodKind: NominaPreviewPeriodKind;
  rangeDays: number;
  rangeStart: string;
  rangeEnd: string;
  weekColumns: NominaPreviewWeekCol[];
  summary: { id: string; label: string; total: number }[];
  sections: NominaPreviewSection[];
  novedades: NominaPreviewNovedad[];
  grandTotal: number;
  stats: {
    closedCells: number;
    calculatedCells: number;
  };
};

/** Normaliza rango y devuelve ISO dates (inicio ≤ fin). */
export function normalizePreviewRange(rangeStart: string, rangeEnd: string): { start: string; end: string } {
  let start = rangeStart;
  let end = rangeEnd;
  if (start > end) {
    const t = start;
    start = end;
    end = t;
  }
  return { start, end };
}

export type NominaRegistroCerrado = {
  personal_id: string;
  semana_inicio: string;
  area: string;
  monto_pagado: number;
  es_semana_libre: boolean;
  estado_asistencia?: 'trabajada' | 'libre' | 'no_laborado' | null;
  dias_trabajados?: number | null;
  salario_base_calculado?: number | null;
  novedad_turno?: string | null;
  novedad_turno_obs?: string | null;
};

function getWeekEnd(weekStart: string): string {
  const d = new Date(weekStart + 'T12:00:00');
  d.setDate(d.getDate() + 6);
  return d.toISOString().split('T')[0];
}

/** Semanas de nómina (lun–dom) que intersectan el rango [inicio, fin]. */
export function listWeekStartsInRange(rangeStart: string, rangeEnd: string): string[] {
  const { start, end } = normalizePreviewRange(rangeStart, rangeEnd);
  const weeks: string[] = [];
  let cur = getWeekStart(parseISO(start));

  for (let guard = 0; guard < 120; guard++) {
    if (cur > end) break;
    const weekEnd = getWeekEnd(cur);
    if (weekEnd >= start) weeks.push(cur);
    const d = new Date(cur + 'T12:00:00');
    d.setDate(d.getDate() + 7);
    cur = d.toISOString().split('T')[0];
  }

  return weeks;
}

function fmtPreviewDate(d: Date, withYear = false): string {
  return format(d, withYear ? 'dd MMM yyyy' : 'dd MMM', { locale: es }).toUpperCase();
}

/** Título principal del reporte según el rango elegido (día, semanas, meses, etc.). */
export function formatPreviewPeriodLabel(rangeStart: string, rangeEnd: string): {
  label: string;
  kind: NominaPreviewPeriodKind;
  rangeDays: number;
} {
  const { start, end } = normalizePreviewRange(rangeStart, rangeEnd);
  const startDate = parseISO(start);
  const endDate = parseISO(end);
  const rangeDays = differenceInCalendarDays(endDate, startDate) + 1;
  const weekCount = listWeekStartsInRange(start, end).length;

  if (rangeDays === 1 || isSameDay(startDate, endDate)) {
    return { label: `Día ${fmtPreviewDate(startDate, true)}`, kind: 'day', rangeDays };
  }

  if (rangeDays < 7 && weekCount <= 1) {
    return {
      label: `Periodo del ${fmtPreviewDate(startDate)} al ${fmtPreviewDate(endDate, true)} (${rangeDays} días)`,
      kind: 'days',
      rangeDays,
    };
  }

  if (weekCount === 1) {
    const ws = listWeekStartsInRange(start, end)[0];
    const we = getWeekEnd(ws);
    const clipStart = start > ws ? start : ws;
    const clipEnd = end < we ? end : we;
    if (clipStart === ws && clipEnd === we && rangeDays === 7) {
      return {
        label: `Semana del ${fmtPreviewDate(parseISO(ws))} al ${fmtPreviewDate(parseISO(we), true)}`,
        kind: 'week',
        rangeDays,
      };
    }
    return {
      label: `Semana del ${fmtPreviewDate(parseISO(clipStart))} al ${fmtPreviewDate(parseISO(clipEnd), true)}`,
      kind: 'week',
      rangeDays,
    };
  }

  const monthsSpan = differenceInCalendarMonths(endDate, startDate) + 1;
  const sameYear = startDate.getFullYear() === endDate.getFullYear();
  const rangeText = sameYear
    ? `del ${fmtPreviewDate(startDate)} al ${fmtPreviewDate(endDate, true)}`
    : `del ${fmtPreviewDate(startDate, true)} al ${fmtPreviewDate(endDate, true)}`;

  if (monthsSpan >= 2) {
    return {
      label: `Período ${rangeText} · ${weekCount} semanas · ${monthsSpan} meses`,
      kind: 'long',
      rangeDays,
    };
  }

  return {
    label: `Período ${rangeText} · ${weekCount} semanas`,
    kind: 'weeks',
    rangeDays,
  };
}

export function formatWeekColumnHeader(
  weekStart: string,
  weekEnd: string,
  index: number,
  totalWeeks: number,
  rangeStart: string,
  rangeEnd: string,
): { header: string; displayStart: string; displayEnd: string; isPartialInRange: boolean } {
  const displayStart = rangeStart > weekStart ? rangeStart : weekStart;
  const displayEnd = rangeEnd < weekEnd ? rangeEnd : weekEnd;
  const isPartialInRange = displayStart !== weekStart || displayEnd !== weekEnd;

  const a = fmtPreviewDate(parseISO(displayStart));
  const b = fmtPreviewDate(parseISO(displayEnd));

  let header: string;
  if (totalWeeks === 1) {
    header = isPartialInRange ? `${a} al ${b}` : `Semana ${a} al ${b}`;
  } else {
    header = `${index + 1}. ${a} al ${b}`;
  }

  return { header, displayStart, displayEnd, isPartialInRange };
}

function buildObservaciones(
  weeks: Record<string, NominaPreviewWeekCell>,
  novedadesSemana: Array<{ weekStart: string; novedad: NominaNovedadTurno; obs: string }>,
): string {
  const parts: string[] = [];

  for (const n of novedadesSemana) {
    if (!hasNovedadTurno(n.novedad, n.obs)) continue;
    const label = NOVEDAD_TURNO_LABEL[n.novedad] || n.novedad;
    parts.push(n.obs.trim() ? `${label}: ${n.obs.trim()}` : label);
  }

  const librePagada = Object.values(weeks).some((w) => w.estado === 'libre' && w.amount > 0);
  const noLaborado = Object.values(weeks).some((w) => w.estado === 'no_laborado');
  if (librePagada) parts.push('Semana libre');
  if (noLaborado) parts.push('No laborado');
  return parts.length ? parts.join(' · ') : '—';
}

export function buildNominaPreviewNovedadesDesdeRegistros(
  registros: NominaRegistroCerrado[],
  personalById: Map<string, Personal>,
  rangeStart: string,
  rangeEnd: string,
): NominaPreviewNovedad[] {
  const { start, end } = normalizePreviewRange(rangeStart, rangeEnd);
  const weekSet = new Set(listWeekStartsInRange(start, end));
  const items: NominaPreviewNovedad[] = [];

  for (const r of registros) {
    if (!weekSet.has(r.semana_inicio)) continue;
    const novedad = parseNovedadTurno(r.novedad_turno);
    const obs = (r.novedad_turno_obs || '').trim();
    if (!hasNovedadTurno(novedad, obs)) continue;

    const p = personalById.get(r.personal_id);
    items.push({
      id: `${r.personal_id}|${r.semana_inicio}`,
      fecha: r.semana_inicio,
      nombre: p?.nombre_completo || 'Trabajador',
      cedula: p?.cedula || '—',
      area: p?.area || r.area,
      tipo: NOVEDAD_TURNO_PREVIEW_LABEL[novedad] || novedad,
      detalle: obs || '—',
    });
  }

  return items.sort(
    (a, b) =>
      (a.fecha || '').localeCompare(b.fecha || '') ||
      a.nombre.localeCompare(b.nombre, 'es'),
  );
}

function isAdminCargo(cargo: string): boolean {
  const c = cargo.toLowerCase();
  return c.includes('administr') || c.includes('oficina') || c.includes('contab');
}

export function resolvePreviewSection(p: Personal): { id: string; title: string; subtitle: string } {
  const cargo = (p.cargo || '').trim();
  if (p.area === 'planta') {
    if (isAdminCargo(cargo)) {
      return {
        id: 'planta_admin',
        title: 'Nómina Administrativos Molinos',
        subtitle: 'Personal administrativo en planta / molino',
      };
    }
    return {
      id: 'planta_operativos',
      title: 'Semanas Molinos — Grupo operativo',
      subtitle: 'Operación de molino (esquemas rotativos y fijos)',
    };
  }
  if (p.area === 'administracion') {
    return {
      id: 'admin_mina',
      title: 'Nómina Administrativos Mina',
      subtitle: 'Administración central y soporte mina',
    };
  }
  if (p.area === 'mina') {
    const grupo = getGrupoNominaKey(p);
    return {
      id: `mina__${grupo}`,
      title: `Semanas Mina Belén — ${grupo}`,
      subtitle: 'Agrupado por vertical / asignación (biblioteca + área detalle)',
    };
  }
  return {
    id: `${p.area}_general`,
    title: `Nómina ${p.area}`,
    subtitle: cargo || 'Sin cargo',
  };
}

const SECTION_ORDER = [
  'planta_admin',
  'planta_operativos',
  'admin_mina',
  'mina__',
];

function sectionSortKey(id: string): number {
  const idx = SECTION_ORDER.findIndex((p) => id.startsWith(p.replace('__', '')) || id === p);
  if (idx >= 0) return idx;
  if (id.startsWith('mina__')) return 10;
  return 99;
}

export function buildNominaPreviewReport(input: {
  personal: Personal[];
  rangeStart: string;
  rangeEnd: string;
  registrosCerrados: NominaRegistroCerrado[];
  valesPorPersonal?: Record<string, number>;
}): NominaPreviewReport {
  const { personal, registrosCerrados, valesPorPersonal = {} } = input;
  const { start: rangeStart, end: rangeEnd } = normalizePreviewRange(
    input.rangeStart,
    input.rangeEnd,
  );

  const weekStarts = listWeekStartsInRange(rangeStart, rangeEnd);
  const weekSet = new Set(weekStarts);
  const periodMeta = formatPreviewPeriodLabel(rangeStart, rangeEnd);

  const weekColumns: NominaPreviewWeekCol[] = weekStarts.map((weekStart, i) => {
    const weekEnd = getWeekEnd(weekStart);
    const col = formatWeekColumnHeader(
      weekStart,
      weekEnd,
      i,
      weekStarts.length,
      rangeStart,
      rangeEnd,
    );
    return {
      weekStart,
      weekEnd,
      displayStart: col.displayStart,
      displayEnd: col.displayEnd,
      header: col.header,
      isPartialInRange: col.isPartialInRange,
    };
  });

  const periodLabel =
    weekColumns.length > 0
      ? periodMeta.label
      : `Sin semanas de nómina entre ${format(parseISO(rangeStart), 'dd/MM/yyyy')} y ${format(parseISO(rangeEnd), 'dd/MM/yyyy')}`;

  const cerradoMap = new Map<string, NominaRegistroCerrado>();
  for (const r of registrosCerrados) {
    if (!weekSet.has(r.semana_inicio)) continue;
    cerradoMap.set(`${r.personal_id}|${r.semana_inicio}|${r.area}`, r);
  }

  const sectionMap = new Map<string, NominaPreviewSection>();
  let closedCells = 0;
  let calculatedCells = 0;

  for (const p of personal) {
    if (p.estatus && p.estatus !== 'ACTIVO') continue;
    if (p.fecha_ingreso && p.fecha_ingreso > rangeEnd) continue;
    const meta = resolvePreviewSection(p);
    if (!sectionMap.has(meta.id)) {
      sectionMap.set(meta.id, {
        id: meta.id,
        title: meta.title,
        subtitle: meta.subtitle,
        rows: [],
        sectionTotal: 0,
      });
    }

    const weeks: Record<string, NominaPreviewWeekCell> = {};
    const novedadesSemana: Array<{ weekStart: string; novedad: NominaNovedadTurno; obs: string }> =
      [];
    let total = 0;

    for (const w of weekColumns) {
      if (p.fecha_ingreso && p.fecha_ingreso > w.weekEnd) {
        weeks[w.weekStart] = { amount: 0, estado: 'no_laborado', source: 'calculada' };
        calculatedCells += 1;
        continue;
      }

      const closed = cerradoMap.get(`${p.id}|${w.weekStart}|${p.area}`);
      if (closed) {
        const estado =
          closed.estado_asistencia ??
          (closed.es_semana_libre ? 'libre' : 'trabajada');
        weeks[w.weekStart] = {
          amount: Number(closed.monto_pagado),
          estado,
          source: 'cerrada',
        };
        novedadesSemana.push({
          weekStart: w.weekStart,
          novedad: parseNovedadTurno(closed.novedad_turno),
          obs: closed.novedad_turno_obs || '',
        });
        closedCells += 1;
      } else {
        const vales = valesPorPersonal[p.id] || 0;
        const pred = predictWeekPay(p, w.weekStart, w.weekStart === weekStarts[weekStarts.length - 1] ? vales : 0);
        weeks[w.weekStart] = {
          amount: pred.amount,
          estado: pred.estado,
          source: pred.source,
        };
        calculatedCells += 1;
      }
      total += weeks[w.weekStart].amount;
    }

    sectionMap.get(meta.id)!.rows.push({
      personal: p,
      weeks,
      total,
      observaciones: buildObservaciones(weeks, novedadesSemana),
    });
  }

  const sections = [...sectionMap.values()]
    .map((s) => {
      s.rows.sort((a, b) => a.personal.nombre_completo.localeCompare(b.personal.nombre_completo, 'es'));
      s.sectionTotal = s.rows.reduce((n, r) => n + r.total, 0);
      return s;
    })
    .sort((a, b) => sectionSortKey(a.id) - sectionSortKey(b.id) || a.title.localeCompare(b.title, 'es'));

  const summary = sections.map((s) => ({
    id: s.id,
    label: s.title.replace(/^Semanas Mina Belén — /, 'Nóminas ').replace(/^Semanas Molinos — /, 'Nómina '),
    total: s.sectionTotal,
  }));

  const grandTotal = summary.reduce((n, s) => n + s.total, 0);
  const personalById = new Map(personal.map((p) => [p.id, p]));
  const novedades = buildNominaPreviewNovedadesDesdeRegistros(
    registrosCerrados,
    personalById,
    rangeStart,
    rangeEnd,
  );

  return {
    periodLabel,
    periodKind: periodMeta.kind,
    rangeDays: periodMeta.rangeDays,
    rangeStart,
    rangeEnd,
    weekColumns,
    summary,
    sections,
    novedades,
    grandTotal,
    stats: { closedCells, calculatedCells },
  };
}

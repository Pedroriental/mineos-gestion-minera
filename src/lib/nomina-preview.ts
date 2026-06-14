import {
  differenceInCalendarDays,
  differenceInCalendarMonths,
  format,
  isSameDay,
  parseISO,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { getGrupoNominaKey, normalizeAreaDetalle } from '@/lib/personal-master';
import {
  cleanSectionName,
  inferAreaFromSection,
  resolveSectionMeta,
} from '@/lib/nomina/section-resolver';
import { buildArchiveMap, resolveNominaCell } from '@/lib/nomina/engine';
import type { EstadoAsistenciaNomina } from '@/lib/nomina-calculo';
import {
  NOVEDAD_TURNO_LABEL,
  NOVEDAD_TURNO_PREVIEW_LABEL,
  hasNovedadTurno,
  parseNovedadTurno,
  type NominaNovedadTurno,
} from '@/lib/nomina-novedad-turno';
import { getWeekStart } from '@/lib/rotacion-personal';
import { inferPayrollSectionFromLabel } from '@/lib/nomina/manual-period';
import type { PersonalSnapshot, ParsedNominaPeriod, NominaPeriodoSummary } from '@/lib/nomina/types';
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
  /** Derivado de la rotación: la semana siguiente al rango le corresponde libre. */
  saleLibre: boolean;
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
  personal_snapshot?: PersonalSnapshot | null;
  periodo_id?: string | null;
};

function getWeekEnd(weekStart: string): string {
  const d = new Date(weekStart + 'T12:00:00');
  d.setDate(d.getDate() + 6);
  return d.toISOString().split('T')[0];
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + days);
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
  derived?: { saleLibre?: boolean; retirado?: boolean },
): string {
  const parts: string[] = [];

  if (derived?.retirado) parts.push('Retirado');

  for (const n of novedadesSemana) {
    if (!hasNovedadTurno(n.novedad, n.obs)) continue;
    const label = NOVEDAD_TURNO_LABEL[n.novedad] || n.novedad;
    let part = '';
    if (n.obs.trim()) {
      if (n.novedad === 'ACTIVO') {
        part = n.obs.trim();
      } else if (n.obs.trim().toLowerCase() === label.toLowerCase()) {
        part = label;
      } else {
        part = `${label}: ${n.obs.trim()}`;
      }
    } else {
      part = label;
    }
    if (part && !parts.includes(part)) {
      parts.push(part);
    }
  }

  const librePagada = Object.values(weeks).some((w) => w.estado === 'libre' && w.amount > 0);
  const noLaborado = Object.values(weeks).some((w) => w.estado === 'no_laborado');
  const hasAbsenceNovelty = novedadesSemana.some(
    (n) => n.novedad === 'REPOSO' || n.novedad === 'VACACIONES' || n.novedad === 'AUSENCIA',
  );

  if (librePagada) parts.push('Semana libre');
  if (noLaborado && !hasAbsenceNovelty) parts.push('No laborado');
  if (derived?.saleLibre && !parts.includes('Salen libre')) parts.push('Salen libre');
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
  
  // Agrupar por clave: `${personal_id}|${tipo}|${detalle}`
  const groupedMap = new Map<string, NominaPreviewNovedad>();

  for (const r of registros) {
    if (!weekSet.has(r.semana_inicio)) continue;
    const novedad = parseNovedadTurno(r.novedad_turno);
    const obs = (r.novedad_turno_obs || '').trim();
    if (!hasNovedadTurno(novedad, obs)) continue;

    const p = personalById.get(r.personal_id);
    const nombre = p?.nombre_completo || 'Trabajador';
    const cedula = p?.cedula || '—';
    const area = p?.area || r.area;
    const tipo = NOVEDAD_TURNO_PREVIEW_LABEL[novedad] || novedad;
    const detalle = obs || '—';

    const groupKey = `${r.personal_id}|${tipo}|${detalle}`;
    if (!groupedMap.has(groupKey)) {
      groupedMap.set(groupKey, {
        id: groupKey,   // ← Usar groupKey como id: siempre único por trabajador+tipo+detalle
        fecha: r.semana_inicio,
        nombre,
        cedula,
        area,
        tipo,
        detalle,
      });
    }
  }

  return [...groupedMap.values()].sort(
    (a, b) =>
      a.area.localeCompare(b.area) ||
      a.nombre.localeCompare(b.nombre, 'es') ||
      (a.fecha || '').localeCompare(b.fecha || '')
  );
}

function isAdminCargo(cargo: string): boolean {
  const c = cargo.toLowerCase();
  return c.includes('administr') || c.includes('oficina') || c.includes('contab');
}

export type NominaPreviewImportSection = {
  id: string;
  title: string;
};

function previewSectionSource(p: Personal): string {
  const area = p.area || 'mina';
  const detalle = (p.area_detalle || '').trim();
  const normalizedDetalle = detalle ? normalizeAreaDetalle(detalle, area) : null;
  if (normalizedDetalle) return normalizedDetalle;

  const cargo = (p.cargo || '').trim();
  if (cargo) {
    const normalizedCargo = normalizeAreaDetalle(cargo, area);
    if (normalizedCargo) return normalizedCargo;
    return cargo;
  }

  return detalle || cargo;
}

function findImportSectionSpec(
  snapshot: PersonalSnapshot | null | undefined,
  importSectionOrder?: NominaPreviewImportSection[],
): NominaPreviewImportSection | undefined {
  if (!snapshot || !importSectionOrder?.length) return undefined;

  if (snapshot.section_id) {
    const byId = importSectionOrder.find((s) => s.id === snapshot.section_id);
    if (byId) return byId;
  }

  const title = (snapshot.section_title || '').trim();
  if (title) {
    const byTitle = importSectionOrder.find(
      (s) => s.title.toLowerCase() === title.toLowerCase(),
    );
    if (byTitle) return byTitle;
  }

  const det = (snapshot.area_detalle || '').trim();
  if (det && det.toLowerCase() !== 'general') {
    const detLower = det.toLowerCase();
    return importSectionOrder.find(
      (s) =>
        s.title.toLowerCase() === detLower ||
        s.title.toLowerCase().includes(detLower) ||
        detLower.includes(s.title.toLowerCase()),
    );
  }

  return undefined;
}

function resolveWorkerPreviewSection(
  p: Personal,
  snapshot: PersonalSnapshot | null | undefined,
  importSectionOrder?: NominaPreviewImportSection[],
): { id: string; title: string; subtitle: string } {
  const importSpec = findImportSectionSpec(snapshot, importSectionOrder);
  if (importSpec) {
    return { id: importSpec.id, title: importSpec.title, subtitle: '' };
  }

  const enriched: Personal = snapshot
    ? {
        ...p,
        cargo: snapshot.cargo || p.cargo,
        area: (snapshot.area as Personal['area']) || p.area,
        area_detalle: snapshot.area_detalle || p.area_detalle,
      }
    : p;

  return resolvePreviewSectionFromPersonal(enriched);
}

function collectImportPreviewPeople(
  personal: Personal[],
  registrosCerrados: NominaRegistroCerrado[],
  weekSet: Set<string>,
  personalSnapshots: Record<string, PersonalSnapshot | null | undefined>,
  filterArea?: string,
): Personal[] {
  const personalById = new Map(personal.map((p) => [p.id, p]));
  const ids = new Set<string>();
  for (const r of registrosCerrados) {
    if (weekSet.has(r.semana_inicio)) ids.add(r.personal_id);
  }

  return [...ids]
    .map((id) => {
      const existing = personalById.get(id);
      const registroRef = registrosCerrados.find(
        (r) => r.personal_id === id && weekSet.has(r.semana_inicio),
      );
      const snap =
        personalSnapshots[id] ??
        registroRef?.personal_snapshot ??
        null;

      if (snap && existing) {
        return {
          ...existing,
          cedula: snap.cedula || existing.cedula,
          nombre_completo: snap.nombre_completo || existing.nombre_completo,
          cargo: snap.cargo || existing.cargo,
          area: (registroRef?.area as Personal['area']) || (snap.area as Personal['area']) || existing.area,
          area_detalle: snap.area_detalle || existing.area_detalle,
        };
      }
      if (snap) {
        return {
          id,
          cedula: snap.cedula,
          nombre_completo: snap.nombre_completo,
          cargo: snap.cargo,
          area: (registroRef?.area as Personal['area']) || (snap.area as Personal['area']),
          area_detalle: snap.area_detalle,
          salario_base: snap.salario_base,
          salario_libre: snap.salario_libre,
          bono_transporte: snap.bono_transporte,
          esquema_rotacion: snap.esquema_rotacion,
          rotacion_inicio_fecha: snap.rotacion_inicio_fecha,
          fecha_ingreso: existing?.fecha_ingreso ?? null,
          estatus: 'ACTIVO',
        } as Personal;
      }
      if (registroRef) {
        const snapFromReg = registroRef.personal_snapshot;
        return {
          id,
          cedula: snapFromReg?.cedula || existing?.cedula || '—',
          nombre_completo: snapFromReg?.nombre_completo || existing?.nombre_completo || 'Trabajador',
          cargo: snapFromReg?.cargo || existing?.cargo || 'General',
          area: (registroRef.area as Personal['area']) || existing?.area || 'mina',
          area_detalle: snapFromReg?.area_detalle || existing?.area_detalle || null,
          salario_base: Number(snapFromReg?.salario_base ?? existing?.salario_base) || 0,
          salario_libre: Number(snapFromReg?.salario_libre ?? existing?.salario_libre) || 0,
          bono_transporte: Number(snapFromReg?.bono_transporte ?? existing?.bono_transporte) || 0,
          esquema_rotacion: snapFromReg?.esquema_rotacion || existing?.esquema_rotacion || 'FIJO_SEMANAL',
          rotacion_inicio_fecha: snapFromReg?.rotacion_inicio_fecha ?? existing?.rotacion_inicio_fecha ?? null,
          fecha_ingreso: existing?.fecha_ingreso ?? null,
          estatus: existing?.estatus ?? 'ACTIVO',
        } as Personal;
      }
      return existing ?? null;
    })
    .filter((p): p is Personal => p != null)
    .filter((p) => !filterArea || p.area === filterArea);
}

/** Elimina duplicados por trabajador+semana+área; prefiere registros con periodo_id (cierre guardado). */
export function dedupePreviewRegistros(
  registros: NominaRegistroCerrado[],
): NominaRegistroCerrado[] {
  const map = new Map<string, NominaRegistroCerrado>();
  const score = (r: NominaRegistroCerrado) =>
    (r.periodo_id ? 4 : 0) + (r.personal_snapshot ? 2 : 0) + (Number(r.monto_pagado) > 0 ? 1 : 0);

  for (const r of registros) {
    const key = `${r.personal_id}|${r.semana_inicio}|${r.area}`;
    const existing = map.get(key);
    if (!existing || score(r) > score(existing)) {
      map.set(key, r);
    }
  }
  return [...map.values()];
}

function sumClosedRegistrosInRange(
  registros: NominaRegistroCerrado[],
  rangeStart: string,
  rangeEnd: string,
  filterArea?: string,
): number {
  const weekSet = new Set(listWeekStartsInRange(rangeStart, rangeEnd));
  let total = 0;
  for (const r of dedupePreviewRegistros(registros)) {
    if (!weekSet.has(r.semana_inicio)) continue;
    if (filterArea && r.area !== filterArea) continue;
    total += Number(r.monto_pagado) || 0;
  }
  return parseFloat(total.toFixed(2));
}
export function resolvePreviewSectionFromPersonal(p: Personal): {
  id: string;
  title: string;
  subtitle: string;
} {
  const source = previewSectionSource(p);
  if (source) {
    const inferredArea = inferAreaFromSection(source);
    const cargo = cleanSectionName(source);
    const meta = resolveSectionMeta(inferredArea, cargo);
    return { id: meta.id, title: meta.title, subtitle: meta.subtitle };
  }
  return resolvePreviewSectionLegacy(p);
}

function resolvePreviewSectionLegacy(p: Personal): { id: string; title: string; subtitle: string } {
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

export function resolvePreviewSection(p: Personal): { id: string; title: string; subtitle: string } {
  return resolvePreviewSectionFromPersonal(p);
}

const LEGACY_SECTION_ORDER = ['planta_admin', 'planta_operativos', 'admin_mina'];

function buildImportSectionOrderIndex(
  importSectionOrder?: NominaPreviewImportSection[],
): Map<string, number> {
  const map = new Map<string, number>();
  importSectionOrder?.forEach((s, i) => map.set(s.id, i));
  return map;
}

function sectionSortKey(id: string, importOrder: Map<string, number>): number {
  const fromImport = importOrder.get(id);
  if (fromImport !== undefined) return fromImport;
  const idx = LEGACY_SECTION_ORDER.indexOf(id);
  if (idx >= 0) return idx;
  if (id.startsWith('mina__')) return 10;
  return 99;
}

/** Periodo archivado pertenece a un solo área de nómina (mina, planta, etc.). */
export function nominaPeriodoMatchesArea(
  period: NominaPeriodoSummary,
  filterArea: string,
): boolean {
  const meta = period.metadata ?? {};
  const metaArea = typeof meta.area === 'string' ? meta.area.trim() : '';
  if (metaArea) return metaArea === filterArea;

  if (period.origen === 'consolidacion_manual') {
    const implied = inferPayrollSectionFromLabel(period.label);
    if (implied) return implied === filterArea;
  }

  const sections = meta.sectionTotals as Array<{ id?: string; title?: string }> | undefined;
  if (sections?.length) {
    const areas = new Set<string>();
    for (const s of sections) {
      const id = (s.id ?? '').toLowerCase();
      const title = (s.title ?? '').toLowerCase();
      if (id.startsWith('planta') || title.includes('molino')) areas.add('planta');
      else if (id.startsWith('mina') || title.includes('mina')) areas.add('mina');
      else if (id.startsWith('admin') || title.includes('administr')) areas.add('administracion');
    }
    if (areas.size === 1) return areas.has(filterArea);
    return false;
  }

  return false;
}

function applyImportSectionOrder(
  sectionMap: Map<string, NominaPreviewSection>,
  importSectionOrder?: NominaPreviewImportSection[],
): void {
  if (!importSectionOrder?.length) return;
  for (const spec of importSectionOrder) {
    const existing = sectionMap.get(spec.id);
    if (existing) {
      if (spec.title) existing.title = spec.title;
      continue;
    }
    sectionMap.set(spec.id, {
      id: spec.id,
      title: spec.title,
      subtitle: '',
      rows: [],
      sectionTotal: 0,
    });
  }
}

export function buildNominaPreviewReport(input: {
  personal: Personal[];
  rangeStart: string;
  rangeEnd: string;
  registrosCerrados: NominaRegistroCerrado[];
  valesPorPersonal?: Record<string, number>;
  /** Si false, solo filas con nómina cerrada/archivada en el rango (sin proyección por rotación). */
  allowProjection?: boolean;
  /** Limita filas, registros y totales a un área de nómina (mina, planta, etc.). */
  filterArea?: string;
  /** Orden y títulos de secciones del periodo importado (metadata.sectionTotals). */
  importSectionOrder?: NominaPreviewImportSection[];
  /** Snapshots del import histórico por personal_id (para reconstruir secciones). */
  personalSnapshots?: Record<string, PersonalSnapshot | null | undefined>;
}): NominaPreviewReport {
  const {
    personal,
    valesPorPersonal = {},
    allowProjection = false,
    importSectionOrder,
    personalSnapshots = {},
    filterArea,
  } = input;
  const registrosCerrados = dedupePreviewRegistros(
    filterArea
      ? input.registrosCerrados.filter((r) => r.area === filterArea)
      : input.registrosCerrados,
  );
  const personalFiltered = filterArea
    ? personal.filter((p) => p.area === filterArea)
    : personal;
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
    if (!filterArea) {
      const snapArea = r.personal_snapshot?.area;
      if (snapArea && snapArea !== r.area) {
        cerradoMap.set(`${r.personal_id}|${r.semana_inicio}|${snapArea}`, r);
      }
      if (!cerradoMap.has(`${r.personal_id}|${r.semana_inicio}`)) {
        cerradoMap.set(`${r.personal_id}|${r.semana_inicio}`, r);
      }
    }
  }
  const archive = buildArchiveMap(registrosCerrados);
  const lastOpenWeekStart = weekStarts[weekStarts.length - 1];
  const importArchiveMode = Boolean(importSectionOrder?.length);
  const hasRegistrosInRange = registrosCerrados.some((r) => weekSet.has(r.semana_inicio));
  const peopleToProcess =
    importArchiveMode || hasRegistrosInRange
      ? collectImportPreviewPeople(
          personalFiltered,
          registrosCerrados,
          weekSet,
          personalSnapshots,
          filterArea,
        )
      : personalFiltered;

  const closedWeeksByArea = new Set<string>();
  for (const r of registrosCerrados) {
    closedWeeksByArea.add(`${r.semana_inicio}|${r.area}`);
  }

  const sectionMap = new Map<string, NominaPreviewSection>();
  let closedCells = 0;
  let calculatedCells = 0;

  for (const p of peopleToProcess) {
    const hasRegistroInRange = registrosCerrados.some(
      (r) => r.personal_id === p.id && weekSet.has(r.semana_inicio),
    );
    if (!allowProjection && !hasRegistroInRange) continue;
    if (p.estatus && p.estatus !== 'ACTIVO' && !hasRegistroInRange) continue;
    if (p.fecha_ingreso && p.fecha_ingreso > rangeEnd) continue;
    const snap = personalSnapshots[p.id];
    const meta = resolveWorkerPreviewSection(p, snap, importSectionOrder);
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

      const effectiveArea = filterArea ?? p.area;
      const closed = filterArea
        ? cerradoMap.get(`${p.id}|${w.weekStart}|${filterArea}`)
        : cerradoMap.get(`${p.id}|${w.weekStart}|${p.area}`) ??
          cerradoMap.get(`${p.id}|${w.weekStart}`);
      if (closed) {
        const estado =
          (closed.estado_asistencia as EstadoAsistenciaNomina | undefined) ??
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
        const vales =
          w.weekStart === lastOpenWeekStart ? valesPorPersonal[p.id] || 0 : 0;
        const resolved = resolveNominaCell({
          personal: p,
          weekStart: w.weekStart,
          area: effectiveArea,
          archive,
          valesDeduccion: vales,
          allowProjection,
          isWeekClosed: closedWeeksByArea.has(`${w.weekStart}|${effectiveArea}`),
        });
        weeks[w.weekStart] = {
          amount: resolved.amount,
          estado: resolved.estado,
          source: resolved.source === 'archivo' ? 'cerrada' : 'calculada',
        };
        if (resolved.source === 'archivo') closedCells += 1;
        else calculatedCells += 1;
      }
      total += weeks[w.weekStart].amount;
    }

    // ── Anotaciones derivadas (estilo planilla Excel) ──
    // «Salen libre»: trabajó en el rango y la semana siguiente le corresponde libre por rotación.
    let saleLibre = false;
    if (!importArchiveMode && weekColumns.length > 0) {
      const trabajoEnRango = Object.values(weeks).some(
        (w) => w.estado === 'trabajada' && w.amount > 0,
      );
      if (trabajoEnRango) {
        const nextWeekStart = addDaysIso(weekColumns[weekColumns.length - 1].weekStart, 7);
        const next = resolveNominaCell({
          personal: p,
          weekStart: nextWeekStart,
          area: p.area,
          archive,
          allowProjection: true,
        });
        saleLibre = next.estado === 'libre';
      }
    }
    const retirado = p.estado_laboral === 'DESPEDIDO';

    sectionMap.get(meta.id)!.rows.push({
      personal: p,
      weeks,
      total,
      saleLibre,
      observaciones: buildObservaciones(weeks, novedadesSemana, { saleLibre, retirado }),
    });
  }

  applyImportSectionOrder(sectionMap, importSectionOrder);
  const importOrderIndex = buildImportSectionOrderIndex(importSectionOrder);

  const sections = [...sectionMap.values()]
    .filter((s) => s.rows.length > 0)
    .filter((s) => {
      if (!filterArea) return true;
      return s.rows.some((r) => r.personal.area === filterArea);
    })
    .map((s) => {
      s.rows.sort((a, b) => a.personal.nombre_completo.localeCompare(b.personal.nombre_completo, 'es'));
      s.sectionTotal = s.rows.reduce((n, r) => n + r.total, 0);
      return s;
    })
    .sort(
      (a, b) =>
        sectionSortKey(a.id, importOrderIndex) - sectionSortKey(b.id, importOrderIndex) ||
        a.title.localeCompare(b.title, 'es'),
    );

  const summary = sections.map((s) => ({
    id: s.id,
    label: s.title.replace(/^Semanas Mina Belén — /, 'Nóminas ').replace(/^Semanas Molinos — /, 'Nómina '),
    total: s.sectionTotal,
  }));

  let grandTotal = parseFloat(summary.reduce((n, s) => n + s.total, 0).toFixed(2));
  if (!allowProjection) {
    grandTotal = sumClosedRegistrosInRange(registrosCerrados, rangeStart, rangeEnd, filterArea);
  } else if (calculatedCells === 0) {
    const closedExact = sumClosedRegistrosInRange(
      registrosCerrados,
      rangeStart,
      rangeEnd,
      filterArea,
    );
    if (closedExact > 0) grandTotal = closedExact;
  }
  const personalById = new Map(personalFiltered.map((p) => [p.id, p]));
  let novedades = buildNominaPreviewNovedadesDesdeRegistros(
    registrosCerrados,
    personalById,
    rangeStart,
    rangeEnd,
  );
  if (filterArea) {
    novedades = novedades.filter((n) => n.area === filterArea);
  }

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

/** Sin nómina cerrada/archivada en el rango — no mostrar matriz (salvo proyección explícita). */
export function isNominaPreviewEmpty(input: {
  report: NominaPreviewReport;
  includeProjection?: boolean;
}): boolean {
  const { report, includeProjection = false } = input;

  if (report.weekColumns.length === 0) return true;
  if (report.stats.closedCells > 0) return false;
  if (includeProjection && report.grandTotal > 0) return false;
  return true;
}

export function buildPreviewReportFromParsed(period: ParsedNominaPeriod): NominaPreviewReport {
  const periodMeta = formatPreviewPeriodLabel(period.rangeStart, period.rangeEnd);
  
  const weekColumns: NominaPreviewWeekCol[] = period.weekColumns.map((w) => ({
    weekStart: w.weekStart,
    weekEnd: w.weekEnd,
    displayStart: w.weekStart,
    displayEnd: w.weekEnd,
    header: w.header,
    isPartialInRange: !!w.isPartialInRange,
  }));

  const sections: NominaPreviewSection[] = period.sections.map((section) => {
    const rows: NominaPreviewWorkerRow[] = section.rows
      .filter((r) => r._valid)
      .map((r) => {
        const weeks: Record<string, NominaPreviewWeekCell> = {};
        for (const weekStart of Object.keys(r.weeks)) {
          const cell = r.weeks[weekStart];
          weeks[weekStart] = {
            amount: cell.amount,
            estado: cell.estado || (cell.amount <= 0 ? 'no_laborado' : 'trabajada'),
            source: 'cerrada',
          };
        }
        
        return {
          personal: {
            id: r.cedula,
            cedula: r.cedula,
            nombre_completo: r.nombre_completo,
            cargo: r.cargo,
            area: section.area || 'mina',
            area_detalle: section.areaDetalle || section.title,
            fecha_ingreso: r.fecha_ingreso,
            estatus: 'ACTIVO',
          } as unknown as Personal,
          weeks,
          total: r.total,
          saleLibre: false,
          observaciones: r.observaciones || '—',
        };
      });

    return {
      id: section.id,
      title: section.title,
      subtitle: section.subtitle || '',
      rows,
      sectionTotal: section.sectionTotal,
    };
  });

  const summary = sections.map((s) => ({
    id: s.id,
    label: s.title.replace(/^Semanas Mina Belén — /, 'Nóminas ').replace(/^Semanas Molinos — /, 'Nómina '),
    total: s.sectionTotal,
  }));

  return {
    periodLabel: periodMeta.label,
    periodKind: periodMeta.kind,
    rangeDays: periodMeta.rangeDays,
    rangeStart: period.rangeStart,
    rangeEnd: period.rangeEnd,
    weekColumns,
    summary,
    sections,
    novedades: [], // En vista previa de importación no hay novedades todavía
    grandTotal: period.grandTotal,
    stats: {
      closedCells: period.flatCells.length,
      calculatedCells: 0,
    },
  };
}

import type { EstadoAsistenciaNomina } from '@/lib/nomina-calculo';
import type { Personal } from '@/lib/types';

export type NominaOrigen = 'cierre_v3' | 'import_historico' | 'ajuste_manual';

export type PersonalSnapshot = {
  cedula: string;
  nombre_completo: string;
  cargo: string;
  area: string;
  area_detalle: string | null;
  /** Sección de la planilla importada (p. ej. planta_admin, mina__Vertical 1PD). */
  section_id?: string | null;
  /** Título de la planilla en el Excel (p. ej. Nómina Administrativos Molinos). */
  section_title?: string | null;
  /** Cuadrilla de plantilla al cerrar (Vista Semanal manual). */
  cuadrilla_id?: string | null;
  cuadrilla_nombre?: string | null;
  salario_base: number;
  salario_libre: number;
  bono_transporte: number;
  esquema_rotacion: string;
  rotacion_inicio_fecha: string | null;
};

export type CuadrillaSnapshotInput = {
  cuadrillaId?: string | null;
  cuadrillaNombre?: string | null;
  plantillaArea?: 'mina' | 'planta';
};

export type ParsedWeekColumn = {
  weekStart: string;
  weekEnd: string;
  colIndex: number;
  rawHeader: string;
  rawRange: { inicio: string | null; fin: string | null };
  header: string;
  columnKind?: 'libre' | 'trabajada' | 'bono' | 'unknown';
  isPartialInRange?: boolean;
};

export type ParsedWorkerCell = {
  amount: number;
  estado?: EstadoAsistenciaNomina;
  rawValue?: string | number | null;
  _warnings?: string[];
  _skip?: boolean;
};

export type ParsedWorkerRow = {
  nombre_completo: string;
  cedula: string;
  cargo: string;
  area: Personal['area'];
  fecha_ingreso: string;
  weeks: Record<string, ParsedWorkerCell>;
  total: number;
  sourceRowIndex?: number;
  _valid: boolean;
  _error?: string;
  observaciones?: string;
};


export type ParsedNominaSection = {
  id: string;
  rawTitle: string;
  title: string;
  subtitle?: string;
  area: Personal['area'];
  cargo: string;
  areaDetalle: string | null;
  weekColumns: ParsedWeekColumn[];
  rows: ParsedWorkerRow[];
  sectionTotal: number;
};

export type ParsedNominaPeriod = {
  source: 'excel' | 'pdf';
  sourceFileName?: string;
  sheetName?: string;
  rangeStart: string;
  rangeEnd: string;
  weekColumns: ParsedWeekColumn[];
  sections: ParsedNominaSection[];
  flatCells: Array<{
    sectionId: string;
    weekStart: string;
    worker: ParsedWorkerRow;
    cell: ParsedWorkerCell;
  }>;
  stats: {
    workerCount: number;
    cellCount: number;
    skippedRows: number;
    warnings: string[];
    /** Total impreso en cabecera del PDF (si se detectó). */
    declaredSourceTotal?: number | null;
  };
  grandTotal: number;
};

export type InferredWorkerProfile = {
  cedula: string;
  salario_base: number;
  salario_libre: number;
  esquema_rotacion: Personal['esquema_rotacion'];
  rotacion_inicio_fecha: string | null;
  confidence: number;
  needsReview: boolean;
  weekEstados: Record<string, EstadoAsistenciaNomina>;
  notes: string[];
};

export type NominaCellSource = 'archivo' | 'proyeccion';

export type ResolvedNominaCell = {
  amount: number;
  estado: EstadoAsistenciaNomina;
  source: NominaCellSource;
  diasTrabajados?: number;
  bonificaciones?: number;
  totalVales?: number;
};

export type NominaPeriodoSummary = {
  id: string;
  label: string;
  rangeStart: string;
  rangeEnd: string;
  totalUsd: number;
  origen: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  semanaCount: number;
};

function previewSectionPrefixForPlantillaArea(area?: 'mina' | 'planta'): string {
  return area === 'planta' ? 'Semanas Molinos — ' : 'Semanas Mina Belén — ';
}

export function buildPersonalSnapshot(
  p: Personal,
  cuadrilla?: CuadrillaSnapshotInput,
): PersonalSnapshot {
  const base: PersonalSnapshot = {
    cedula: p.cedula,
    nombre_completo: p.nombre_completo,
    cargo: p.cargo,
    area: p.area,
    area_detalle: p.area_detalle || null,
    salario_base: Number(p.salario_base) || 0,
    salario_libre: Number(p.salario_libre) || 0,
    bono_transporte: Number(p.bono_transporte) || 0,
    esquema_rotacion: p.esquema_rotacion || 'FIJO_SEMANAL',
    rotacion_inicio_fecha: p.rotacion_inicio_fecha || null,
  };

  const cuadrillaId = cuadrilla?.cuadrillaId?.trim() || null;
  const cuadrillaNombre = cuadrilla?.cuadrillaNombre?.trim() || null;
  if (!cuadrillaId && !cuadrillaNombre) return base;

  const prefix = previewSectionPrefixForPlantillaArea(cuadrilla?.plantillaArea);
  return {
    ...base,
    cuadrilla_id: cuadrillaId,
    cuadrilla_nombre: cuadrillaNombre,
    section_id: cuadrillaId
      ? `plantilla__${cuadrillaId}`
      : cuadrillaNombre
        ? `plantilla__${cuadrillaNombre}`
        : null,
    section_title: cuadrillaNombre ? `${prefix}${cuadrillaNombre}` : null,
  };
}

import type { PlantillaColumnaKey } from '@/lib/rotacion-plantillas/columnas-vista';

/** Estatus de una semana dentro de una plantilla de rotación personalizada. */
export type EstatusRotacionPlantilla =
  | 'trabajada_paga'
  | 'libre_paga'
  | 'libre_sin_pago'
  | 'no_laborada'
  | 'reposo'
  | 'vacaciones'
  | 'bono_transporte_paga';

export type RotacionSemanaColumn = {
  id: string;
  nombre: string;
  orden: number;
  estatusDefault: EstatusRotacionPlantilla;
};

export type RotacionTrabajadorFila = {
  id: string;
  personalId: string;
  /** Overrides por columna; null = usar estatusDefault de la columna */
  celdas: Record<string, EstatusRotacionPlantilla | null>;
};

/** Cuadrilla / sección dentro de una plantilla (Vertical 1, Cocina, Admin, etc.) */
export type RotacionCuadrilla = {
  id: string;
  nombre: string;
  /** Valor o etiqueta de biblioteca `asignacion_nomina` para filtrar personal */
  asignacionKey: string;
  orden: number;
  semanas: RotacionSemanaColumn[];
  filas: RotacionTrabajadorFila[];
  /** Columnas opcionales para esta cuadrilla específica (ignora sandbox.columnasVista si existe) */
  columnasVista?: PlantillaColumnaKey[];
};

export type RotacionPlantillaSandbox = {
  nombre: string;
  descripcion: string;
  area: string;
  cuadrillas: RotacionCuadrilla[];
  /** Columnas de datos visibles en vista previa y planilla (checkboxes del creador) */
  columnasVista?: PlantillaColumnaKey[];
};

export type RotacionPlantillaRecord = RotacionPlantillaSandbox & {
  id: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

/** Estado de cierre de una semana dentro de una instancia en ejecución */
export type SemanaEjecucionEstado = 'ABIERTA' | 'CERRADA_AUDITADA' | 'BLOQUEADA';

export type RotacionInstanciaSemana = {
  orden: number;
  semanaInicio: string;
  semanaFin: string;
  estado: SemanaEjecucionEstado;
  subtotalUsd: number;
  subtotalDias: number;
  subtotalBonos: number;
  trabajadoresCount: number;
  cuadrillaId?: string;
  cuadrillaNombre?: string;
};

/** Payload exportable hacia Balance General */
export type RotacionBalanceExport = {
  plantillaId: string;
  plantillaNombre: string;
  area: string;
  semanasCerradas: RotacionInstanciaSemana[];
  totalUsd: number;
  totalDias: number;
  totalBonos: number;
  exportadoAt: string;
};

export const ESTATUS_ROTACION_OPCIONES: {
  value: EstatusRotacionPlantilla;
  label: string;
  short: string;
  previewClass: string;
}[] = [
  { value: 'trabajada_paga', label: 'Trabajado con pago', short: 'Trab.', previewClass: 'bg-emerald-100 text-emerald-800' },
  { value: 'libre_paga', label: 'Libre con pago', short: 'Lib.Pag', previewClass: 'bg-amber-100 text-amber-800' },
  { value: 'libre_sin_pago', label: 'Libre sin pago', short: 'Lib.$0', previewClass: 'bg-zinc-100 text-zinc-600' },
  { value: 'no_laborada', label: 'No laborada', short: 'N/Lab', previewClass: 'bg-red-50 text-red-700' },
  { value: 'reposo', label: 'Reposo', short: 'Rep.', previewClass: 'bg-blue-50 text-blue-700' },
  { value: 'vacaciones', label: 'Vacaciones', short: 'Vac.', previewClass: 'bg-violet-50 text-violet-700' },
  {
    value: 'bono_transporte_paga',
    label: 'Bono transporte',
    short: 'Transp.',
    previewClass: 'bg-sky-100 text-sky-800',
  },
];

export function estatusRotacionLabel(v: EstatusRotacionPlantilla): string {
  return ESTATUS_ROTACION_OPCIONES.find((o) => o.value === v)?.label ?? v;
}

export function estatusRotacionShort(v: EstatusRotacionPlantilla): string {
  return ESTATUS_ROTACION_OPCIONES.find((o) => o.value === v)?.short ?? v;
}

export function estatusRotacionPreviewClass(v: EstatusRotacionPlantilla): string {
  return ESTATUS_ROTACION_OPCIONES.find((o) => o.value === v)?.previewClass ?? 'bg-zinc-100 text-zinc-700';
}

/** Total de trabajadores asignados en todas las cuadrillas */
export function totalTrabajadoresPlantilla(sandbox: RotacionPlantillaSandbox): number {
  const ids = new Set<string>();
  sandbox.cuadrillas.forEach((c) => c.filas.forEach((f) => ids.add(f.personalId)));
  return ids.size;
}

// ============================================================
// MineOS - Datos del PDF de plantilla
// Toma un snapshot de instancia activa + plantilla y produce la
// estructura de filas lista para el render del PDF.
// ============================================================

import type { Personal } from '@/lib/types';
import {
  coerceEstatusPlantillaParaEsquema,
  previewPagoSemanal,
} from '@/lib/rotacion-plantillas/semana-cierre';
import {
  posicionEfectivaCuadrilla,
  resolveEstatusCuadrilla,
} from '@/lib/rotacion-plantillas/projection';
import {
  estatusRotacionShort,
  type EstatusRotacionPlantilla,
  type RotacionCuadrilla,
  type RotacionPlantillaRecord,
  type RotacionTrabajadorFila,
} from '@/lib/rotacion-plantillas/types';
import type { InstanciaActivaSnapshot } from '@/lib/rotacion-plantillas/projection';
import {
  columnasVistaForCuadrilla,
  labelColumnaVista,
  type PlantillaColumnaKey,
} from '@/lib/rotacion-plantillas/columnas-vista';

export type PlantillaPdfColumnaVariable = {
  key: PlantillaColumnaKey;
  label: string;
  value: string;
};

export type PlantillaPdfRotacionCelda = {
  semanaId: string;
  semanaNombre: string;
  semanaOrden: number;
  estatus: EstatusRotacionPlantilla;
  estatusShort: string;
  estatusLabel: string;
  /** USD estimado: sueldo + bono del estatus para la semana (no reemplaza motor nómina). */
  montoEstimado: number;
};

export type PlantillaPdfRow = {
  personalId: string;
  nombre_completo: string;
  cedula: string;
  cargo: string;
  esquema_rotacion: string;
  columnasVariables: PlantillaPdfColumnaVariable[];
  rotacion: PlantillaPdfRotacionCelda[];
  totalCiclo: number;
  /** true si el trabajador no se encontró en `personalMap`. */
  sinDatos: boolean;
};

export type PlantillaPdfCuadrilla = {
  id: string;
  nombre: string;
  asignacionKey: string;
  /** Estatus actual de la cuadrilla en la instancia. */
  estado: 'ACTIVA' | 'COMPLETADA' | 'PAUSADA';
  /** Posición activa del ciclo de la instancia. */
  posicionActiva: number;
  /** Total de semanas en la rotación de esta cuadrilla. */
  totalSemanas: number;
  /** Columnas variables efectivas para esta cuadrilla. */
  columnasVariables: PlantillaColumnaKey[];
  rows: PlantillaPdfRow[];
  subtotalesPorSemana: Array<{
    semanaId: string;
    semanaNombre: string;
    semanaOrden: number;
    trabajadas: number;
    libresPagadas: number;
    libresSinPago: number;
    reposos: number;
    vacaciones: number;
    bonoTransporte: number;
    noLaboradas: number;
    monto: number;
  }>;
  totalCuadrilla: number;
  totalTrabajadores: number;
};

export type PlantillaPdfData = {
  plantilla: {
    id: string;
    nombre: string;
    descripcion: string;
    area: string;
  };
  instancia: {
    id: string;
    estado: string;
    fechaInicioCiclo: string;
  };
  /** Columnas que se mostrarán en el header del PDF (orden estable). */
  columnasVariables: PlantillaColumnaKey[];
  cuadrillas: PlantillaPdfCuadrilla[];
  totalCiclo: number;
  totalTrabajadores: number;
  generatedAt: Date;
};

const NOMINA_PDF_LOCALE = 'es-VE';
const NOMINA_PDF_CURRENCY = 'USD';

const fmtMoney = (n: number) =>
  new Intl.NumberFormat(NOMINA_PDF_LOCALE, {
    style: 'currency',
    currency: NOMINA_PDF_CURRENCY,
  }).format(n);

function resolveColumnaVariable(
  key: PlantillaColumnaKey,
  p: Personal | null,
): string {
  if (!p) return '—';
  switch (key) {
    case 'nombre':
      return p.nombre_completo;
    case 'cedula':
      return p.cedula;
    case 'fecha_ingreso':
      return p.fecha_ingreso || '—';
    case 'cargo':
      return p.cargo || '—';
    case 'estado':
      return p.estado_laboral || p.estatus || '—';
    case 'area_detalle':
      return p.area_detalle || '—';
    case 'esquema':
      return p.esquema_rotacion || 'FIJO_SEMANAL';
    case 'bono_transporte':
      return fmtMoney(Number(p.bono_transporte) || 0);
    case 'subtotal_semanal':
      return ''; // se renderiza aparte
    case 'total_periodo':
      return ''; // se renderiza aparte
    default:
      return '—';
  }
}

function buildRotacion(
  cuadrilla: RotacionCuadrilla,
  fila: RotacionTrabajadorFila,
  posicionActiva: number,
  personal: Personal | null,
): { celdas: PlantillaPdfRotacionCelda[]; total: number } {
  const total = cuadrilla.semanas.length;
  if (total === 0) return { celdas: [], total: 0 };

  const salarioBase = Number(personal?.salario_base) || 0;
  const salarioLibre = Number(personal?.salario_libre) || salarioBase;
  const bonoTransporte = Number(personal?.bono_transporte) || 0;
  const esquema = personal?.esquema_rotacion;

  const celdas: PlantillaPdfRotacionCelda[] = [];
  let totalMonto = 0;

  for (let i = 0; i < total; i++) {
    const posicion = posicionEfectivaCuadrilla(total, posicionActiva + i);
    const semana = cuadrilla.semanas[posicion];
    if (!semana) continue;

    const estatusBase = resolveEstatusCuadrilla(cuadrilla, posicionActiva + i, fila);
    if (!estatusBase) continue;

    const tieneOverrideExplicito = fila.celdas[semana.id] != null;
    const estatus = coerceEstatusPlantillaParaEsquema(
      estatusBase,
      esquema,
      tieneOverrideExplicito,
    );

    const preview = previewPagoSemanal(estatus, salarioBase, salarioLibre, bonoTransporte);
    const monto = preview.sueldo + preview.bono;
    totalMonto += monto;

    celdas.push({
      semanaId: semana.id,
      semanaNombre: semana.nombre,
      semanaOrden: posicion,
      estatus,
      estatusShort: estatusRotacionShort(estatus),
      estatusLabel: estatusLabelLocal(estatus),
      montoEstimado: monto,
    });
  }

  return { celdas, total: totalMonto };
}

function estatusLabelLocal(v: EstatusRotacionPlantilla): string {
  switch (v) {
    case 'trabajada_paga':
      return 'Trabajado con pago';
    case 'libre_paga':
      return 'Libre con pago';
    case 'libre_sin_pago':
      return 'Libre sin pago';
    case 'no_laborada':
      return 'No laborada';
    case 'reposo':
      return 'Reposo';
    case 'vacaciones':
      return 'Vacaciones';
    case 'bono_transporte_paga':
      return 'Bono transporte';
    default:
      return v;
  }
}

function mergeColumnas(
  cuadrillas: RotacionCuadrilla[],
  plantillaFallback: PlantillaColumnaKey[] | undefined,
): PlantillaColumnaKey[] {
  const seen = new Set<PlantillaColumnaKey>();
  for (const c of cuadrillas) {
    const cols = columnasVistaForCuadrilla(c, plantillaFallback ?? []);
    for (const k of cols) seen.add(k);
  }
  return Array.from(seen);
}

function subtotalesParaCuadrilla(
  cuadrilla: RotacionCuadrilla,
  rows: PlantillaPdfRow[],
  posicionActiva: number,
): PlantillaPdfCuadrilla['subtotalesPorSemana'] {
  const totalSemanas = cuadrilla.semanas.length;
  if (totalSemanas === 0) return [];

  const inicial: PlantillaPdfCuadrilla['subtotalesPorSemana'] = [];
  for (let i = 0; i < totalSemanas; i++) {
    const posicion = posicionEfectivaCuadrilla(totalSemanas, posicionActiva + i);
    const semana = cuadrilla.semanas[posicion];
    if (!semana) continue;
    inicial.push({
      semanaId: semana.id,
      semanaNombre: semana.nombre,
      semanaOrden: posicion,
      trabajadas: 0,
      libresPagadas: 0,
      libresSinPago: 0,
      reposos: 0,
      vacaciones: 0,
      bonoTransporte: 0,
      noLaboradas: 0,
      monto: 0,
    });
  }

  for (const row of rows) {
    for (const cell of row.rotacion) {
      const target = inicial.find((s) => s.semanaId === cell.semanaId);
      if (!target) continue;
      target.monto += cell.montoEstimado;
      switch (cell.estatus) {
        case 'trabajada_paga':
          target.trabajadas += 1;
          break;
        case 'libre_paga':
          target.libresPagadas += 1;
          break;
        case 'libre_sin_pago':
          target.libresSinPago += 1;
          break;
        case 'reposo':
          target.reposos += 1;
          break;
        case 'vacaciones':
          target.vacaciones += 1;
          break;
        case 'bono_transporte_paga':
          target.bonoTransporte += 1;
          break;
        case 'no_laborada':
          target.noLaboradas += 1;
          break;
      }
    }
  }

  return inicial;
}

/**
 * Construye la estructura de datos para el PDF de plantilla.
 *
 * - `plantilla` debe estar activa y tener `cuadrillas` definidas.
 * - `instancia` debe estar en estado `ACTIVA`.
 * - `personalMap` debe contener todos los `personalId` de las filas de las cuadrillas;
 *   los que falten se marcan como `sinDatos: true` y se omiten de los cálculos.
 */
export function buildPlantillaPdfData(
  plantilla: RotacionPlantillaRecord,
  instancia: InstanciaActivaSnapshot,
  personalMap: Map<string, Personal>,
  opts?: { now?: Date },
): PlantillaPdfData {
  const generatedAt = opts?.now ?? new Date();
  const columnasVariables = mergeColumnas(plantilla.cuadrillas, plantilla.columnasVista);

  const cuadrillas: PlantillaPdfCuadrilla[] = [];
  let totalCiclo = 0;
  let totalTrabajadores = 0;

  for (const instCuadrilla of instancia.cuadrillas) {
    if (instCuadrilla.estado !== 'ACTIVA') continue;

    const plantillaCuadrilla = plantilla.cuadrillas.find(
      (c) => c.id === instCuadrilla.cuadrillaId,
    );
    if (!plantillaCuadrilla) continue;

    const cols = columnasVistaForCuadrilla(plantillaCuadrilla, plantilla.columnasVista ?? []);
    const rows: PlantillaPdfRow[] = [];
    let totalCuadrilla = 0;

    for (const fila of plantillaCuadrilla.filas) {
      const personal = personalMap.get(fila.personalId) ?? null;
      const { celdas, total } = buildRotacion(
        plantillaCuadrilla,
        fila,
        instCuadrilla.posicionActiva,
        personal,
      );

      const columnasVariablesData: PlantillaPdfColumnaVariable[] = cols.map((k) => ({
        key: k,
        label: labelColumnaVista(k),
        value: resolveColumnaVariable(k, personal),
      }));

      const row: PlantillaPdfRow = {
        personalId: fila.personalId,
        nombre_completo: personal?.nombre_completo ?? `Trabajador ${fila.personalId.slice(0, 6)}`,
        cedula: personal?.cedula ?? '—',
        cargo: personal?.cargo ?? '—',
        esquema_rotacion: personal?.esquema_rotacion ?? '—',
        columnasVariables: columnasVariablesData,
        rotacion: celdas,
        totalCiclo: total,
        sinDatos: personal === null,
      };

      rows.push(row);
      totalCuadrilla += total;
    }

    const subtotalesPorSemana = subtotalesParaCuadrilla(
      plantillaCuadrilla,
      rows,
      instCuadrilla.posicionActiva,
    );

    cuadrillas.push({
      id: instCuadrilla.id,
      nombre: instCuadrilla.cuadrillaNombre,
      asignacionKey: instCuadrilla.asignacionKey,
      estado: instCuadrilla.estado,
      posicionActiva: instCuadrilla.posicionActiva,
      totalSemanas: plantillaCuadrilla.semanas.length,
      columnasVariables: cols,
      rows,
      subtotalesPorSemana,
      totalCuadrilla,
      totalTrabajadores: rows.length,
    });

    totalCiclo += totalCuadrilla;
    totalTrabajadores += rows.length;
  }

  return {
    plantilla: {
      id: plantilla.id,
      nombre: plantilla.nombre,
      descripcion: plantilla.descripcion,
      area: plantilla.area,
    },
    instancia: {
      id: instancia.id,
      estado: instancia.estado,
      fechaInicioCiclo: instancia.fechaInicioCiclo,
    },
    columnasVariables,
    cuadrillas,
    totalCiclo,
    totalTrabajadores,
    generatedAt,
  };
}

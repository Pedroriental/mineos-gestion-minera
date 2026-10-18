import {
  applyProportionalWeeklyPay,
  NOMINA_DIAS_POR_SEMANA,
  type EstadoAsistenciaNomina,
} from '@/lib/nomina-calculo';
import {
  findFuzzyWorkerCandidates,
  nameSimilarity,
  tokenizeName,
} from '@/lib/nomina/worker-name-fuzzy';
import { normalizeWorkerName, type WorkerMatchRecord } from '@/lib/nomina/worker-match';
import { getWeekEnd } from '@/lib/nomina/week-utils';
import { getWeekStart } from '@/lib/rotacion-personal';
import type { Personal } from '@/lib/types';

export const DEFAULT_BONO_TRANSPORTE_MOLINO = 30;

export type TipoColumnaCorte =
  | 'libre_pagada'
  | 'libre_sin_pago'
  | 'trabajada_1'
  | 'trabajada_2'
  | 'trabajada_unica';

export type ColumnaCorteDef = {
  index: number;
  weekStart: string;
  weekEnd: string;
  tipo: TipoColumnaCorte;
  label: string;
  shortLabel: string;
  incluyeBonoTransporteSalida: boolean;
};

export type CeldaCorteSemana = {
  weekStart: string;
  estadoAsistencia: EstadoAsistenciaNomina;
  diasTrabajados: number;
  cargoSemana: string;
  salarioBaseSemana: number;
  salarioLibreSemana: number;
  sueldoCalculado: number;
  bonoTransporte: number;
  pagoExtra: number;
  motivoExtra: string;
  bloqueadaPorNuevoIngreso: boolean;
  totalSemana: number;
};

export type FilaCorteTrabajador = {
  personal: Personal;
  esNuevoEnCiclo: boolean;
  cuadrillaNombre: string;
  cargopermanenteCambiado?: boolean;
  despidoAlCierre?: boolean;
  relevoNota?: string;
  valesTotal: number;
  semanas: Record<string, CeldaCorteSemana>;
  totalBrutoCorte: number;
  totalBonoTransporteCorte: number;
  totalExtrasCorte: number;
  totalNetoCorte: number;
};

/**
 * Resta o suma `deltaWeeks` semanas a una fecha `YYYY-MM-DD` (lunes de nómina).
 */
export function shiftWeekIso(weekStartIso: string, deltaWeeks: number): string {
  const parts = weekStartIso.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return weekStartIso;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  d.setDate(d.getDate() + deltaWeeks * 7);
  return getWeekStart(d);
}

/**
 * Construye las columnas del corte según el modo operativo explicado por gerencia:
 * - MINA (`corte_mina_3sem`): [Semana Libre Anterior (t-2), Semana Trabajada 1 (t-1), Semana Trabajada 2 (t)]
 * - MOLINOS Regreso (`molino_regreso_3sem`): [Semana Libre Pagada (t-2), Semana Libre $0 (t-1), Semana Trabajada 1 (t)]
 * - MOLINOS Salida (`molino_salida_1sem`): [Semana Trabajada 2 + Bono Carro $30 (t)]
 * - MOLINOS Ciclo Completo (`molino_completo_4sem`): [Libre Pagada, Libre $0, Trabajada 1, Trabajada 2 + Bono Carro $30]
 */
export type ModoCortePreset =
  | 'mina_corte_3sem'
  | 'molino_regreso_3sem'
  | 'molino_salida_1sem'
  | 'molino_completo_4sem'
  | 'periodo_personalizado';

export function buildColumnasCorte(
  preset: ModoCortePreset,
  anchorWeekStart: string,
  customWeekStarts?: string[],
  area: string = 'mina',
): ColumnaCorteDef[] {
  if (preset === 'periodo_personalizado' && customWeekStarts && customWeekStarts.length > 0) {
    return customWeekStarts.map((ws, idx) => {
      const isLast = idx === customWeekStarts.length - 1;
      const tipo: TipoColumnaCorte =
        idx === 0 && customWeekStarts.length >= 3
          ? 'libre_pagada'
          : idx === 1 && customWeekStarts.length === 4
            ? 'libre_sin_pago'
            : isLast
              ? 'trabajada_2'
              : 'trabajada_1';
      return {
        index: idx,
        weekStart: ws,
        weekEnd: getWeekEnd(ws),
        tipo,
        label:
          tipo === 'libre_pagada'
            ? 'Sem. Libre Pagada'
            : tipo === 'libre_sin_pago'
              ? 'Sem. Libre $0'
              : `Sem. Trabajada ${idx}`,
        shortLabel:
          tipo === 'libre_pagada'
            ? 'Libre Pag.'
            : tipo === 'libre_sin_pago'
              ? 'Libre $0'
              : `Trab. ${idx}`,
        incluyeBonoTransporteSalida: area === 'planta' && isLast,
      };
    });
  }

  if (preset === 'mina_corte_3sem') {
    const wLibre = shiftWeekIso(anchorWeekStart, -2);
    const wTrab1 = shiftWeekIso(anchorWeekStart, -1);
    const wTrab2 = anchorWeekStart;
    return [
      {
        index: 0,
        weekStart: wLibre,
        weekEnd: getWeekEnd(wLibre),
        tipo: 'libre_pagada',
        label: '1. Semana Libre Previa',
        shortLabel: 'Libre Previa',
        incluyeBonoTransporteSalida: false,
      },
      {
        index: 1,
        weekStart: wTrab1,
        weekEnd: getWeekEnd(wTrab1),
        tipo: 'trabajada_1',
        label: '2. Semana Trabajada 1',
        shortLabel: 'Trabajada 1',
        incluyeBonoTransporteSalida: false,
      },
      {
        index: 2,
        weekStart: wTrab2,
        weekEnd: getWeekEnd(wTrab2),
        tipo: 'trabajada_2',
        label: '3. Semana Trabajada 2 (Salida)',
        shortLabel: 'Trabajada 2',
        incluyeBonoTransporteSalida: false,
      },
    ];
  }

  if (preset === 'molino_regreso_3sem') {
    const wLibrePaga = shiftWeekIso(anchorWeekStart, -2);
    const wLibreCero = shiftWeekIso(anchorWeekStart, -1);
    const wTrab1 = anchorWeekStart;
    return [
      {
        index: 0,
        weekStart: wLibrePaga,
        weekEnd: getWeekEnd(wLibrePaga),
        tipo: 'libre_pagada',
        label: '1. Semana Libre Pagada',
        shortLabel: 'Libre Pag.',
        incluyeBonoTransporteSalida: false,
      },
      {
        index: 1,
        weekStart: wLibreCero,
        weekEnd: getWeekEnd(wLibreCero),
        tipo: 'libre_sin_pago',
        label: '2. Semana Libre ($0)',
        shortLabel: 'Libre $0',
        incluyeBonoTransporteSalida: false,
      },
      {
        index: 2,
        weekStart: wTrab1,
        weekEnd: getWeekEnd(wTrab1),
        tipo: 'trabajada_1',
        label: '3. Semana Trabajada 1 (Regreso)',
        shortLabel: 'Trabajada 1',
        incluyeBonoTransporteSalida: false,
      },
    ];
  }

  if (preset === 'molino_salida_1sem') {
    const wTrab2 = anchorWeekStart;
    return [
      {
        index: 0,
        weekStart: wTrab2,
        weekEnd: getWeekEnd(wTrab2),
        tipo: 'trabajada_2',
        label: 'Semana Trabajada 2 + Salida a Casa ($30 Carro)',
        shortLabel: 'Trab. 2 + Salida',
        incluyeBonoTransporteSalida: true,
      },
    ];
  }

  // molino_completo_4sem
  const w0 = shiftWeekIso(anchorWeekStart, -3);
  const w1 = shiftWeekIso(anchorWeekStart, -2);
  const w2 = shiftWeekIso(anchorWeekStart, -1);
  const w3 = anchorWeekStart;
  return [
    {
      index: 0,
      weekStart: w0,
      weekEnd: getWeekEnd(w0),
      tipo: 'libre_pagada',
      label: '1. Semana Libre Pagada',
      shortLabel: 'Libre Pag.',
      incluyeBonoTransporteSalida: false,
    },
    {
      index: 1,
      weekStart: w1,
      weekEnd: getWeekEnd(w1),
      tipo: 'libre_sin_pago',
      label: '2. Semana Libre ($0)',
      shortLabel: 'Libre $0',
      incluyeBonoTransporteSalida: false,
    },
    {
      index: 2,
      weekStart: w2,
      weekEnd: getWeekEnd(w2),
      tipo: 'trabajada_1',
      label: '3. Semana Trabajada 1',
      shortLabel: 'Trabajada 1',
      incluyeBonoTransporteSalida: false,
    },
    {
      index: 3,
      weekStart: w3,
      weekEnd: getWeekEnd(w3),
      tipo: 'trabajada_2',
      label: '4. Semana Trabajada 2 + Carro ($30)',
      shortLabel: 'Trab. 2 + Carro',
      incluyeBonoTransporteSalida: true,
    },
  ];
}

/**
 * Determina si un trabajador es NUEVO en este ciclo (no tiene derecho a cobrar la semana libre previa)
 * revisando:
 * 1. Si estuvo presente en semanas cerradas anteriores a la primera semana trabajada del corte (`veteranIds`).
 * 2. O si su `fecha_ingreso` es posterior al inicio de la semana libre previa.
 */
export function isWorkerNewForCut(
  personal: Pick<Personal, 'id' | 'fecha_ingreso'>,
  firstWorkedWeekStart: string,
  veteranWorkerIds: Set<string>,
): boolean {
  if (veteranWorkerIds.size > 0) {
    return !veteranWorkerIds.has(personal.id);
  }
  if (personal.fecha_ingreso && personal.fecha_ingreso >= firstWorkedWeekStart) {
    return true;
  }
  return false;
}

/**
 * Calcula una celda individual del corte (sueldo + bono transporte + pago extra).
 */
export function computeCeldaCorte(
  cell: Omit<CeldaCorteSemana, 'sueldoCalculado' | 'totalSemana'>,
): CeldaCorteSemana {
  let sueldoCalculado = 0;
  if (cell.estadoAsistencia === 'libre') {
    sueldoCalculado = cell.bloqueadaPorNuevoIngreso
      ? 0
      : Number(cell.salarioLibreSemana) || Number(cell.salarioBaseSemana) || 0;
  } else if (cell.estadoAsistencia === 'trabajada') {
    sueldoCalculado = applyProportionalWeeklyPay(
      Number(cell.salarioBaseSemana) || 0,
      cell.diasTrabajados,
      NOMINA_DIAS_POR_SEMANA,
    );
  } else {
    sueldoCalculado = 0;
  }

  const bono = Math.max(0, Number(cell.bonoTransporte) || 0);
  const extra = Math.max(0, Number(cell.pagoExtra) || 0);
  const totalSemana = parseFloat((sueldoCalculado + bono + extra).toFixed(2));

  return {
    ...cell,
    sueldoCalculado,
    totalSemana,
  };
}

/**
 * Construye una fila completa del corte para un trabajador.
 */
export function buildFilaCorteTrabajador(input: {
  personal: Personal;
  columnas: ColumnaCorteDef[];
  area: string;
  esNuevoEnCiclo: boolean;
  valesTotal?: number;
  cuadrillaNombre?: string;
  existingCells?: Record<string, Partial<CeldaCorteSemana>>;
}): FilaCorteTrabajador {
  const {
    personal,
    columnas,
    area,
    esNuevoEnCiclo,
    valesTotal = 0,
    cuadrillaNombre,
    existingCells = {},
  } = input;

  const baseSal = Number(personal.salario_base) || 0;
  const libreSal = Number(personal.salario_libre) || baseSal;
  const defaultBonoMolino =
    area === 'planta'
      ? Number(personal.bono_transporte) > 0
        ? Number(personal.bono_transporte)
        : DEFAULT_BONO_TRANSPORTE_MOLINO
      : 0;

  const semanas: Record<string, CeldaCorteSemana> = {};

  for (const col of columnas) {
    const prev = existingCells[col.weekStart];
    let defaultEstado: EstadoAsistenciaNomina = 'trabajada';
    let defaultDias = NOMINA_DIAS_POR_SEMANA;
    let bloqueadaNuevo = false;

    if (col.tipo === 'libre_pagada') {
      if (esNuevoEnCiclo) {
        defaultEstado = 'no_laborado';
        defaultDias = 0;
        bloqueadaNuevo = true;
      } else {
        defaultEstado = 'libre';
        defaultDias = 0;
      }
    } else if (col.tipo === 'libre_sin_pago') {
      defaultEstado = 'no_laborado';
      defaultDias = 0;
    }

    const estadoAsistencia = prev?.estadoAsistencia ?? defaultEstado;
    const diasTrabajados =
      prev?.diasTrabajados !== undefined
        ? prev.diasTrabajados
        : estadoAsistencia === 'trabajada'
          ? defaultDias
          : 0;

    // Bono de transporte en Molinos: $30 cuando se van libres (en la columna marcada como salida)
    const bonoTransporte =
      prev?.bonoTransporte !== undefined
        ? prev.bonoTransporte
        : col.incluyeBonoTransporteSalida && area === 'planta' && estadoAsistencia === 'trabajada' && diasTrabajados > 0
          ? defaultBonoMolino
          : 0;

    const celda = computeCeldaCorte({
      weekStart: col.weekStart,
      estadoAsistencia,
      diasTrabajados,
      cargoSemana: prev?.cargoSemana ?? personal.cargo,
      salarioBaseSemana: prev?.salarioBaseSemana ?? baseSal,
      salarioLibreSemana: prev?.salarioLibreSemana ?? libreSal,
      bonoTransporte,
      pagoExtra: prev?.pagoExtra ?? 0,
      motivoExtra: prev?.motivoExtra ?? '',
      bloqueadaPorNuevoIngreso:
        prev?.bloqueadaPorNuevoIngreso !== undefined
          ? prev.bloqueadaPorNuevoIngreso
          : bloqueadaNuevo,
    });

    semanas[col.weekStart] = celda;
  }

  return recomputeFilaCorteTotals({
    personal,
    esNuevoEnCiclo,
    cuadrillaNombre: cuadrillaNombre || personal.area_detalle || 'General',
    valesTotal,
    semanas,
    totalBrutoCorte: 0,
    totalBonoTransporteCorte: 0,
    totalExtrasCorte: 0,
    totalNetoCorte: 0,
  });
}

export function recomputeFilaCorteTotals(fila: FilaCorteTrabajador): FilaCorteTrabajador {
  let totalBrutoCorte = 0;
  let totalBonoTransporteCorte = 0;
  let totalExtrasCorte = 0;

  const updatedSemanas: Record<string, CeldaCorteSemana> = {};
  for (const [ws, cell] of Object.entries(fila.semanas)) {
    const computed = computeCeldaCorte(cell);
    updatedSemanas[ws] = computed;
    totalBrutoCorte += computed.sueldoCalculado;
    totalBonoTransporteCorte += computed.bonoTransporte;
    totalExtrasCorte += computed.pagoExtra;
  }

  const totalNetoCorte = Math.max(
    0,
    parseFloat(
      (
        totalBrutoCorte +
        totalBonoTransporteCorte +
        totalExtrasCorte -
        (Number(fila.valesTotal) || 0)
      ).toFixed(2),
    ),
  );

  return {
    ...fila,
    semanas: updatedSemanas,
    totalBrutoCorte: parseFloat(totalBrutoCorte.toFixed(2)),
    totalBonoTransporteCorte: parseFloat(totalBonoTransporteCorte.toFixed(2)),
    totalExtrasCorte: parseFloat(totalExtrasCorte.toFixed(2)),
    totalNetoCorte,
  };
}

// ============================================================================
// PARSER INTELIGENTE DE LISTAS Y REPORTES DE SUPERVISORES (WhatsApp/Word/Excel)
// ============================================================================

export type ParsedSupervisorItem = {
  rawLine: string;
  matchedPersonal: Personal | null;
  confidence: number;
  matchReason: string;
  extractedName: string;
  extractedCedula?: string;
  diasTrabajados: number;
  /** Total de días en la guardia de 14 días (ej. 14, 12, 7 en tabla de mina) */
  diasGuardiaTotal?: number;
  /** Si la tabla del supervisor indica explícitamente si cobra o no la semana libre */
  cobraSemanaLibre?: boolean;
  frenteReportado?: string;
  estadoAsistencia: EstadoAsistenciaNomina;
  pagoExtra: number;
  motivoExtra: string;
  bonoTransporteOverride?: number;
  cargoOverride?: string;
  salarioOverride?: number;
  esNuevoExplicito: boolean;
  esDespidoExplicito: boolean;
};

/**
 * Distribuye un total de días de guardia (0..14) entre las semanas trabajadas del corte
 * (ej. 14d -> 7d + 7d; 12d -> 7d + 5d; 7d -> 0d + 7d) y recalcula los totales.
 */
export function applyDiasGuardiaToFilaCorte(
  fila: FilaCorteTrabajador,
  diasGuardiaTotal: number,
  columnas: ColumnaCorteDef[],
): FilaCorteTrabajador {
  const clamped = Math.max(0, Math.min(14, Math.round(Number(diasGuardiaTotal) || 0)));
  const workedCols = columnas.filter(
    (c) => c.tipo === 'trabajada_1' || c.tipo === 'trabajada_2' || c.tipo === 'trabajada_unica',
  );
  if (workedCols.length === 0) return fila;

  const nextSemanas = { ...fila.semanas };

  if (workedCols.length === 1) {
    const ws = workedCols[0].weekStart;
    const cell = nextSemanas[ws];
    if (cell) {
      nextSemanas[ws] = {
        ...cell,
        estadoAsistencia: clamped > 0 ? 'trabajada' : 'no_laborado',
        diasTrabajados: clamped,
      };
    }
  } else {
    const col1 = workedCols[0];
    const col2 = workedCols[workedCols.length - 1];
    let dias1 = 0;
    let dias2 = 0;
    if (clamped <= 7) {
      dias1 = 0;
      dias2 = clamped;
    } else {
      dias1 = 7;
      dias2 = clamped - 7;
    }
    if (nextSemanas[col1.weekStart]) {
      nextSemanas[col1.weekStart] = {
        ...nextSemanas[col1.weekStart],
        estadoAsistencia: dias1 > 0 ? 'trabajada' : 'no_laborado',
        diasTrabajados: dias1,
      };
    }
    if (nextSemanas[col2.weekStart]) {
      nextSemanas[col2.weekStart] = {
        ...nextSemanas[col2.weekStart],
        estadoAsistencia: dias2 > 0 ? 'trabajada' : 'no_laborado',
        diasTrabajados: dias2,
      };
    }
  }

  return recomputeFilaCorteTotals({
    ...fila,
    semanas: nextSemanas,
  });
}

function digitsEditDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[a.length][b.length];
}

/**
 * Separa palabras pegadas por OCR (ej. "BermudesManuel" -> "Bermudes Manuel", "Medina]uan" -> "Medina Juan")
 */
export function normalizeOcrTextLine(raw: string): string {
  return raw
    .replace(/[\]\|]uan\b/gi, ' Juan')
    .replace(/([a-záéíóúñ])[lI1]ose\b/gi, '$1 Jose')
    .replace(/([a-záéíóúñ])([A-ZÁÉÍÓÚÑ])/g, '$1 $2')
    .replace(/([A-ZÁÉÍÓÚÑ]{2,})([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)/g, '$1 $2');
}

/**
 * Encuentra el mejor trabajador en el catálogo usando:
 * 1. Coincidencia exacta o difusa (OCR) de cédula
 * 2. Coincidencia exacta de nombre normalizado
 * 3. Coincidencia por tokens (ej. "Pedro Perez" -> "PEDRO JOSE PEREZ GOMEZ")
 * 4. Coincidencia difusa (Levenshtein / variantes de orden)
 */
export function matchWorkerFromText(
  rawText: string,
  catalog: Personal[],
  fullLineForCedula?: string,
): { worker: Personal | null; confidence: number; reason: string; extractedCedula?: string } {
  const clean = normalizeOcrTextLine(rawText).trim();
  const cedulaSource = normalizeOcrTextLine(fullLineForCedula || rawText).trim();
  if (!clean && !cedulaSource) return { worker: null, confidence: 0, reason: 'vacío' };

  // 1. Buscar cédula numérica (con puntos o de 6 a 9 dígitos)
  const dottedCedula = cedulaSource.match(/\b(\d{1,2}[.,]\d{3}[.,]\d{3})\b/);
  const plainCedula = cedulaSource.replace(/\./g, '').match(/\b(\d{6,9})\b/);
  const candidateDigits = dottedCedula
    ? dottedCedula[1].replace(/\D/g, '')
    : plainCedula
      ? plainCedula[1]
      : undefined;

  if (candidateDigits && candidateDigits.length >= 6 && candidateDigits.length <= 9) {
    const byCedula = catalog.find(
      (p) => p.cedula && p.cedula.replace(/\D/g, '') === candidateDigits,
    );
    if (byCedula) {
      return {
        worker: byCedula,
        confidence: 1,
        reason: `Cédula ${candidateDigits}`,
        extractedCedula: candidateDigits,
      };
    }

    // Coincidencia difusa de cédula para fotos/OCR donde 1 o 2 dígitos se leen distinto:
    // Exigimos siempre coincidencia parcial de nombre para no confundir a un trabajador NUEVO con otro existente.
    let bestCedulaWorker: Personal | null = null;
    let bestDist = 99;
    for (const p of catalog) {
      const pDigits = (p.cedula || '').replace(/\D/g, '');
      if (pDigits.length < 6) continue;
      const dist = digitsEditDistance(candidateDigits, pDigits);
      if (dist < bestDist) {
        bestDist = dist;
        bestCedulaWorker = p;
      }
    }
    if (bestCedulaWorker && bestDist <= 2) {
      const nameSim = nameSimilarity(clean, bestCedulaWorker.nombre_completo);
      const qTokens = tokenizeName(clean);
      const dbTokens = tokenizeName(bestCedulaWorker.nombre_completo);
      const tokenOverlap = qTokens.some((qt) =>
        dbTokens.some((dt) => nameSimilarity(qt, dt) >= 0.6),
      );
      if (nameSim >= 0.42 || tokenOverlap) {
        return {
          worker: bestCedulaWorker,
          confidence: bestDist === 1 ? 0.95 : 0.91,
          reason: `Cédula + Nombre OCR (${candidateDigits})`,
          extractedCedula: candidateDigits,
        };
      }
    }
  }

  const normQuery = normalizeWorkerName(clean);
  if (!normQuery || normQuery.length < 2) {
    return { worker: null, confidence: 0, reason: 'sin nombre válido', extractedCedula: candidateDigits };
  }

  // 2. Exact match
  for (const p of catalog) {
    if (normalizeWorkerName(p.nombre_completo) === normQuery) {
      return { worker: p, confidence: 1, reason: 'Nombre exacto', extractedCedula: candidateDigits };
    }
  }

  // 3. Token subset match (muy común en listas de supervisores: "Juan Perez" -> "Juan Carlos Perez")
  const queryTokens = tokenizeName(clean).filter((t) => t.length >= 2);
  if (queryTokens.length >= 1) {
    let bestTokenWorker: Personal | null = null;
    let bestTokenScore = 0;

    for (const p of catalog) {
      const dbTokens = tokenizeName(p.nombre_completo);
      if (!dbTokens.length) continue;

      let matchedCount = 0;
      for (const qt of queryTokens) {
        const hit = dbTokens.some(
          (dt) =>
            dt === qt ||
            (qt.length >= 4 && dt.startsWith(qt)) ||
            nameSimilarity(dt, qt) >= 0.8,
        );
        if (hit) matchedCount++;
      }

      if (matchedCount === queryTokens.length) {
        const score =
          queryTokens.length >= 2
            ? 0.94 + Math.min(0.05, (queryTokens.length / dbTokens.length) * 0.05)
            : 0.78;
        if (score > bestTokenScore) {
          bestTokenScore = score;
          bestTokenWorker = p;
        }
      } else if (queryTokens.length >= 2 && matchedCount >= 1) {
        // Caso OCR donde 1 de los 2 nombres quedó distorsionado (ej. "Iaetancout Geraldine" -> "Betancourt Geraldine")
        const partialScore = 0.76 * (matchedCount / queryTokens.length) + 0.12;
        if (partialScore > bestTokenScore && nameSimilarity(clean, p.nombre_completo) >= 0.58) {
          bestTokenScore = partialScore;
          bestTokenWorker = p;
        }
      }
    }

    if (bestTokenWorker && bestTokenScore >= 0.74) {
      return {
        worker: bestTokenWorker,
        confidence: bestTokenScore,
        reason: bestTokenScore >= 0.9 ? 'Coincidencia de nombre y apellido' : 'Coincidencia parcial',
        extractedCedula: candidateDigits,
      };
    }
  }

  // 4. Fuzzy match general
  const matchRecords: WorkerMatchRecord[] = catalog.map((p) => ({
    id: p.id,
    cedula: p.cedula,
    nombre_completo: p.nombre_completo,
    cargo: p.cargo,
    area: p.area,
  }));
  const fuzzy = findFuzzyWorkerCandidates(clean, matchRecords, { threshold: 0.65, limit: 1 });
  if (fuzzy.length > 0) {
    const found = catalog.find((p) => p.id === fuzzy[0].worker.id) ?? null;
    if (found) {
      return {
        worker: found,
        confidence: fuzzy[0].score,
        reason: fuzzy[0].reason,
        extractedCedula: candidateDigits,
      };
    }
  }

  return { worker: null, confidence: 0, reason: 'No encontrado en base', extractedCedula: candidateDigits };
}

function detectCargoFromText(text: string): string | undefined {
  if (/\b(martiller[oa]|martiler[oa])\b/i.test(text)) return 'Martillero';
  if (/\b(ayudante\s+barrenador)\b/i.test(text)) return 'Ayudante Barrenador';
  if (/\b(barrenador)\b/i.test(text)) return 'Barrenador';
  if (/\b(recorter[oa]|recomer[oa]|recorer[oa])\b/i.test(text)) return 'Recortero';
  if (/\b(cociner[oa])\b/i.test(text)) return 'Cocinera';
  if (/\b(wincher[oa]|winchere)\b/i.test(text)) return 'Winchero';
  if (/\b(bomber[oa])\b/i.test(text)) return 'Bombero';
  if (/\b(supervisor[a]?)\b/i.test(text)) return 'Supervisor';
  if (/\b(moliner[oa])\b/i.test(text)) return 'Molinero';
  if (/\b(compresorista|operador\s+de\s+compresor)\b/i.test(text)) return 'Operador de Compresor';
  if (/\b(mec[aá]nic[oa])\b/i.test(text)) return 'Mecánico';
  if (/\b(electricista)\b/i.test(text)) return 'Electricista';
  if (/\b(soldador)\b/i.test(text)) return 'Soldador';
  if (/\b(chofer|conductor)\b/i.test(text)) return 'Chofer';
  if (/\b(vigilante|seguridad)\b/i.test(text)) return 'Vigilante';
  return undefined;
}

/**
 * Parsea un bloque de texto pegado desde WhatsApp, Excel, Word, o extraído por OCR de una foto
 * y devuelve la lista estructurada de trabajadores e incidencias.
 */
export function parseSupervisorListInput(
  rawInput: string,
  catalog: Personal[],
  area: string,
): ParsedSupervisorItem[] {
  const lines = rawInput
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 2);

  // Priorizar trabajadores del área actual pero permitir encontrar de otras áreas (ej. traslados mina <-> molino)
  const sortedCatalog = [...catalog].sort((a, b) => {
    const aArea = a.area === area ? 0 : 1;
    const bArea = b.area === area ? 0 : 1;
    return aArea - bArea;
  });

  const results: ParsedSupervisorItem[] = [];

  for (const rawLine of lines) {
    const normalizedLine = normalizeOcrTextLine(rawLine);

    // Ignorar encabezados o pies de tabla comunes (WhatsApp / Fotos de tablas de nómina)
    if (
      /^(reporte|nomina|nómina|lista|listado de trabajadores|cuadrilla|grupo|fecha|semana|mina|molino|total|elaborado por|item\s+nombre)/i.test(
        normalizedLine,
      ) ||
      /\b(nombre y apellido|incentivo productivo|usd\s*\/\s*semana|elaborado por)\b/i.test(
        normalizedLine,
      )
    ) {
      continue;
    }

    // Ignorar líneas sin letras reales (ej. bordes de tabla OCR o líneas de solo números)
    const alphaCount = (normalizedLine.match(/[a-záéíóúñA-ZÁÉÍÓÚÑ]/g) || []).length;
    if (alphaCount < 3) continue;

    // Limpiar viñetas o numeración inicial ("1. ", "| 1 |", "[14 [", "- ")
    const withoutBullet = normalizedLine
      .replace(/^\s*[\|\[\(\+\-\•\*]*\s*(?:\d{1,2}\s*[\.\)\-\|\[\]]+\s*)?/, '')
      .trim();
    if (!withoutBullet) continue;

    let diasTrabajados = NOMINA_DIAS_POR_SEMANA;
    let diasGuardiaTotal: number | undefined = undefined;
    let cobraSemanaLibre: boolean | undefined = undefined;
    let salarioOverride: number | undefined = undefined;
    let frenteReportado: string | undefined = undefined;
    let estadoAsistencia: EstadoAsistenciaNomina = 'trabajada';
    let pagoExtra = 0;
    const motivosExtra: string[] = [];
    let bonoTransporteOverride: number | undefined = undefined;
    let cargoOverride: string | undefined = detectCargoFromText(withoutBullet);
    let esNuevoExplicito = false;
    let esDespidoExplicito = false;

    const lower = withoutBullet.toLowerCase();

    // Detectar Frente en cualquier formato (V1, V2, V3, Vertical 1, Molino 1)
    const frenteMatch = withoutBullet.match(/\b(V[123I]|M[12]|Vertical\s*[123])\b/i);
    if (frenteMatch) {
      const rawFrente = frenteMatch[1].toUpperCase().replace(/\s+/g, '');
      if (rawFrente === 'VI' || rawFrente === 'V1' || rawFrente === 'VERTICAL1') {
        frenteReportado = 'V1';
      } else if (rawFrente === 'V2' || rawFrente === 'VERTICAL2') {
        frenteReportado = 'V2';
      } else if (rawFrente === 'V3' || rawFrente === 'VERTICAL3') {
        frenteReportado = 'V3';
      } else {
        frenteReportado = rawFrente;
      }
    }

    // Detectar si es una fila tabular de cuadro de nómina (Excel o Foto OCR con columnas | o ])
    const isTabularRow =
      (withoutBullet.match(/[\|\]]/g) || []).length >= 2 ||
      /\b(14[.,]?2[089]|21[.,]?43|25[.,]?00)\b/.test(withoutBullet);

    if (isTabularRow) {
      // Detectar Sueldo Semanal en tabla (100,00 / 150,00 / 175,00 o en OCR 10000 / 15000 / i5000 / 17500)
      if (/\b[i1]75(?:[.,]00|00)?\b/i.test(withoutBullet) || /\b25[.,]?00\b/.test(withoutBullet)) {
        salarioOverride = 175;
      } else if (/\b[i1]50(?:[.,]00|00)?\b/i.test(withoutBullet) || /\b21[.,]?43\b/.test(withoutBullet)) {
        salarioOverride = 150;
      } else if (/\b100(?:[.,]00|00)?\b/.test(withoutBullet) || /\b14[.,]?2[089]\b/.test(withoutBullet)) {
        salarioOverride = 100;
      }

      // Detectar Días Trabajados en la guardia (columna justo después de $/día 14.29 / 21.43 / 25.00)
      const afterDailyRate = withoutBullet.match(
        /(?:14[.,]?2[089]|21[.,]?43|25[.,]?00)\s*[\|\]\/\(\s]+\s*(\d{1,2})\b/,
      );
      if (afterDailyRate) {
        const parsedD = parseInt(afterDailyRate[1], 10);
        if (parsedD >= 0 && parsedD <= 14) {
          diasGuardiaTotal = parsedD;
        }
      } else {
        // Buscar columna aislada con 14, 12, 7 entre separadores
        const isolatedDays = withoutBullet.match(/[\|\]]\s*(14|13|12|11|10|9|8|7|6|5|4|3|2|1)\s*[\|\]]/);
        if (isolatedDays) {
          diasGuardiaTotal = parseInt(isolatedDays[1], 10);
        }
      }

      if (diasGuardiaTotal !== undefined) {
        diasTrabajados = diasGuardiaTotal > 7 ? diasGuardiaTotal - 7 : diasGuardiaTotal;
        if (diasGuardiaTotal < 14) {
          // Si trabajó menos de 14 días en la guardia (ej. 7 o 12 días), no cobra semana libre previa
          cobraSemanaLibre = false;
          esNuevoExplicito = true;
        } else {
          // Trabajó 14 días: verificar si justo después del monto de $/Guardia (ej. 200) viene un guión (- / —) en vez del monto de Semana Libre
          const after14Part = withoutBullet.split(/(?:14[.,]?2[089]|21[.,]?43|25[.,]?00)\s*[\|\]\/\(\s]+\s*14\b/)[1] ?? '';
          const hasImmediateDashAfterGuardiaPay =
            /^\s*[\|\]]?\s*\d+(?:[.,]\d+)?\s*[\|\)\]]+\s*[-—]/.test(after14Part);
          const has200FinalFor100 =
            salarioOverride === 100 &&
            /\b200(?:[.,]00|00)?\s*[\|\]]?\s*$/.test(after14Part.trim());
          if (hasImmediateDashAfterGuardiaPay || has200FinalFor100) {
            cobraSemanaLibre = false;
            esNuevoExplicito = true;
          } else {
            cobraSemanaLibre = true;
          }
        }
      }
    } else {
      // En texto libre, detectar sueldo explícito (ej. "sueldo 150", "150/sem", "gana 120$")
      const sueldoTextMatch = withoutBullet.match(
        /(?:sueldo|salario|base|gana)\s*[:\$]?\s*(\d{2,3}(?:[.,]\d+)?)\b|\b(100|120|125|150|175|200)\s*(?:\$\s*\/\s*sem|\/\s*sem)/i,
      );
      if (sueldoTextMatch) {
        salarioOverride = parseFloat((sueldoTextMatch[1] || sueldoTextMatch[2]).replace(',', '.'));
      }
    }

    // Si no se detectó sueldo pero sí cargo, sugerir sueldo estándar del cargo en MineOS
    if (salarioOverride === undefined && cargoOverride) {
      if (cargoOverride === 'Supervisor') salarioOverride = 175;
      else if (cargoOverride === 'Martillero' || cargoOverride === 'Barrenador' || cargoOverride === 'Ayudante Barrenador') {
        salarioOverride = 150;
      } else {
        salarioOverride = 100;
      }
    }

    // Detectar "nuevo" / "ingreso" explícito en texto libre
    if (/\b(nuevo|ingreso|entró|entro|sin libre)\b/i.test(lower)) {
      esNuevoExplicito = true;
      cobraSemanaLibre = false;
    }

    // Detectar "despido" / "retiro" / "baja" / "se fue"
    if (/\b(despedido|despido|retirado|retiro|se fue|baja)\b/i.test(lower)) {
      esDespidoExplicito = true;
    }

    // Detectar estado libre o falta total en texto libre
    if (!isTabularRow) {
      if (/\b(semana libre|salió libre|salio libre|\blibre\b)\b/i.test(lower) && !/\b(no libre|sin libre)\b/i.test(lower)) {
        estadoAsistencia = 'libre';
        diasTrabajados = 0;
      } else if (/\b(no vino|ausente|no laboro|no laboró|falta completa)\b/i.test(lower)) {
        estadoAsistencia = 'no_laborado';
        diasTrabajados = 0;
      }

      // Detectar días trabajados ("5 dias", "5d", "12 dias", "14d")
      const diasMatch = withoutBullet.match(/\b(\d{1,2})\s*(?:d[ií]as?|d\b)/i);
      const faltoMatch = withoutBullet.match(/falt[oó]\s*(\d{1,2})\s*(?:d[ií]as?|d\b)?/i);
      if (faltoMatch) {
        const faltas = Math.min(7, Math.max(0, parseInt(faltoMatch[1], 10)));
        diasTrabajados = Math.max(0, NOMINA_DIAS_POR_SEMANA - faltas);
        estadoAsistencia = diasTrabajados === 0 ? 'no_laborado' : 'trabajada';
      } else if (diasMatch) {
        const dParsed = Math.min(14, Math.max(0, parseInt(diasMatch[1], 10)));
        if (dParsed > 7) {
          diasGuardiaTotal = dParsed;
          diasTrabajados = dParsed - 7;
          if (dParsed < 14) {
            cobraSemanaLibre = false;
            esNuevoExplicito = true;
          }
        } else {
          diasTrabajados = dParsed;
        }
        estadoAsistencia = diasTrabajados === 0 ? 'no_laborado' : 'trabajada';
      }
    }

    // Detectar bono transporte / pasaje / carro
    const carroMatch = withoutBullet.match(/(?:carro|transporte|pasaje)\s*[:\$]?\s*(\d+(?:[.,]\d+)?)/i);
    if (carroMatch) {
      bonoTransporteOverride = parseFloat(carroMatch[1].replace(',', '.'));
    } else if (/\b(con carro|con pasaje|con transporte)\b/i.test(lower)) {
      bonoTransporteOverride = DEFAULT_BONO_TRANSPORTE_MOLINO;
    } else if (/\b(sin carro|sin pasaje|sin transporte)\b/i.test(lower)) {
      bonoTransporteOverride = 0;
    }

    // Detectar pago extra / bono ("extra 30", "+40$", "bono 25$", "incentivo 50")
    const extraMatch = withoutBullet.match(/(?:extra|bono|adicional|incentivo|\+)\s*[:\$]?\s*(\d+(?:[.,]\d+)?)\s*\$?/i);
    if (extraMatch) {
      pagoExtra = parseFloat(extraMatch[1].replace(',', '.'));
      motivosExtra.push('Pago extra / incentivo reportado por supervisor');
    }

    // Extraer la parte del nombre (en filas tabulares está antes de la cédula o antes del cargo)
    let nameSegment = withoutBullet;
    const cedulaPos = withoutBullet.search(/\b(?:\d{1,2}[.,]\d{3}[.,]\d{3}|\d{6,9})\b/);
    if (cedulaPos > 2) {
      nameSegment = withoutBullet.slice(0, cedulaPos);
    }

    const cleanedName = nameSegment
      .replace(/(?:extra|bono|adicional|incentivo|carro|transporte|pasaje|sueldo|salario|base|gana|\+)\s*[:\$]?\s*\d+(?:[.,]\d+)?\s*(?:\/\s*sem|\$)?/gi, ' ')
      .replace(/\b\d+(?:[.,]\d+)?\s*\$/gi, ' ')
      .replace(/\b\d{1,2}\s*(?:d[ií]as?|d\b)/gi, ' ')
      .replace(/falt[oó]\s*\d{1,2}\s*(?:d[ií]as?|d\b)?/gi, ' ')
      .replace(
        /\b(nuevo|ingreso|despedido|despido|retirado|retiro|libre|semana libre|reposo|falta|turno|extra|bono|adicional|carro|transporte|pasaje|martillero|martilero|recortero|recomero|recorero|cocinera|winchero|winchere|bombero|supervisor|molinero|barrenador|compresorista|v1|v2|v3|vi)\b/gi,
        ' ',
      )
      .replace(/\b\d+\b/g, ' ')
      .replace(/[\$\+\-\(\)\[\]\t\|,;:\._—]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Emparejar usando el nombre limpio para tokens y la línea completa para extraer la cédula
    const match = matchWorkerFromText(cleanedName || withoutBullet, sortedCatalog, withoutBullet);

    results.push({
      rawLine,
      matchedPersonal: match.worker,
      confidence: match.confidence,
      matchReason: match.reason,
      extractedName: cleanedName || withoutBullet,
      extractedCedula: match.extractedCedula,
      diasTrabajados,
      diasGuardiaTotal,
      cobraSemanaLibre,
      frenteReportado,
      salarioOverride,
      estadoAsistencia,
      pagoExtra,
      motivoExtra: motivosExtra.join(' · '),
      bonoTransporteOverride,
      cargoOverride,
      esNuevoExplicito,
      esDespidoExplicito,
    });
  }

  return results;
}

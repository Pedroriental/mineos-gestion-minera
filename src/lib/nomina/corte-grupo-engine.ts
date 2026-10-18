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
 * Encuentra el mejor trabajador en el catálogo usando:
 * 1. Coincidencia exacta de cédula
 * 2. Coincidencia exacta de nombre normalizado
 * 3. Coincidencia por tokens (ej. "Pedro Perez" -> "PEDRO JOSE PEREZ GOMEZ")
 * 4. Coincidencia difusa (Levenshtein / variantes de orden)
 */
export function matchWorkerFromText(
  rawText: string,
  catalog: Personal[],
): { worker: Personal | null; confidence: number; reason: string } {
  const clean = rawText.trim();
  if (!clean) return { worker: null, confidence: 0, reason: 'vacío' };

  // 1. Buscar cédula numérica (6 a 9 dígitos)
  const cedulaMatch = clean.replace(/\./g, '').match(/\b(\d{6,9})\b/);
  if (cedulaMatch) {
    const digits = cedulaMatch[1];
    const byCedula = catalog.find(
      (p) => p.cedula && p.cedula.replace(/\D/g, '') === digits,
    );
    if (byCedula) {
      return { worker: byCedula, confidence: 1, reason: `Cédula ${digits}` };
    }
  }

  const normQuery = normalizeWorkerName(clean);
  if (!normQuery || normQuery.length < 2) {
    return { worker: null, confidence: 0, reason: 'sin nombre válido' };
  }

  // 2. Exact match
  for (const p of catalog) {
    if (normalizeWorkerName(p.nombre_completo) === normQuery) {
      return { worker: p, confidence: 1, reason: 'Nombre exacto' };
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
          (dt) => dt === qt || (qt.length >= 4 && dt.startsWith(qt)) || nameSimilarity(dt, qt) >= 0.84,
        );
        if (hit) matchedCount++;
      }

      if (matchedCount === queryTokens.length) {
        // Todos los tokens buscados están en el trabajador
        const score =
          queryTokens.length >= 2
            ? 0.94 + Math.min(0.05, queryTokens.length / dbTokens.length * 0.05)
            : 0.78;
        if (score > bestTokenScore) {
          bestTokenScore = score;
          bestTokenWorker = p;
        }
      }
    }

    if (bestTokenWorker && bestTokenScore >= 0.78) {
      return {
        worker: bestTokenWorker,
        confidence: bestTokenScore,
        reason: bestTokenScore >= 0.9 ? 'Coincidencia de nombre y apellido' : 'Coincidencia parcial',
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
  const fuzzy = findFuzzyWorkerCandidates(clean, matchRecords, { threshold: 0.68, limit: 1 });
  if (fuzzy.length > 0) {
    const found = catalog.find((p) => p.id === fuzzy[0].worker.id) ?? null;
    if (found) {
      return {
        worker: found,
        confidence: fuzzy[0].score,
        reason: fuzzy[0].reason,
      };
    }
  }

  return { worker: null, confidence: 0, reason: 'No encontrado en base' };
}

/**
 * Parsea un bloque de texto pegado desde WhatsApp, Excel, Word o transcripción de nota de voz
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
    .filter((l) => l.length > 1);

  // Priorizar trabajadores del área actual pero permitir encontrar de otras áreas (ej. traslados mina <-> molino)
  const sortedCatalog = [...catalog].sort((a, b) => {
    const aArea = a.area === area ? 0 : 1;
    const bArea = b.area === area ? 0 : 1;
    return aArea - bArea;
  });

  const results: ParsedSupervisorItem[] = [];

  for (const rawLine of lines) {
    // Ignorar encabezados comunes de listas de WhatsApp
    if (/^(reporte|nomina|nómina|lista|cuadrilla|grupo|fecha|semana|mina|molino|total)\b[:\s]*$/i.test(rawLine)) {
      continue;
    }

    // Limpiar viñetas o numeración inicial ("1. ", "1- ", "- ", "• ")
    const withoutBullet = rawLine.replace(/^\s*(?:\d+[\.\)\-\s]+|[\-\•\*]\s*)/, '').trim();
    if (!withoutBullet) continue;

    let diasTrabajados = NOMINA_DIAS_POR_SEMANA;
    let estadoAsistencia: EstadoAsistenciaNomina = 'trabajada';
    let pagoExtra = 0;
    const motivosExtra: string[] = [];
    let bonoTransporteOverride: number | undefined = undefined;
    let cargoOverride: string | undefined = undefined;
    let esNuevoExplicito = false;
    let esDespidoExplicito = false;

    const lower = withoutBullet.toLowerCase();

    // Detectar "nuevo" / "ingreso"
    if (/\b(nuevo|ingreso|entró|entro)\b/i.test(lower)) {
      esNuevoExplicito = true;
    }

    // Detectar "despido" / "retiro" / "baja" / "se fue"
    if (/\b(despedido|despido|retirado|retiro|se fue|baja)\b/i.test(lower)) {
      esDespidoExplicito = true;
    }

    // Detectar estado libre o falta total
    if (/\b(semana libre|salió libre|salio libre|\blibre\b)\b/i.test(lower) && !/\bno libre\b/i.test(lower)) {
      estadoAsistencia = 'libre';
      diasTrabajados = 0;
    } else if (/\b(no vino|ausente|no laboro|no laboró|falta completa)\b/i.test(lower)) {
      estadoAsistencia = 'no_laborado';
      diasTrabajados = 0;
    }

    // Detectar días trabajados ("5 dias", "5d", "trabajo 4 dias")
    const diasMatch = withoutBullet.match(/\b(\d{1,2})\s*(?:d[ií]as?|d\b)/i);
    const faltoMatch = withoutBullet.match(/falt[oó]\s*(\d{1,2})\s*(?:d[ií]as?|d\b)?/i);
    if (faltoMatch) {
      const faltas = Math.min(7, Math.max(0, parseInt(faltoMatch[1], 10)));
      diasTrabajados = Math.max(0, NOMINA_DIAS_POR_SEMANA - faltas);
      estadoAsistencia = diasTrabajados === 0 ? 'no_laborado' : 'trabajada';
    } else if (diasMatch) {
      diasTrabajados = Math.min(14, Math.max(0, parseInt(diasMatch[1], 10)));
      estadoAsistencia = diasTrabajados === 0 ? 'no_laborado' : 'trabajada';
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

    // Detectar pago extra / bono ("extra 30", "+40$", "bono 25$")
    const extraMatch = withoutBullet.match(/(?:extra|bono|adicional|\+)\s*\$?\s*(\d+(?:[.,]\d+)?)\s*\$?/i);
    if (extraMatch) {
      pagoExtra = parseFloat(extraMatch[1].replace(',', '.'));
      motivosExtra.push('Pago extra reportado por supervisor');
    }

    // Extraer solo la parte del nombre quitando tokens de montos, días y palabras clave
    const cleanedName = withoutBullet
      .replace(/(?:extra|bono|adicional|carro|transporte|pasaje|\+)\s*[:\$]?\s*\d+(?:[.,]\d+)?\s*\$?/gi, ' ')
      .replace(/\b\d+(?:[.,]\d+)?\s*\$/gi, ' ')
      .replace(/\b\d{1,2}\s*(?:d[ií]as?|d\b)/gi, ' ')
      .replace(/falt[oó]\s*\d{1,2}\s*(?:d[ií]as?|d\b)?/gi, ' ')
      .replace(/\b(nuevo|ingreso|despedido|despido|retirado|retiro|libre|semana libre|reposo|falta|turno|extra|bono|adicional|carro|transporte|pasaje)\b/gi, ' ')
      .replace(/[\$\+\-\(\)\[\]\t\|,;]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const match = matchWorkerFromText(cleanedName || withoutBullet, sortedCatalog);

    results.push({
      rawLine,
      matchedPersonal: match.worker,
      confidence: match.confidence,
      matchReason: match.reason,
      extractedName: cleanedName || withoutBullet,
      diasTrabajados,
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

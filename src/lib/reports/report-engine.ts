import { parseISO, format, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import type {
  ReporteProduccion,
  ReporteVoladura,
  ReporteExtraccion,
  ReporteQuemado,
  Gasto,
} from '../types';
import type { NominaReportRow } from '../actions/report-actions';
import { aggregateBalance, type BalanceSummary } from '@/lib/reconciliation/aggregate-balance';
import {
  splitNominaByDivisiones,
  type NominaDivisionAmount,
  type NominaDivisionParam,
} from '@/lib/reconciliation/nomina-divisiones';
import { assignNominaSemanaToMonthKey } from '@/lib/nomina/nomina-read-model';
import { safeFormatDate, getWeekRangeLabel } from '@/lib/reports/report-date-utils';

export { safeFormatDate, getWeekRangeLabel } from '@/lib/reports/report-date-utils';
export { aggregateBalance, type BalanceSummary };

/**
 * Normaliza una cadena de texto a un formato estándar en minúsculas y sin acentos.
 * E.g., "Belén  " -> "belen"
 */
export function normalizeString(str: string | undefined | null): string {
  if (!str) return '';
  return str
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Dada una lista de nombres originales que normalizan al mismo valor,
 * selecciona la representación canónica más legible y completa.
 */
export function getBestCanonicalName(names: (string | undefined | null)[]): string {
  const cleanNames = names
    .map((n) => n?.trim() || '')
    .filter((n) => n.length > 0);

  if (cleanNames.length === 0) return '';

  let bestName = cleanNames[0];
  let bestScore = -1;

  for (const name of cleanNames) {
    let score = 0;

    // 1. Presencia de acentos (prioriza mantener la tilde original)
    const normalizedNFD = name.normalize('NFD');
    const hasAccents = normalizedNFD !== normalizedNFD.replace(/[\u0300-\u036f]/g, '');
    if (hasAccents) score += 5;

    // 2. Formato de Título / CamelCase (Empieza con mayúscula y contiene minúsculas)
    const isFirstUpper = name[0] === name[0].toUpperCase() && name[0] !== name[0].toLowerCase();
    const hasLower = /[a-z]/g.test(name);
    if (isFirstUpper && hasLower) score += 3;

    // 3. No es puramente mayúsculas (a menos que sea muy corta)
    const isPureUpper = name === name.toUpperCase() && name !== name.toLowerCase();
    if (!isPureUpper) score += 2;

    if (score > bestScore) {
      bestScore = score;
      bestName = name;
    }
  }

  return bestName;
}

/** Agrupa variantes del mismo nombre (mayúsculas, acentos, guiones) en una sola etiqueta legible. */
export function getCanonicalList(rawValues: (string | undefined | null)[]): string[] {
  const groups = new Map<string, Set<string>>();
  rawValues.forEach((val) => {
    if (!val?.trim()) return;
    const key = normalizeString(val);
    if (!groups.has(key)) groups.set(key, new Set());
    groups.get(key)!.add(val.trim());
  });
  return Array.from(groups.values())
    .map((set) => getBestCanonicalName(Array.from(set)))
    .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
}

// ── 1. Módulo: Producción ───────────────────────────────────

export interface ProduccionSummary {
  kpis: {
    oroTotalGrams: number;
    sacosTotal: number;
    toneladasTotal: number;
    tenorPromedioGpt: number;
    mermaPromedioPct: number;
  };
  rows: {
    grupo: string;
    sacos: number;
    toneladas: number;
    oroGramos: number;
    tenorGpt: number;
    mermaPct: number;
    registrosCount: number;
  }[];
}

export function aggregateProduccion(
  data: ReporteProduccion[],
  agruparPor: 'dia' | 'semana' | 'mes' | 'molino' | 'material' = 'dia'
): ProduccionSummary {
  let oroTotalGrams = 0;
  let sacosTotal = 0;
  let toneladasTotal = 0;
  let tenorSumaPesada = 0;
  let mermaSuma = 0;
  let mermaCount = 0;

  const gruposMap = new Map<string, {
    sacos: number;
    toneladas: number;
    oroGramos: number;
    tenorSumaPesada: number;
    mermaSuma: number;
    mermaCount: number;
    registrosCount: number;
  }>();

  const rawNamesMap = new Map<string, Set<string>>();

  data.forEach((r) => {
    const oro = Number(r.oro_recuperado_g ?? 0);
    const sacos = Number(r.sacos ?? 0);
    const tons = Number(r.toneladas_procesadas ?? 0);
    const tenor = Number(r.tenor_tonelada_gpt ?? 0);
    const merma = Number(r.merma_1_pct ?? r.merma_2_pct ?? 0);

    oroTotalGrams += oro;
    sacosTotal += sacos;
    toneladasTotal += tons;
    if (tons > 0) {
      tenorSumaPesada += tenor * tons;
    } else {
      tenorSumaPesada += tenor * (sacos * 0.05); // Estimar peso por saco (50kg = 0.05t)
    }

    if (merma > 0) {
      mermaSuma += merma;
      mermaCount++;
    }

    // Calcular grupo
    let grupoOriginal = 'Otros';
    if (agruparPor === 'dia') {
      grupoOriginal = safeFormatDate(r.fecha, 'dd/MM/yyyy');
    } else if (agruparPor === 'semana') {
      grupoOriginal = getWeekRangeLabel(r.fecha);
    } else if (agruparPor === 'mes') {
      grupoOriginal = safeFormatDate(r.fecha, 'MMMM yyyy');
    } else if (agruparPor === 'molino') {
      grupoOriginal = r.molino || 'Sin Molino';
    } else if (agruparPor === 'material') {
      grupoOriginal = r.material || 'Sin Material';
    }

    const isStringGrouping = agruparPor === 'molino' || agruparPor === 'material';
    const grupoKey = isStringGrouping ? normalizeString(grupoOriginal) : grupoOriginal;

    if (isStringGrouping) {
      if (!rawNamesMap.has(grupoKey)) rawNamesMap.set(grupoKey, new Set());
      rawNamesMap.get(grupoKey)!.add(grupoOriginal);
    }

    const current = gruposMap.get(grupoKey) || {
      sacos: 0,
      toneladas: 0,
      oroGramos: 0,
      tenorSumaPesada: 0,
      mermaSuma: 0,
      mermaCount: 0,
      registrosCount: 0,
    };

    current.sacos += sacos;
    current.toneladas += tons;
    current.oroGramos += oro;
    current.registrosCount += 1;
    if (tons > 0) {
      current.tenorSumaPesada += tenor * tons;
    } else {
      current.tenorSumaPesada += tenor * (sacos * 0.05);
    }
    if (merma > 0) {
      current.mermaSuma += merma;
      current.mermaCount++;
    }

    gruposMap.set(grupoKey, current);
  });

  const rows = Array.from(gruposMap.entries()).map(([grupoKey, stats]) => {
    const tenorGpt = stats.toneladas > 0 
      ? stats.tenorSumaPesada / stats.toneladas 
      : (stats.sacos > 0 ? stats.tenorSumaPesada / (stats.sacos * 0.05) : 0);

    let grupo = grupoKey;
    if (agruparPor === 'molino' || agruparPor === 'material') {
      const names = Array.from(rawNamesMap.get(grupoKey) || []);
      grupo = getBestCanonicalName(names) || grupoKey;
    }

    return {
      grupo,
      sacos: stats.sacos,
      toneladas: Number(stats.toneladas.toFixed(2)),
      oroGramos: Number(stats.oroGramos.toFixed(2)),
      tenorGpt: Number(tenorGpt.toFixed(2)),
      mermaPct: stats.mermaCount > 0 ? Number((stats.mermaSuma / stats.mermaCount).toFixed(2)) : 0,
      registrosCount: stats.registrosCount,
    };
  });

  const tenorPromedioGpt = toneladasTotal > 0
    ? tenorSumaPesada / toneladasTotal
    : (sacosTotal > 0 ? tenorSumaPesada / (sacosTotal * 0.05) : 0);

  return {
    kpis: {
      oroTotalGrams: Number(oroTotalGrams.toFixed(2)),
      sacosTotal,
      toneladasTotal: Number(toneladasTotal.toFixed(2)),
      tenorPromedioGpt: Number(tenorPromedioGpt.toFixed(2)),
      mermaPromedioPct: mermaCount > 0 ? Number((mermaSuma / mermaCount).toFixed(2)) : 0,
    },
    rows,
  };
}

// ── 2. Módulo: Nómina ───────────────────────────────────────

export interface NominaSummary {
  divisionesConfig: NominaDivisionParam[];
  kpis: {
    totalPagado: number;
    bonoTransporteTotal: number;
    trabajadoresUnicos: number;
    /** Legacy cierre (solo cuando no hay divisiones configuradas). */
    pedroTotal: number;
    darinelTotal: number;
    laFeTotal: number;
    divisiones: NominaDivisionAmount[];
  };
  rows: {
    grupo: string;
    trabajadoresCount: number;
    montoPagado: number;
    bonoTransporte: number;
    semanasLibresCount: number;
    montoPedro: number;
    montoDarinel: number;
    montoLaFe: number;
    divisiones: NominaDivisionAmount[];
  }[];
}

function toNominaDivisionAmounts(
  total: number,
  divisiones: NominaDivisionParam[],
): NominaDivisionAmount[] {
  return splitNominaByDivisiones(total, divisiones).map(({ id, nombre, montoUsd }) => ({
    id,
    nombre,
    montoUsd,
  }));
}

export function aggregateNomina(
  data: NominaReportRow[],
  agruparPor: 'semana' | 'mes' | 'area' | 'cargo' | 'trabajador' = 'semana',
  divisionesConfig: NominaDivisionParam[] = [],
): NominaSummary {
  const useDivisiones = divisionesConfig.length > 0;
  let totalPagado = 0;
  let bonoTransporteTotal = 0;
  const trabajadoresSet = new Set<string>();

  // Consolidar cierres únicos por semana
  const cierresMap = new Map<string, { pedro: number; darinel: number; laFe: number }>();
  data.forEach((r) => {
    if (r.tiene_cierre) {
      cierresMap.set(r.semana_id, {
        pedro: r.cierre_pedro,
        darinel: r.cierre_darinel,
        laFe: r.cierre_la_fe,
      });
    }
  });

  let pedroTotal = 0;
  let darinelTotal = 0;
  let laFeTotal = 0;
  cierresMap.forEach((c) => {
    pedroTotal += c.pedro;
    darinelTotal += c.darinel;
    laFeTotal += c.laFe;
  });

  const gruposMap = new Map<string, {
    trabajadores: Set<string>;
    montoPagado: number;
    bonoTransporte: number;
    semanasLibresCount: number;
    semanaIds: Set<string>;
  }>();

  const rawNamesMap = new Map<string, Set<string>>();

  data.forEach((r) => {
    const pagado = Number(r.monto_pagado ?? 0);
    const bono = Number(r.bono_transporte_pagado ?? 0);
    trabajadoresSet.add(r.trabajador_nombre);

    totalPagado += pagado;
    bonoTransporteTotal += bono;

    let grupoOriginal = 'Otros';
    if (agruparPor === 'semana') {
      grupoOriginal = getWeekRangeLabel(r.semana_inicio);
    } else if (agruparPor === 'mes') {
      grupoOriginal = assignNominaSemanaToMonthKey(r.semana_fin);
    } else if (agruparPor === 'area') {
      grupoOriginal = r.area === 'mina' ? 'Mina' : r.area === 'planta' ? 'Molinos (Planta)' : r.area;
    } else if (agruparPor === 'cargo') {
      grupoOriginal = r.trabajador_cargo || 'Sin Cargo';
    } else if (agruparPor === 'trabajador') {
      grupoOriginal = r.trabajador_nombre;
    }

    const isStringGrouping = ['area', 'cargo', 'trabajador'].includes(agruparPor);
    const grupoKey = isStringGrouping ? normalizeString(grupoOriginal) : grupoOriginal;

    if (isStringGrouping) {
      if (!rawNamesMap.has(grupoKey)) rawNamesMap.set(grupoKey, new Set());
      rawNamesMap.get(grupoKey)!.add(grupoOriginal);
    }

    const current = gruposMap.get(grupoKey) || {
      trabajadores: new Set<string>(),
      montoPagado: 0,
      bonoTransporte: 0,
      semanasLibresCount: 0,
      semanaIds: new Set<string>(),
    };

    current.trabajadores.add(r.trabajador_nombre);
    current.montoPagado += pagado;
    current.bonoTransporte += bono;
    if (r.es_semana_libre) {
      current.semanasLibresCount++;
    }
    current.semanaIds.add(r.semana_id);

    gruposMap.set(grupoKey, current);
  });

  const rows = Array.from(gruposMap.entries()).map(([grupoKey, stats]) => {
    let grupoPedro = 0;
    let grupoDarinel = 0;
    let grupoLaFe = 0;

    if (!useDivisiones) {
      stats.semanaIds.forEach((wid) => {
        const c = cierresMap.get(wid);
        if (c) {
          if (agruparPor === 'semana' || agruparPor === 'mes') {
            grupoPedro += c.pedro;
            grupoDarinel += c.darinel;
            grupoLaFe += c.laFe;
          } else {
            const totalSemanaPago = data
              .filter((d) => d.semana_id === wid)
              .reduce((s, d) => s + d.monto_pagado, 0);
            const grupoSemanaPago = data
              .filter(
                (d) =>
                  d.semana_id === wid &&
                  (agruparPor === 'area'
                    ? normalizeString(d.area) ===
                      normalizeString(
                        grupoKey === 'mina' ? 'mina' : grupoKey === 'molinos (planta)' ? 'planta' : grupoKey,
                      )
                    : agruparPor === 'cargo'
                      ? normalizeString(d.trabajador_cargo) === grupoKey
                      : normalizeString(d.trabajador_nombre) === grupoKey),
              )
              .reduce((s, d) => s + d.monto_pagado, 0);

            const ratio = totalSemanaPago > 0 ? grupoSemanaPago / totalSemanaPago : 0;
            grupoPedro += c.pedro * ratio;
            grupoDarinel += c.darinel * ratio;
            grupoLaFe += c.laFe * ratio;
          }
        }
      });
    }

    const montoPagado = Number(stats.montoPagado.toFixed(2));
    const rowDivisiones = useDivisiones
      ? toNominaDivisionAmounts(montoPagado, divisionesConfig)
      : [];

    let grupo = grupoKey;
    if (['area', 'cargo', 'trabajador'].includes(agruparPor)) {
      const names = Array.from(rawNamesMap.get(grupoKey) || []);
      grupo = getBestCanonicalName(names) || grupoKey;
      if (grupoKey === 'mina') grupo = 'Mina';
      if (grupoKey === 'planta' || grupoKey === 'molinos (planta)') grupo = 'Molinos (Planta)';
    }

    return {
      grupo,
      trabajadoresCount: stats.trabajadores.size,
      montoPagado,
      bonoTransporte: Number(stats.bonoTransporte.toFixed(2)),
      semanasLibresCount: stats.semanasLibresCount,
      montoPedro: Number(grupoPedro.toFixed(2)),
      montoDarinel: Number(grupoDarinel.toFixed(2)),
      montoLaFe: Number(grupoLaFe.toFixed(2)),
      divisiones: rowDivisiones,
    };
  });

  const kpiDivisiones = useDivisiones
    ? toNominaDivisionAmounts(totalPagado, divisionesConfig)
    : [];

  return {
    divisionesConfig,
    kpis: {
      totalPagado: Number(totalPagado.toFixed(2)),
      bonoTransporteTotal: Number(bonoTransporteTotal.toFixed(2)),
      trabajadoresUnicos: trabajadoresSet.size,
      pedroTotal: Number(pedroTotal.toFixed(2)),
      darinelTotal: Number(darinelTotal.toFixed(2)),
      laFeTotal: Number(laFeTotal.toFixed(2)),
      divisiones: kpiDivisiones,
    },
    rows,
  };
}

// ── 3. Módulo: Voladuras ────────────────────────────────────

export interface VoladurasSummary {
  kpis: {
    disparosCount: number;
    huecosTotal: number;
    chupisTotal: number;
    arrozKgTotal: number;
    ratioHC: number;
    sinNovedadCount: number;
    conNovedadCount: number;
  };
  rows: {
    grupo: string;
    disparos: number;
    huecos: number;
    huecosPies: number;
    chupis: number;
    chupisPies: number;
    arrozKg: number;
    ratioHC: number;
    sinNovedad: number;
  }[];
}

export function aggregateVoladuras(
  data: ReporteVoladura[],
  agruparPor: 'dia' | 'semana' | 'mina' = 'dia'
): VoladurasSummary {
  let huecosTotal = 0;
  let chupisTotal = 0;
  let arrozKgTotal = 0;
  let sinNovedadCount = 0;

  const gruposMap = new Map<string, {
    disparos: number;
    huecos: number;
    huecosPies: number;
    chupis: number;
    chupisPies: number;
    arrozKg: number;
    sinNovedad: number;
  }>();

  const rawNamesMap = new Map<string, Set<string>>();

  data.forEach((r) => {
    const h = Number(r.huecos_cantidad ?? 0);
    const hp = Number(r.huecos_pies ?? 0);
    const c = Number(r.chupis_cantidad ?? 0);
    const cp = Number(r.chupis_pies ?? 0);
    const a = Number(r.arroz_kg ?? 0);

    huecosTotal += h;
    chupisTotal += c;
    arrozKgTotal += a;
    if (r.sin_novedad) sinNovedadCount++;

    let grupoOriginal = 'Otros';
    if (agruparPor === 'dia') {
      grupoOriginal = safeFormatDate(r.fecha, 'dd/MM/yyyy');
    } else if (agruparPor === 'semana') {
      grupoOriginal = getWeekRangeLabel(r.fecha);
    } else if (agruparPor === 'mina') {
      grupoOriginal = r.mina || 'Sin Especificar';
    }

    const isStringGrouping = agruparPor === 'mina';
    const grupoKey = isStringGrouping ? normalizeString(grupoOriginal) : grupoOriginal;

    if (isStringGrouping) {
      if (!rawNamesMap.has(grupoKey)) rawNamesMap.set(grupoKey, new Set());
      rawNamesMap.get(grupoKey)!.add(grupoOriginal);
    }

    const current = gruposMap.get(grupoKey) || {
      disparos: 0,
      huecos: 0,
      huecosPies: 0,
      chupis: 0,
      chupisPies: 0,
      arrozKg: 0,
      sinNovedad: 0,
    };

    current.disparos++;
    current.huecos += h;
    current.huecosPies += hp;
    current.chupis += c;
    current.chupisPies += cp;
    current.arrozKg += a;
    if (r.sin_novedad) current.sinNovedad++;

    gruposMap.set(grupoKey, current);
  });

  const rows = Array.from(gruposMap.entries()).map(([grupoKey, stats]) => {
    const ratio = stats.chupis > 0 ? stats.huecos / stats.chupis : stats.huecos;
    
    let grupo = grupoKey;
    if (agruparPor === 'mina') {
      const names = Array.from(rawNamesMap.get(grupoKey) || []);
      grupo = getBestCanonicalName(names) || grupoKey;
    }

    return {
      grupo,
      disparos: stats.disparos,
      huecos: stats.huecos,
      huecosPies: Number(stats.huecosPies.toFixed(1)),
      chupis: stats.chupis,
      chupisPies: Number(stats.chupisPies.toFixed(1)),
      arrozKg: Number(stats.arrozKg.toFixed(2)),
      ratioHC: Number(ratio.toFixed(2)),
      sinNovedad: stats.sinNovedad,
    };
  });

  const totalRatio = chupisTotal > 0 ? huecosTotal / chupisTotal : huecosTotal;

  return {
    kpis: {
      disparosCount: data.length,
      huecosTotal,
      chupisTotal,
      arrozKgTotal: Number(arrozKgTotal.toFixed(2)),
      ratioHC: Number(totalRatio.toFixed(2)),
      sinNovedadCount,
      conNovedadCount: data.length - sinNovedadCount,
    },
    rows,
  };
}

// ── 4. Módulo: Quemado ──────────────────────────────────────

export interface QuemadoSummary {
  kpis: {
    quemadasCount: number;
    amalgamaTotalG: number;
    oroTotalG: number;
    mantoAmalgamaTotalG: number;
    mantoOroTotalG: number;
    retortaOroTotalG: number;
    rendimientoOroPct: number;
  };
  rows: {
    grupo: string;
    quemadas: number;
    amalgamaG: number;
    oroG: number;
    rendimientoPct: number;
    planchasCount: number;
  }[];
}

export function aggregateQuemado(
  data: ReporteQuemado[],
  agruparPor: 'dia' | 'semana' | 'mes' = 'dia'
): QuemadoSummary {
  let amalgamaTotalG = 0;
  let oroTotalG = 0;
  let mantoAmalgamaTotalG = 0;
  let mantoOroTotalG = 0;
  let retortaOroTotalG = 0;

  const gruposMap = new Map<string, {
    quemadas: number;
    amalgamaG: number;
    oroG: number;
    planchasCount: number;
  }>();

  data.forEach((r) => {
    const amal = Number(r.total_amalgama_g ?? 0);
    const oro = Number(r.total_oro_g ?? 0);
    const mantoAmal = Number(r.manto_amalgama_g ?? 0);
    const mantoOro = Number(r.manto_oro_g ?? 0);
    const retortaOro = Number(r.retorta_oro_g ?? 0);
    const planchas = r.planchas?.length ?? 0;

    amalgamaTotalG += amal;
    oroTotalG += oro;
    mantoAmalgamaTotalG += mantoAmal;
    mantoOroTotalG += mantoOro;
    retortaOroTotalG += retortaOro;

    let grupo = 'Otros';
    if (agruparPor === 'dia') {
      grupo = safeFormatDate(r.fecha, 'dd/MM/yyyy');
    } else if (agruparPor === 'semana') {
      grupo = getWeekRangeLabel(r.fecha);
    } else if (agruparPor === 'mes') {
      grupo = safeFormatDate(r.fecha, 'MMMM yyyy');
    }

    const current = gruposMap.get(grupo) || {
      quemadas: 0,
      amalgamaG: 0,
      oroG: 0,
      planchasCount: 0,
    };

    current.quemadas++;
    current.amalgamaG += amal;
    current.oroG += oro;
    current.planchasCount += planchas;

    gruposMap.set(grupo, current);
  });

  const rows = Array.from(gruposMap.entries()).map(([grupo, stats]) => {
    const rend = stats.amalgamaG > 0 ? (stats.oroG / stats.amalgamaG) * 100 : 0;
    return {
      grupo,
      quemadas: stats.quemadas,
      amalgamaG: Number(stats.amalgamaG.toFixed(2)),
      oroG: Number(stats.oroG.toFixed(2)),
      rendimientoPct: Number(rend.toFixed(2)),
      planchasCount: stats.planchasCount,
    };
  });

  const totalRend = amalgamaTotalG > 0 ? (oroTotalG / amalgamaTotalG) * 100 : 0;

  return {
    kpis: {
      quemadasCount: data.length,
      amalgamaTotalG: Number(amalgamaTotalG.toFixed(2)),
      oroTotalG: Number(oroTotalG.toFixed(2)),
      mantoAmalgamaTotalG: Number(mantoAmalgamaTotalG.toFixed(2)),
      mantoOroTotalG: Number(mantoOroTotalG.toFixed(2)),
      retortaOroTotalG: Number(retortaOroTotalG.toFixed(2)),
      rendimientoOroPct: Number(totalRend.toFixed(2)),
    },
    rows,
  };
}

// ── 4b. Módulo: Quemado — Agrupación por Plancha ─────────────
// Explota el JSONB planchas y agrega por índice (Plancha 1, 2, 3...)

export interface QuemadoPlanchaSummary {
  kpis: {
    totalQuemadas: number;
    totalPlanchas: number;
    amalgamaTotalG: number;
    oroTotalG: number;
    mantoAmalgamaTotalG: number;
    mantoOroTotalG: number;
    retortaOroTotalG: number;
    rendimientoGlobalPct: number;
  };
  rows: {
    plancha: number;
    label: string;
    amalgamaG: number;
    oroG: number;
    totalG: number;
    pctTotal: number;
    quemadasConDatos: number;
    fechaInicio: string;      // Primera fecha con datos en esta plancha
    fechaFin: string;         // Última fecha con datos en esta plancha
    fechasConDatos: string[]; // Fechas únicas (para filtro)
  }[];
}

export function aggregateQuemadoByPlancha(
  data: ReporteQuemado[]
): QuemadoPlanchaSummary {
  // Acumuladores por índice de plancha (0-based = Plancha 1, 2, 3...)
  const planchaTotals = new Map<number, {
    amalgamaG: number;
    oroG: number;
    count: number;
    fechas: Set<string>; // Fechas únicas donde esta plancha tiene datos
  }>();

  let totalQuemadas = 0;
  let amalgamaTotalG = 0;
  let oroTotalG = 0;
  let mantoAmalgamaTotalG = 0;
  let mantoOroTotalG = 0;
  let retortaOroTotalG = 0;

  data.forEach((r) => {
    totalQuemadas++;
    const amal = Number(r.total_amalgama_g ?? 0);
    const oro = Number(r.total_oro_g ?? 0);
    const mantoAmal = Number(r.manto_amalgama_g ?? 0);
    const mantoOro = Number(r.manto_oro_g ?? 0);
    const retortaOro = Number(r.retorta_oro_g ?? 0);

    amalgamaTotalG += amal;
    oroTotalG += oro;
    mantoAmalgamaTotalG += mantoAmal;
    mantoOroTotalG += mantoOro;
    retortaOroTotalG += retortaOro;

    // Explode planchas array by index
    const planchas = r.planchas ?? [];
    const fecha = r.fecha; // fecha del registro
    planchas.forEach((p, idx) => {
      const pAmal = Number(p.amalgama_g ?? 0);
      const pOro = Number(p.oro_recuperado_g ?? 0);
      const current = planchaTotals.get(idx) || { amalgamaG: 0, oroG: 0, count: 0, fechas: new Set<string>() };
      current.amalgamaG += pAmal;
      current.oroG += pOro;
      current.count += 1;
      current.fechas.add(fecha);
      planchaTotals.set(idx, current);
    });
  });

  // Build rows sorted by plancha number
  const totalGeneral = oroTotalG;
  
  const rows = Array.from(planchaTotals.entries())
    .sort(([a], [b]) => a - b)
    .map(([idx, stats]) => {
      const totalPlancha = stats.oroG;
      const pctTotal = totalGeneral > 0 ? (totalPlancha / totalGeneral) * 100 : 0;
      const fechasArray = Array.from(stats.fechas).sort();
      return {
        plancha: idx + 1,
        label: `Plancha ${idx + 1}`,
        amalgamaG: Number(stats.amalgamaG.toFixed(2)),
        oroG: Number(stats.oroG.toFixed(2)),
        totalG: Number(totalPlancha.toFixed(2)),
        pctTotal: Number(pctTotal.toFixed(2)),
        quemadasConDatos: stats.count,
        fechaInicio: fechasArray[0] ?? '',
        fechaFin: fechasArray[fechasArray.length - 1] ?? '',
        fechasConDatos: fechasArray,
      };
    });

  const rendimientoGlobalPct = amalgamaTotalG > 0 ? (oroTotalG / amalgamaTotalG) * 100 : 0;

  return {
    kpis: {
      totalQuemadas,
      totalPlanchas: planchaTotals.size,
      amalgamaTotalG: Number(amalgamaTotalG.toFixed(2)),
      oroTotalG: Number(oroTotalG.toFixed(2)),
      mantoAmalgamaTotalG: Number(mantoAmalgamaTotalG.toFixed(2)),
      mantoOroTotalG: Number(mantoOroTotalG.toFixed(2)),
      retortaOroTotalG: Number(retortaOroTotalG.toFixed(2)),
      rendimientoGlobalPct: Number(rendimientoGlobalPct.toFixed(2)),
    },
    rows,
  };
}

// ── 5. Módulo: Extracción ───────────────────────────────────

export interface ExtraccionSummary {
  kpis: {
    reportesCount: number;
    sacosTotal: number;
    eventosTotal: number;
  };
  rows: {
    grupo: string;
    reportes: number;
    sacos: number;
    eventos: number;
  }[];
}

export function aggregateExtraccion(
  data: ReporteExtraccion[],
  agruparPor: 'dia' | 'semana' | 'mina' = 'dia'
): ExtraccionSummary {
  let sacosTotal = 0;
  let eventosTotal = 0;

  const gruposMap = new Map<string, {
    reportes: number;
    sacos: number;
    eventos: number;
  }>();

  const rawNamesMap = new Map<string, Set<string>>();

  data.forEach((r) => {
    const sacos = Number(r.sacos_extraidos ?? 0);
    const ev = r.eventos?.length ?? 0;

    sacosTotal += sacos;
    eventosTotal += ev;

    let grupoOriginal = 'Otros';
    if (agruparPor === 'dia') {
      grupoOriginal = safeFormatDate(r.fecha, 'dd/MM/yyyy');
    } else if (agruparPor === 'semana') {
      grupoOriginal = getWeekRangeLabel(r.fecha);
    } else if (agruparPor === 'mina') {
      grupoOriginal = r.mina || 'Sin Especificar';
    }

    const isStringGrouping = agruparPor === 'mina';
    const grupoKey = isStringGrouping ? normalizeString(grupoOriginal) : grupoOriginal;

    if (isStringGrouping) {
      if (!rawNamesMap.has(grupoKey)) rawNamesMap.set(grupoKey, new Set());
      rawNamesMap.get(grupoKey)!.add(grupoOriginal);
    }

    const current = gruposMap.get(grupoKey) || {
      reportes: 0,
      sacos: 0,
      eventos: 0,
    };

    current.reportes++;
    current.sacos += sacos;
    current.eventos += ev;

    gruposMap.set(grupoKey, current);
  });

  const rows = Array.from(gruposMap.entries()).map(([grupoKey, stats]) => {
    let grupo = grupoKey;
    if (agruparPor === 'mina') {
      const names = Array.from(rawNamesMap.get(grupoKey) || []);
      grupo = getBestCanonicalName(names) || grupoKey;
    }

    return {
      grupo,
      reportes: stats.reportes,
      sacos: stats.sacos,
      eventos: stats.eventos,
    };
  });

  return {
    kpis: {
      reportesCount: data.length,
      sacosTotal,
      eventosTotal,
    },
    rows,
  };
}

// ── 6. Módulo: Gastos ───────────────────────────────────────

export interface GastosSummary {
  kpis: {
    totalGastado: number;
    promedioGasto: number;
    mayorGastoMonto: number;
    mayorGastoDesc: string;
    registrosCount: number;
  };
  rows: {
    grupo: string;
    monto: number;
    gastoPromedio: number;
    gastoMayor: number;
    registrosCount: number;
  }[];
}

export function aggregateGastos(
  data: Gasto[],
  agruparPor: 'dia' | 'semana' | 'mes' | 'categoria' = 'dia'
): GastosSummary {
  let totalGastado = 0;
  let mayorGastoMonto = 0;
  let mayorGastoDesc = 'N/A';

  const gruposMap = new Map<string, {
    monto: number;
    gastoMayor: number;
    registrosCount: number;
  }>();

  const rawNamesMap = new Map<string, Set<string>>();

  data.forEach((g) => {
    const monto = Number(g.monto ?? 0);
    totalGastado += monto;

    if (monto > mayorGastoMonto) {
      mayorGastoMonto = monto;
      mayorGastoDesc = `${g.descripcion || 'Gasto'} (${g.proveedor || 'Sin Proveedor'})`;
    }

    let grupoOriginal = 'Otros';
    if (agruparPor === 'dia') {
      grupoOriginal = safeFormatDate(g.fecha, 'dd/MM/yyyy');
    } else if (agruparPor === 'semana') {
      grupoOriginal = getWeekRangeLabel(g.fecha);
    } else if (agruparPor === 'mes') {
      grupoOriginal = safeFormatDate(g.fecha, 'MMMM yyyy');
    } else if (agruparPor === 'categoria') {
      grupoOriginal = g.categorias_gasto?.nombre || 'Sin Categoría';
    }

    const isStringGrouping = agruparPor === 'categoria';
    const grupoKey = isStringGrouping ? normalizeString(grupoOriginal) : grupoOriginal;

    if (isStringGrouping) {
      if (!rawNamesMap.has(grupoKey)) rawNamesMap.set(grupoKey, new Set());
      rawNamesMap.get(grupoKey)!.add(grupoOriginal);
    }

    const current = gruposMap.get(grupoKey) || {
      monto: 0,
      gastoMayor: 0,
      registrosCount: 0,
    };

    current.monto += monto;
    current.registrosCount++;
    if (monto > current.gastoMayor) {
      current.gastoMayor = monto;
    }

    gruposMap.set(grupoKey, current);
  });

  const rows = Array.from(gruposMap.entries()).map(([grupoKey, stats]) => {
    let grupo = grupoKey;
    if (agruparPor === 'categoria') {
      const names = Array.from(rawNamesMap.get(grupoKey) || []);
      grupo = getBestCanonicalName(names) || grupoKey;
    }

    return {
      grupo,
      monto: Number(stats.monto.toFixed(2)),
      gastoPromedio: stats.registrosCount > 0 ? Number((stats.monto / stats.registrosCount).toFixed(2)) : 0,
      gastoMayor: Number(stats.gastoMayor.toFixed(2)),
      registrosCount: stats.registrosCount,
    };
  });

  return {
    kpis: {
      totalGastado: Number(totalGastado.toFixed(2)),
      promedioGasto: data.length > 0 ? Number((totalGastado / data.length).toFixed(2)) : 0,
      mayorGastoMonto: Number(mayorGastoMonto.toFixed(2)),
      mayorGastoDesc,
      registrosCount: data.length,
    },
    rows,
  };
}

// ── 7. Módulo: Balance General ──────────────────────────────

// aggregateBalance → motor de reconciliación (re-export arriba)

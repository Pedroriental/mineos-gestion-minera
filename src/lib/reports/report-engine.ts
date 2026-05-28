import { parseISO, format, startOfWeek, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import type {
  ReporteProduccion,
  ReporteVoladura,
  ReporteExtraccion,
  ReporteQuemado,
  Gasto,
} from '../types';
import type { NominaReportRow, BalanceReportData } from '../actions/report-actions';

// ── Helpers de Fechas ────────────────────────────────────────

export function safeFormatDate(dateStr: string, pattern: string): string {
  try {
    const date = parseISO(dateStr);
    return format(date, pattern, { locale: es });
  } catch (e) {
    return dateStr;
  }
}

export function getWeekRangeLabel(dateStr: string): string {
  try {
    const date = parseISO(dateStr);
    const start = startOfWeek(date, { weekStartsOn: 1 });
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return `${format(start, 'dd/MM')} al ${format(end, 'dd/MM/yyyy')}`;
  } catch (e) {
    return dateStr;
  }
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
    let grupo = 'Otros';
    if (agruparPor === 'dia') {
      grupo = safeFormatDate(r.fecha, 'dd/MM/yyyy');
    } else if (agruparPor === 'semana') {
      grupo = getWeekRangeLabel(r.fecha);
    } else if (agruparPor === 'mes') {
      grupo = safeFormatDate(r.fecha, 'MMMM yyyy');
    } else if (agruparPor === 'molino') {
      grupo = r.molino || 'Sin Molino';
    } else if (agruparPor === 'material') {
      grupo = r.material || 'Sin Material';
    }

    const current = gruposMap.get(grupo) || {
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

    gruposMap.set(grupo, current);
  });

  const rows = Array.from(gruposMap.entries()).map(([grupo, stats]) => {
    const tenorGpt = stats.toneladas > 0 
      ? stats.tenorSumaPesada / stats.toneladas 
      : (stats.sacos > 0 ? stats.tenorSumaPesada / (stats.sacos * 0.05) : 0);

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
  kpis: {
    totalPagado: number;
    bonoTransporteTotal: number;
    trabajadoresUnicos: number;
    pedroTotal: number;
    darinelTotal: number;
    laFeTotal: number;
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
  }[];
}

export function aggregateNomina(
  data: NominaReportRow[],
  agruparPor: 'semana' | 'mes' | 'area' | 'cargo' | 'trabajador' = 'semana'
): NominaSummary {
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

  data.forEach((r) => {
    const pagado = Number(r.monto_pagado ?? 0);
    const bono = Number(r.bono_transporte_pagado ?? 0);
    trabajadoresSet.add(r.trabajador_nombre);

    totalPagado += pagado;
    bonoTransporteTotal += bono;

    let grupo = 'Otros';
    if (agruparPor === 'semana') {
      grupo = getWeekRangeLabel(r.semana_inicio);
    } else if (agruparPor === 'mes') {
      grupo = safeFormatDate(r.semana_inicio, 'MMMM yyyy');
    } else if (agruparPor === 'area') {
      grupo = r.area === 'mina' ? 'Mina' : r.area === 'planta' ? 'Molinos (Planta)' : r.area;
    } else if (agruparPor === 'cargo') {
      grupo = r.trabajador_cargo || 'Sin Cargo';
    } else if (agruparPor === 'trabajador') {
      grupo = r.trabajador_nombre;
    }

    const current = gruposMap.get(grupo) || {
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

    gruposMap.set(grupo, current);
  });

  const rows = Array.from(gruposMap.entries()).map(([grupo, stats]) => {
    // Calcular split proporcional por grupo si aplica
    let grupoPedro = 0;
    let grupoDarinel = 0;
    let grupoLaFe = 0;

    stats.semanaIds.forEach((wid) => {
      const c = cierresMap.get(wid);
      if (c) {
        // Asignamos una proporción del cierre al grupo, o el total si es por semana/mes
        if (agruparPor === 'semana' || agruparPor === 'mes') {
          grupoPedro += c.pedro;
          grupoDarinel += c.darinel;
          grupoLaFe += c.laFe;
        } else {
          // Para cargos/areas prorrateamos según la nómina pagada en ese grupo vs total
          const totalSemanaPago = data
            .filter((d) => d.semana_id === wid)
            .reduce((s, d) => s + d.monto_pagado, 0);
          const grupoSemanaPago = data
            .filter((d) => d.semana_id === wid && 
              (agruparPor === 'area' ? (d.area === (grupo === 'Mina' ? 'mina' : grupo === 'Molinos (Planta)' ? 'planta' : grupo)) : 
               agruparPor === 'cargo' ? d.trabajador_cargo === grupo : 
               d.trabajador_nombre === grupo))
            .reduce((s, d) => s + d.monto_pagado, 0);

          const ratio = totalSemanaPago > 0 ? grupoSemanaPago / totalSemanaPago : 0;
          grupoPedro += c.pedro * ratio;
          grupoDarinel += c.darinel * ratio;
          grupoLaFe += c.laFe * ratio;
        }
      }
    });

    return {
      grupo,
      trabajadoresCount: stats.trabajadores.size,
      montoPagado: Number(stats.montoPagado.toFixed(2)),
      bonoTransporte: Number(stats.bonoTransporte.toFixed(2)),
      semanasLibresCount: stats.semanasLibresCount,
      montoPedro: Number(grupoPedro.toFixed(2)),
      montoDarinel: Number(grupoDarinel.toFixed(2)),
      montoLaFe: Number(grupoLaFe.toFixed(2)),
    };
  });

  return {
    kpis: {
      totalPagado: Number(totalPagado.toFixed(2)),
      bonoTransporteTotal: Number(bonoTransporteTotal.toFixed(2)),
      trabajadoresUnicos: trabajadoresSet.size,
      pedroTotal: Number(pedroTotal.toFixed(2)),
      darinelTotal: Number(darinelTotal.toFixed(2)),
      laFeTotal: Number(laFeTotal.toFixed(2)),
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

    let grupo = 'Otros';
    if (agruparPor === 'dia') {
      grupo = safeFormatDate(r.fecha, 'dd/MM/yyyy');
    } else if (agruparPor === 'semana') {
      grupo = getWeekRangeLabel(r.fecha);
    } else if (agruparPor === 'mina') {
      grupo = r.mina || 'Sin Especificar';
    }

    const current = gruposMap.get(grupo) || {
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

    gruposMap.set(grupo, current);
  });

  const rows = Array.from(gruposMap.entries()).map(([grupo, stats]) => {
    const ratio = stats.chupis > 0 ? stats.huecos / stats.chupis : stats.huecos;
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

  data.forEach((r) => {
    const sacos = Number(r.sacos_extraidos ?? 0);
    const ev = r.eventos?.length ?? 0;

    sacosTotal += sacos;
    eventosTotal += ev;

    let grupo = 'Otros';
    if (agruparPor === 'dia') {
      grupo = safeFormatDate(r.fecha, 'dd/MM/yyyy');
    } else if (agruparPor === 'semana') {
      grupo = getWeekRangeLabel(r.fecha);
    } else if (agruparPor === 'mina') {
      grupo = r.mina || 'Sin Especificar';
    }

    const current = gruposMap.get(grupo) || {
      reportes: 0,
      sacos: 0,
      eventos: 0,
    };

    current.reportes++;
    current.sacos += sacos;
    current.eventos += ev;

    gruposMap.set(grupo, current);
  });

  const rows = Array.from(gruposMap.entries()).map(([grupo, stats]) => {
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

  data.forEach((g) => {
    const monto = Number(g.monto ?? 0);
    totalGastado += monto;

    if (monto > mayorGastoMonto) {
      mayorGastoMonto = monto;
      mayorGastoDesc = `${g.descripcion || 'Gasto'} (${g.proveedor || 'Sin Proveedor'})`;
    }

    let grupo = 'Otros';
    if (agruparPor === 'dia') {
      grupo = safeFormatDate(g.fecha, 'dd/MM/yyyy');
    } else if (agruparPor === 'semana') {
      grupo = getWeekRangeLabel(g.fecha);
    } else if (agruparPor === 'mes') {
      grupo = safeFormatDate(g.fecha, 'MMMM yyyy');
    } else if (agruparPor === 'categoria') {
      grupo = g.categorias_gasto?.nombre || 'Sin Categoría';
    }

    const current = gruposMap.get(grupo) || {
      monto: 0,
      gastoMayor: 0,
      registrosCount: 0,
    };

    current.monto += monto;
    current.registrosCount++;
    if (monto > current.gastoMayor) {
      current.gastoMayor = monto;
    }

    gruposMap.set(grupo, current);
  });

  const rows = Array.from(gruposMap.entries()).map(([grupo, stats]) => {
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

export interface BalanceSummary {
  kpis: {
    ingresoOroUsd: number;     // Estimado oro a $75 por gramo
    ingresoArenasUsd: number;
    ingresoTotalUsd: number;
    gastoNominaUsd: number;
    gastoOperativoUsd: number;
    gastoTotalUsd: number;
    rentabilidadUsd: number;
    margenRentabilidadPct: number;
    costoPorGramoOro: number;
  };
  rows: {
    grupo: string;
    ingresosOro: number;
    ingresosArenas: number;
    ingresosTotal: number;
    gastosNomina: number;
    gastosOperativos: number;
    gastosTotal: number;
    rentabilidad: number;
    margenPct: number;
  }[];
}

export function aggregateBalance(
  data: BalanceReportData,
  agruparPor: 'semana' | 'mes' = 'semana',
  goldPricePerGram: number = 75 // Valor estimado por defecto si no hay variable activa
): BalanceSummary {
  let oroTotalGrams = data.produccion.reduce((s, r) => s + Number(r.oro_recuperado_g ?? 0), 0);
  let ingresoOroUsd = oroTotalGrams * goldPricePerGram;
  let ingresoArenasUsd = data.ventasArenas.reduce((s, v) => s + Number(v.total_venta ?? 0), 0);
  let ingresoTotalUsd = ingresoOroUsd + ingresoArenasUsd;

  let gastoNominaUsd = data.nomina.reduce((s, r) => s + Number(r.monto_pagado ?? 0), 0);
  let gastoOperativoUsd = data.gastos.reduce((s, r) => s + Number(r.monto ?? 0), 0);
  let gastoTotalUsd = gastoNominaUsd + gastoOperativoUsd;

  let rentabilidadUsd = ingresoTotalUsd - gastoTotalUsd;
  let margenRentabilidadPct = ingresoTotalUsd > 0 ? (rentabilidadUsd / ingresoTotalUsd) * 100 : 0;
  let costoPorGramoOro = oroTotalGrams > 0 ? gastoTotalUsd / oroTotalGrams : 0;

  // Rejilla de series de tiempo agrupada
  const gruposMap = new Map<string, {
    oroGramos: number;
    arenasUsd: number;
    gastoNomina: number;
    gastoOperativo: number;
  }>();

  // 1. Asignar producción
  data.produccion.forEach((r) => {
    const grupo = agruparPor === 'semana' ? getWeekRangeLabel(r.fecha) : safeFormatDate(r.fecha, 'MMMM yyyy');
    const current = gruposMap.get(grupo) || { oroGramos: 0, arenasUsd: 0, gastoNomina: 0, gastoOperativo: 0 };
    current.oroGramos += Number(r.oro_recuperado_g ?? 0);
    gruposMap.set(grupo, current);
  });

  // 2. Asignar ventas arenas
  data.ventasArenas.forEach((v) => {
    const grupo = agruparPor === 'semana' ? getWeekRangeLabel(v.fecha) : safeFormatDate(v.fecha, 'MMMM yyyy');
    const current = gruposMap.get(grupo) || { oroGramos: 0, arenasUsd: 0, gastoNomina: 0, gastoOperativo: 0 };
    current.arenasUsd += Number(v.total_venta ?? 0);
    gruposMap.set(grupo, current);
  });

  // 3. Asignar nómina
  data.nomina.forEach((n) => {
    const grupo = agruparPor === 'semana' ? getWeekRangeLabel(n.semana_inicio) : safeFormatDate(n.semana_inicio, 'MMMM yyyy');
    const current = gruposMap.get(grupo) || { oroGramos: 0, arenasUsd: 0, gastoNomina: 0, gastoOperativo: 0 };
    current.gastoNomina += Number(n.monto_pagado ?? 0);
    gruposMap.set(grupo, current);
  });

  // 4. Asignar gastos operativos
  data.gastos.forEach((g) => {
    const grupo = agruparPor === 'semana' ? getWeekRangeLabel(g.fecha) : safeFormatDate(g.fecha, 'MMMM yyyy');
    const current = gruposMap.get(grupo) || { oroGramos: 0, arenasUsd: 0, gastoNomina: 0, gastoOperativo: 0 };
    current.gastoOperativo += Number(g.monto ?? 0);
    gruposMap.set(grupo, current);
  });

  const rows = Array.from(gruposMap.entries()).map(([grupo, stats]) => {
    const ingOro = stats.oroGramos * goldPricePerGram;
    const ingTotal = ingOro + stats.arenasUsd;
    const gstTotal = stats.gastoNomina + stats.gastoOperativo;
    const rent = ingTotal - gstTotal;
    const marg = ingTotal > 0 ? (rent / ingTotal) * 100 : 0;

    return {
      grupo,
      ingresosOro: Number(ingOro.toFixed(2)),
      ingresosArenas: Number(stats.arenasUsd.toFixed(2)),
      ingresosTotal: Number(ingTotal.toFixed(2)),
      gastosNomina: Number(stats.gastoNomina.toFixed(2)),
      gastosOperativos: Number(stats.gastoOperativo.toFixed(2)),
      gastosTotal: Number(gstTotal.toFixed(2)),
      rentabilidad: Number(rent.toFixed(2)),
      margenPct: Number(marg.toFixed(2)),
    };
  });

  // Ordenar los grupos por fecha estimada de inicio
  // Para ordenar "dd/MM al dd/MM/yyyy" o "MMMM yyyy", podemos hacer parse de la primera parte si fuese necesario, 
  // pero el Map preserva el orden de inserción de las transacciones originales de producción y nómina, que ya están ordenadas.
  // Solo en caso de que sea necesario, podríamos ordenar las filas.

  return {
    kpis: {
      ingresoOroUsd: Number(ingresoOroUsd.toFixed(2)),
      ingresoArenasUsd: Number(ingresoArenasUsd.toFixed(2)),
      ingresoTotalUsd: Number(ingresoTotalUsd.toFixed(2)),
      gastoNominaUsd: Number(gastoNominaUsd.toFixed(2)),
      gastoOperativoUsd: Number(gastoOperativoUsd.toFixed(2)),
      gastoTotalUsd: Number(gastoTotalUsd.toFixed(2)),
      rentabilidadUsd: Number(rentabilidadUsd.toFixed(2)),
      margenRentabilidadPct: Number(margenRentabilidadPct.toFixed(2)),
      costoPorGramoOro: Number(costoPorGramoOro.toFixed(2)),
    },
    rows: rows.sort((a, b) => {
      // Ordenar series temporales cronológicamente por la etiqueta de grupo
      // Como las series pueden ser complicadas, una aproximación simple es útil
      return a.grupo.localeCompare(b.grupo);
    }),
  };
}

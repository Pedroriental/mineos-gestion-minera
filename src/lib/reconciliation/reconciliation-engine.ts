import type { DateRange } from '@/lib/reports/report-types';
import type { RentabilidadResult } from '@/lib/rpc/rentabilidad';
import { RECONCILIATION_RULES } from '@/lib/reconciliation/rules-registry';
import {
  cumplimientoPct,
  metaForPeriod,
  projectToPeriodEnd,
  periodCalendarDays,
  elapsedDaysInPeriod,
} from '@/lib/reconciliation/projection';
import type {
  MacroSummary,
  PrecioOroAplicado,
  ReconciliationParams,
  ReconciliationRawInputs,
  ReconciliationRuleDef,
  ReconciliationRuleResult,
  ReconciliationSnapshot,
  RuleStatus,
} from '@/lib/reconciliation/types';

function ruleProcedencia(def: ReconciliationRuleDef) {
  return {
    origenA: def.origenA,
    origenB: def.origenB,
    unidadA: def.unidadA,
    unidadB: def.unidadB,
  };
}

function pctDiff(a: number, b: number): number | null {
  const base = Math.max(Math.abs(a), Math.abs(b), 1e-9);
  return Math.round((Math.abs(a - b) / base) * 10000) / 100;
}

function resolveStatus(
  compare: string,
  valueA: number,
  valueB: number,
  tolerancePct: number | null,
  deviationPct: number | null,
): RuleStatus {
  if (!Number.isFinite(valueA) || !Number.isFinite(valueB)) return 'insufficient_data';

  if (compare === 'pct_diff') {
    const dev = deviationPct ?? pctDiff(valueA, valueB) ?? 0;
    const tol = tolerancePct ?? 5;
    if (dev <= tol) return 'ok';
    if (dev <= tol * 2) return 'warning';
    return 'error';
  }
  if (compare === 'gte') {
    if (valueA >= valueB) return 'ok';
    if (valueA >= valueB * 0.9) return 'warning';
    return 'error';
  }
  if (compare === 'lte') {
    if (valueB <= 0) return 'ok';
    if (valueA <= valueB) return 'ok';
    if (valueA <= valueB * 1.1) return 'warning';
    return 'error';
  }
  return 'ok';
}

function tolFromParams(params: ReconciliationParams, key?: string): number | null {
  if (!key) return null;
  const map: Record<string, number> = {
    tolSacosMinaPlantaPct: params.tolSacosMinaPlantaPct,
    tolOroPlantaQuemadoPct: params.tolOroPlantaQuemadoPct,
    tolNominaVsSemanasPct: params.tolNominaVsSemanasPct,
    tolRpcIngresoPct: params.tolRpcIngresoPct,
  };
  return map[key] ?? null;
}

export function buildRawInputs(data: {
  sacosExtraccion: number;
  sacosProduccion: number;
  oroPlantaG: number;
  oroQuemadoG: number;
  tonProcesadas: number;
  ingresoArenasUsd: number;
  gastoNominaUsd: number;
  gastoOperativoUsd: number;
  nominaRegistrosUsd: number;
  nominaSemanasUsd: number;
  precioOroUsd: number;
}): ReconciliationRawInputs {
  const ingresoOroUsd = data.oroPlantaG * data.precioOroUsd;
  const ingresoTotal = ingresoOroUsd + data.ingresoArenasUsd;
  const gastoTotal = data.gastoNominaUsd + data.gastoOperativoUsd;
  const margenPct = ingresoTotal > 0 ? ((ingresoTotal - gastoTotal) / ingresoTotal) * 100 : 0;
  const costoPorGramo = data.oroPlantaG > 0 ? gastoTotal / data.oroPlantaG : 0;
  const leyCabezaGpt = data.tonProcesadas > 0 ? data.oroPlantaG / data.tonProcesadas : 0;
  const oroEsperadoLey = leyCabezaGpt * data.tonProcesadas;
  const recoveryPct =
    oroEsperadoLey > 0 ? Math.min(100, (data.oroPlantaG / oroEsperadoLey) * 100) : null;

  return {
    sacosExtraccion: data.sacosExtraccion,
    sacosProduccion: data.sacosProduccion,
    oroPlantaG: data.oroPlantaG,
    oroQuemadoG: data.oroQuemadoG,
    tonProcesadas: data.tonProcesadas,
    leyCabezaGpt,
    ingresoOroUsd,
    ingresoArenasUsd: data.ingresoArenasUsd,
    gastoNominaUsd: data.gastoNominaUsd,
    gastoOperativoUsd: data.gastoOperativoUsd,
    nominaRegistrosUsd: data.nominaRegistrosUsd,
    nominaSemanasUsd: data.nominaSemanasUsd,
    margenPct,
    costoPorGramo,
    recoveryPct,
  };
}

export function evaluateRules(
  inputs: ReconciliationRawInputs,
  params: ReconciliationParams,
  rentabilidadRpc: RentabilidadResult | null,
): ReconciliationRuleResult[] {
  const ingresoTotal = inputs.ingresoOroUsd + inputs.ingresoArenasUsd;
  const gastoTotal = inputs.gastoNominaUsd + inputs.gastoOperativoUsd;
  const utilidad = ingresoTotal - gastoTotal;

  const rules: ReconciliationRuleResult[] = [];

  for (const def of RECONCILIATION_RULES) {
    let valueA = 0;
    let valueB = 0;
    let labelA = '';
    let labelB = '';
    let tolerancePct = tolFromParams(params, def.toleranceKey);
    let status: RuleStatus = 'ok';
    let message = '';

    switch (def.id) {
      case 'sacos_mina_planta':
        valueA = inputs.sacosExtraccion;
        valueB = inputs.sacosProduccion;
        labelA = 'Sacos extracción';
        labelB = 'Sacos producción';
        break;
      case 'oro_planta_quemado':
        valueA = inputs.oroPlantaG;
        valueB = inputs.oroQuemadoG;
        labelA = 'Oro planta (g)';
        labelB = 'Oro quemado (g)';
        break;
      case 'recovery_ley':
        valueA = inputs.recoveryPct ?? 0;
        valueB = params.metaRecoveryPct;
        labelA = 'Recovery %';
        labelB = 'Meta recovery %';
        tolerancePct = null;
        break;
      case 'ingreso_vs_gastos':
        valueA = utilidad;
        valueB = params.metaUtilidadMinUsd;
        labelA = 'Utilidad USD';
        labelB = 'Utilidad mínima USD';
        tolerancePct = null;
        break;
      case 'margen_meta':
        valueA = inputs.margenPct;
        valueB = params.metaMargenPct;
        labelA = 'Margen %';
        labelB = 'Meta margen %';
        tolerancePct = null;
        break;
      case 'costo_por_gramo':
        valueA = inputs.costoPorGramo;
        valueB = params.metaCostoPorGramoUsd;
        labelA = 'Costo/g USD';
        labelB = 'Meta costo/g';
        if (valueB <= 0) {
          status = 'ok';
          message = 'Meta costo/g no configurada';
          rules.push({
            id: def.id,
            label: def.label,
            description: def.description,
            severity: def.severity,
            status,
            valueA,
            valueB,
            labelA,
            labelB,
            ...ruleProcedencia(def),
            deviation: null,
            deviationPct: null,
            tolerancePct,
            message,
            drillDown: def.drillDown,
          });
          continue;
        }
        break;
      case 'nomina_registros_semanas':
        valueA = inputs.nominaRegistrosUsd;
        valueB = inputs.nominaSemanasUsd;
        labelA = 'Pagos en registros';
        labelB = 'Total semanas cerradas';
        break;
      case 'rpc_divergencia':
        labelA = 'Ingreso motor';
        labelB = 'Ingreso RPC';
        if (!rentabilidadRpc) {
          status = 'insufficient_data';
          message = 'RPC get_rentabilidad no disponible';
          rules.push({
            id: def.id,
            label: def.label,
            description: def.description,
            severity: def.severity,
            status,
            valueA: null,
            valueB: null,
            labelA,
            labelB,
            ...ruleProcedencia(def),
            deviation: null,
            deviationPct: null,
            tolerancePct: params.tolRpcIngresoPct,
            message,
            drillDown: def.drillDown,
          });
          continue;
        }
        valueA = ingresoTotal;
        valueB = rentabilidadRpc.ingreso_bruto_usd;
        labelA = 'Ingreso motor';
        labelB = 'Ingreso RPC';
        tolerancePct = params.tolRpcIngresoPct;
        break;
      default:
        continue;
    }

    const deviation = valueA - valueB;
    const deviationPct =
      def.compare === 'pct_diff' ? pctDiff(valueA, valueB) : def.compare === 'gte' || def.compare === 'lte' ? null : pctDiff(valueA, valueB);

    status = resolveStatus(def.compare, valueA, valueB, tolerancePct, deviationPct);

    if (def.id === 'recovery_ley' && inputs.recoveryPct == null) {
      status = 'insufficient_data';
      message = 'Sin toneladas para calcular recovery';
    } else if (def.id === 'ingreso_vs_gastos') {
      message =
        utilidad >= params.metaUtilidadMinUsd
          ? 'Utilidad dentro del mínimo'
          : 'Utilidad por debajo del mínimo configurado';
    } else if (status === 'ok') {
      message = 'Dentro de tolerancia';
    } else if (status === 'warning') {
      message = 'Desvío moderado';
    } else if (status === 'error') {
      message = 'Desvío fuera de tolerancia';
    }

    rules.push({
      id: def.id,
      label: def.label,
      description: def.description,
      severity: def.severity,
      status,
      valueA,
      valueB,
      labelA,
      labelB,
      ...ruleProcedencia(def),
      deviation,
      deviationPct,
      tolerancePct,
      message,
      drillDown: def.drillDown,
    });
  }

  const severityOrder = { high: 0, medium: 1, low: 2 };
  const statusOrder = { error: 0, warning: 1, insufficient_data: 2, ok: 3 };

  return rules.sort((a, b) => {
    const sd = (Math.abs(b.deviationPct ?? 0) - Math.abs(a.deviationPct ?? 0));
    if (sd !== 0) return sd;
    const ss = statusOrder[a.status] - statusOrder[b.status];
    if (ss !== 0) return ss;
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}

export function buildMacroSummary(
  dateRange: DateRange,
  inputs: ReconciliationRawInputs,
  params: ReconciliationParams,
  precioOro: PrecioOroAplicado,
): MacroSummary {
  const diasPeriodo = periodCalendarDays(dateRange.from, dateRange.to);
  const diasTranscurridos = elapsedDaysInPeriod(dateRange.from, dateRange.to);
  const metaPeriodoOroG = metaForPeriod(params.metaOroGDia, dateRange.from, dateRange.to);
  const proyeccionOroG = projectToPeriodEnd(inputs.oroPlantaG, dateRange.from, dateRange.to);

  return {
    metaPeriodoOroG,
    realOroG: inputs.oroPlantaG,
    proyeccionOroG,
    cumplimientoOroPct: cumplimientoPct(inputs.oroPlantaG, metaPeriodoOroG),
    metaPeriodoMargenPct: params.metaMargenPct,
    realMargenPct: inputs.margenPct,
    proyeccionMargenPct: inputs.margenPct,
    diasTranscurridos,
    diasPeriodo,
    precioOroUsd: precioOro.usdPorGramo,
    precioOroModo: precioOro.modo,
    precioOroFuenteEtiqueta: precioOro.fuenteEtiqueta,
    precioOroOrigenUi: precioOro.origenUi,
    precioOroFechaCache: precioOro.fechaCache,
  };
}

export function buildSnapshot(
  dateRange: DateRange,
  params: ReconciliationParams,
  inputs: ReconciliationRawInputs,
  rentabilidadRpc: RentabilidadResult | null,
  precioOro: PrecioOroAplicado,
): ReconciliationSnapshot {
  const macro = buildMacroSummary(dateRange, inputs, params, precioOro);
  const rules = evaluateRules(inputs, params, rentabilidadRpc);

  const ingresoMotor = inputs.ingresoOroUsd + inputs.ingresoArenasUsd;
  let rpcDivergence: ReconciliationSnapshot['rpcDivergence'] = null;
  if (rentabilidadRpc) {
    const ingresoDiffUsd = ingresoMotor - rentabilidadRpc.ingreso_bruto_usd;
    const margenDiffPct = inputs.margenPct - rentabilidadRpc.margen_pct;
    rpcDivergence = {
      ingresoDiffUsd,
      margenDiffPct,
      flagged: Math.abs(ingresoDiffUsd) > ingresoMotor * 0.03,
    };
  }

  return {
    dateRange,
    params,
    macro,
    rules,
    inputs,
    rentabilidadRpc,
    rpcDivergence,
    generatedAt: new Date().toISOString(),
  };
}

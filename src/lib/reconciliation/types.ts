import type { DateRange } from '@/lib/reports/report-types';
import type { RentabilidadResult } from '@/lib/rpc/rentabilidad';
import type { NominaDivisionParam } from '@/lib/reconciliation/nomina-divisiones';
import type {
  BalanceOperativoDivergence,
  BalanceOperativoRpc,
} from '@/lib/reconciliation/balance-operativo-rpc';

export type RuleSeverity = 'low' | 'medium' | 'high';
export type RuleStatus = 'ok' | 'warning' | 'error' | 'insufficient_data';

export type ReconciliationCompare = 'pct_diff' | 'abs_diff' | 'gte' | 'lte';

export interface ReconciliationRuleDef {
  id: string;
  label: string;
  description: string;
  severity: RuleSeverity;
  toleranceKey?: string;
  compare: ReconciliationCompare;
  drillDown: Array<'dia' | 'semana' | 'mina' | 'molino' | 'registro'>;
  /** De dónde sale el valor A (tabla, RPC, biblioteca…). */
  origenA: string;
  /** De dónde sale el valor B. */
  origenB: string;
  unidadA?: string;
  unidadB?: string;
}

export interface ReconciliationRuleResult {
  id: string;
  label: string;
  description: string;
  severity: RuleSeverity;
  status: RuleStatus;
  valueA: number | null;
  valueB: number | null;
  labelA: string;
  labelB: string;
  origenA: string;
  origenB: string;
  unidadA?: string;
  unidadB?: string;
  deviation: number | null;
  deviationPct: number | null;
  tolerancePct: number | null;
  message: string;
  drillDown: ReconciliationRuleDef['drillDown'];
}

export interface ReconciliationParams {
  metaOroGDia: number;
  metaSacosDia: number;
  metaMargenPct: number;
  metaRecoveryPct: number;
  tolSacosMinaPlantaPct: number;
  tolOroPlantaQuemadoPct: number;
  tolNominaVsSemanasPct: number;
  tolRpcIngresoPct: number;
  metaUtilidadMinUsd: number;
  precioOroFuente: 'cache' | 'manual';
  precioOroManualUsd: number;
  metaCostoPorGramoUsd: number;
  nominaDivisiones: NominaDivisionParam[];
}

export const DEFAULT_RECONCILIATION_PARAMS: ReconciliationParams = {
  metaOroGDia: 15,
  metaSacosDia: 0,
  metaMargenPct: 10,
  metaRecoveryPct: 60,
  tolSacosMinaPlantaPct: 8,
  tolOroPlantaQuemadoPct: 5,
  tolNominaVsSemanasPct: 2,
  tolRpcIngresoPct: 3,
  metaUtilidadMinUsd: 0,
  precioOroFuente: 'cache',
  precioOroManualUsd: 75,
  metaCostoPorGramoUsd: 0,
  nominaDivisiones: [],
};

export interface ReconciliationFilters {
  molinos?: string[];
  minas?: string[];
}

export type PrecioOroModo = 'cache' | 'manual';

/** Precio USD/g aplicado al cálculo del periodo y su procedencia. */
export interface PrecioOroAplicado {
  usdPorGramo: number;
  modo: PrecioOroModo;
  /** Tag interno en `precio_oro_cache.fuente` (goldapi, fallback, …). */
  fuenteEtiqueta: string;
  /** Origen legible para UI (goldapi.io, Supabase, Biblioteca). */
  origenUi: string;
  fechaCache: string | null;
}

export interface MacroSummary {
  metaPeriodoOroG: number;
  realOroG: number;
  proyeccionOroG: number;
  cumplimientoOroPct: number;
  metaPeriodoMargenPct: number;
  realMargenPct: number;
  proyeccionMargenPct: number;
  diasTranscurridos: number;
  diasPeriodo: number;
  precioOroUsd: number;
  precioOroModo: PrecioOroModo;
  precioOroFuenteEtiqueta: string;
  precioOroOrigenUi: string;
  precioOroFechaCache: string | null;
}

export interface ReconciliationRawInputs {
  sacosExtraccion: number;
  sacosProduccion: number;
  oroPlantaG: number;
  oroQuemadoG: number;
  tonProcesadas: number;
  leyCabezaGpt: number;
  ingresoOroUsd: number;
  ingresoArenasUsd: number;
  gastoNominaUsd: number;
  gastoOperativoUsd: number;
  nominaRegistrosUsd: number;
  nominaSemanasUsd: number;
  margenPct: number;
  costoPorGramo: number;
  recoveryPct: number | null;
}

export interface ReconciliationSnapshot {
  dateRange: DateRange;
  params: ReconciliationParams;
  macro: MacroSummary;
  rules: ReconciliationRuleResult[];
  inputs: ReconciliationRawInputs;
  rentabilidadRpc: RentabilidadResult | null;
  balanceOperativoRpc: BalanceOperativoRpc | null;
  rpcDivergence: {
    ingresoDiffUsd: number;
    margenDiffPct: number;
    flagged: boolean;
  } | null;
  balanceOperativoDivergence: BalanceOperativoDivergence | null;
  generatedAt: string;
}

export type DrillDownLevel = 'periodo' | 'semana' | 'dia' | 'registro';

export interface DrillDownRow {
  key: string;
  label: string;
  valueA: number;
  valueB: number;
  deviationPct: number | null;
  status: RuleStatus;
  fecha?: string;
  deepLink?: string;
  /** Encabezados de columnas en el panel de detalle */
  columnA?: string;
  columnB?: string;
  unitA?: string;
  unitB?: string;
}

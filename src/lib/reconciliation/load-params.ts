import type { BibliotecaCategoriaCompleta } from '@/lib/types';
import { parseNominaDivisionesJson, serializeNominaDivisionesJson } from '@/lib/reconciliation/nomina-divisiones';
import {
  DEFAULT_RECONCILIATION_PARAMS,
  type ReconciliationParams,
} from '@/lib/reconciliation/types';

function numVal(v: string | null | undefined, fallback: number): number {
  if (v == null || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function strVal(v: string | null | undefined, fallback: string): string {
  const s = (v ?? '').trim();
  return s || fallback;
}

/** Lee parámetros de reconciliación desde categorías de biblioteca por slug/clave. */
export function loadReconciliationParamsFromCatalog(
  catalogo: BibliotecaCategoriaCompleta[],
  overrides?: Partial<ReconciliationParams>,
): ReconciliationParams {
  const map = new Map<string, string>();
  for (const cat of catalogo) {
    for (const v of cat.variables) {
      map.set(v.clave, v.valor ?? '');
    }
  }

  const p: ReconciliationParams = {
    metaOroGDia: numVal(map.get('meta_oro_g_dia'), DEFAULT_RECONCILIATION_PARAMS.metaOroGDia),
    metaSacosDia: numVal(map.get('meta_sacos_dia'), DEFAULT_RECONCILIATION_PARAMS.metaSacosDia),
    metaMargenPct: numVal(map.get('meta_margen_pct'), DEFAULT_RECONCILIATION_PARAMS.metaMargenPct),
    metaRecoveryPct: numVal(map.get('meta_recovery_pct'), DEFAULT_RECONCILIATION_PARAMS.metaRecoveryPct),
    tolSacosMinaPlantaPct: numVal(
      map.get('tol_sacos_mina_planta_pct'),
      DEFAULT_RECONCILIATION_PARAMS.tolSacosMinaPlantaPct,
    ),
    tolOroPlantaQuemadoPct: numVal(
      map.get('tol_oro_planta_quemado_pct'),
      DEFAULT_RECONCILIATION_PARAMS.tolOroPlantaQuemadoPct,
    ),
    tolNominaVsSemanasPct: numVal(
      map.get('tol_nomina_vs_semanas_pct'),
      DEFAULT_RECONCILIATION_PARAMS.tolNominaVsSemanasPct,
    ),
    tolRpcIngresoPct: numVal(
      map.get('tol_rpc_ingreso_pct'),
      DEFAULT_RECONCILIATION_PARAMS.tolRpcIngresoPct,
    ),
    metaUtilidadMinUsd: numVal(
      map.get('meta_utilidad_min_usd'),
      DEFAULT_RECONCILIATION_PARAMS.metaUtilidadMinUsd,
    ),
    precioOroFuente:
      strVal(map.get('precio_oro_fuente'), DEFAULT_RECONCILIATION_PARAMS.precioOroFuente) === 'manual'
        ? 'manual'
        : 'cache',
    precioOroManualUsd: numVal(
      map.get('precio_oro_manual_usd'),
      DEFAULT_RECONCILIATION_PARAMS.precioOroManualUsd,
    ),
    metaCostoPorGramoUsd: numVal(
      map.get('meta_costo_por_gramo_usd'),
      DEFAULT_RECONCILIATION_PARAMS.metaCostoPorGramoUsd,
    ),
    nominaDivisiones: parseNominaDivisionesJson(map.get('nomina_divisiones_json')),
  };

  return { ...p, ...overrides };
}

export function reconciliationParamsToBibliotecaRows(
  params: ReconciliationParams,
): Array<{ clave: string; etiqueta: string; valor: string; unidad: string; categoriaSlug: string }> {
  return [
    { categoriaSlug: 'metas_produccion', clave: 'meta_oro_g_dia', etiqueta: 'Meta oro (g/día)', valor: String(params.metaOroGDia), unidad: 'g' },
    { categoriaSlug: 'metas_produccion', clave: 'meta_sacos_dia', etiqueta: 'Meta sacos (día)', valor: String(params.metaSacosDia), unidad: 'sacos' },
    { categoriaSlug: 'metas_produccion', clave: 'meta_margen_pct', etiqueta: 'Meta margen %', valor: String(params.metaMargenPct), unidad: '%' },
    { categoriaSlug: 'metas_produccion', clave: 'meta_recovery_pct', etiqueta: 'Meta recovery %', valor: String(params.metaRecoveryPct), unidad: '%' },
    { categoriaSlug: 'tolerancias_reconciliacion', clave: 'tol_sacos_mina_planta_pct', etiqueta: 'Tolerancia sacos mina→planta', valor: String(params.tolSacosMinaPlantaPct), unidad: '%' },
    { categoriaSlug: 'tolerancias_reconciliacion', clave: 'tol_oro_planta_quemado_pct', etiqueta: 'Tolerancia oro planta→quemado', valor: String(params.tolOroPlantaQuemadoPct), unidad: '%' },
    { categoriaSlug: 'tolerancias_reconciliacion', clave: 'tol_nomina_vs_semanas_pct', etiqueta: 'Tolerancia nómina registros vs semanas', valor: String(params.tolNominaVsSemanasPct), unidad: '%' },
    { categoriaSlug: 'tolerancias_reconciliacion', clave: 'tol_rpc_ingreso_pct', etiqueta: 'Tolerancia ingreso motor vs RPC', valor: String(params.tolRpcIngresoPct), unidad: '%' },
    { categoriaSlug: 'metas_produccion', clave: 'meta_utilidad_min_usd', etiqueta: 'Utilidad mínima periodo USD', valor: String(params.metaUtilidadMinUsd), unidad: 'USD' },
    { categoriaSlug: 'parametros_balance', clave: 'precio_oro_fuente', etiqueta: 'Fuente precio oro', valor: params.precioOroFuente, unidad: '' },
    { categoriaSlug: 'parametros_balance', clave: 'precio_oro_manual_usd', etiqueta: 'Precio oro manual USD/g', valor: String(params.precioOroManualUsd), unidad: 'USD/g' },
    { categoriaSlug: 'parametros_balance', clave: 'meta_costo_por_gramo_usd', etiqueta: 'Meta costo por gramo USD', valor: String(params.metaCostoPorGramoUsd), unidad: 'USD/g' },
    {
      categoriaSlug: 'parametros_balance',
      clave: 'nomina_divisiones_json',
      etiqueta: 'Reparto nómina (JSON)',
      valor: serializeNominaDivisionesJson(params.nominaDivisiones),
      unidad: '',
    },
  ];
}

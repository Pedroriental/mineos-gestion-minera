import type { DateRange, ModuleFilters, ReportModule, ReportPayload } from '@/lib/reports/report-types';
import type { ReportTabFilters } from '@/lib/reports/hub/report-tab-fetch';
import { buildOperationalFilters } from '@/lib/reports/live-modules/operational-filters';

function mapTurnos(values: string[]): string[] {
  const map: Record<string, string> = {
    dia: 'DÍA',
    noche: 'NOCHE',
    completo: 'COMPLETO',
  };
  return values.map((v) => map[v.toLowerCase()] ?? v);
}

function moduleFiltersFromList(
  entries: Array<[string, string[]]>,
): ModuleFilters | undefined {
  const out: ModuleFilters = {};
  for (const [key, values] of entries) {
    if (values.length) out[key] = { in: values };
  }
  return Object.keys(out).length ? out : undefined;
}

export type HubConstructorOptions = {
  dateRange: DateRange;
  tab: ReportModule;
  tabFilters: ReportTabFilters;
  /** Balance / reconciliación — filtros operativos molino/mina */
  selectedMolinos?: string[];
  selectedMinas?: string[];
  balanceGroupBy?: string;
};

/** Construye payload del constructor desde el estado de una pestaña del hub. */
export function buildHubTabConstructorPayload(opts: HubConstructorOptions): ReportPayload {
  const { dateRange, tab, tabFilters, selectedMolinos = [], selectedMinas = [] } = opts;
  const filters: Partial<Record<ReportModule, ModuleFilters>> = {};
  let groupBy = 'dia';

  const operational = buildOperationalFilters(selectedMolinos, selectedMinas);
  if (operational?.molinos?.length || operational?.minas?.length) {
    filters.reconciliacion = {
      ...(operational.molinos?.length ? { molinos: { in: operational.molinos } } : {}),
      ...(operational.minas?.length ? { minas: { in: operational.minas } } : {}),
    };
  }

  switch (tab) {
    case 'produccion': {
      const f = tabFilters.produccion;
      groupBy = f.groupBy;
      const mod = moduleFiltersFromList([
        ['molino', f.molinos],
        ['material', f.materiales],
        ['turno', mapTurnos(f.turnos)],
      ]);
      if (mod) filters.produccion = mod;
      break;
    }
    case 'nomina': {
      const f = tabFilters.nomina;
      groupBy = f.groupBy;
      const mod: ModuleFilters = {};
      if (f.areas.length) mod.area = { in: f.areas };
      if (f.cargos.length) mod.cargo = { in: f.cargos };
      if (Object.keys(mod).length) filters.nomina = mod;
      break;
    }
    case 'voladuras': {
      const f = tabFilters.voladuras;
      groupBy = f.groupBy;
      const mod = moduleFiltersFromList([
        ['mina', f.minas],
        ['vertical_disparo', f.verticales],
        ['turno', mapTurnos(f.turnos)],
      ]);
      if (mod) filters.voladuras = mod;
      break;
    }
    case 'quemado': {
      const f = tabFilters.quemado;
      groupBy = f.groupBy;
      const mod = moduleFiltersFromList([['turno', mapTurnos(f.turnos)]]);
      if (mod) filters.quemado = mod;
      break;
    }
    case 'extraccion': {
      const f = tabFilters.extraccion;
      groupBy = f.groupBy;
      const mod = moduleFiltersFromList([
        ['mina', f.minas],
        ['vertical', f.verticales],
        ['turno', mapTurnos(f.turnos)],
      ]);
      if (mod) filters.extraccion = mod;
      break;
    }
    case 'gastos': {
      const f = tabFilters.gastos;
      groupBy = f.groupBy;
      const mod: ModuleFilters = {};
      if (f.categorias.length) mod.categoria_id = { in: f.categorias };
      if (f.tipos.length) mod.tipo = { in: f.tipos };
      if (f.proveedor.trim()) mod.proveedor = { ilike: `%${f.proveedor.trim()}%` };
      if (Object.keys(mod).length) filters.gastos = mod;
      break;
    }
    case 'balance':
      groupBy = opts.balanceGroupBy ?? 'semana';
      break;
    case 'reconciliacion':
      groupBy = 'periodo';
      break;
  }

  return {
    dateFrom: dateRange.from,
    dateTo: dateRange.to,
    modules: [tab],
    groupBy,
    filters,
  };
}

export function hubOperationalFilterCount(
  tab: ReportModule,
  tabFilters: ReportTabFilters,
  molinos: string[],
  minas: string[],
): number {
  let n = molinos.length + minas.length;
  switch (tab) {
    case 'produccion':
      n += tabFilters.produccion.molinos.length + tabFilters.produccion.materiales.length + tabFilters.produccion.turnos.length;
      break;
    case 'nomina':
      n += tabFilters.nomina.areas.length + tabFilters.nomina.cargos.length + (tabFilters.nomina.personalId ? 1 : 0);
      break;
    case 'voladuras':
      n += tabFilters.voladuras.minas.length + tabFilters.voladuras.verticales.length + tabFilters.voladuras.turnos.length;
      break;
    case 'quemado':
      n += tabFilters.quemado.turnos.length;
      break;
    case 'extraccion':
      n += tabFilters.extraccion.minas.length + tabFilters.extraccion.verticales.length + tabFilters.extraccion.turnos.length;
      break;
    case 'gastos':
      n += tabFilters.gastos.categorias.length + tabFilters.gastos.tipos.length + (tabFilters.gastos.proveedor.trim() ? 1 : 0);
      break;
    default:
      break;
  }
  return n;
}

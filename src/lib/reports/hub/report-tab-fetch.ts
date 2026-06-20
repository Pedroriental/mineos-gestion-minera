import type { DateRange, FilterOptions, ReportModule } from '@/lib/reports/report-types';
import {
  fetchProduccionReport,
  fetchNominaReport,
  fetchVoladurasReport,
  fetchQuemadoReport,
  fetchExtraccionReport,
  fetchGastosReport,
} from '@/lib/actions/report-actions';
import {
  aggregateProduccion,
  aggregateNomina,
  aggregateVoladuras,
  aggregateQuemado,
  aggregateQuemadoByPlancha,
  aggregateExtraccion,
  aggregateGastos,
} from '@/lib/reports/report-engine';
import type { NominaDivisionParam } from '@/lib/reconciliation/nomina-divisiones';

export type OperationalReportTab = Exclude<ReportModule, 'reconciliacion' | 'balance'>;

export type ReportTabFilters = {
  produccion: {
    molinos: string[];
    materiales: string[];
    turnos: string[];
    groupBy: 'dia' | 'semana' | 'mes' | 'molino' | 'material';
  };
  nomina: {
    areas: string[];
    cargos: string[];
    personalId: string;
    groupBy: 'semana' | 'mes' | 'area' | 'cargo' | 'trabajador';
    nominaDivisiones: NominaDivisionParam[];
  };
  voladuras: {
    minas: string[];
    verticales: string[];
    turnos: string[];
    groupBy: 'dia' | 'semana' | 'mina';
  };
  quemado: {
    turnos: string[];
    groupBy: 'dia' | 'semana' | 'mes' | 'plancha';
  };
  extraccion: {
    minas: string[];
    verticales: string[];
    turnos: string[];
    groupBy: 'dia' | 'semana' | 'mina';
  };
  gastos: {
    categorias: string[];
    tipos: string[];
    proveedor: string;
    groupBy: 'dia' | 'semana' | 'mes' | 'categoria';
  };
};

export type AggregatedReportResult = {
  rows: unknown[];
  kpis: Record<string, unknown>;
};

export async function fetchOperationalTabRaw(
  tab: OperationalReportTab,
  dateRange: DateRange,
  filters: ReportTabFilters[OperationalReportTab],
): Promise<unknown> {
  switch (tab) {
    case 'produccion':
      return fetchProduccionReport({
        dateRange,
        molinos: filters.molinos,
        materiales: filters.materiales,
        turnos: filters.turnos as ('dia' | 'noche' | 'completo')[],
      });
    case 'nomina':
      return fetchNominaReport({
        dateRange,
        areas: filters.areas as ('mina' | 'planta' | 'transporte' | 'administrativo')[],
        cargos: filters.cargos,
        personalId: filters.personalId,
      });
    case 'voladuras':
      return fetchVoladurasReport({
        dateRange,
        minas: filters.minas,
        verticales: filters.verticales,
        turnos: filters.turnos as ('dia' | 'noche')[],
      });
    case 'quemado':
      return fetchQuemadoReport({
        dateRange,
        turnos: filters.turnos as ('dia' | 'noche')[],
      });
    case 'extraccion':
      return fetchExtraccionReport({
        dateRange,
        minas: filters.minas,
        verticales: filters.verticales,
        turnos: filters.turnos as ('dia' | 'noche')[],
      });
    case 'gastos':
      return fetchGastosReport({
        dateRange,
        categorias: filters.categorias,
        tipos: filters.tipos as ('mina' | 'planta' | 'general' | 'transporte' | 'seguridad' | 'administrativo')[],
        proveedor: filters.proveedor,
      });
  }
}

export function aggregateOperationalTab(
  tab: OperationalReportTab,
  rawData: unknown,
  filters: ReportTabFilters[OperationalReportTab],
): AggregatedReportResult | null {
  if (!Array.isArray(rawData)) return null;

  switch (tab) {
    case 'produccion':
      return aggregateProduccion(rawData, filters.groupBy);
    case 'nomina':
      return aggregateNomina(rawData, filters.groupBy, filters.nominaDivisiones ?? []);
    case 'voladuras':
      return aggregateVoladuras(rawData, filters.groupBy);
    case 'quemado':
      if (filters.groupBy === 'plancha') {
        return aggregateQuemadoByPlancha(rawData as any);
      }
      return aggregateQuemado(rawData, filters.groupBy);
    case 'extraccion':
      return aggregateExtraccion(rawData, filters.groupBy);
    case 'gastos':
      return aggregateGastos(rawData, filters.groupBy);
  }
}

export function reportesTableColSpan(tab: ReportModule, nominaDivisionCount = 0): number {
  switch (tab) {
    case 'produccion':
      return 6;
    case 'nomina':
      return 4 + (nominaDivisionCount > 0 ? nominaDivisionCount : 0);
    case 'voladuras':
      return 7;
    case 'quemado':
      return 6;
    case 'extraccion':
      return 4;
    case 'gastos':
      return 5;
    case 'balance':
      return 10;
    default:
      return 5;
  }
}

export const EMPTY_FILTER_OPTIONS: FilterOptions = {
  produccion: { molinos: [], materiales: [] },
  nomina: { cargos: [], personal: [] },
  voladuras: { minas: [], verticales: [] },
  extraccion: { minas: [], verticales: [] },
  gastos: { categorias: [] },
};

/** Garantiza arrays definidos en opciones de filtros (evita `.map` sobre undefined). */
export function normalizeFilterOptions(
  raw: Partial<FilterOptions> | null | undefined,
): FilterOptions {
  return {
    produccion: {
      molinos: raw?.produccion?.molinos ?? [],
      materiales: raw?.produccion?.materiales ?? [],
    },
    nomina: {
      cargos: raw?.nomina?.cargos ?? [],
      personal: raw?.nomina?.personal ?? [],
    },
    voladuras: {
      minas: raw?.voladuras?.minas ?? [],
      verticales: raw?.voladuras?.verticales ?? [],
    },
    extraccion: {
      minas: raw?.extraccion?.minas ?? [],
      verticales: raw?.extraccion?.verticales ?? [],
    },
    gastos: {
      categorias: raw?.gastos?.categorias ?? [],
    },
  };
}

export function uniqueMinasFromOptions(options: FilterOptions): string[] {
  const set = new Set([
    ...(options.voladuras?.minas ?? []),
    ...(options.extraccion?.minas ?? []),
  ]);
  return Array.from(set).sort();
}

import type { ReportPayload } from '@/lib/reports/report-types';

export type FactoryReportPreset = {
  id: string;
  name: string;
  description: string;
  payload: ReportPayload;
};

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysAgoStr(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Presets de fábrica (sin persistencia) para arrancar análisis comunes. */
export const FACTORY_REPORT_PRESETS: FactoryReportPreset[] = [
  {
    id: 'balance-mes',
    name: 'Balance mensual',
    description: 'Balance en vivo agrupado por mes (30 días)',
    payload: {
      dateFrom: daysAgoStr(30),
      dateTo: todayStr(),
      modules: ['balance'],
      groupBy: 'mes',
      filters: {},
    },
  },
  {
    id: 'recon-30d',
    name: 'Reconciliación 30d',
    description: 'Matriz de reglas del último mes',
    payload: {
      dateFrom: daysAgoStr(30),
      dateTo: todayStr(),
      modules: ['reconciliacion'],
      groupBy: 'periodo',
      filters: {},
    },
  },
  {
    id: 'prod-semana',
    name: 'Producción semanal',
    description: 'Producción por día (7 días)',
    payload: {
      dateFrom: daysAgoStr(7),
      dateTo: todayStr(),
      modules: ['produccion'],
      groupBy: 'dia',
      filters: {},
    },
  },
  {
    id: 'gastos-nomina',
    name: 'Gastos + Nómina',
    description: 'Costos operativos y nómina del mes',
    payload: {
      dateFrom: daysAgoStr(30),
      dateTo: todayStr(),
      modules: ['gastos', 'nomina'],
      groupBy: 'mes',
      filters: {},
    },
  },
];

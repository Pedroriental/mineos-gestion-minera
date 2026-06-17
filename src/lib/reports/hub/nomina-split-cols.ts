import type {
  NominaDivisionAmount,
  NominaDivisionParam,
} from '@/lib/reconciliation/nomina-divisiones';
import type { ReportModule } from '@/lib/reports/report-types';

/** Columnas de reparto nómina para tablas/KPIs del hub (solo pestaña nómina). */
export function resolveNominaSplitCols(
  activeTab: ReportModule,
  divisionesFromKpis: NominaDivisionAmount[] | undefined,
  nominaDivisiones: NominaDivisionParam[] | undefined,
): NominaDivisionAmount[] {
  if (activeTab !== 'nomina') return [];
  if (divisionesFromKpis?.length) return divisionesFromKpis;
  return (nominaDivisiones ?? []).map((d) => ({
    id: d.id,
    nombre: d.nombre,
    montoUsd: 0,
  }));
}

import type { ReportModule } from './report-types';
import { format } from 'date-fns';

// Helper to escape values for CSV
function escapeCSVValue(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  if (str.includes(',') || str.includes(';') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function downloadReportCSV(
  module: ReportModule,
  aggregatedData: any,
  agruparPor: string
) {
  let headers: string[] = [];
  let rows: any[][] = [];

  // Generate headers and rows depending on module
  if (module === 'produccion') {
    headers = ['Grupo / Periodo', 'Sacos Procesados', 'Toneladas Procesadas', 'Oro Gramos', 'Tenor Promedio (g/t)', 'Merma Promedio %', 'Registros Contabilizados'];
    rows = aggregatedData.rows.map((r: any) => [
      r.grupo,
      r.sacos,
      r.toneladas,
      r.oroGramos,
      r.tenorGpt,
      r.mermaPct,
      r.registrosCount,
    ]);
  } else if (module === 'nomina') {
    headers = ['Grupo / Periodo', 'Cant. Trabajadores', 'Monto Nómina USD', 'Bono Transporte USD', 'Semanas Libres', 'Socio Pedro USD', 'Socio Darinel USD', 'Socio La Fe USD'];
    rows = aggregatedData.rows.map((r: any) => [
      r.grupo,
      r.trabajadoresCount,
      r.montoPagado,
      r.bonoTransporte,
      r.semanasLibresCount,
      r.montoPedro,
      r.montoDarinel,
      r.montoLaFe,
    ]);
  } else if (module === 'voladuras') {
    headers = ['Grupo / Periodo', 'Cantidad Disparos', 'Huecos Cantidad', 'Pies Huecos', 'Chupis Cantidad', 'Pies Chupis', 'Consumo Arroz (kg)', 'Ratio Hueco/Chupi', 'Sin Novedad Cant.'];
    rows = aggregatedData.rows.map((r: any) => [
      r.grupo,
      r.disparos,
      r.huecos,
      r.huecosPies,
      r.chupis,
      r.chupisPies,
      r.arrozKg,
      r.ratioHC,
      r.sinNovedad,
    ]);
  } else if (module === 'quemado') {
    headers = ['Grupo / Periodo', 'Cantidad Procesos', 'Total Amalgama (g)', 'Total Oro Recuperado (g)', 'Rendimiento %', 'Planchas Totales'];
    rows = aggregatedData.rows.map((r: any) => [
      r.grupo,
      r.quemadas,
      r.amalgamaG,
      r.oroG,
      r.rendimientoPct,
      r.planchasCount,
    ]);
  } else if (module === 'extraccion') {
    headers = ['Grupo / Periodo', 'Cantidad Reportes', 'Sacos Extraidos', 'Eventos / Novedades'];
    rows = aggregatedData.rows.map((r: any) => [
      r.grupo,
      r.reportes,
      r.sacos,
      r.eventos,
    ]);
  } else if (module === 'gastos') {
    headers = ['Grupo / Periodo', 'Total Monto Gastado', 'Gasto Promedio', 'Gasto Mayor Único', 'Cant. Registros'];
    rows = aggregatedData.rows.map((r: any) => [
      r.grupo,
      r.monto,
      r.gastoPromedio,
      r.gastoMayor,
      r.registrosCount,
    ]);
  } else if (module === 'balance') {
    headers = ['Grupo / Periodo', 'Ingresos Oro USD', 'Ingresos Arenas USD', 'Ingresos Total USD', 'Gasto Nómina USD', 'Gastos Insumos/Ops USD', 'Gasto Total USD', 'Rentabilidad Neta USD', 'Margen %'];
    rows = aggregatedData.rows.map((r: any) => [
      r.grupo,
      r.ingresosOro,
      r.ingresosArenas,
      r.ingresosTotal,
      r.gastosNomina,
      r.gastosOperativos,
      r.gastosTotal,
      r.rentabilidad,
      r.margenPct,
    ]);
  }

  // Create CSV String
  const csvContent: string[] = [];
  
  // Header line
  csvContent.push(headers.map(escapeCSVValue).join(','));

  // Body lines
  rows.forEach((row) => {
    csvContent.push(row.map(escapeCSVValue).join(','));
  });

  // Convert to Blob and Download (with UTF-8 BOM for Microsoft Excel)
  const csvString = '\uFEFF' + csvContent.join('\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `Reporte_MineOS_${module}_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`
    );
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

// ── Unified CSV Export (Constructor Universal) ─────────────────

import type { ExecuteReportResult } from './report-types';

export function downloadUnifiedReportCSV(
  result: ExecuteReportResult,
  groupBy: string,
) {
  const sections: string[] = [];
  const separator = ',';

  for (const [mod, modData] of Object.entries(result.data)) {
    if (modData.error || !modData.rows || modData.rows.length === 0) continue;

    // Module header
    sections.push(`\ufeffMODULO: ${mod.toUpperCase()}`);
    sections.push(`Agrupado por: ${groupBy}`);
    sections.push('');

    // Totals
    if (modData.totals && Object.keys(modData.totals).length > 0) {
      sections.push('TOTALES:');
      for (const [k, v] of Object.entries(modData.totals)) {
        sections.push(`${escapeCSVValue(k)},${escapeCSVValue(v)}`);
      }
      sections.push('');
    }

    // Data rows
    const rows = modData.rows as Record<string, unknown>[];
    const columns = Object.keys(rows[0]).filter((k) => !k.startsWith('_'));
    sections.push(columns.map((c) => escapeCSVValue(c)).join(separator));
    for (const row of rows) {
      sections.push(columns.map((col) => escapeCSVValue(row[col])).join(separator));
    }
    sections.push('');
    sections.push('');
  }

  const blob = new Blob([sections.join('\n')], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Reporte_Unificado_MineOS_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

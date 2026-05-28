import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import type { DateRange, ReportModule } from './report-types';
import { safeFormatDate, getWeekRangeLabel } from './report-engine';

// ── Palette matching pdf-reports.ts ──────────────────────────

const AMBER  = [213, 119, 6]  as [number, number, number];
const DARK   = [15,  35,  48] as [number, number, number];
const DARKER = [10,  22,  35] as [number, number, number];
const ROW    = [12,  28,  40] as [number, number, number];
const ALT    = [18,  42,  60] as [number, number, number];
const LINE   = [25,  50,  70] as [number, number, number];
const TXT    = [220, 220, 220] as [number, number, number];

const pW = (doc: jsPDF) => doc.internal.pageSize.getWidth();
const pH = (doc: jsPDF) => doc.internal.pageSize.getHeight();

// ── Shared Table Styles ──────────────────────────────────────

const tableStyles = {
  styles: {
    fontSize: 7,
    cellPadding: 1.8,
    textColor: TXT,
    fillColor: ROW,
    lineColor: LINE,
    lineWidth: 0.15,
    overflow: 'ellipsize' as const,
    font: 'helvetica',
  },
  headStyles: {
    fillColor: DARK,
    textColor: AMBER,
    fontStyle: 'bold' as const,
    fontSize: 7,
    cellPadding: 2.2,
  },
  alternateRowStyles: { fillColor: ALT },
};

// ── Shared Header ────────────────────────────────────────────

function addHeader(doc: jsPDF, title: string, subtitle: string) {
  const W = pW(doc);

  // Dark top bar
  doc.setFillColor(...DARKER);
  doc.rect(0, 0, W, 18, 'F');

  // Brand
  doc.setTextColor(...AMBER);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('MineOS', 14, 11);

  // Report title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(title, 55, 11);

  // Timestamp
  doc.setFontSize(7);
  doc.setTextColor(160, 160, 160);
  const now = new Date().toLocaleString('es-ES');
  doc.text(`Generado: ${now}`, W - 14, 11, { align: 'right' });

  // Subtitle bar
  doc.setFillColor(22, 48, 68);
  doc.rect(0, 18, W, 7.5, 'F');
  doc.setTextColor(190, 190, 190);
  doc.setFontSize(7);
  doc.text(subtitle, 14, 23);
}

// ── Shared Summary Box (KPIs) ────────────────────────────────

function addSummaryBox(doc: jsPDF, y: number, items: { label: string; value: string }[]) {
  const W   = pW(doc);
  const box = W - 28;
  const colW = box / items.length;

  doc.setFillColor(...DARK);
  doc.roundedRect(14, y, box, 13, 1.5, 1.5, 'F');

  // Dividers
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.2);
  for (let i = 1; i < items.length; i++) {
    const x = 14 + i * colW;
    doc.line(x, y + 2, x, y + 11);
  }

  items.forEach((item, i) => {
    const x = 14 + i * colW + colW / 2;
    doc.setFontSize(6.5);
    doc.setTextColor(140, 140, 140);
    doc.setFont('helvetica', 'normal');
    doc.text(item.label, x, y + 5, { align: 'center' });
    doc.setFontSize(9);
    doc.setTextColor(...AMBER);
    doc.setFont('helvetica', 'bold');
    doc.text(item.value, x, y + 10.5, { align: 'center' });
  });
}

// ── Shared Footer ────────────────────────────────────────────

function addFooter(doc: jsPDF) {
  const pageCount = doc.internal.pages.length - 1; // getNumberOfPages() is deprecated
  const W = pW(doc);
  const H = pH(doc);

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(6.5);
    doc.setTextColor(100, 100, 100);
    doc.text(
      'MINEOS - SISTEMA DE GESTIÓN MINERA DE ALTA PRECISIÓN',
      14,
      H - 8
    );
    doc.text(`Página ${i} de ${pageCount}`, W - 14, H - 8, { align: 'right' });
  }
}

// ── Main PDF Generation Function ─────────────────────────────

export function downloadReportPDF(
  module: ReportModule,
  aggregatedData: any,
  dateRange: DateRange,
  agruparPor: string
) {
  const fromStr = safeFormatDate(dateRange.from, 'dd/MM/yyyy');
  const toStr = safeFormatDate(dateRange.to, 'dd/MM/yyyy');
  const subtitle = `Periodo Seleccionado: ${fromStr} al ${toStr} | Agrupación: Por ${agruparPor.toUpperCase()}`;

  // Landscape A4 for wide table layouts
  const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });

  // Draw background color (matching app-dark theme)
  doc.setFillColor(...DARKER);
  doc.rect(0, 0, pW(doc), pH(doc), 'F');

  if (module === 'produccion') {
    addHeader(doc, 'REPORTE CONSOLIDADO DE PRODUCCIÓN', subtitle);
    
    // KPIs Summary Box
    const kpis = aggregatedData.kpis;
    addSummaryBox(doc, 30, [
      { label: 'ORO RECUPERADO TOTAL', value: `${kpis.oroTotalGrams.toLocaleString('es-ES')} g` },
      { label: 'SACOS PROCESADOS', value: kpis.sacosTotal.toLocaleString('es-ES') },
      { label: 'TONELADAS PROCESADAS', value: `${kpis.toneladasTotal.toLocaleString('es-ES')} t` },
      { label: 'TENOR PROMEDIO (GPT)', value: `${kpis.tenorPromedioGpt.toFixed(2)} g/t` },
      { label: 'MERMA PROMEDIO', value: `${kpis.mermaPromedioPct.toFixed(2)}%` },
    ]);

    // Table Content
    const headers = ['Grupo / Periodo', 'Sacos', 'Toneladas', 'Au Gramos', 'Tenor (g/t)', 'Merma %', 'Registros'];
    const body = aggregatedData.rows.map((r: any) => [
      r.grupo,
      r.sacos.toLocaleString('es-ES'),
      r.toneladas.toLocaleString('es-ES'),
      r.oroGramos.toLocaleString('es-ES') + ' g',
      r.tenorGpt.toFixed(2) + ' g/t',
      r.mermaPct.toFixed(2) + '%',
      r.registrosCount,
    ]);

    autoTable(doc, {
      ...tableStyles,
      startY: 48,
      head: [headers],
      body: body,
      margin: { left: 14, right: 14 },
    });

  } else if (module === 'nomina') {
    addHeader(doc, 'REPORTE CONSOLIDADO DE NÓMINA', subtitle);

    const kpis = aggregatedData.kpis;
    addSummaryBox(doc, 30, [
      { label: 'TOTAL NOMINA PAGADA', value: `$${kpis.totalPagado.toLocaleString('es-ES')}` },
      { label: 'BONO TRANSPORTE', value: `$${kpis.bonoTransporteTotal.toLocaleString('es-ES')}` },
      { label: 'TRABAJADORES UNICOS', value: kpis.trabajadoresUnicos.toString() },
      { label: 'PARTICIPACION PEDRO', value: `$${kpis.pedroTotal.toLocaleString('es-ES')}` },
      { label: 'PARTICIPACION DARINEL', value: `$${kpis.darinelTotal.toLocaleString('es-ES')}` },
      { label: 'PARTICIPACION LA FE', value: `$${kpis.laFeTotal.toLocaleString('es-ES')}` },
    ]);

    const headers = ['Grupo / Periodo', 'Cant. Trabajadores', 'Pago Nómina', 'Bono Transporte', 'Semanas Libres', 'Socio Pedro', 'Socio Darinel', 'Socio La Fe'];
    const body = aggregatedData.rows.map((r: any) => [
      r.grupo,
      r.trabajadoresCount,
      `$${r.montoPagado.toLocaleString('es-ES')}`,
      `$${r.bonoTransporte.toLocaleString('es-ES')}`,
      r.semanasLibresCount,
      `$${r.montoPedro.toLocaleString('es-ES')}`,
      `$${r.montoDarinel.toLocaleString('es-ES')}`,
      `$${r.montoLaFe.toLocaleString('es-ES')}`,
    ]);

    autoTable(doc, {
      ...tableStyles,
      startY: 48,
      head: [headers],
      body: body,
      margin: { left: 14, right: 14 },
    });

  } else if (module === 'voladuras') {
    addHeader(doc, 'REPORTE CONSOLIDADO DE VOLADURAS / DISPAROS', subtitle);

    const kpis = aggregatedData.kpis;
    addSummaryBox(doc, 30, [
      { label: 'DISPAROS REALIZADOS', value: kpis.disparosCount.toString() },
      { label: 'HUECOS TOTALES', value: kpis.huecosTotal.toLocaleString('es-ES') },
      { label: 'CHUPIS TOTALES', value: kpis.chupisTotal.toLocaleString('es-ES') },
      { label: 'CONSUMO ARROZ', value: `${kpis.arrozKgTotal.toLocaleString('es-ES')} kg` },
      { label: 'RATIO H/C', value: kpis.ratioHC.toFixed(2) },
      { label: 'SIN NOVEDADES / INCIDENTES', value: `${kpis.sinNovedadCount} / ${kpis.conNovedadCount}` },
    ]);

    const headers = ['Grupo / Periodo', 'Disparos', 'Huecos', 'Pies Huecos', 'Chupis', 'Pies Chupis', 'Arroz (kg)', 'Ratio H/C', 'Sin Novedad'];
    const body = aggregatedData.rows.map((r: any) => [
      r.grupo,
      r.disparos,
      r.huecos.toLocaleString('es-ES'),
      r.huecosPies.toLocaleString('es-ES'),
      r.chupis.toLocaleString('es-ES'),
      r.chupisPies.toLocaleString('es-ES'),
      r.arrozKg.toLocaleString('es-ES') + ' kg',
      r.ratioHC.toFixed(2),
      r.sinNovedad,
    ]);

    autoTable(doc, {
      ...tableStyles,
      startY: 48,
      head: [headers],
      body: body,
      margin: { left: 14, right: 14 },
    });

  } else if (module === 'quemado') {
    addHeader(doc, 'REPORTE CONSOLIDADO DE QUEMADO Y PLANCAS', subtitle);

    const kpis = aggregatedData.kpis;
    addSummaryBox(doc, 30, [
      { label: 'PROCESOS DE QUEMADO', value: kpis.quemadasCount.toString() },
      { label: 'AMALGAMA TOTAL', value: `${kpis.amalgamaTotalG.toLocaleString('es-ES')} g` },
      { label: 'ORO PURO RECUPERADO', value: `${kpis.oroTotalG.toLocaleString('es-ES')} g` },
      { label: 'RENDIMIENTO ORO/AMALGAMA', value: `${kpis.rendimientoOroPct.toFixed(2)}%` },
      { label: 'MANTO (AMALGAMA/ORO)', value: `${kpis.mantoAmalgamaTotalG.toFixed(1)}g / ${kpis.mantoOroTotalG.toFixed(1)}g` },
      { label: 'RETORTA ORO', value: `${kpis.retortaOroTotalG.toFixed(1)} g` },
    ]);

    const headers = ['Grupo / Periodo', 'Cant. Procesos', 'Amalgama (g)', 'Oro Recuperado (g)', 'Rendimiento %', 'Planchas Totales'];
    const body = aggregatedData.rows.map((r: any) => [
      r.grupo,
      r.quemadas,
      r.amalgamaG.toLocaleString('es-ES') + ' g',
      r.oroG.toLocaleString('es-ES') + ' g',
      r.rendimientoPct.toFixed(2) + '%',
      r.planchasCount,
    ]);

    autoTable(doc, {
      ...tableStyles,
      startY: 48,
      head: [headers],
      body: body,
      margin: { left: 14, right: 14 },
    });

  } else if (module === 'extraccion') {
    addHeader(doc, 'REPORTE CONSOLIDADO DE EXTRACCIÓN', subtitle);

    const kpis = aggregatedData.kpis;
    addSummaryBox(doc, 30, [
      { label: 'REPORTES DE EXTRACCION', value: kpis.reportesCount.toString() },
      { label: 'SACOS EXTRAIDOS TOTAL', value: kpis.sacosTotal.toLocaleString('es-ES') },
      { label: 'EVENTOS REGISTRADOS', value: kpis.eventosTotal.toString() },
      { label: 'PROMEDIO SACOS POR REPORTES', value: kpis.reportesCount > 0 ? (kpis.sacosTotal / kpis.reportesCount).toFixed(1) : '0' },
    ]);

    const headers = ['Grupo / Periodo', 'Cantidad Reportes', 'Sacos Extraídos', 'Eventos / Novedades'];
    const body = aggregatedData.rows.map((r: any) => [
      r.grupo,
      r.reportes,
      r.sacos.toLocaleString('es-ES'),
      r.eventos,
    ]);

    autoTable(doc, {
      ...tableStyles,
      startY: 48,
      head: [headers],
      body: body,
      margin: { left: 14, right: 14 },
    });

  } else if (module === 'gastos') {
    addHeader(doc, 'REPORTE CONSOLIDADO DE GASTOS', subtitle);

    const kpis = aggregatedData.kpis;
    addSummaryBox(doc, 30, [
      { label: 'TOTAL GASTADO OPERACIONAL', value: `$${kpis.totalGastado.toLocaleString('es-ES')}` },
      { label: 'PROMEDIO POR TRANSACCION', value: `$${kpis.promedioGasto.toLocaleString('es-ES')}` },
      { label: 'REGISTROS DE GASTOS', value: kpis.registrosCount.toLocaleString('es-ES') },
      { label: 'MAYOR GASTO REGISTRADO', value: `$${kpis.mayorGastoMonto.toLocaleString('es-ES')} - ${kpis.mayorGastoDesc}` },
    ]);

    const headers = ['Grupo / Periodo', 'Total Monto Gasto', 'Gasto Promedio', 'Gasto Mayor Único', 'Nro. Facturas/Transacciones'];
    const body = aggregatedData.rows.map((r: any) => [
      r.grupo,
      `$${r.monto.toLocaleString('es-ES')}`,
      `$${r.gastoPromedio.toLocaleString('es-ES')}`,
      `$${r.gastoMayor.toLocaleString('es-ES')}`,
      r.registrosCount,
    ]);

    autoTable(doc, {
      ...tableStyles,
      startY: 48,
      head: [headers],
      body: body,
      margin: { left: 14, right: 14 },
    });

  } else if (module === 'balance') {
    addHeader(doc, 'BALANCE GENERAL CONSOLIDADO Y RENTABILIDAD', subtitle);

    const kpis = aggregatedData.kpis;
    addSummaryBox(doc, 30, [
      { label: 'INGRESO TOTAL ESTIMADO', value: `$${kpis.ingresoTotalUsd.toLocaleString('es-ES')}` },
      { label: 'GASTO TOTAL INTEGRAL', value: `$${kpis.gastoTotalUsd.toLocaleString('es-ES')}` },
      { label: 'UTILIDAD NETA ESTIMADA', value: `$${kpis.rentabilidadUsd.toLocaleString('es-ES')}` },
      { label: 'MARGEN RENTABILIDAD %', value: `${kpis.margenRentabilidadPct.toFixed(2)}%` },
      { label: 'COSTO POR GRAMO ORO', value: `$${kpis.costoPorGramoOro.toFixed(2)} /g` },
      { label: 'INGRESOS ARENAS / ORO', value: `$${kpis.ingresoArenasUsd.toLocaleString('es-ES')} / $${kpis.ingresoOroUsd.toLocaleString('es-ES')}` },
    ]);

    const headers = ['Grupo / Periodo', 'Ingresos Oro', 'Ingresos Arenas', 'Ingresos Total', 'Gasto Nómina', 'Gastos Insumos/Ops', 'Gasto Total', 'Rentabilidad Neta', 'Margen %'];
    const body = aggregatedData.rows.map((r: any) => [
      r.grupo,
      `$${r.ingresosOro.toLocaleString('es-ES')}`,
      `$${r.ingresosArenas.toLocaleString('es-ES')}`,
      `$${r.ingresosTotal.toLocaleString('es-ES')}`,
      `$${r.gastosNomina.toLocaleString('es-ES')}`,
      `$${r.gastosOperativos.toLocaleString('es-ES')}`,
      `$${r.gastosTotal.toLocaleString('es-ES')}`,
      `$${r.rentabilidad.toLocaleString('es-ES')}`,
      r.margenPct.toFixed(2) + '%',
    ]);

    autoTable(doc, {
      ...tableStyles,
      startY: 48,
      head: [headers],
      body: body,
      margin: { left: 14, right: 14 },
    });
  }

  // Draw Page Numbering Footer
  addFooter(doc);

  // Save the PDF
  doc.save(`Reporte_MineOS_${module}_${format(new Date(), 'yyyyMMdd_HHmmss')}.pdf`);
}

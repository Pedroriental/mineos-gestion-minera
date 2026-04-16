import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ReporteVoladura, ReporteProduccion } from './types';

const BRAND = '#D97706'; // amber-600
const DARK  = '#0F2330';

function addHeader(doc: jsPDF, title: string, subtitle: string) {
  // Background bar
  doc.setFillColor(DARK);
  doc.rect(0, 0, 210, 22, 'F');

  // Title
  doc.setTextColor(213, 119, 6); // amber
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('MineOS', 14, 10);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(title, 14, 17);

  // Date generated
  doc.setFontSize(8);
  doc.setTextColor(180, 180, 180);
  const now = new Date().toLocaleString('es-ES');
  doc.text(`Generado: ${now}`, 210 - 14, 17, { align: 'right' });

  // Subtitle bar
  doc.setFillColor(30, 50, 70);
  doc.rect(0, 22, 210, 9, 'F');
  doc.setTextColor(200, 200, 200);
  doc.setFontSize(8);
  doc.text(subtitle, 14, 27.5);
}

function addSummaryBox(doc: jsPDF, y: number, items: { label: string; value: string }[]) {
  const colW = (210 - 28) / items.length;
  doc.setFillColor(15, 35, 48);
  doc.roundedRect(14, y, 182, 14, 2, 2, 'F');
  items.forEach((item, i) => {
    const x = 14 + i * colW + colW / 2;
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.setFont('helvetica', 'normal');
    doc.text(item.label, x, y + 5, { align: 'center' });
    doc.setFontSize(10);
    doc.setTextColor(213, 119, 6);
    doc.setFont('helvetica', 'bold');
    doc.text(item.value, x, y + 11.5, { align: 'center' });
  });
}

// ─────────────────────────────────────────────────────────────
//  VOLADURAS
// ─────────────────────────────────────────────────────────────
export function downloadVoladurasPDF(data: ReporteVoladura[], dateLabel?: string) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const label = dateLabel || `${data.length} registros`;

  addHeader(doc, 'Reporte de Voladuras', label);

  const totalHuecos  = data.reduce((s, d) => s + (d.huecos_cantidad  || 0), 0);
  const totalChupis  = data.reduce((s, d) => s + (d.chupis_cantidad  || 0), 0);
  const totalArroz   = data.reduce((s, d) => s + Number(d.arroz_kg   || 0), 0);
  const totalFosf    = data.reduce((s, d) => s + (d.fosforos_lp      || 0), 0);
  const disparos     = data.filter(d => d.numero_disparo).length;

  addSummaryBox(doc, 33, [
    { label: 'Registros',   value: String(data.length) },
    { label: 'Huecos',      value: String(totalHuecos) },
    { label: 'Chupis',      value: String(totalChupis) },
    { label: 'Arroz (kg)',  value: totalArroz.toFixed(1) },
    { label: 'Fósforos LP', value: String(totalFosf) },
    { label: 'Disparos',    value: String(disparos) },
  ]);

  autoTable(doc, {
    startY: 52,
    margin: { left: 14, right: 14 },
    head: [[
      'Fecha', 'Turno', 'Mina', 'Frente', 'Vertical',
      'Huecos', 'Pies H', 'Chupis', 'Pies C',
      'N° Disp.', 'Hora Disp.',
      'Fósforos', 'Espag.', 'Vit.E', 'Trenza (m)', 'Arroz (kg)',
      'Estado',
    ]],
    body: data.map(d => [
      d.fecha,
      d.turno === 'dia' ? 'Día' : d.turno === 'noche' ? 'Noche' : 'Completo',
      d.mina || '—',
      d.frente || '—',
      (d as ReporteVoladura & { vertical_disparo?: string }).vertical_disparo || '—',
      d.huecos_cantidad,
      d.huecos_pies,
      d.chupis_cantidad,
      d.chupis_pies,
      d.numero_disparo || '—',
      d.hora_disparo || '—',
      d.fosforos_lp,
      d.espaguetis,
      d.vitamina_e,
      d.trenza_metros,
      d.arroz_kg,
      d.sin_novedad ? 'Sin novedad' : 'Con novedad',
    ]),
    styles: {
      fontSize: 7,
      cellPadding: 2,
      textColor: [220, 220, 220],
      fillColor: [12, 28, 40],
      lineColor: [30, 55, 75],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [15, 35, 48],
      textColor: [213, 119, 6],
      fontStyle: 'bold',
      fontSize: 7,
    },
    alternateRowStyles: { fillColor: [16, 38, 55] },
    columnStyles: {
      16: { fontStyle: 'bold' },
    },
  });

  addFooter(doc);
  doc.save(`voladuras-${dateLabel?.replace(/\s/g, '_') || 'reporte'}.pdf`);
}

// ─────────────────────────────────────────────────────────────
//  PRODUCCIÓN
// ─────────────────────────────────────────────────────────────
export function downloadProduccionPDF(data: ReporteProduccion[], dateLabel?: string) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const label = dateLabel || `${data.length} registros`;

  addHeader(doc, 'Reporte de Producción', label);

  const totalOro   = data.reduce((s, d) => s + Number(d.oro_recuperado_g || 0), 0);
  const totalSacos = data.reduce((s, d) => s + Number(d.sacos || 0), 0);
  const totalTon   = data.reduce((s, d) => s + Number(d.toneladas_procesadas || 0), 0);
  const avgTenor   = totalTon > 0 ? (totalOro / totalTon).toFixed(4) : '—';

  addSummaryBox(doc, 33, [
    { label: 'Registros',   value: String(data.length) },
    { label: 'Oro Rec. (g)', value: totalOro.toFixed(4) },
    { label: 'Sacos',       value: String(totalSacos) },
    { label: 'Toneladas',   value: totalTon.toFixed(2) },
    { label: 'Tenor (g/t)', value: avgTenor },
  ]);

  autoTable(doc, {
    startY: 52,
    margin: { left: 14, right: 14 },
    head: [[
      'Fecha', 'Turno', 'Molino', 'Material', 'Código',
      'Amalg. 1 (g)', 'Amalg. 2 (g)', 'Oro Rec. (g)',
      'Merma 1 %', 'Merma 2 %',
      'Sacos', 'Ton. Proc.', 'Tenor g/t', 'Tenor g/s',
      'Responsable', 'Observaciones',
    ]],
    body: data.map(d => [
      d.fecha,
      d.turno === 'dia' ? 'Día' : d.turno === 'noche' ? 'Noche' : 'Completo',
      d.molino || '—',
      d.material || '—',
      d.material_codigo || '—',
      d.amalgama_1_g ?? '—',
      d.amalgama_2_g ?? '—',
      d.oro_recuperado_g,
      d.merma_1_pct != null ? `${d.merma_1_pct}%` : '—',
      d.merma_2_pct != null ? `${d.merma_2_pct}%` : '—',
      d.sacos ?? '—',
      d.toneladas_procesadas ?? '—',
      d.tenor_tonelada_gpt ?? '—',
      d.tenor_saco_gps ?? '—',
      d.responsable || '—',
      d.observaciones || '',
    ]),
    styles: {
      fontSize: 7,
      cellPadding: 2,
      textColor: [220, 220, 220],
      fillColor: [12, 28, 40],
      lineColor: [30, 55, 75],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [15, 35, 48],
      textColor: [213, 119, 6],
      fontStyle: 'bold',
      fontSize: 7,
    },
    alternateRowStyles: { fillColor: [16, 38, 55] },
    columnStyles: {
      7: { textColor: [251, 191, 36], fontStyle: 'bold' },
    },
  });

  addFooter(doc);
  doc.save(`produccion-${dateLabel?.replace(/\s/g, '_') || 'reporte'}.pdf`);
}

function addFooter(doc: jsPDF) {
  const pageCount = (doc as jsPDF & { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text(`MineOS — Gestión Minera`, 14, doc.internal.pageSize.getHeight() - 5);
    doc.text(`Página ${i} / ${pageCount}`, doc.internal.pageSize.getWidth() - 14, doc.internal.pageSize.getHeight() - 5, { align: 'right' });
  }
}

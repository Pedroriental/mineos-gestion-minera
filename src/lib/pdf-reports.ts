import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ReporteVoladura, ReporteProduccion } from './types';

// ── Palette ────────────────────────────────────────────────────────────────
const AMBER  = [213, 119, 6]  as [number, number, number];
const DARK   = [15,  35,  48] as [number, number, number];
const DARKER = [10,  22,  35] as [number, number, number];
const ROW    = [12,  28,  40] as [number, number, number];
const ALT    = [18,  42,  60] as [number, number, number];
const LINE   = [25,  50,  70] as [number, number, number];
const TXT    = [220, 220, 220] as [number, number, number];

const pW = (doc: jsPDF) => doc.internal.pageSize.getWidth();
const pH = (doc: jsPDF) => doc.internal.pageSize.getHeight();

// ── Shared table styles ────────────────────────────────────────────────────
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

// ── Header ─────────────────────────────────────────────────────────────────
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

  // Timestamp (right)
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

// ── Summary box ────────────────────────────────────────────────────────────
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

// ── Footer ─────────────────────────────────────────────────────────────────
function addFooter(doc: jsPDF) {
  const W = pW(doc);
  const H = pH(doc);
  const count = (
    doc as jsPDF & { internal: { getNumberOfPages: () => number } }
  ).internal.getNumberOfPages();

  for (let i = 1; i <= count; i++) {
    doc.setPage(i);
    // Footer bar
    doc.setFillColor(...DARKER);
    doc.rect(0, H - 7, W, 7, 'F');
    doc.setFontSize(6.5);
    doc.setTextColor(120, 120, 120);
    doc.setFont('helvetica', 'normal');
    doc.text('MineOS — Sistema de Gestión Minera', 14, H - 2.5);
    doc.text(`Página ${i} / ${count}`, W - 14, H - 2.5, { align: 'right' });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  VOLADURAS
// ═══════════════════════════════════════════════════════════════════════════
export function downloadVoladurasPDF(data: ReporteVoladura[], dateLabel?: string) {
  const doc   = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const label = dateLabel || `${data.length} registros`;

  addHeader(doc, 'Reporte de Voladuras', label);

  const totalHuecos = data.reduce((s, d) => s + (d.huecos_cantidad || 0), 0);
  const totalChupis = data.reduce((s, d) => s + (d.chupis_cantidad || 0), 0);
  const totalArroz  = data.reduce((s, d) => s + Number(d.arroz_kg   || 0), 0);
  const totalFosf   = data.reduce((s, d) => s + (d.fosforos_lp      || 0), 0);
  const disparos    = data.filter(d => d.numero_disparo).length;

  addSummaryBox(doc, 28, [
    { label: 'Registros',    value: String(data.length)     },
    { label: 'Huecos',       value: String(totalHuecos)     },
    { label: 'Chupis',       value: String(totalChupis)     },
    { label: 'Arroz (kg)',   value: totalArroz.toFixed(1)   },
    { label: 'Fósforos LP',  value: String(totalFosf)       },
    { label: 'Con Disparo',  value: String(disparos)        },
  ]);

  autoTable(doc, {
    startY: 44,
    margin: { left: 14, right: 14 },
    head: [[
      'Fecha', 'Turno', 'Mina', 'Frente', 'Vert.',
      'Huecos', 'Pies H', 'Chupis', 'Pies C',
      'N° Disp.', 'Hora',
      'Fósf.', 'Espag.', 'Vit.E', 'Trenza', 'Arroz',
      'Estado',
    ]],
    body: data.map(d => [
      d.fecha,
      d.turno === 'dia' ? 'Día' : d.turno === 'noche' ? 'Noche' : 'Comp.',
      d.mina   || '—',
      d.frente || '—',
      (d as ReporteVoladura & { vertical_disparo?: string }).vertical_disparo || '—',
      d.huecos_cantidad  ?? '—',
      d.huecos_pies      ?? '—',
      d.chupis_cantidad  ?? '—',
      d.chupis_pies      ?? '—',
      d.numero_disparo   || '—',
      d.hora_disparo     || '—',
      d.fosforos_lp      ?? '—',
      d.espaguetis       ?? '—',
      d.vitamina_e       ?? '—',
      d.trenza_metros    ?? '—',
      d.arroz_kg         ?? '—',
      d.sin_novedad ? 'OK' : 'Nov.',
    ]),
    ...tableStyles,
    columnStyles: {
      0:  { cellWidth: 20 },
      1:  { cellWidth: 13 },
      2:  { cellWidth: 20 },
      3:  { cellWidth: 18 },
      4:  { cellWidth: 12 },
      5:  { cellWidth: 13 },
      6:  { cellWidth: 13 },
      7:  { cellWidth: 13 },
      8:  { cellWidth: 13 },
      9:  { cellWidth: 16 },
      10: { cellWidth: 14 },
      11: { cellWidth: 12 },
      12: { cellWidth: 13 },
      13: { cellWidth: 12 },
      14: { cellWidth: 13 },
      15: { cellWidth: 12 },
      16: { cellWidth: 14, fontStyle: 'bold' },
    },
  });

  addFooter(doc);
  doc.save(`voladuras-${dateLabel?.replace(/\s/g, '_') || 'reporte'}.pdf`);
}

// ═══════════════════════════════════════════════════════════════════════════
//  PRODUCCIÓN
// ═══════════════════════════════════════════════════════════════════════════
export function downloadProduccionPDF(data: ReporteProduccion[], dateLabel?: string) {
  const doc   = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const label = dateLabel || `${data.length} registros`;

  addHeader(doc, 'Reporte de Producción', label);

  const totalOro   = data.reduce((s, d) => s + Number(d.oro_recuperado_g   || 0), 0);
  const totalSacos = data.reduce((s, d) => s + Number(d.sacos              || 0), 0);
  const totalKg    = totalSacos * 50;
  const totalTon   = data.reduce((s, d) => s + Number(d.toneladas_procesadas || 0), 0);
  const avgTenor   = totalTon > 0 ? (totalOro / totalTon).toFixed(4) : '—';
  const avgMerma1  = data.filter(d => d.merma_1_pct).reduce((s, d) => s + Number(d.merma_1_pct), 0) /
                     (data.filter(d => d.merma_1_pct).length || 1);

  addSummaryBox(doc, 28, [
    { label: 'Registros',    value: String(data.length)              },
    { label: 'Au Rec. (g)',  value: totalOro.toFixed(4)              },
    { label: 'Sacos (×50kg)', value: `${totalSacos}  (${totalKg} kg)` },
    { label: 'Toneladas',    value: totalTon.toFixed(3)              },
    { label: 'Tenor g/t',   value: avgTenor                         },
    { label: 'Merma 1 prom', value: data.filter(d => d.merma_1_pct).length > 0 ? `${avgMerma1.toFixed(1)}%` : '—' },
  ]);

  autoTable(doc, {
    startY: 44,
    margin: { left: 14, right: 14 },
    head: [[
      'Fecha', 'Turno', 'Molino', 'Material',
      'Amalg.1 (g)', 'Amalg.2 (g)', 'Au Rec. (g)',
      'Merma 1%', 'Merma 2%',
      'Sacos', 'Ton.', 'g/t', 'g/s',
      'Responsable', 'Obs.',
    ]],
    body: data.map(d => [
      d.fecha,
      d.turno === 'dia' ? 'Día' : d.turno === 'noche' ? 'Noche' : 'Comp.',
      d.molino   || '—',
      d.material || '—',
      d.amalgama_1_g          ?? '—',
      d.amalgama_2_g          ?? '—',
      Number(d.oro_recuperado_g).toFixed(4),
      d.merma_1_pct != null   ? `${d.merma_1_pct}%` : '—',
      d.merma_2_pct != null   ? `${d.merma_2_pct}%` : '—',
      d.sacos                 ?? '—',
      d.toneladas_procesadas  ?? '—',
      d.tenor_tonelada_gpt    ?? '—',
      d.tenor_saco_gps        ?? '—',
      d.responsable           || '—',
      d.observaciones         || '',
    ]),
    ...tableStyles,
    columnStyles: {
      0:  { cellWidth: 20 },                                    // Fecha
      1:  { cellWidth: 13 },                                    // Turno
      2:  { cellWidth: 20 },                                    // Molino
      3:  { cellWidth: 24 },                                    // Material
      4:  { cellWidth: 18 },                                    // Amalg.1
      5:  { cellWidth: 18 },                                    // Amalg.2
      6:  { cellWidth: 22, textColor: [251, 191, 36], fontStyle: 'bold' }, // Au Rec
      7:  { cellWidth: 15 },                                    // Merma1
      8:  { cellWidth: 15 },                                    // Merma2
      9:  { cellWidth: 15 },                                    // Sacos
      10: { cellWidth: 15 },                                    // Ton
      11: { cellWidth: 16 },                                    // g/t
      12: { cellWidth: 16 },                                    // g/s
      13: { cellWidth: 22 },                                    // Responsable
      14: { cellWidth: 'auto' as unknown as number },           // Obs
    },
  });

  addFooter(doc);
  doc.save(`produccion-${dateLabel?.replace(/\s/g, '_') || 'reporte'}.pdf`);
}

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
  const totalSacos = Math.round(data.reduce((s, d) => s + Number(d.sacos || 0), 0));
  const totalKg    = totalSacos * 50;
  const totalTon   = data.reduce((s, d) => s + Number(d.toneladas_procesadas || 0), 0);
  const avgTenor   = totalTon > 0 ? (totalOro / totalTon).toFixed(4) : '—';
  const avgMerma1  = data.filter(d => d.merma_1_pct).reduce((s, d) => s + Number(d.merma_1_pct), 0) /
                     (data.filter(d => d.merma_1_pct).length || 1);

  addSummaryBox(doc, 28, [
    { label: 'Registros',    value: String(data.length)              },
    { label: 'Au Rec. (g)',  value: totalOro.toFixed(4)              },
    { label: 'Sacos (×50kg)', value: `${totalSacos}  (${totalKg.toLocaleString()} kg)` },
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
      d.sacos != null ? Math.round(Number(d.sacos)) : '—',
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

// ═══════════════════════════════════════════════════════════════════════════
//  BALANCE DE RECUPERACIÓN POR ORIGEN
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Clasifica un registro por su origen de oro:
 *  - Vertical 1 / 2 / 3 → detectado por código Vx en material_codigo o molino
 *  - Mantenimiento
 *  - Repaso
 *  - Molino Continuo
 *  - Otros
 */
function clasificarOrigen(r: ReporteProduccion): string {
  const molino   = (r.molino   || '').toLowerCase().trim();
  const material = (r.material || '').toLowerCase().trim();
  const codigo   = (r.material_codigo || '').toUpperCase().trim();

  // Mantenimiento
  if (molino.includes('mantenimiento') || material.includes('mantenimiento')) {
    return 'Mantenimiento';
  }

  // Molino Continuo
  if (molino.includes('continuo') || material.includes('continuo')) {
    return 'Molino Continuo';
  }

  // Repaso
  if (molino.includes('repaso') || material.includes('repaso')) {
    return 'Repaso';
  }

  // Caratal
  if (molino.includes('caratal') || material.includes('caratal')) {
    return 'Caratal';
  }

  // Verticales: detectar V1, V2, V3 en el código (ej. V1D26, V2D10, V3)
  // Buscar en material_codigo primero, luego en molino y material
  const buscarVertical = (s: string): string | null => {
    const m = s.match(/V([123])/i);
    return m ? `Vertical ${m[1]}` : null;
  };

  const v = buscarVertical(codigo) || buscarVertical(molino) || buscarVertical(material);
  if (v) return v;

  return 'Otros';
}

const COLORES_ORIGEN: Record<string, [number, number, number]> = {
  'Vertical 1':    [218, 165,  32],  // dorado
  'Vertical 2':    [251, 146,  60],  // naranja
  'Vertical 3':    [52,  211, 153],  // esmeralda
  'Mantenimiento': [148, 163, 184],  // gris azulado
  'Repaso':        [167, 139, 250],  // violeta
  'Caratal':       [248, 113, 113],  // rojo coral
  'Molino Continuo': [56, 189, 248], // celeste
  'Otros':         [113, 113, 122],  // zinc
};

const ORDEN_ORIGEN = [
  'Vertical 1', 'Vertical 2', 'Vertical 3',
  'Mantenimiento', 'Repaso', 'Caratal', 'Molino Continuo', 'Otros',
];

interface BalanceOrigen {
  origen: string;
  registros: ReporteProduccion[];
  totalOro: number;
  totalSacos: number;
  totalTon: number;
  tenor: number;
  mermaPromedio: number | null;
  pctTotal: number; // % del oro total
}

export function downloadBalanceRecuperacionPDF(
  data: ReporteProduccion[],
  dateLabel?: string,
  oroQuemadoPlanchas: number = 0,
  countQuemado: number = 0
) {
  if (data.length === 0) return;

  const doc   = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W     = pW(doc);
  const label = dateLabel || `${data.length} registros`;

  addHeader(doc, 'Balance de Recuperación de Oro por Origen', label);

  // ── Agrupar ──────────────────────────────────────────────
  const grupos: Record<string, ReporteProduccion[]> = {};
  ORDEN_ORIGEN.forEach(o => { grupos[o] = []; });

  data.forEach(r => {
    const origen = clasificarOrigen(r);
    if (!grupos[origen]) grupos[origen] = [];
    grupos[origen].push(r);
  });

  const totalOroGlobal = data.reduce((s, r) => s + (Number(r.oro_recuperado_g) || 0), 0);

  // ── Calcular estadísticas por grupo ──────────────────────
  const balances: BalanceOrigen[] = ORDEN_ORIGEN
    .map(origen => {
      const regs = grupos[origen] || [];
      if (regs.length === 0) return null;

      const totalOro   = regs.reduce((s, r) => s + (Number(r.oro_recuperado_g)    || 0), 0);
      const totalSacos = Math.round(regs.reduce((s, r) => s + (Number(r.sacos) || 0), 0));
      const totalTon   = regs.reduce((s, r) => s + (Number(r.toneladas_procesadas) || 0), 0);
      const tenor      = totalTon > 0 ? totalOro / totalTon : 0;

      const conMerma   = regs.filter(r => r.merma_1_pct != null && Number(r.merma_1_pct) > 0);
      const mermaPromedio = conMerma.length > 0
        ? conMerma.reduce((s, r) => s + Number(r.merma_1_pct), 0) / conMerma.length
        : null;

      return {
        origen,
        registros: regs,
        totalOro,
        totalSacos,
        totalTon,
        tenor,
        mermaPromedio,
        pctTotal: totalOroGlobal > 0 ? (totalOro / totalOroGlobal) * 100 : 0,
      };
    })
    .filter(Boolean) as BalanceOrigen[];

  // ── Summary Box Global ────────────────────────────────────
  const totalSacosGlobal  = Math.round(data.reduce((s, r) => s + (Number(r.sacos) || 0), 0));
  const totalTonGlobal    = data.reduce((s, r) => s + (Number(r.toneladas_procesadas) || 0), 0);
  const oroSoloMolinos    = totalOroGlobal;  // Au sólo de registros de producción
  const oroGranTotal      = oroSoloMolinos + oroQuemadoPlanchas; // AU TOTAL REAL
  const tenorGlobal       = totalTonGlobal > 0 ? oroSoloMolinos / totalTonGlobal : 0;
  const origenesActivos   = balances.length;

  addSummaryBox(doc, 28, [
    { label: 'Au Molinos (g)',       value: oroSoloMolinos.toFixed(4)             },
    { label: 'Quemado Planchas (g)', value: oroQuemadoPlanchas > 0 ? oroQuemadoPlanchas.toFixed(4) : '—' },
    { label: 'AU GRAN TOTAL (g)',    value: oroGranTotal.toFixed(4)               },
    { label: 'Sacos Totales',        value: String(totalSacosGlobal)              },
    { label: 'Toneladas',            value: totalTonGlobal.toFixed(3)             },
    { label: 'Tenor Global g/t',     value: tenorGlobal.toFixed(4)               },
  ]);

  // ── TABLA RESUMEN CONSOLIDADO ─────────────────────────────
  let curY = 46;

  // Título sección
  doc.setFillColor(10, 22, 35);
  doc.rect(14, curY, W - 28, 6.5, 'F');
  doc.setFontSize(7.5);
  doc.setTextColor(...AMBER);
  doc.setFont('helvetica', 'bold');
  doc.text('// RESUMEN CONSOLIDADO POR ORIGEN', 17, curY + 4.5);
  curY += 8;

  autoTable(doc, {
    startY: curY,
    margin: { left: 14, right: 14 },
    head: [[
      'ORIGEN / MÉTODO',
      'REGISTROS',
      'Au RECUPERADO (g)',
      '% DEL TOTAL',
      'SACOS',
      'TONELADAS',
      'TENOR (g/t)',
      'MERMA PROM.',
    ]],
    body: balances.map(b => {
      const color = COLORES_ORIGEN[b.origen] || COLORES_ORIGEN['Otros'];
      return [
        { content: b.origen, styles: { textColor: color as [number, number, number], fontStyle: 'bold' as const } },
        { content: String(b.registros.length), styles: { halign: 'center' as const } },
        { content: b.totalOro.toFixed(4),  styles: { textColor: [251, 191, 36] as [number, number, number], fontStyle: 'bold' as const, halign: 'right' as const } },
        { content: `${b.pctTotal.toFixed(1)}%`, styles: { halign: 'center' as const } },
        { content: String(b.totalSacos),   styles: { halign: 'center' as const } },
        { content: b.totalTon.toFixed(3),  styles: { halign: 'right' as const  } },
        { content: b.tenor.toFixed(4),     styles: { halign: 'right' as const  } },
        { content: b.mermaPromedio != null ? `${b.mermaPromedio.toFixed(1)}%` : '—', styles: { halign: 'center' as const } },
      ];
    }),
    foot: [
      // Fila: Subtotal Molinos
      [
        { content: 'SUBTOTAL MOLINOS', styles: { fontStyle: 'bold' as const, textColor: [180, 180, 180] as [number, number, number] } },
        { content: String(data.length), styles: { halign: 'center' as const } },
        { content: oroSoloMolinos.toFixed(4), styles: { textColor: [251, 191, 36] as [number, number, number], fontStyle: 'bold' as const, halign: 'right' as const } },
        { content: oroGranTotal > 0 ? `${((oroSoloMolinos / oroGranTotal) * 100).toFixed(1)}%` : '100.0%', styles: { halign: 'center' as const } },
        { content: String(totalSacosGlobal), styles: { halign: 'center' as const } },
        { content: totalTonGlobal.toFixed(3), styles: { halign: 'right' as const } },
        { content: tenorGlobal.toFixed(4), styles: { halign: 'right' as const } },
        { content: '—', styles: { halign: 'center' as const } },
      ],
      // Fila: Quemado de Planchas (solo si hay valor)
      ...(oroQuemadoPlanchas > 0 ? [[
        { content: 'QUEMADO DE PLANCHAS', styles: { fontStyle: 'bold' as const, textColor: [250, 204, 21] as [number, number, number] } },
        { content: countQuemado > 0 ? String(countQuemado) : '-', styles: { halign: 'center' as const } },
        { content: oroQuemadoPlanchas.toFixed(4), styles: { textColor: [251, 191, 36] as [number, number, number], fontStyle: 'bold' as const, halign: 'right' as const } },
        { content: oroGranTotal > 0 ? `${((oroQuemadoPlanchas / oroGranTotal) * 100).toFixed(1)}%` : '-', styles: { halign: 'center' as const } },
        { content: '-', styles: { halign: 'center' as const } },
        { content: '-', styles: { halign: 'right' as const } },
        { content: '-', styles: { halign: 'right' as const } },
        { content: '-', styles: { halign: 'center' as const } },
      ]] : []),
      // Fila: Gran Total
      [
        { content: 'GRAN TOTAL AU', styles: { fontStyle: 'bold' as const, textColor: AMBER as [number, number, number] } },
        { content: String(data.length), styles: { halign: 'center' as const, fontStyle: 'bold' as const } },
        { content: oroGranTotal.toFixed(4), styles: { textColor: [251, 191, 36] as [number, number, number], fontStyle: 'bold' as const, halign: 'right' as const } },
        { content: '100.0%', styles: { halign: 'center' as const, fontStyle: 'bold' as const } },
        { content: String(totalSacosGlobal), styles: { halign: 'center' as const, fontStyle: 'bold' as const } },
        { content: totalTonGlobal.toFixed(3), styles: { halign: 'right' as const, fontStyle: 'bold' as const } },
        { content: tenorGlobal.toFixed(4), styles: { halign: 'right' as const, fontStyle: 'bold' as const } },
        { content: '—', styles: { halign: 'center' as const } },
      ],
    ],
    ...tableStyles,
    footStyles: {
      fillColor: DARKER,
      textColor: TXT,
      fontStyle: 'bold',
      fontSize: 7.5,
    },
    columnStyles: {
      0: { cellWidth: 40 },
      1: { cellWidth: 22, halign: 'center' },
      2: { cellWidth: 38, halign: 'right' },
      3: { cellWidth: 22, halign: 'center' },
      4: { cellWidth: 20, halign: 'center' },
      5: { cellWidth: 25, halign: 'right' },
      6: { cellWidth: 25, halign: 'right' },
      7: { cellWidth: 22, halign: 'center' },
    },
  });

  curY = (doc as any).lastAutoTable.finalY + 8;

  // ── TABLAS DETALLE POR ORIGEN ─────────────────────────────
  for (const bal of balances) {
    // Si no cabe el encabezado de sección, nueva página
    if (curY > pH(doc) - 50) {
      doc.addPage();
      curY = 14;
    }

    const color = COLORES_ORIGEN[bal.origen] || COLORES_ORIGEN['Otros'];

    // Encabezado sección
    doc.setFillColor(...DARK);
    doc.rect(14, curY, W - 28, 7, 'F');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...color);
    doc.text(`// ${bal.origen.toUpperCase()}`, 17, curY + 4.8);
    doc.setTextColor(180, 180, 180);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Au: ${bal.totalOro.toFixed(4)} g  |  ${bal.pctTotal.toFixed(1)}% del total  |  ${bal.registros.length} registros`,
      W - 16, curY + 4.8, { align: 'right' }
    );
    curY += 9;

    // Subtabla del origen
    autoTable(doc, {
      startY: curY,
      margin: { left: 14, right: 14 },
      head: [[
        'Fecha', 'Turno', 'Molino / Código', 'Material',
        'Amalg.1 (g)', 'Amalg.2 (g)', 'Au Rec. (g)',
        'Merma 1%', 'Sacos', 'Ton.', 'Tenor g/t',
      ]],
      body: bal.registros.map(r => [
        r.fecha,
        r.turno === 'dia' ? 'Día' : r.turno === 'noche' ? 'Noche' : 'Comp.',
        [r.molino, r.material_codigo].filter(Boolean).join(' / ') || r.molino || '—',
        r.material || '—',
        r.amalgama_1_g != null ? Number(r.amalgama_1_g).toFixed(2) : '—',
        r.amalgama_2_g != null ? Number(r.amalgama_2_g).toFixed(2) : '—',
        { content: Number(r.oro_recuperado_g).toFixed(4), styles: { textColor: [251, 191, 36] as [number, number, number], fontStyle: 'bold' as const } },
        r.merma_1_pct != null ? `${Number(r.merma_1_pct).toFixed(1)}%` : '—',
        r.sacos != null ? Math.round(Number(r.sacos)) : 0,
        r.toneladas_procesadas != null ? Number(r.toneladas_procesadas).toFixed(3) : '—',
        r.tenor_tonelada_gpt != null ? Number(r.tenor_tonelada_gpt).toFixed(4) : '—',
      ]),
      foot: [[
        { content: 'SUBTOTAL', colSpan: 6, styles: { fontStyle: 'bold' as const, textColor: color as [number, number, number] } },
        { content: bal.totalOro.toFixed(4), styles: { textColor: [251, 191, 36] as [number, number, number], fontStyle: 'bold' as const } },
        { content: bal.mermaPromedio != null ? `${bal.mermaPromedio.toFixed(1)}%` : '—' },
        { content: String(bal.totalSacos) },
        { content: bal.totalTon.toFixed(3) },
        { content: bal.tenor.toFixed(4) },
      ]],
      ...tableStyles,
      footStyles: {
        fillColor: DARK,
        textColor: TXT,
        fontStyle: 'bold',
        fontSize: 7,
      },
      columnStyles: {
        0:  { cellWidth: 20 },
        1:  { cellWidth: 14 },
        2:  { cellWidth: 32 },
        3:  { cellWidth: 28 },
        4:  { cellWidth: 18, halign: 'right' },
        5:  { cellWidth: 18, halign: 'right' },
        6:  { cellWidth: 22, halign: 'right' },
        7:  { cellWidth: 16, halign: 'center' },
        8:  { cellWidth: 14, halign: 'center' },
        9:  { cellWidth: 18, halign: 'right' },
        10: { cellWidth: 20, halign: 'right' },
      },
    });

    curY = (doc as any).lastAutoTable.finalY + 6;
  }

  addFooter(doc);
  const fileName = `Balance_Recuperacion_${dateLabel?.replace(/[\s\/]/g, '_') || 'reporte'}.pdf`;
  doc.save(fileName);
}


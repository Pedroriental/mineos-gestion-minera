'use client';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { GastosEmpresaResumen } from '@/lib/actions/compensacion-gastos';

function fmt(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(n);
}

function fmtDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  return { r: (num >> 16) & 0xff, g: (num >> 8) & 0xff, b: num & 0xff };
}

const GOLD: [number, number, number] = [218, 165, 32];
const BLACK: [number, number, number] = [0, 0, 0];
const DARK: [number, number, number] = [30, 30, 30];
const MUTED: [number, number, number] = [100, 100, 100];
const LIGHT_BG: [number, number, number] = [245, 245, 245];

export function generarPdfEmpresa(data: GastosEmpresaResumen): void {
  const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const empresaColor = hexToRgb(data.empresa.color);

  // ============ PÁGINA 1: ENCABEZADO + RESUMEN ============

  // Franja superior dorada
  doc.setFillColor(...GOLD);
  doc.rect(0, 0, pageWidth, 10, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...DARK);
  doc.text(`Informe de Gastos — ${data.empresa.nombre}`, margin, 22);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  const periodo = `${fmtDate(data.desde)} — ${fmtDate(data.hasta)}`;
  doc.text(`Período: ${periodo}`, margin, 29);

  // Participación en esquina superior derecha
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(empresaColor.r, empresaColor.g, empresaColor.b);
  const partTxt = `Participación: ${data.empresa.porcentaje}%`;
  doc.text(partTxt, pageWidth - margin, 22, { align: 'right' });

  // ─── Recuadro de compensación (tarjeta destacada) ───────────────────────
  const comp = data.compensacion;
  const esDebeCobrar = comp.estado === 'debe_cobrar';
  const esDebePagar = comp.estado === 'debe_pagar';

  const cardColor: [number, number, number] = esDebeCobrar
    ? [20, 90, 40]
    : esDebePagar
      ? [90, 20, 20]
      : [40, 40, 40];

  const cardTextColor: [number, number, number] = esDebeCobrar
    ? [80, 200, 120]
    : esDebePagar
      ? [220, 80, 80]
      : [180, 180, 180];

  const estadoLabel = esDebeCobrar
    ? 'DEBE COBRAR'
    : esDebePagar
      ? 'DEBE PAGAR'
      : 'EQUILIBRADO';

  doc.setFillColor(...cardColor);
  doc.roundedRect(margin, 35, pageWidth - margin * 2, 30, 3, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...cardTextColor);
  doc.text('COMPENSACIÓN DE GASTOS COMPARTIDOS (MINA)', margin + 6, 43);

  doc.setFontSize(20);
  const saldoTxt = `${esDebeCobrar ? '+' : ''}${fmt(comp.saldo)}`;
  doc.text(saldoTxt, margin + 6, 57);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(estadoLabel, pageWidth - margin - 6, 57, { align: 'right' });

  // Detalle pequeño del cálculo de compensación
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  const detalleComp = [
    `Total compartido: ${fmt(comp.totalCompartido)}`,
    `Pagado por ${data.empresa.nombre}: ${fmt(comp.gastadoEmpresa)}`,
    `Teórico (${data.empresa.porcentaje}%): ${fmt(comp.teorico)}`,
    `Saldo (pagado − teórico): ${fmt(comp.saldo)}`,
  ];
  let detX = margin + 6;
  for (const txt of detalleComp) {
    doc.text(txt, detX, 43 + 30 + 8);
    detX += 70;
  }

  // ─── Tabla: totales por categoría ────────────────────────────────────────
  const porCat: Record<string, { total: number; pagado: number; count: number }> = {};
  for (const g of data.gastos) {
    if (!porCat[g.categoria]) porCat[g.categoria] = { total: 0, pagado: 0, count: 0 };
    porCat[g.categoria].total += g.montoTotal;
    porCat[g.categoria].pagado += g.montoPagado;
    porCat[g.categoria].count += 1;
  }

  const catRows = Object.entries(porCat).map(([cat, v]) => [
    cat,
    String(v.count),
    fmt(v.total),
    fmt(v.pagado),
  ]);
  catRows.push(['TOTAL GENERAL', String(data.gastos.length), '—', fmt(data.totalGastado)]);

  autoTable(doc, {
    head: [['Categoría', '# Gastos', 'Monto Total', `Pagado por ${data.empresa.nombre}`]],
    body: catRows,
    startY: 82,
    styles: { fontSize: 9, cellPadding: 3, halign: 'right' },
    headStyles: { fillColor: GOLD, textColor: BLACK, fontStyle: 'bold', halign: 'center' },
    columnStyles: {
      0: { halign: 'left', cellWidth: 80 },
      1: { halign: 'center', cellWidth: 25 },
      2: { halign: 'right', cellWidth: 45 },
      3: { halign: 'right', cellWidth: 55, fontStyle: 'bold' },
    },
    didParseCell: (d) => {
      if (d.section === 'body' && d.row.index === catRows.length - 1) {
        d.cell.styles.fontStyle = 'bold';
        d.cell.styles.fillColor = GOLD;
        d.cell.styles.textColor = BLACK;
      }
    },
    alternateRowStyles: { fillColor: LIGHT_BG },
  });

  // ============ PÁGINA 2+: DESGLOSE DETALLADO ============
  doc.addPage();

  // Franja dorada en p2
  doc.setFillColor(...GOLD);
  doc.rect(0, 0, pageWidth, 10, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...DARK);
  doc.text(`Desglose Detallado — ${data.empresa.nombre}`, margin, 22);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(`Todos los gastos donde ${data.empresa.nombre} registró un pago en ${periodo}`, margin, 28);

  // Agrupar por categoría para mostrar secciones
  const catOrden = Object.keys(porCat).sort((a, b) => a.localeCompare(b));

  type CellDef = string | { content: string; colSpan?: number; rowSpan?: number; styles?: Record<string, unknown> };
  const detalleRows: CellDef[][] = [];

  for (const cat of catOrden) {
    // Fila de encabezado de categoría (colSpan 4)
    detalleRows.push([
      {
        content: cat.toUpperCase(),
        colSpan: 4,
        styles: { fontStyle: 'bold', fillColor: [50, 50, 50], textColor: [218, 165, 32], halign: 'left' },
      },
      '', '', '',
    ]);

    const itemsCat = data.gastos.filter((g) => g.categoria === cat);
    for (const g of itemsCat) {
      detalleRows.push([
        fmtDate(g.fecha),
        g.descripcion ?? 'Sin descripción',
        fmt(g.montoTotal),
        fmt(g.montoPagado),
      ]);
    }

    // Subtotal de categoría
    const cat_ = porCat[cat];
    detalleRows.push([
      '',
      { content: `Subtotal ${cat}`, styles: { fontStyle: 'bold', halign: 'right' } },
      fmt(cat_.total),
      { content: fmt(cat_.pagado), styles: { fontStyle: 'bold' } },
    ]);
  }

  // Fila total final
  detalleRows.push([
    '',
    { content: 'TOTAL GENERAL', styles: { fontStyle: 'bold', halign: 'right', fillColor: GOLD, textColor: BLACK } },
    { content: '—', styles: { fillColor: GOLD, textColor: BLACK } },
    { content: fmt(data.totalGastado), styles: { fontStyle: 'bold', fillColor: GOLD, textColor: BLACK } },
  ]);

  autoTable(doc, {
    head: [['Fecha', 'Descripción', 'Monto Total', `Pagado por ${data.empresa.nombre}`]],
    body: detalleRows,
    startY: 33,
    styles: { fontSize: 8, cellPadding: 3, halign: 'right', overflow: 'linebreak' },
    headStyles: { fillColor: GOLD, textColor: BLACK, fontStyle: 'bold', halign: 'center' },
    columnStyles: {
      0: { halign: 'center', cellWidth: 28 },
      1: { halign: 'left', cellWidth: 130 },
      2: { halign: 'right', cellWidth: 38 },
      3: { halign: 'right', cellWidth: 42, fontStyle: 'bold' },
    },
    alternateRowStyles: { fillColor: LIGHT_BG },
  });


  // ============ PIE DE PÁGINA ============
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Generado el ${new Date().toLocaleString('es-ES')} — Página ${i} de ${pageCount} — Informe ${data.empresa.nombre}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'center' },
    );
  }

  const nombreArchivo = data.empresa.nombre.toLowerCase().replace(/\s+/g, '_');
  doc.save(`informe_${nombreArchivo}_${data.mes}.pdf`);
}

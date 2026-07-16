'use client';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { CompensacionResumen } from '@/lib/compensacion-gastos';

function fmtPdf(n: number): string {
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

export function generarPdfCompensacionGastos(resumen: CompensacionResumen): void {
  const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;

  // ============ HEADER ============
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(218, 165, 32);
  doc.text('Compensación de Gastos de Mina', margin, 18);

  doc.setFontSize(11);
  doc.setTextColor(80, 80, 80);
  doc.setFont('helvetica', 'normal');
  const periodoLabel = resumen.period.dia
    ? fmtDate(resumen.period.dia)
    : `${fmtDate(resumen.period.desde)} - ${fmtDate(resumen.period.hasta)}`;
  doc.text(`Período: ${periodoLabel}`, margin, 25);

  // Info de empresas (arriba a la derecha)
  let rightX = pageWidth - margin;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(40, 40, 40);
  resumen.empresas.forEach((e) => {
    const txt = `${e.nombre} (${e.porcentaje}%)`;
    doc.setTextColor(hexToRgb(e.color).r, hexToRgb(e.color).g, hexToRgb(e.color).b);
    doc.text(txt, rightX, 18, { align: 'right' });
    rightX -= doc.getTextWidth(txt) + 8;
  });

  // ============ TABLA PRINCIPAL ============
  const N = resumen.empresas.length;

  const headerRow1 = [
    'Item',
    'Descripción del Gasto',
    'Total',
    { content: 'Gasto Real', colSpan: N, styles: { halign: 'center' } },
    { content: 'Gasto Teórico', colSpan: N, styles: { halign: 'center' } },
    { content: 'Compensación de Gastos', colSpan: N, styles: { halign: 'center' } }
  ];

  const headerRow2 = [
    '',
    '',
    '',
    ...resumen.empresas.map((e) => e.nombre),
    ...resumen.empresas.map((e) => e.nombre),
    ...resumen.empresas.map((e) => e.nombre)
  ];

  const fullHead = [headerRow1, headerRow2];
  const body: (string | number)[][] = [];

  resumen.categorias.forEach((cat, i) => {
    const row: (string | number)[] = [String(i + 1), cat.nombre, fmtPdf(cat.total)];
    
    // Gasto Real
    resumen.empresas.forEach((e) => {
      row.push(fmtPdf(cat.gastoRealPorEmpresa[e.id] ?? 0));
    });
    
    // Gasto Teórico
    resumen.empresas.forEach((e) => {
      row.push(fmtPdf(cat.gastoTeoricoPorEmpresa[e.id] ?? 0));
    });
    
    // Compensación
    resumen.empresas.forEach((e) => {
      const comp = cat.compensacionPorEmpresa[e.id] ?? 0;
      const compStr = comp > 0 ? `+${fmtPdf(comp)}` : fmtPdf(comp);
      row.push(compStr);
    });
    
    body.push(row);
  });

  // Fila de totales
  const totalRow: (string | number)[] = ['', 'TOTAL', fmtPdf(resumen.totalGasto)];
  
  // Gasto Real Totales
  resumen.empresas.forEach((e) => {
    totalRow.push(fmtPdf(resumen.totalRealPorEmpresa[e.id] ?? 0));
  });
  
  // Gasto Teórico Totales
  resumen.empresas.forEach((e) => {
    totalRow.push(fmtPdf(resumen.totalTeoricoPorEmpresa[e.id] ?? 0));
  });
  
  // Compensación Totales
  resumen.empresas.forEach((e) => {
    const comp = resumen.totalCompensacionPorEmpresa[e.id] ?? 0;
    totalRow.push(comp > 0 ? `+${fmtPdf(comp)}` : fmtPdf(comp));
  });
  
  body.push(totalRow);

  autoTable(doc, {
    head: fullHead,
    body,
    startY: 32,
    styles: { fontSize: 8, cellPadding: 3, halign: 'right', overflow: 'linebreak' },
    headStyles: {
      fillColor: [218, 165, 32],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 15 },
      1: { halign: 'left', cellWidth: 50 },
      2: { halign: 'right', cellWidth: 28, fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.row.index === body.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [218, 165, 32];
        data.cell.styles.textColor = [0, 0, 0];
      }
    },
  });

  // ============ RESUMEN DE COMPENSACIÓN ============
  type DocWithAutoTable = jsPDF & { lastAutoTable?: { finalY?: number } };
  const docWithTable = doc as DocWithAutoTable;
  const finalY = docWithTable.lastAutoTable?.finalY ?? 50;
  let resumenY = finalY + 12;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(218, 165, 32);
  doc.text('Resumen de Compensación', margin, resumenY);

  resumenY += 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text(
    'Positivo (+) = la empresa pago de mas: debe cobrar',
    margin,
    resumenY,
  );
  resumenY += 5;
  doc.text(
    'Negativo (-) = la empresa pago de menos: debe pagar',
    margin,
    resumenY,
  );
  resumenY += 10;

  // Tabla de resumen
  const resumenData = resumen.empresas.map((e) => {
    const r = resumen.resumenPorEmpresa[e.id];
    const saldo = r?.saldo ?? 0;
    const estado = r?.estado ?? 'equilibrado';
    const label = estado === 'debe_cobrar' ? 'DEBE COBRAR' : estado === 'debe_pagar' ? 'DEBE PAGAR' : 'EQUILIBRADO';
    return [e.nombre, fmtPdf(saldo), label];
  });

  autoTable(doc, {
    head: [['Empresa', 'Saldo', 'Estado']],
    body: resumenData,
    startY: resumenY,
    styles: { fontSize: 9, cellPadding: 3, halign: 'right' },
    headStyles: { fillColor: [218, 165, 32], textColor: [0, 0, 0] },
    columnStyles: {
      0: { halign: 'left', cellWidth: 60 },
      1: { halign: 'right', cellWidth: 40, fontStyle: 'bold' },
      2: { halign: 'center', cellWidth: 40, fontStyle: 'bold' },
    },
  });

  // ============ SEGUNDA PÁGINA: DESGLOSE DETALLADO ============
  doc.addPage();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(218, 165, 32);
  doc.text('Desglose Detallado de Gastos', margin, 18);

  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.setFont('helvetica', 'normal');
  doc.text('Detalle de gastos individuales considerados en el cálculo de compensación.', margin, 24);

  // Cabecera de la tabla detallada
  const detalleHead = [
    [
      'Fecha',
      'Categoría',
      'Descripción del Gasto',
      'Monto Total',
      ...resumen.empresas.map((e) => `Pagó ${e.nombre}`)
    ]
  ];

  // Ordenar gastos por fecha
  const gastosOrdenados = [...(resumen.gastos ?? [])].sort((a, b) => {
    return a.fecha.localeCompare(b.fecha);
  });

  const detalleBody = gastosOrdenados.map((g) => {
    const row = [
      fmtDate(g.fecha),
      g.categoria,
      g.descripcion ?? 'Sin descripción',
      fmtPdf(g.monto)
    ];

    resumen.empresas.forEach((e) => {
      const pago = g.pagos.find((p) => p.empresa_id === e.id);
      row.push(fmtPdf(pago?.monto_pagado ?? 0));
    });

    return row;
  });

  // Fila de totales al final del desglose
  const totalDetalleRow = [
    '',
    '',
    'TOTALES',
    fmtPdf(resumen.totalGasto)
  ];
  resumen.empresas.forEach((e) => {
    totalDetalleRow.push(fmtPdf(resumen.totalRealPorEmpresa[e.id] ?? 0));
  });
  detalleBody.push(totalDetalleRow);

  autoTable(doc, {
    head: detalleHead,
    body: detalleBody,
    startY: 30,
    styles: { fontSize: 8, cellPadding: 3, halign: 'right', overflow: 'linebreak' },
    headStyles: {
      fillColor: [218, 165, 32],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 25 },
      1: { halign: 'left', cellWidth: 40 },
      2: { halign: 'left', cellWidth: 90 },
      3: { halign: 'right', cellWidth: 25, fontStyle: 'bold' },
      4: { halign: 'right', cellWidth: 25 },
      5: { halign: 'right', cellWidth: 25 }
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.row.index === detalleBody.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [240, 240, 240];
        data.cell.styles.textColor = [0, 0, 0];
      }
    },
  });

  // ============ FOOTER ============
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Generado el ${new Date().toLocaleString('es-ES')} - Página ${i} de ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'center' },
    );
  }

  doc.save(`compensacion_gastos_${resumen.period.mes}.pdf`);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  return {
    r: (num >> 16) & 0xff,
    g: (num >> 8) & 0xff,
    b: num & 0xff,
  };
}

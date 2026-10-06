'use client';

import jsPDF from 'jspdf';
import autoTable, { type RowInput } from 'jspdf-autotable';
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

  const fullHead: RowInput[] = [headerRow1 as RowInput, headerRow2 as RowInput];
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
    startY: 26,
    styles: { fontSize: 7.5, cellPadding: 2, halign: 'right', overflow: 'linebreak' },
    headStyles: {
      fillColor: [218, 165, 32],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 12 },
      1: { halign: 'left', cellWidth: 46 },
      2: { halign: 'right', cellWidth: 26, fontStyle: 'bold' },
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
  const finalYMain = docWithTable.lastAutoTable?.finalY ?? 60;
  let resumenY = finalYMain + 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(218, 165, 32);
  doc.text('Resumen de Compensación', margin, resumenY);

  resumenY += 4;
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(
    'Positivo (+) = debe cobrar  ·  Negativo (-) = debe pagar',
    margin,
    resumenY,
  );
  resumenY += 3;

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
    styles: { fontSize: 8, cellPadding: 1.8, halign: 'right' },
    headStyles: { fillColor: [218, 165, 32], textColor: [0, 0, 0] },
    columnStyles: {
      0: { halign: 'left', cellWidth: 55 },
      1: { halign: 'right', cellWidth: 35, fontStyle: 'bold' },
      2: { halign: 'center', cellWidth: 35, fontStyle: 'bold' },
    },
  });

  // ============ SECCIÓN 4: HISTÓRICO Y COMPARATIVA DE COMPENSACIÓN ============
  const finalYResumen = docWithTable.lastAutoTable?.finalY ?? resumenY + 15;
  let histY = finalYResumen + 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(218, 165, 32);
  doc.text('HISTÓRICO Y ESTATUS ACUMULADO DE COMPENSACIÓN', margin, histY);

  histY += 4;

  const PRECIO_ORO = 98.00;
  const fe = resumen.empresas.find(e => (e.nombre_corto ?? '').toLowerCase().includes('fe') || e.nombre.toLowerCase().includes('fe')) ?? resumen.empresas[0];
  const riasco = resumen.empresas.find(e => (e.nombre_corto ?? '').toLowerCase().includes('riasco') || e.nombre.toLowerCase().includes('riasco')) ?? resumen.empresas[1];

  const mesEvaluado = resumen.period.mes; // '2026-08' o '2026-07'

  // Compensación del mes evaluado en USD
  const compFeUsd = resumen.totalCompensacionPorEmpresa[fe?.id ?? ''] ?? 0;
  const compRiascoUsd = resumen.totalCompensacionPorEmpresa[riasco?.id ?? ''] ?? 0;

  // Conversión a gramos de oro (@ $98.00/g)
  const gMesFe = Math.round((compFeUsd / PRECIO_ORO) * 100) / 100;
  const gMesRiasco = Math.round((compRiascoUsd / PRECIO_ORO) * 100) / 100;

  const fmtG = (val: number) => {
    const formatted = Math.abs(val).toFixed(2).replace('.', ',');
    return val > 0 ? `+${formatted} g` : val < 0 ? `-${formatted} g` : '0,00 g';
  };

  // Histórico previo consolidado:
  // Feb - Jun saldo acumulado: Los Riasco +101,90 g | La Fé -101,90 g
  // Julio 2026: Los Riasco -122,98 g (-$12.051,73) | La Fé +122,98 g (+$12.051,73)
  // Cierre Julio: Los Riasco -21,08 g | La Fé +21,08 g
  // Agosto 2026: Los Riasco +31,62 g (+$3.098,31) | La Fé -31,62 g (-$3.098,31)
  // Cierre Agosto: Los Riasco +10,54 g (~$1.032,92) | La Fé -10,54 g (~-$1.032,92)

  let histBody: (string | { content: string; styles?: any })[][];

  if (mesEvaluado === '2026-07') {
    histBody = [
      ['Febrero', '-135,29 g', '+135,29 g'],
      ['Marzo', '+48,53 g', '-48,53 g'],
      ['Abril', '+86,02 g', '-86,02 g'],
      ['Mayo', '+48,90 g', '-48,90 g'],
      ['Junio', '+53,74 g', '-53,74 g'],
      ['Saldo Acumulado Previo (Feb - Jun)', '+101,90 g', '-101,90 g'],
      [`Julio 2026 (Mes Evaluado @ $${PRECIO_ORO.toFixed(2)}/g)`, fmtG(gMesRiasco), fmtG(gMesFe)],
      ['SALDO ACUMULADO TOTAL (CIERRE JULIO)', fmtG(101.90 + gMesRiasco), fmtG(-101.90 + gMesFe)],
    ];
  } else {
    // Agosto 2026 o posterior: muestra Julio como mes cerrado y Agosto como mes evaluado
    const gJulioRiasco = -122.98;
    const gJulioFe = 122.98;
    const cierreJulioRiasco = 101.90 + gJulioRiasco; // -21.08 g
    const cierreJulioFe = -101.90 + gJulioFe;       // +21.08 g
    const saldoFinalRiascoG = Math.round((cierreJulioRiasco + gMesRiasco) * 100) / 100; // +10.54 g
    const saldoFinalFeG = Math.round((cierreJulioFe + gMesFe) * 100) / 100;             // -10.54 g

    histBody = [
      ['Febrero', '-135,29 g', '+135,29 g'],
      ['Marzo', '+48,53 g', '-48,53 g'],
      ['Abril', '+86,02 g', '-86,02 g'],
      ['Mayo', '+48,90 g', '-48,90 g'],
      ['Junio', '+53,74 g', '-53,74 g'],
      ['Saldo Acumulado Previo (Feb - Jun)', '+101,90 g', '-101,90 g'],
      ['Julio 2026 (Cerrado)', fmtG(gJulioRiasco), fmtG(gJulioFe)],
      ['Saldo Acumulado al Cierre de Julio', fmtG(cierreJulioRiasco), fmtG(cierreJulioFe)],
      [`Agosto 2026 (Mes Evaluado @ $${PRECIO_ORO.toFixed(2)}/g)`, fmtG(gMesRiasco), fmtG(gMesFe)],
      ['SALDO ACUMULADO TOTAL (CIERRE AGOSTO)', fmtG(saldoFinalRiascoG), fmtG(saldoFinalFeG)],
    ];
  }

  // Subtítulo tabla izquierda
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(60, 60, 60);
  doc.text(`Histórico y Liquidación en Oro (Tasa: $${PRECIO_ORO.toFixed(2)}/g)`, margin, histY);

  // Subtítulo tabla derecha
  doc.text('Comparativa Mensual Operativa y Financiera (Julio vs Agosto 2026)', margin + 130, histY);
  histY += 3;

  // TABLA IZQUIERDA: Histórico en Oro
  autoTable(doc, {
    head: [['Mes / Período', 'Los Riasco (g)', 'La Fé (g)']],
    body: histBody,
    startY: histY,
    tableWidth: 124,
    margin: { left: margin },
    styles: { fontSize: 6.8, cellPadding: 1.2, halign: 'center' },
    headStyles: { fillColor: [218, 165, 32], textColor: [0, 0, 0], fontStyle: 'bold' },
    columnStyles: {
      0: { halign: 'left', cellWidth: 56 },
      1: { halign: 'center', cellWidth: 34 },
      2: { halign: 'center', cellWidth: 34 },
    },
    didParseCell: (data) => {
      if (data.section === 'body') {
        // Fila 5: Saldo Previo Feb-Jun
        if (data.row.index === 5) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [240, 240, 240];
        }
        // Fila 7 en Agosto: Saldo Cierre Julio
        if (histBody.length > 8 && data.row.index === 7) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [245, 245, 245];
        }
        // Última fila: Saldo Acumulado Total
        if (data.row.index === histBody.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [218, 165, 32];
          data.cell.styles.textColor = [0, 0, 0];
        }
      }
    },
  });

  // TABLA DERECHA: Comparativa Mensual (Julio vs Agosto)
  const compTableBody = [
    ['Gasto Total Mina', '$97.600,33', '$82.477,75', '-$15.122,58 (-15,5%)'],
    ['Aporte Real Los Riasco', '$46.508,47 (47,7%)', '$52.584,96 (63,8%)', '+$6.076,49 (+13,1%)'],
    ['Aporte Real La Fé', '$51.091,86 (52,3%)', '$29.892,79 (36,2%)', '-$21.199,07 (-41,5%)'],
    ['Cuota Teórica Pactada', '60% Riasco / 40% Fé', '60% Riasco / 40% Fé', 'Pacto 60/40 Vigente'],
    ['Compensación Neta (USD)', 'Riasco: -$12.051,73\nLa Fé: +$12.051,73', 'Riasco: +$3.098,31\nLa Fé: -$3.098,31', '+$15.150,04 Favorable\na Los Riasco'],
    ['Compensación Oro (@ $98/g)', 'Riasco: -122,98 g\nLa Fé: +122,98 g', 'Riasco: +31,62 g\nLa Fé: -31,62 g', '+154,60 g Variación\na favor Riasco'],
    ['Saldo Acumulado al Cierre', 'Riasco: -21,08 g\nLa Fé: +21,08 g', 'Riasco: +10,54 g\nLa Fé: -10,54 g', '+31,62 g Reversión\na favor Riasco'],
    ['Estatus de Liquidación', 'Los Riasco DEBE PAGAR\nLa Fé DEBE COBRAR', 'Los Riasco DEBE COBRAR\nLa Fé DEBE PAGAR', 'Reversión mensual\nde acreedor a deudor'],
  ];

  autoTable(doc, {
    head: [['Indicador Operativo / Financiero', 'Julio 2026', 'Agosto 2026', 'Variación / Análisis']],
    body: compTableBody,
    startY: histY,
    tableWidth: 139,
    margin: { left: margin + 130 },
    styles: { fontSize: 6.2, cellPadding: 1.1, halign: 'center', overflow: 'linebreak' },
    headStyles: { fillColor: [50, 50, 50], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { halign: 'left', cellWidth: 46, fontStyle: 'bold' },
      1: { halign: 'center', cellWidth: 31 },
      2: { halign: 'center', cellWidth: 31 },
      3: { halign: 'center', cellWidth: 31, fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      if (data.section === 'body') {
        if (data.row.index === 0) {
          data.cell.styles.fillColor = [245, 245, 245];
        }
        if (data.row.index === 4 || data.row.index === 6) {
          data.cell.styles.fillColor = [255, 250, 240];
        }
        if (data.row.index === compTableBody.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [240, 240, 240];
        }
      }
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

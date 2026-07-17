'use client';

import jsPDF from 'jspdf';
import autoTable, { type RowInput } from 'jspdf-autotable';
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

const GOLD: [number, number, number] = [218, 165, 32];
const BLACK: [number, number, number] = [0, 0, 0];
const DARK: [number, number, number] = [30, 30, 30];
const MUTED: [number, number, number] = [100, 100, 100];
const LIGHT_BG: [number, number, number] = [245, 245, 245];

export function generarPdfEmpresa(data: GastosEmpresaResumen): void {
  // Orientación vertical (Portrait) para mayor legibilidad y formato estándar de reporte
  const doc = new jsPDF({ orientation: 'portrait', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;

  const empresaNombreLimpio = data.empresa.nombre.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // ============ PÁGINA 1: ENCABEZADO + RESUMEN FINANCIERO ============

  // Franja superior dorada
  doc.setFillColor(...GOLD);
  doc.rect(0, 0, pageWidth, 8, 'F');

  // Título principal
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...DARK);
  doc.text(`Informe de Gastos - ${empresaNombreLimpio}`, margin, 20);

  // Subtítulo con período
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  const periodo = `${fmtDate(data.desde)} a ${fmtDate(data.hasta)}`;
  doc.text(`Periodo: ${periodo}`, margin, 26);

  // Participación en la esquina superior derecha
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...DARK);
  const partTxt = `Participacion: ${data.empresa.porcentaje}%`;
  doc.text(partTxt, pageWidth - margin, 20, { align: 'right' });

  // ─── TABLA DE RESUMEN DE COMPENSACIÓN (Alto contraste y fácil lectura) ───
  const comp = data.compensacion;
  const esDebeCobrar = comp.estado === 'debe_cobrar';
  const esDebePagar = comp.estado === 'debe_pagar';

  const labelSaldo = esDebeCobrar
    ? 'SALDO A COBRAR (Favor)'
    : esDebePagar
      ? 'SALDO A PAGAR (Contra)'
      : 'SALDO EQUILIBRADO';

  const saldoVal = `${comp.saldo > 0 ? '+' : ''}${fmt(comp.saldo)}`;

  // Filas del resumen
  const resumenRows: RowInput[] = [
    ['Total compartido en Mina (100%)', fmt(comp.totalCompartido)],
    [`Teorico de ${empresaNombreLimpio} (${data.empresa.porcentaje}%)`, fmt(comp.teorico)],
    [`Aportado realmente por ${empresaNombreLimpio}`, fmt(comp.gastadoEmpresa)],
    [labelSaldo, saldoVal],
  ];

  autoTable(doc, {
    head: [['Concepto de Compensacion (Mina)', 'Monto']],
    body: resumenRows,
    startY: 32,
    styles: {
      fontSize: 10.5,
      cellPadding: 4.5,
      halign: 'right',
      textColor: DARK,
    },
    headStyles: {
      fillColor: DARK,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left',
    },
    columnStyles: {
      0: { halign: 'left', fontStyle: 'normal' },
      1: { halign: 'right', fontStyle: 'bold', cellWidth: 50 },
    },
    didParseCell: (d) => {
      // Estilo especial de alto contraste para la fila del Saldo Final
      if (d.section === 'body' && d.row.index === resumenRows.length - 1) {
        d.cell.styles.fontStyle = 'bold';
        d.cell.styles.fontSize = 11.5;
        if (esDebeCobrar) {
          d.cell.styles.fillColor = [230, 245, 235]; // Fondo verde suave
          d.cell.styles.textColor = [0, 100, 0];      // Texto verde oscuro
        } else if (esDebePagar) {
          d.cell.styles.fillColor = [253, 235, 235]; // Fondo rojo suave
          d.cell.styles.textColor = [160, 20, 20];    // Texto rojo oscuro
        } else {
          d.cell.styles.fillColor = [240, 240, 240]; // Fondo gris
          d.cell.styles.textColor = DARK;
        }
      }
    },
  });

  // ─── EXPLICACIÓN DEL CÁLCULO DE COMPENSACIÓN ───
  const boxY = (doc as any).lastAutoTable.finalY + 5;
  const boxHeight = 24;

  // Fondo y borde del recuadro
  doc.setFillColor(248, 249, 250);
  doc.setDrawColor(220, 224, 230);
  doc.roundedRect(margin, boxY, pageWidth - margin * 2, boxHeight, 2, 2, 'FD');

  // Título de la explicación
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...DARK);
  doc.text('Explicacion detallada del calculo:', margin + 6, boxY + 6);

  // Texto explicativo
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);

  const explicacionText = esDebeCobrar
    ? `${empresaNombreLimpio} aporto ${fmt(comp.gastadoEmpresa)} en efectivo, superando su cuota del ${data.empresa.porcentaje}% (${fmt(comp.teorico)}) del total compartido de Mina (${fmt(comp.totalCompartido)}). Le corresponde cobrar la diferencia.`
    : esDebePagar
      ? `${empresaNombreLimpio} aporto ${fmt(comp.gastadoEmpresa)} en efectivo, quedando por debajo de su cuota del ${data.empresa.porcentaje}% (${fmt(comp.teorico)}) del total compartido de Mina (${fmt(comp.totalCompartido)}). Debe pagar la diferencia.`
      : `${empresaNombreLimpio} aporto exactamente su cuota del ${data.empresa.porcentaje}% (${fmt(comp.teorico)}) del total compartido de Mina (${fmt(comp.totalCompartido)}).`;

  const formulaText = `Formula: Aportado Real (${fmt(comp.gastadoEmpresa)}) - Teorico (${fmt(comp.teorico)}) = Saldo de ${saldoVal}`;

  doc.text(explicacionText, margin + 6, boxY + 12, { maxWidth: pageWidth - margin * 2 - 12 });
  doc.setFont('helvetica', 'bold');
  doc.text(formulaText, margin + 6, boxY + 19);

  // ─── TABLA DE RESUMEN POR CATEGORÍA (Mina vs Molino) ───
  const porCat: Record<string, { total: number; pagado: number; count: number }> = {};
  for (const g of data.gastos) {
    if (!porCat[g.categoria]) porCat[g.categoria] = { total: 0, pagado: 0, count: 0 };
    porCat[g.categoria].total += g.montoTotal;
    porCat[g.categoria].pagado += g.montoPagado;
    porCat[g.categoria].count += 1;
  }

  const catRows: RowInput[] = Object.entries(porCat).map(([cat, v]) => [
    cat,
    String(v.count),
    fmt(v.total),
    fmt(v.pagado),
  ]);
  catRows.push(['TOTAL GENERAL', String(data.gastos.length), '—', fmt(data.totalGastado)]);

  const startYCat = boxY + boxHeight + 10;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...DARK);
  doc.text('Resumen de Gastos por Categoria', margin, startYCat - 3);

  autoTable(doc, {
    head: [['Categoria', 'Cant.', 'Monto Total', `Pagado por ${empresaNombreLimpio}`]],
    body: catRows,
    startY: startYCat,
    styles: {
      fontSize: 10,
      cellPadding: 4,
      halign: 'right',
      textColor: DARK,
    },
    headStyles: {
      fillColor: GOLD,
      textColor: BLACK,
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { halign: 'left', cellWidth: 70 },
      1: { halign: 'center', cellWidth: 20 },
      2: { halign: 'right', cellWidth: 40 },
      3: { halign: 'right', cellWidth: 50, fontStyle: 'bold' },
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

  // Franja superior dorada en p2
  doc.setFillColor(...GOLD);
  doc.rect(0, 0, pageWidth, 8, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...DARK);
  doc.text(`Desglose Detallado - ${empresaNombreLimpio}`, margin, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...MUTED);
  doc.text(`Todos los gastos donde se registro un pago de ${empresaNombreLimpio} en el periodo`, margin, 25);

  // Ordenar y agrupar por categoría
  const catOrden = Object.keys(porCat).sort((a, b) => a.localeCompare(b));
  type CellDef = string | { content: string; colSpan?: number; rowSpan?: number; styles?: Record<string, unknown> };
  const detalleRows: CellDef[][] = [];

  for (const cat of catOrden) {
    // Encabezado de categoría
    detalleRows.push([
      {
        content: cat.toUpperCase(),
        colSpan: 4,
        styles: {
          fontStyle: 'bold',
          fillColor: [50, 50, 50],
          textColor: GOLD,
          halign: 'left',
          fontSize: 9.5,
        },
      },
      '', '', '',
    ]);

    const itemsCat = data.gastos.filter((g) => g.categoria === cat);
    for (const g of itemsCat) {
      detalleRows.push([
        fmtDate(g.fecha),
        g.descripcion ?? 'Sin descripcion',
        fmt(g.montoTotal),
        fmt(g.montoPagado),
      ]);
    }

    // Subtotal por categoría
    const cat_ = porCat[cat];
    detalleRows.push([
      '',
      { content: `Subtotal ${cat}`, styles: { fontStyle: 'bold', halign: 'right' } },
      fmt(cat_.total),
      { content: fmt(cat_.pagado), styles: { fontStyle: 'bold' } },
    ]);
  }

  // Fila total general
  detalleRows.push([
    '',
    { content: 'TOTAL GENERAL', styles: { fontStyle: 'bold', halign: 'right', fillColor: GOLD, textColor: BLACK } },
    { content: '—', styles: { fillColor: GOLD, textColor: BLACK } },
    { content: fmt(data.totalGastado), styles: { fontStyle: 'bold', fillColor: GOLD, textColor: BLACK } },
  ]);

  autoTable(doc, {
    head: [['Fecha', 'Descripcion', 'Monto Total', `Pagado por ${empresaNombreLimpio}`]],
    body: detalleRows,
    startY: 30,
    styles: {
      fontSize: 9.5,
      cellPadding: 4,
      halign: 'right',
      textColor: DARK,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: GOLD,
      textColor: BLACK,
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 25 },
      1: { halign: 'left', cellWidth: 85 },
      2: { halign: 'right', cellWidth: 35 },
      3: { halign: 'right', cellWidth: 35, fontStyle: 'bold' },
    },
    alternateRowStyles: { fillColor: LIGHT_BG },
  });

  // ============ PIE DE PÁGINA (PAGINACIÓN) ============
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Generado el ${new Date().toLocaleString('es-ES')} - Pagina ${i} de ${pageCount} - Informe ${empresaNombreLimpio}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'center' },
    );
  }

  const nombreArchivo = empresaNombreLimpio.toLowerCase().replace(/\s+/g, '_');
  doc.save(`informe_${nombreArchivo}_${data.mes}.pdf`);
}

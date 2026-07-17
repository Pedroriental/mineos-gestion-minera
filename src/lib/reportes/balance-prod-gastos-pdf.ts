'use client';

import jsPDF from 'jspdf';
import autoTable, { type RowInput } from 'jspdf-autotable';
import type { BalanceProdGastosResumen } from '@/lib/actions/compensacion-gastos';

function fmt(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(n);
}

function fmtNum(n: number, decimals = 2): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
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

export function generarPdfBalanceProdGastos(data: BalanceProdGastosResumen): void {
  // Usar formato Portrait (vertical) A4 para máxima legibilidad
  const doc = new jsPDF({ orientation: 'portrait', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;

  const empresaNombreLimpio = data.empresa.nombre.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // ============ PÁGINA 1: ENCABEZADO + RESUMEN DEL BALANCE ============

  // Franja superior dorada
  doc.setFillColor(...GOLD);
  doc.rect(0, 0, pageWidth, 8, 'F');

  // Título principal
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...DARK);
  doc.text(`Balance Prod. vs Gastos - ${empresaNombreLimpio}`, margin, 20);

  // Subtítulo con período
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  const periodo = `${fmtDate(data.desde)} a ${fmtDate(data.hasta)}`;
  doc.text(`Periodo: ${periodo} | Precio Oro Ref: ${fmt(data.precioOro)}/g`, margin, 26);

  // Participación en la esquina superior derecha
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...DARK);
  const partTxt = `Participacion: ${data.empresa.porcentaje}%`;
  doc.text(partTxt, pageWidth - margin, 20, { align: 'right' });

  // ─── TABLA RESUMEN DE COMPARACIÓN DE BALANCE ───
  const prod = data.produccion;
  const gastos = data.gastos;

  const balanceAjustado = data.balanceNetoAjustado;
  const esGanancia = balanceAjustado >= 0;

  const labelBalance = esGanancia
    ? 'BALANCE NETO AJUSTADO (Ganancia)'
    : 'BALANCE NETO AJUSTADO (Perdida)';

  const balanceVal = `${esGanancia ? '+' : ''}${fmt(balanceAjustado)}`;

  const resumenRows: RowInput[] = [
    ['Oro Gran Total Producido (Planta)', `${fmtNum(prod.oroGranTotal, 4)} g`],
    ['Valor Estimado del Oro Producido (100%)', fmt(prod.valorOroGranTotal)],
    [`Cuota de Oro de ${empresaNombreLimpio} (${data.empresa.porcentaje}%)`, fmt(prod.valorOroEmpresa)],
    [`Gastos Reales de ${empresaNombreLimpio} (Desembolsado)`, fmt(gastos.totalGastado)],
    [`Ajuste por Compensacion (Mina)`, `${gastos.compensacion.saldo >= 0 ? '+' : ''}${fmt(gastos.compensacion.saldo)}`],
    [`Gastos Netos Ajustados de ${empresaNombreLimpio}`, fmt(gastos.totalGastado - gastos.compensacion.saldo)],
    [labelBalance, balanceVal],
  ];

  autoTable(doc, {
    head: [['Concepto del Balance Comparativo', 'Valor']],
    body: resumenRows,
    startY: 32,
    styles: {
      fontSize: 10,
      cellPadding: 4,
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
      // Destacar la fila del Balance Final
      if (d.section === 'body' && d.row.index === resumenRows.length - 1) {
        d.cell.styles.fontStyle = 'bold';
        d.cell.styles.fontSize = 11;
        if (esGanancia) {
          d.cell.styles.fillColor = [230, 245, 235]; // Verde suave
          d.cell.styles.textColor = [0, 100, 0];      // Verde oscuro
        } else {
          d.cell.styles.fillColor = [253, 235, 235]; // Rojo suave
          d.cell.styles.textColor = [160, 20, 20];    // Rojo oscuro
        }
      }
    },
  });

  // ─── TABLA RESUMEN DE PRODUCCIÓN POR ORIGEN ───
  const startYProd = (doc as any).lastAutoTable.finalY + 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...DARK);
  doc.text('Resumen de Recuperacion de Oro por Origen', margin, startYProd - 3);

  const prodRows: RowInput[] = prod.origenResumen.map((o) => [
    o.origen,
    String(o.totalSacos),
    `${fmtNum(o.totalTon, 3)} T`,
    `${fmtNum(o.tenor, 4)} g/T`,
    `${fmtNum(o.totalOro, 4)} g`,
    fmt(o.totalOro * data.precioOro),
    `${fmtNum(o.pctTotal, 1)}%`,
  ]);

  if (prod.oroQuemadoPlanchas > 0) {
    prodRows.push([
      'Quemado Planchas (Oro Fino)',
      '—',
      '—',
      '—',
      `${fmtNum(prod.oroQuemadoPlanchas, 4)} g`,
      fmt(prod.oroQuemadoPlanchas * data.precioOro),
      `${fmtNum((prod.oroQuemadoPlanchas / prod.oroGranTotal) * 100, 1)}%`,
    ]);
  }

  prodRows.push([
    'TOTAL PRODUCIDO',
    String(prod.sacosTotales),
    `${fmtNum(prod.toneladas, 3)} T`,
    `${fmtNum(prod.tenorGlobal, 4)} g/T`,
    `${fmtNum(prod.oroGranTotal, 4)} g`,
    fmt(prod.valorOroGranTotal),
    '100%',
  ]);

  autoTable(doc, {
    head: [['Origen', 'Sacos', 'Tons.', 'Tenor', 'Au Recup.', 'Valor USD', '% Au']],
    body: prodRows,
    startY: startYProd,
    styles: {
      fontSize: 8.5,
      cellPadding: 3.5,
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
      0: { halign: 'left', cellWidth: 50 },
      1: { halign: 'center', cellWidth: 15 },
      2: { halign: 'center', cellWidth: 20 },
      3: { halign: 'center', cellWidth: 20 },
      4: { halign: 'right', cellWidth: 25 },
      5: { halign: 'right', cellWidth: 32, fontStyle: 'bold' },
      6: { halign: 'center', cellWidth: 18 },
    },
    didParseCell: (d) => {
      if (d.section === 'body' && d.row.index === prodRows.length - 1) {
        d.cell.styles.fontStyle = 'bold';
        d.cell.styles.fillColor = GOLD;
        d.cell.styles.textColor = BLACK;
      }
    },
    alternateRowStyles: { fillColor: LIGHT_BG },
  });

  // ============ PÁGINA 2: DETALLE DIARIO DE PRODUCCIÓN ============
  doc.addPage();

  doc.setFillColor(...GOLD);
  doc.rect(0, 0, pageWidth, 8, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...DARK);
  doc.text('Detalle Diario de Produccion', margin, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...MUTED);
  doc.text(`Listado detallado de turnos de procesamiento en el periodo`, margin, 25);

  const diarioRows: RowInput[] = prod.registros.map((r) => {
    const oro = Number(r.oro_recuperado_g) || 0;
    return [
      fmtDate(r.fecha),
      r.turno === 'dia' ? 'Dia' : r.turno === 'noche' ? 'Noche' : 'Completo',
      r.molino || '—',
      r.material || '—',
      String(r.sacos ?? 0),
      `${fmtNum(r.toneladas_procesadas ?? 0, 3)} T`,
      `${fmtNum(oro, 2)} g`,
      fmt(oro * data.precioOro),
    ];
  });

  diarioRows.push([
    'TOTALES',
    '',
    '',
    '',
    String(prod.sacosTotales),
    `${fmtNum(prod.toneladas, 3)} T`,
    `${fmtNum(prod.totalOroRecuperado, 2)} g`,
    fmt(prod.totalOroRecuperado * data.precioOro),
  ]);

  autoTable(doc, {
    head: [['Fecha', 'Turno', 'Molino', 'Material', 'Sacos', 'Tons.', 'Au Rec.', 'Valor USD']],
    body: diarioRows,
    startY: 30,
    styles: {
      fontSize: 9,
      cellPadding: 3.5,
      halign: 'center',
      textColor: DARK,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: DARK,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 18 },
      2: { cellWidth: 18 },
      3: { halign: 'left', cellWidth: 42 },
      4: { cellWidth: 15 },
      5: { cellWidth: 20 },
      6: { halign: 'right', cellWidth: 22 },
      7: { halign: 'right', cellWidth: 25, fontStyle: 'bold' },
    },
    didParseCell: (d) => {
      if (d.section === 'body' && d.row.index === diarioRows.length - 1) {
        d.cell.styles.fontStyle = 'bold';
        d.cell.styles.fillColor = GOLD;
        d.cell.styles.textColor = BLACK;
      }
    },
    alternateRowStyles: { fillColor: LIGHT_BG },
  });

  // ============ PÁGINA 3: DESGLOSE DETALLADO DE GASTOS DE LA EMPRESA ============
  doc.addPage();

  doc.setFillColor(...GOLD);
  doc.rect(0, 0, pageWidth, 8, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...DARK);
  doc.text(`Detalle de Gastos - ${empresaNombreLimpio}`, margin, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...MUTED);
  doc.text(`Todos los gastos registrados donde ${empresaNombreLimpio} realizo un pago en el periodo`, margin, 25);

  const gastosRows: RowInput[] = gastos.gastos.map((g) => [
    fmtDate(g.fecha),
    g.categoria,
    g.descripcion ?? 'Sin descripcion',
    fmt(g.montoTotal),
    fmt(g.montoPagado),
  ]);

  gastosRows.push([
    'TOTAL PAGADO EN EFECTIVO',
    '',
    '',
    '—',
    fmt(gastos.totalGastado),
  ]);

  autoTable(doc, {
    head: [['Fecha', 'Categoria', 'Descripcion', 'Monto Total', 'Pagado por Empresa']],
    body: gastosRows,
    startY: 30,
    styles: {
      fontSize: 9,
      cellPadding: 3.5,
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
      1: { halign: 'left', cellWidth: 35 },
      2: { halign: 'left', cellWidth: 65 },
      3: { halign: 'right', cellWidth: 25 },
      4: { halign: 'right', cellWidth: 30, fontStyle: 'bold' },
    },
    didParseCell: (d) => {
      if (d.section === 'body' && d.row.index === gastosRows.length - 1) {
        d.cell.styles.fontStyle = 'bold';
        d.cell.styles.fillColor = GOLD;
        d.cell.styles.textColor = BLACK;
      }
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
      `Generado el ${new Date().toLocaleString('es-ES')} - Pagina ${i} de ${pageCount} - Balance ${empresaNombreLimpio}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'center' },
    );
  }

  const nombreArchivo = empresaNombreLimpio.toLowerCase().replace(/\s+/g, '_');
  doc.save(`balance_prod_gastos_${nombreArchivo}_${data.mes}.pdf`);
}

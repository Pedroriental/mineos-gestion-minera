// ============================================================
// MineOS - Generador de PDF para Liquidación de Despidos
// jsPDF + autoTable. Misma estructura visual que la versión HTML.
// ============================================================

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { DistribucionLinea } from '@/lib/nomina-distribucion';

export type LiquidacionExportRow = {
  personal: {
    nombre_completo: string;
    cedula: string;
    cargo: string;
    area_detalle?: string | null;
  };
  salarioBase: number;
  porDia: number;
  diasTrabajados: number;
  totalDias: number;
  cobraSemanaLibre: boolean;
  semanaLibreMonto: number;
  bonificaciones: number;
  totalACobrar: number;
  despidoFecha: string;
  despidoCausa?: string | null;
};

export type LiquidacionExportMeta = {
  area: string;
  areaLabel: string;
  fechaGeneracion: string;
  fechaLiquidacion: string;
  workerCount: number;
  totalGeneral: number;
  totalDias: number;
  totalLibres: number;
  totalBonificaciones: number;
};

const LOCALE = 'es-VE';
const CURRENCY = 'USD';

const fmtUsd = (n: number) =>
  new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: CURRENCY,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

const PAGE_MARGIN_MM = 12;
const HEADER_BG: [number, number, number] = [232, 238, 245];
const ROW_ALT: [number, number, number] = [250, 251, 252];
const TOTAL_BG: [number, number, number] = [255, 248, 225];
const TEXT_BORDER: [number, number, number] = [221, 227, 234];
const TEXT_DARK: [number, number, number] = [146, 64, 14];

let cachedLogoPng: string | null = null;
let logoFetchPromise: Promise<string | null> | null = null;

async function getLogoPngBase64(): Promise<string | null> {
  if (cachedLogoPng !== null) return cachedLogoPng || null;
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;
  if (logoFetchPromise) return logoFetchPromise;
  logoFetchPromise = (async () => {
    try {
      const svgUrl = '/brand/mineos-logotipo-light.svg';
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = svgUrl;
      await Promise.race([
        new Promise<void>((resolve, reject) => {
          if (img.complete && img.naturalWidth > 0) resolve();
          else {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error('Logo load failed'));
          }
        }),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('Logo load timeout')), 1200),
        ),
      ]);
      const scale = 3;
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, (img.naturalWidth || 100) * scale);
      canvas.height = Math.max(1, (img.naturalHeight || 30) * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        cachedLogoPng = '';
        return null;
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      cachedLogoPng = canvas.toDataURL('image/png');
      return cachedLogoPng;
    } catch {
      cachedLogoPng = '';
      return null;
    }
  })();
  return logoFetchPromise;
}

function addHeader(doc: jsPDF, meta: LiquidacionExportMeta) {
  const pW = doc.internal.pageSize.getWidth();

  doc.setFillColor(212, 175, 55);
  doc.rect(0, 0, pW, 4, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(212, 175, 55);
  doc.text('MOLINOS LA FÉ — MINA BELÉN', PAGE_MARGIN_MM, 18);

  doc.setFontSize(13);
  doc.setTextColor(...TEXT_DARK);
  doc.text(`Liquidación de Personal Retirado · ${meta.areaLabel}`, PAGE_MARGIN_MM, 26);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(
    `Fecha de liquidación: ${meta.fechaLiquidacion}    Trabajadores: ${meta.workerCount}    Generado: ${meta.fechaGeneracion}`,
    PAGE_MARGIN_MM,
    32,
  );
}

function addSummaryBoxes(
  doc: jsPDF,
  meta: LiquidacionExportMeta,
  startY: number,
): number {
  const pW = doc.internal.pageSize.getWidth();
  const items: Array<{ label: string; value: string }> = [
    { label: 'Total a Pagar', value: fmtUsd(meta.totalGeneral) },
    { label: 'Total / Días Trabajados', value: fmtUsd(meta.totalDias) },
    { label: 'Total Sem. Libres', value: fmtUsd(meta.totalLibres) },
    { label: 'Total Bonificaciones', value: fmtUsd(meta.totalBonificaciones) },
  ];

  const gap = 4;
  const boxW = (pW - 2 * PAGE_MARGIN_MM - gap * (items.length - 1)) / items.length;
  const boxH = 16;

  items.forEach((it, i) => {
    const x = PAGE_MARGIN_MM + i * (boxW + gap);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.rect(x, startY, boxW, boxH, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(110, 130, 150);
    doc.text(it.label.toUpperCase(), x + 3, startY + 5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...TEXT_DARK);
    doc.text(it.value, x + 3, startY + 12);
  });

  return startY + boxH + 4;
}

function buildDoc(rows: LiquidacionExportRow[], meta: LiquidacionExportMeta): jsPDF {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  addHeader(doc, meta);

  let cursor = addSummaryBoxes(doc, meta, 36);

  const head: string[] = [
    '#',
    'Nombre y Apellido',
    'Cédula',
    'Cargo',
    '$/Sem',
    '$/día',
    'Días Trab.',
    'Total /DT',
    'Sem. Libre',
    'Bono',
    'Total a Cobrar',
  ];

  const body = rows.map((r, i) => [
    i + 1,
    r.personal.nombre_completo,
    r.personal.cedula,
    r.personal.cargo || '—',
    fmtUsd(r.salarioBase),
    fmtUsd(r.porDia),
    r.diasTrabajados,
    fmtUsd(r.totalDias),
    r.cobraSemanaLibre ? fmtUsd(r.semanaLibreMonto) : '—',
    fmtUsd(r.bonificaciones),
    fmtUsd(r.totalACobrar),
  ]);

  // Fila total
  body.push([
    '·',
    'TOTAL',
    '',
    '',
    '',
    '',
    '',
    fmtUsd(meta.totalDias),
    fmtUsd(meta.totalLibres),
    fmtUsd(meta.totalBonificaciones),
    fmtUsd(meta.totalGeneral),
  ]);

  autoTable(doc, {
    startY: cursor,
    head: [head],
    body,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2.5,
      lineColor: TEXT_BORDER,
      lineWidth: 0.1,
      textColor: [17, 17, 17],
    },
    headStyles: {
      fillColor: HEADER_BG,
      textColor: [60, 60, 60],
      fontStyle: 'bold',
      lineColor: [184, 196, 212],
      lineWidth: 0.3,
      halign: 'center',
    },
    alternateRowStyles: { fillColor: ROW_ALT },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { halign: 'left' },
      2: { halign: 'center', cellWidth: 28 },
      3: { halign: 'left' },
      4: { halign: 'right', cellWidth: 22 },
      5: { halign: 'right', cellWidth: 20 },
      6: { halign: 'center', cellWidth: 18 },
      7: { halign: 'right', cellWidth: 22 },
      8: { halign: 'right', cellWidth: 22 },
      9: { halign: 'right', cellWidth: 20 },
      10: { halign: 'right', cellWidth: 28 },
    },
    didParseCell: (cellData) => {
      if (cellData.section === 'body' && cellData.row.index === body.length - 1) {
        cellData.cell.styles.fillColor = TOTAL_BG;
        cellData.cell.styles.fontStyle = 'bold';
        cellData.cell.styles.textColor = TEXT_DARK;
      }
    },
    margin: { left: PAGE_MARGIN_MM, right: PAGE_MARGIN_MM },
  });

  return doc;
}

function addDistribucionSection(
  doc: jsPDF,
  distribucion: DistribucionLinea[],
  startY: number,
): number {
  if (!distribucion.length) return startY;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(40, 40, 40);
  doc.text('Distribución de pagos', PAGE_MARGIN_MM, startY + 4);

  const head: string[] = ['Beneficiario', '%', 'Bruto', 'Pagos directos', 'Neto'];
  const body = distribucion.map((d) => [
    d.nombre,
    `${Number(d.porcentaje).toFixed(2)}%`,
    fmtUsd(Number(d.bruto) || 0),
    fmtUsd(Number(d.pagoDirecto) || 0),
    fmtUsd(Number(d.neto) || 0),
  ]);

  autoTable(doc, {
    startY: startY + 8,
    head: [head],
    body,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2.5,
      lineColor: TEXT_BORDER,
      lineWidth: 0.1,
      textColor: [17, 17, 17],
    },
    headStyles: {
      fillColor: HEADER_BG,
      textColor: [60, 60, 60],
      fontStyle: 'bold',
      lineColor: [184, 196, 212],
      lineWidth: 0.3,
    },
    alternateRowStyles: { fillColor: ROW_ALT },
    columnStyles: {
      0: { halign: 'left' },
      1: { halign: 'right', cellWidth: 18 },
      2: { halign: 'right', cellWidth: 30 },
      3: { halign: 'right', cellWidth: 30 },
      4: { halign: 'right', cellWidth: 30 },
    },
    margin: { left: PAGE_MARGIN_MM, right: PAGE_MARGIN_MM },
  });

  // @ts-expect-error lastAutoTable existe en runtime
  const finalY: number = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? startY + 30;

  // Firmas
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(40, 40, 40);
  const sigY = finalY + 14;
  const pW = doc.internal.pageSize.getWidth();
  const usable = pW - 2 * PAGE_MARGIN_MM;
  const boxW = usable / distribucion.length;
  distribucion.forEach((d, i) => {
    const x = PAGE_MARGIN_MM + i * boxW;
    doc.setDrawColor(60, 60, 60);
    doc.line(x + 8, sigY, x + boxW - 8, sigY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(String(d.nombre).toUpperCase(), x + boxW / 2, sigY + 5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Beneficiario', x + boxW / 2, sigY + 10, { align: 'center' });
  });

  return sigY + 16;
}

function addFooter(doc: jsPDF) {
  const pH = doc.internal.pageSize.getHeight();
  const pW = doc.internal.pageSize.getWidth();
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(140, 140, 140);
    doc.text(
      'Generado por MineOS · Sistema de Gestión Minera de Alta Precisión',
      PAGE_MARGIN_MM,
      pH - 6,
    );
    doc.text(
      `Página ${i} de ${total}`,
      pW - PAGE_MARGIN_MM,
      pH - 6,
      { align: 'right' },
    );
  }
}

function defaultFileName(meta: LiquidacionExportMeta): string {
  const slug = meta.area.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `liquidacion-${slug || 'area'}-${meta.fechaLiquidacion}.pdf`;
}

export async function buildLiquidacionPdfBlob(
  rows: LiquidacionExportRow[],
  meta: LiquidacionExportMeta,
  distribucion: DistribucionLinea[] = [],
): Promise<Blob> {
  const doc = buildDoc(rows, meta);

  // @ts-expect-error lastAutoTable existe en runtime
  const afterTabla: number = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? 50;
  addDistribucionSection(doc, distribucion, afterTabla);

  addFooter(doc);

  // Logo en cada página
  const logoPng = await getLogoPngBase64();
  if (logoPng) {
    const pW = doc.internal.pageSize.getWidth();
    for (let i = 1; i <= doc.getNumberOfPages(); i++) {
      doc.setPage(i);
      try {
        doc.addImage(logoPng, 'PNG', pW - PAGE_MARGIN_MM - 35, 8, 35, 12, undefined, 'FAST');
      } catch {
        // ignore
      }
    }
  }

  const arrayBuffer = doc.output('arraybuffer');
  return new Blob([arrayBuffer], { type: 'application/pdf' });
}

export async function downloadLiquidacionPdf(
  rows: LiquidacionExportRow[],
  meta: LiquidacionExportMeta,
  distribucion: DistribucionLinea[] = [],
  fileName?: string,
): Promise<void> {
  if (typeof window === 'undefined') return;
  const blob = await buildLiquidacionPdfBlob(rows, meta, distribucion);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName ?? defaultFileName(meta);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function previewLiquidacionPdf(
  rows: LiquidacionExportRow[],
  meta: LiquidacionExportMeta,
  distribucion: DistribucionLinea[] = [],
): Promise<{ blob: Blob; url: string }> {
  if (typeof window === 'undefined') {
    throw new Error('previewLiquidacionPdf requiere window');
  }
  const blob = await buildLiquidacionPdfBlob(rows, meta, distribucion);
  const url = URL.createObjectURL(blob);
  return { blob, url };
}

export type ShareOutcome = 'shared' | 'cancelled' | 'unsupported' | 'failed';

export function canSharePdf(): boolean {
  if (typeof navigator === 'undefined') return false;
  if (typeof navigator.canShare !== 'function') return false;
  try {
    const dummy = new File([new Blob(['x'])], 'x.pdf', { type: 'application/pdf' });
    return navigator.canShare({ files: [dummy] });
  } catch {
    return false;
  }
}

export async function shareLiquidacionPdf(
  rows: LiquidacionExportRow[],
  meta: LiquidacionExportMeta,
  distribucion: DistribucionLinea[] = [],
  fileName?: string,
): Promise<ShareOutcome> {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    return 'unsupported';
  }
  try {
    const blob = await buildLiquidacionPdfBlob(rows, meta, distribucion);
    const name = fileName ?? defaultFileName(meta);
    const file = new File([blob], name, { type: 'application/pdf' });
    if (typeof navigator.canShare === 'function' && !navigator.canShare({ files: [file] })) {
      return 'unsupported';
    }
    await navigator.share({
      files: [file],
      title: `Liquidación ${meta.areaLabel} ${meta.fechaLiquidacion}`,
    });
    return 'shared';
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return 'cancelled';
    return 'failed';
  }
}

export { defaultFileName as defaultLiquidacionPdfFileName };

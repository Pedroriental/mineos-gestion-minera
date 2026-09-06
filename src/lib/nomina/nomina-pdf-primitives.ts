// ============================================================
// MineOS - Primitivas compartidas para PDFs de nómina
// Header, meta band, sección con tabla, totales, footer, es-VE,
// logo MineOS rasterizado. Usado por nomina-plantilla-pdf y
// trabajadores-listado-pdf para garantizar el mismo diseño visual.
// ============================================================

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export const NOMINA_PDF_LOCALE = 'es-VE';
export const NOMINA_PDF_CURRENCY = 'USD';

export const PAGE_MARGIN_MM = 12;
export const PAGE_FORMAT: 'a4' = 'a4';
export const PAGE_ORIENTATION: 'landscape' = 'landscape';
/** Si la posición vertical supera este valor, se inserta un salto de página. */
export const PAGE_BREAK_Y_MM = 170;
export const PAGE_BREAK_TOTAL_Y_MM = 175;

export const COLORS = {
  primary: '#d4af37',
  primaryRgb: [212, 175, 55] as [number, number, number],
  accentBg: '#fff8e1',
  accentText: '#92400e',
  accentTextRgb: [146, 64, 14] as [number, number, number],
  headerBg: '#e8eef5',
  headerBgRgb: [232, 238, 245] as [number, number, number],
  rowAltBg: '#fafbfc',
  rowAltRgb: [250, 251, 252] as [number, number, number],
  border: '#b8c4d4',
  borderRgb: [184, 196, 212] as [number, number, number],
  borderLight: '#dde3ea',
  borderLightRgb: [221, 227, 234] as [number, number, number],
  text: '#111',
  textRgb: [17, 17, 17] as [number, number, number],
  textMuted: '#525252',
  textMutedRgb: [82, 82, 82] as [number, number, number],
  textSubtle: '#6e6e6e',
  textSubtleRgb: [110, 110, 110] as [number, number, number],
  bandBg: '#f8fafc',
  bandBgRgb: [248, 250, 252] as [number, number, number],
  bandBorder: '#cbd5e1',
  bandBorderRgb: [203, 213, 225] as [number, number, number],
  subtotal: [255, 248, 225] as [number, number, number],
  footerText: '#8c8c8c',
  footerTextRgb: [140, 140, 140] as [number, number, number],
};

export const fmtMoney = (n: number) =>
  new Intl.NumberFormat(NOMINA_PDF_LOCALE, {
    style: 'currency',
    currency: NOMINA_PDF_CURRENCY,
  }).format(Number.isFinite(n) ? n : 0);

export const fmtDate = (iso: string) => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

export const fmtDateTime = (date: Date) =>
  new Intl.DateTimeFormat(NOMINA_PDF_LOCALE, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);

export const capitalize = (s: string) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

// ── Logo rasterizado con cache a nivel de módulo ─────────────────────

let cachedLogoPng: string | null = null;
let logoFetchPromise: Promise<string | null> | null = null;

export async function getLogoPngBase64(): Promise<string | null> {
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

/** Limpia la cache del logo. Útil en tests o al cambiar el SVG. */
export function clearLogoCache(): void {
  cachedLogoPng = null;
  logoFetchPromise = null;
}

// ── Primitivas visuales ─────────────────────────────────────────────

export type PdfDoc = jsPDF;

export type MetaItem = { label: string; value: string };

export type ColumnStyle = {
  halign?: 'left' | 'right' | 'center';
  cellWidth?: number;
};

export type SectionSpec = {
  titulo: string;
  subtitulo?: string;
  headers: string[];
  body: (string | number)[][];
  subtotalRow?: (string | number)[];
  columnStyles?: Record<number, ColumnStyle>;
  /** Filas resaltadas como subtotal en otra posición (1-based). Por defecto es la última. */
  subtotalRowIndex?: number;
};

export type AddSectionOpts = { startY?: number };

/**
 * Header: banda dorada superior + título + subtítulo.
 * El logo se agrega al final (applyLogoToAllPages) para que aparezca
 * en cada página del PDF.
 */
export function addHeader(
  doc: PdfDoc,
  opts: { titulo: string; subtitulo?: string; subtituloSecundario?: string },
): void {
  const pW = doc.internal.pageSize.getWidth();

  // Banda superior decorativa
  doc.setFillColor(...COLORS.primaryRgb);
  doc.rect(0, 0, pW, 4, 'F');

  // Título principal
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.primaryRgb);
  doc.text(opts.titulo, PAGE_MARGIN_MM, 18);

  if (opts.subtitulo) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...COLORS.accentTextRgb);
    doc.text(opts.subtitulo, PAGE_MARGIN_MM, 26);
  }

  if (opts.subtituloSecundario) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.textMutedRgb);
    doc.text(opts.subtituloSecundario, PAGE_MARGIN_MM, 32);
  }
}

/**
 * Banda de metadatos: rectángulo con 4-5 campos label/value.
 * Retorna la posición Y final (debajo de la banda).
 */
export function addMetaBand(
  doc: PdfDoc,
  items: MetaItem[],
  opts?: { y?: number; bandH?: number },
): number {
  const pW = doc.internal.pageSize.getWidth();
  const startY = opts?.y ?? 38;
  const bandH = opts?.bandH ?? 16;

  doc.setFillColor(...COLORS.bandBgRgb);
  doc.setDrawColor(...COLORS.bandBorderRgb);
  doc.rect(PAGE_MARGIN_MM, startY, pW - 2 * PAGE_MARGIN_MM, bandH, 'FD');

  doc.setFontSize(8);
  doc.setTextColor(...COLORS.textMutedRgb);

  const itemY = startY + 6;
  const valueY = startY + 11;

  const colW = (pW - 2 * PAGE_MARGIN_MM) / Math.max(items.length, 1);
  items.forEach((item, i) => {
    const x = PAGE_MARGIN_MM + colW * i + 3;
    doc.setFont('helvetica', 'bold');
    doc.text(item.label.toUpperCase(), x, itemY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.accentTextRgb);
    doc.text(item.value, x, valueY);
    doc.setTextColor(...COLORS.textMutedRgb);
  });

  return startY + bandH + 4;
}

/**
 * Sección con subtítulo + tabla autoTable. Soporta fila subtotal
 * resaltada. Retorna la posición Y final (debajo de la tabla).
 */
export function addSection(
  doc: PdfDoc,
  spec: SectionSpec,
  opts?: AddSectionOpts,
): number {
  const startY = opts?.startY ?? 60;

  // Subtítulo
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.accentTextRgb);
  doc.text(spec.titulo, PAGE_MARGIN_MM, startY + 4);

  if (spec.subtitulo) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.textSubtleRgb);
    doc.text(spec.subtitulo, PAGE_MARGIN_MM, startY + 9);
  }

  // Cuerpo: si hay subtotal, lo agregamos al final
  const body = spec.subtotalRow
    ? [...spec.body, spec.subtotalRow]
    : spec.body;
  const subtotalRowIndex = spec.subtotalRowIndex
    ?? (spec.subtotalRow ? spec.body.length : -1);

  autoTable(doc, {
    startY: startY + 14,
    head: [spec.headers],
    body,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: 2,
      lineColor: COLORS.borderLightRgb,
      lineWidth: 0.1,
      textColor: COLORS.textRgb,
    },
    headStyles: {
      fillColor: COLORS.headerBgRgb,
      textColor: COLORS.textMutedRgb,
      fontStyle: 'bold',
      lineColor: COLORS.borderRgb,
      lineWidth: 0.3,
      halign: 'center',
    },
    alternateRowStyles: {
      fillColor: COLORS.rowAltRgb,
    },
    columnStyles: spec.columnStyles,
    didParseCell: (cellData) => {
      if (
        subtotalRowIndex >= 0 &&
        cellData.section === 'body' &&
        cellData.row.index === subtotalRowIndex
      ) {
        cellData.cell.styles.fillColor = COLORS.subtotal;
        cellData.cell.styles.fontStyle = 'bold';
        cellData.cell.styles.textColor = COLORS.accentTextRgb;
      }
    },
    margin: { left: PAGE_MARGIN_MM, right: PAGE_MARGIN_MM },
  });

  // lastAutoTable existe en runtime aunque la tipización oficial no lo expone
  const finalY = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ??
    startY + 50) as number;
  return finalY + 6;
}

/**
 * Banda de total general al final del documento.
 * Retorna la posición Y final (debajo de la banda).
 */
export function addTotalGeneral(
  doc: PdfDoc,
  total: number,
  label: string,
  opts?: { startY?: number; bandH?: number; valueOverride?: string },
): number {
  const pW = doc.internal.pageSize.getWidth();
  const startY = opts?.startY ?? 100;
  const bandH = opts?.bandH ?? 12;

  doc.setFillColor(...COLORS.subtotal);
  doc.setDrawColor(...COLORS.bandBorderRgb);
  doc.rect(PAGE_MARGIN_MM, startY, pW - 2 * PAGE_MARGIN_MM, bandH, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.accentTextRgb);
  doc.text(label, PAGE_MARGIN_MM + 4, startY + 7.5);

  doc.setFontSize(12);
  doc.text(
    opts?.valueOverride ?? fmtMoney(total),
    pW - PAGE_MARGIN_MM - 4,
    startY + 7.5,
    { align: 'right' },
  );

  return startY + bandH + 6;
}

/**
 * Footer con número de página y tagline. Lo agrega a TODAS las páginas.
 */
export function addFooter(doc: PdfDoc): void {
  const pH = doc.internal.pageSize.getHeight();
  const pW = doc.internal.pageSize.getWidth();
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.footerTextRgb);
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

/**
 * Agrega el logo PNG en la esquina superior derecha de cada página.
 * Llamar después de haber generado todo el contenido.
 */
export async function applyLogoToAllPages(doc: PdfDoc): Promise<void> {
  const logoPng = await getLogoPngBase64();
  if (!logoPng) return;
  const pW = doc.internal.pageSize.getWidth();
  for (let i = 1; i <= doc.getNumberOfPages(); i++) {
    doc.setPage(i);
    try {
      doc.addImage(logoPng, 'PNG', pW - PAGE_MARGIN_MM - 35, 8, 35, 12, undefined, 'FAST');
    } catch {
      // ignore: si el formato no es soportado, no agregamos logo
    }
  }
}

// ── Compartir (Web Share API) ───────────────────────────────────────

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

/**
 * Helper genérico para descargar un Blob PDF como archivo.
 */
export function triggerPdfDownload(blob: Blob, fileName: string): void {
  if (typeof window === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Helper genérico para compartir un Blob PDF vía Web Share API.
 */
export async function sharePdfBlob(
  blob: Blob,
  fileName: string,
  title: string,
): Promise<ShareOutcome> {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    return 'unsupported';
  }
  try {
    const file = new File([blob], fileName, { type: 'application/pdf' });
    if (typeof navigator.canShare === 'function' && !navigator.canShare({ files: [file] })) {
      return 'unsupported';
    }
    await navigator.share({ files: [file], title });
    return 'shared';
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return 'cancelled';
    return 'failed';
  }
}

/**
 * Helper: convierte un arrayBuffer a Blob PDF.
 */
export function arrayBufferToPdfBlob(buffer: ArrayBuffer | Uint8Array): Blob {
  const u8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  // u8.slice() devuelve ArrayBuffer puro, que es lo que BlobPart espera en TS5+
  return new Blob([u8.slice().buffer], { type: 'application/pdf' });
}

// ============================================================
// MineOS - Generador de PDF de plantilla
// Usa jsPDF + autoTable para producir un Blob PDF descargable
// con layout ajustado a la estructura de cuadrillas + rotación.
// ============================================================

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { PlantillaPdfData, PlantillaPdfRow } from '@/lib/rotacion-plantillas/plantilla-pdf-data';
import { labelColumnaVista } from '@/lib/rotacion-plantillas/columnas-vista';

const LOCALE = 'es-VE';
const CURRENCY = 'USD';

const COLORS = {
  primary: '#d4af37',
  primaryRgb: [212, 175, 55] as [number, number, number],
  accentBg: '#fff8e1',
  accentText: '#92400e',
  headerBg: '#e8eef5',
  rowAltBg: '#fafbfc',
  border: '#b8c4d4',
  borderLight: '#dde3ea',
  text: '#111',
  subtotal: [255, 248, 225] as [number, number, number],
};

const fmtMoney = (n: number) =>
  new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: CURRENCY,
  }).format(n);

const fmtDate = (iso: string) => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

const fmtDateTime = (date: Date) =>
  new Intl.DateTimeFormat(LOCALE, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);

const PAGE_MARGIN_MM = 12;
const PAGE_FORMAT: 'a4' = 'a4';
const PAGE_ORIENTATION: 'landscape' = 'landscape';

let cachedLogoPng: string | null = null;
let logoFetchPromise: Promise<string | null> | null = null;

async function getLogoPngBase64(): Promise<string | null> {
  if (cachedLogoPng !== null) return cachedLogoPng;
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;
  if (logoFetchPromise) return logoFetchPromise;

  logoFetchPromise = (async () => {
    try {
      const svgUrl = '/brand/mineos-logotipo-light.svg';
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = svgUrl;
      await new Promise<void>((resolve, reject) => {
        if (img.complete) resolve();
        else {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Logo load failed'));
        }
      });
      const scale = 3;
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, img.naturalWidth * scale);
      canvas.height = Math.max(1, img.naturalHeight * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      cachedLogoPng = canvas.toDataURL('image/png');
      return cachedLogoPng;
    } catch {
      return null;
    }
  })();

  return logoFetchPromise;
}

type PdfDoc = jsPDF;

function addHeader(doc: PdfDoc, data: PlantillaPdfData) {
  const pW = doc.internal.pageSize.getWidth();
  const pH = doc.internal.pageSize.getHeight();
  void pH;

  // Banda superior decorativa
  doc.setFillColor(...COLORS.primaryRgb);
  doc.rect(0, 0, pW, 4, 'F');

  // Logo PNG si está disponible, sino texto
  const logoHeight = 12;
  void logoHeight;
  // El logo se agrega tras el await en addHeaderWithLogo; aquí solo dejamos el texto.
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.primaryRgb);
  doc.text('MOLINOS LA FÉ — MINA BELÉN', PAGE_MARGIN_MM, 18);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...COLORS.accentText);
  doc.text(`Plantilla · ${data.plantilla.nombre}`, PAGE_MARGIN_MM, 26);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  const subtitulo = data.plantilla.descripcion
    ? `Ciclo ${maxSemanasRotacion(data)} semanas · ${capitalize(data.plantilla.area)}`
    : `Ciclo ${maxSemanasRotacion(data)} semanas · ${capitalize(data.plantilla.area)}`;
  doc.text(subtitulo, PAGE_MARGIN_MM, 32);
}

function maxSemanasRotacion(data: PlantillaPdfData): number {
  return data.cuadrillas.reduce((max, c) => Math.max(max, c.totalSemanas), 0) || 1;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function addMetaBand(doc: PdfDoc, data: PlantillaPdfData) {
  const pW = doc.internal.pageSize.getWidth();
  const startY = 38;
  const bandH = 16;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(...([203, 213, 225] as [number, number, number]));
  doc.rect(PAGE_MARGIN_MM, startY, pW - 2 * PAGE_MARGIN_MM, bandH, 'FD');

  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);

  const itemY = startY + 6;
  const valueY = startY + 11;

  const items: Array<{ label: string; value: string }> = [
    { label: 'Cuadrillas activas', value: `${data.cuadrillas.length}` },
    { label: 'Trabajadores', value: `${data.totalTrabajadores}` },
    { label: 'Total ciclo', value: fmtMoney(data.totalCiclo) },
    { label: 'Estado instancia', value: data.instancia.estado },
    { label: 'Generado', value: fmtDateTime(data.generatedAt) },
  ];

  const colW = (pW - 2 * PAGE_MARGIN_MM) / items.length;
  items.forEach((item, i) => {
    const x = PAGE_MARGIN_MM + colW * i + 3;
    doc.setFont('helvetica', 'bold');
    doc.text(item.label.toUpperCase(), x, itemY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.accentText);
    doc.text(item.value, x, valueY);
    doc.setTextColor(60, 60, 60);
  });
}

function addCuadrillaSection(
  doc: PdfDoc,
  cuadrilla: PlantillaPdfData['cuadrillas'][number],
  data: PlantillaPdfData,
  startY: number,
): number {
  // Subtítulo
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.accentText);
  doc.text(
    `Cuadrilla · ${cuadrilla.nombre}`,
    PAGE_MARGIN_MM,
    startY + 4,
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(110, 110, 110);
  doc.text(
    `${cuadrilla.asignacionKey || '—'} · ${cuadrilla.totalTrabajadores} trabajadores · Estado: ${cuadrilla.estado}`,
    PAGE_MARGIN_MM,
    startY + 9,
  );

  // Construir headers y filas
  const baseCols: string[] = ['#', 'Nombre', 'C.I.'];
  if (cuadrilla.columnasVariables.includes('cargo')) baseCols.push('Cargo');
  if (cuadrilla.columnasVariables.includes('esquema')) baseCols.push('Esquema');
  const rotHeaders: string[] = [];
  for (let i = 0; i < cuadrilla.totalSemanas; i++) {
    const pos = (cuadrilla.posicionActiva + i) % cuadrilla.totalSemanas;
    const semana = data.cuadrillas
      .flatMap((c) => c.rows.flatMap((r) => r.rotacion))
      .find((c) => c.semanaOrden === pos && c.semanaId);
    // nombre de la semana: usar el de la primera fila
    const firstCell = cuadrilla.rows[0]?.rotacion[i];
    const nombreSemana = firstCell?.semanaNombre ?? `Sem. ${pos + 1}`;
    rotHeaders.push(nombreSemana);
  }
  const showTotal = cuadrilla.columnasVariables.includes('total_periodo');
  const finalCols = [...baseCols, ...rotHeaders, ...(showTotal ? ['Total ciclo'] : [])];

  const body = cuadrilla.rows.map((row, idx) => {
    const cells: (string | number)[] = [idx + 1, row.nombre_completo, row.cedula];
    if (cuadrilla.columnasVariables.includes('cargo')) {
      cells.push(row.cargo);
    }
    if (cuadrilla.columnasVariables.includes('esquema')) {
      cells.push(row.esquema_rotacion);
    }
    for (let i = 0; i < row.rotacion.length; i++) {
      cells.push(row.rotacion[i].estatusShort);
    }
    if (showTotal) {
      cells.push(fmtMoney(row.totalCiclo));
    }
    return cells;
  });

  // Fila subtotales
  const subtotalRow: (string | number)[] = ['·', 'Subtotal por semana', ''];
  if (cuadrilla.columnasVariables.includes('cargo')) subtotalRow.push('');
  if (cuadrilla.columnasVariables.includes('esquema')) subtotalRow.push('');
  for (let i = 0; i < cuadrilla.subtotalesPorSemana.length; i++) {
    const s = cuadrilla.subtotalesPorSemana[i];
    const summary = [
      `${s.trabajadas} Trab.`,
      s.libresPagadas + s.libresSinPago > 0 ? `${s.libresPagadas + s.libresSinPago} Lib.` : null,
      s.reposos > 0 ? `${s.reposos} Rep.` : null,
    ]
      .filter(Boolean)
      .join(' / ');
    subtotalRow.push(summary || '—');
  }
  if (showTotal) {
    subtotalRow.push(fmtMoney(cuadrilla.totalCuadrilla));
  }
  body.push(subtotalRow);

  autoTable(doc, {
    startY: startY + 14,
    head: [finalCols],
    body,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: 2,
      lineColor: COLORS.borderLight,
      lineWidth: 0.1,
      textColor: [17, 17, 17],
    },
    headStyles: {
      fillColor: [232, 238, 245],
      textColor: [60, 60, 60],
      fontStyle: 'bold',
      lineColor: COLORS.border,
      lineWidth: 0.3,
      halign: 'center',
    },
    alternateRowStyles: {
      fillColor: [250, 251, 252],
    },
    columnStyles: buildColumnStyles(finalCols.length, baseCols.length, showTotal),
    didParseCell: (cellData) => {
      // Última fila: subtotales
      if (cellData.section === 'body' && cellData.row.index === body.length - 1) {
        cellData.cell.styles.fillColor = COLORS.subtotal;
        cellData.cell.styles.fontStyle = 'bold';
        cellData.cell.styles.textColor = COLORS.accentText;
      }
    },
    margin: { left: PAGE_MARGIN_MM, right: PAGE_MARGIN_MM },
  });

  // @ts-expect-error lastAutoTable existe en runtime
  const finalY = (doc as PdfDoc & { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? startY + 50;
  return finalY + 6;
}

function buildColumnStyles(total: number, baseCount: number, hasTotal: boolean) {
  const rotStart = baseCount;
  const rotEnd = hasTotal ? total - 1 : total;
  const styles: Record<number, { halign: 'left' | 'right' | 'center'; cellWidth?: number }> = {};
  styles[0] = { halign: 'center', cellWidth: 8 };
  styles[1] = { halign: 'left' };
  styles[2] = { halign: 'center', cellWidth: 28 };
  for (let i = 3; i < baseCount; i++) {
    styles[i] = { halign: 'left' };
  }
  for (let i = rotStart; i < rotEnd; i++) {
    styles[i] = { halign: 'center', cellWidth: 22 };
  }
  if (hasTotal) {
    styles[total - 1] = { halign: 'right', cellWidth: 32 };
  }
  return styles;
}

function addTotalGeneral(doc: PdfDoc, data: PlantillaPdfData, startY: number): number {
  const pW = doc.internal.pageSize.getWidth();
  const bandH = 12;
  doc.setFillColor(...COLORS.subtotal);
  doc.setDrawColor(...([203, 213, 225] as [number, number, number]));
  doc.rect(PAGE_MARGIN_MM, startY, pW - 2 * PAGE_MARGIN_MM, bandH, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.accentText);
  doc.text('TOTAL GENERAL DEL CICLO', PAGE_MARGIN_MM + 4, startY + 7.5);

  doc.setFontSize(12);
  doc.text(
    fmtMoney(data.totalCiclo),
    pW - PAGE_MARGIN_MM - 4,
    startY + 7.5,
    { align: 'right' },
  );

  return startY + bandH + 6;
}

function addFooter(doc: PdfDoc) {
  const pH = doc.internal.pageSize.getHeight();
  const pW = doc.internal.pageSize.getWidth();
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(140, 140, 140);
    doc.text(
      `Generado por MineOS · Sistema de Gestión Minera de Alta Precisión`,
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

function buildDoc(data: PlantillaPdfData): jsPDF {
  const doc = new jsPDF({
    orientation: PAGE_ORIENTATION,
    unit: 'mm',
    format: PAGE_FORMAT,
  });

  addHeader(doc, data);
  addMetaBand(doc, data);

  let cursor = 60;
  for (const cuadrilla of data.cuadrillas) {
    if (cursor > 170) {
      doc.addPage();
      cursor = 20;
    }
    cursor = addCuadrillaSection(doc, cuadrilla, data, cursor);
  }

  if (cursor > 175) {
    doc.addPage();
    cursor = 20;
  }
  cursor = addTotalGeneral(doc, data, cursor);
  addFooter(doc);
  return doc;
}

export type PlantillaPdfMeta = {
  plantillaNombre: string;
  area: string;
  cycleStart: string;
};

function defaultFileName(meta: PlantillaPdfMeta): string {
  const slug = meta.plantillaNombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `nomina-plantilla-${slug || 'plantilla'}-ciclo-${meta.cycleStart}.pdf`;
}

export async function buildNominaPlantillaPdfBlob(
  data: PlantillaPdfData,
): Promise<Blob> {
  const doc = buildDoc(data);
  const logoPng = await getLogoPngBase64();
  if (logoPng) {
    const pW = doc.internal.pageSize.getWidth();
    // Re-add logo en cada página: lo agregamos encima del texto del header
    for (let i = 1; i <= doc.getNumberOfPages(); i++) {
      doc.setPage(i);
      try {
        doc.addImage(logoPng, 'PNG', pW - PAGE_MARGIN_MM - 35, 8, 35, 12, undefined, 'FAST');
      } catch {
        // ignore: si el formato no es soportado, no agregamos logo
      }
    }
  }
  const arrayBuffer = doc.output('arraybuffer');
  return new Blob([arrayBuffer], { type: 'application/pdf' });
}

export async function downloadNominaPlantillaPdf(
  data: PlantillaPdfData,
  meta: PlantillaPdfMeta,
  fileName?: string,
): Promise<void> {
  if (typeof window === 'undefined') return;
  const blob = await buildNominaPlantillaPdfBlob(data);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName ?? defaultFileName(meta);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function previewNominaPlantillaPdf(
  data: PlantillaPdfData,
): Promise<{ blob: Blob; url: string }> {
  if (typeof window === 'undefined') throw new Error('previewNominaPlantillaPdf requiere window');
  const blob = await buildNominaPlantillaPdfBlob(data);
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

export async function shareNominaPlantillaPdf(
  data: PlantillaPdfData,
  meta: PlantillaPdfMeta,
  fileName?: string,
): Promise<ShareOutcome> {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    return 'unsupported';
  }
  try {
    const blob = await buildNominaPlantillaPdfBlob(data);
    const name = fileName ?? defaultFileName(meta);
    const file = new File([blob], name, { type: 'application/pdf' });
    if (typeof navigator.canShare === 'function' && !navigator.canShare({ files: [file] })) {
      return 'unsupported';
    }
    await navigator.share({ files: [file], title: `Nómina · ${meta.plantillaNombre}` });
    return 'shared';
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return 'cancelled';
    return 'failed';
  }
}

export { defaultFileName as defaultPlantillaPdfFileName };

/** Helper: obtiene la última semana rotada de cualquier fila (para el subtítulo). */
export function _unusedSuppressLinter(row: PlantillaPdfRow): void {
  void row;
}

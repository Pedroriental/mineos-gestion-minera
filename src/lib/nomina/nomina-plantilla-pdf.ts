// ============================================================
// MineOS - Generador de PDF de plantilla
// Usa jsPDF + autoTable sobre las primitivas compartidas en
// nomina-pdf-primitives.ts para garantizar el mismo diseño visual
// que el resto de PDFs de nómina (listado, liquidación, etc.).
// ============================================================

import { jsPDF } from 'jspdf';
import type { PlantillaPdfData } from '@/lib/rotacion-plantillas/plantilla-pdf-data';
import {
  addHeader,
  addMetaBand,
  addSection,
  addTotalGeneral,
  addFooter,
  applyLogoToAllPages,
  arrayBufferToPdfBlob,
  triggerPdfDownload,
  sharePdfBlob,
  canSharePdf,
  fmtMoney,
  fmtDateTime,
  PAGE_MARGIN_MM,
  PAGE_BREAK_Y_MM,
  PAGE_BREAK_TOTAL_Y_MM,
  PAGE_FORMAT,
  PAGE_ORIENTATION,
  type MetaItem,
  type SectionSpec,
  type ColumnStyle,
  type ShareOutcome,
} from './nomina-pdf-primitives';

function maxSemanasRotacion(data: PlantillaPdfData): number {
  return data.cuadrillas.reduce((max, c) => Math.max(max, c.totalSemanas), 0) || 1;
}

function buildCuadrillaHeaders(
  cuadrilla: PlantillaPdfData['cuadrillas'][number],
): string[] {
  const baseCols: string[] = ['#', 'Nombre', 'C.I.'];
  if (cuadrilla.columnasVariables.includes('cargo')) baseCols.push('Cargo');
  if (cuadrilla.columnasVariables.includes('esquema')) baseCols.push('Esquema');
  const rotHeaders: string[] = [];
  for (let i = 0; i < cuadrilla.totalSemanas; i++) {
    const pos = (cuadrilla.posicionActiva + i) % cuadrilla.totalSemanas;
    const firstCell = cuadrilla.rows[0]?.rotacion[i];
    const nombreSemana = firstCell?.semanaNombre ?? `Sem. ${pos + 1}`;
    rotHeaders.push(nombreSemana);
  }
  const showTotal = cuadrilla.columnasVariables.includes('total_periodo');
  return [...baseCols, ...rotHeaders, ...(showTotal ? ['Total ciclo'] : [])];
}

function buildCuadrillaBody(
  cuadrilla: PlantillaPdfData['cuadrillas'][number],
  showTotal: boolean,
): (string | number)[][] {
  return cuadrilla.rows.map((row, idx) => {
    const cells: (string | number)[] = [idx + 1, row.nombre_completo, row.cedula];
    if (cuadrilla.columnasVariables.includes('cargo')) cells.push(row.cargo);
    if (cuadrilla.columnasVariables.includes('esquema')) cells.push(row.esquema_rotacion);
    for (let i = 0; i < row.rotacion.length; i++) {
      cells.push(row.rotacion[i].estatusShort);
    }
    if (showTotal) cells.push(fmtMoney(row.totalCiclo));
    return cells;
  });
}

function buildCuadrillaSubtotal(
  cuadrilla: PlantillaPdfData['cuadrillas'][number],
  showTotal: boolean,
): (string | number)[] {
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
  if (showTotal) subtotalRow.push(fmtMoney(cuadrilla.totalCuadrilla));
  return subtotalRow;
}

function buildCuadrillaColumnStyles(
  total: number,
  baseCount: number,
  hasTotal: boolean,
): Record<number, ColumnStyle> {
  const rotStart = baseCount;
  const rotEnd = hasTotal ? total - 1 : total;
  const styles: Record<number, ColumnStyle> = {};
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

function buildDoc(data: PlantillaPdfData): jsPDF {
  const doc = new jsPDF({
    orientation: PAGE_ORIENTATION,
    unit: 'mm',
    format: PAGE_FORMAT,
  });

  addHeader(doc, {
    titulo: 'MOLINOS LA FÉ — MINA BELÉN',
    subtitulo: `Plantilla · ${data.plantilla.nombre}`,
    subtituloSecundario: `Ciclo ${maxSemanasRotacion(data)} semanas · ${capitalizeArea(data.plantilla.area)}`,
  });

  const metaItems: MetaItem[] = [
    { label: 'Cuadrillas activas', value: `${data.cuadrillas.length}` },
    { label: 'Trabajadores', value: `${data.totalTrabajadores}` },
    { label: 'Total ciclo', value: fmtMoney(data.totalCiclo) },
    { label: 'Estado instancia', value: data.instancia.estado },
    { label: 'Generado', value: fmtDateTime(data.generatedAt) },
  ];
  let cursor = addMetaBand(doc, metaItems, { y: 38 });

  for (const cuadrilla of data.cuadrillas) {
    if (cursor > PAGE_BREAK_Y_MM) {
      doc.addPage();
      cursor = 20;
    }

    const headers = buildCuadrillaHeaders(cuadrilla);
    const showTotal = cuadrilla.columnasVariables.includes('total_periodo');
    const body = buildCuadrillaBody(cuadrilla, showTotal);
    const subtotalRow = buildCuadrillaSubtotal(cuadrilla, showTotal);

    const spec: SectionSpec = {
      titulo: `Cuadrilla · ${cuadrilla.nombre}`,
      subtitulo: `${cuadrilla.asignacionKey || '—'} · ${cuadrilla.totalTrabajadores} trabajadores · Estado: ${cuadrilla.estado}`,
      headers,
      body,
      subtotalRow,
      columnStyles: buildCuadrillaColumnStyles(headers.length, 3, showTotal),
    };

    cursor = addSection(doc, spec, { startY: cursor });
  }

  if (cursor > PAGE_BREAK_TOTAL_Y_MM) {
    doc.addPage();
    cursor = 20;
  }
  cursor = addTotalGeneral(doc, data.totalCiclo, 'TOTAL GENERAL DEL CICLO', { startY: cursor });
  addFooter(doc);
  return doc;
}

function capitalizeArea(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

function defaultFileName(meta: PlantillaPdfMeta): string {
  const slug = meta.plantillaNombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `nomina-plantilla-${slug || 'plantilla'}-ciclo-${meta.cycleStart}.pdf`;
}

export type PlantillaPdfMeta = {
  plantillaNombre: string;
  area: string;
  cycleStart: string;
};

export async function buildNominaPlantillaPdfBlob(
  data: PlantillaPdfData,
): Promise<Blob> {
  const doc = buildDoc(data);
  await applyLogoToAllPages(doc);
  return arrayBufferToPdfBlob(doc.output('arraybuffer'));
}

export async function downloadNominaPlantillaPdf(
  data: PlantillaPdfData,
  meta: PlantillaPdfMeta,
  fileName?: string,
): Promise<void> {
  if (typeof window === 'undefined') return;
  const blob = await buildNominaPlantillaPdfBlob(data);
  triggerPdfDownload(blob, fileName ?? defaultFileName(meta));
}

export async function previewNominaPlantillaPdf(
  data: PlantillaPdfData,
): Promise<{ blob: Blob; url: string }> {
  if (typeof window === 'undefined') throw new Error('previewNominaPlantillaPdf requiere window');
  const blob = await buildNominaPlantillaPdfBlob(data);
  const url = URL.createObjectURL(blob);
  return { blob, url };
}

export async function shareNominaPlantillaPdf(
  data: PlantillaPdfData,
  meta: PlantillaPdfMeta,
  fileName?: string,
): Promise<ShareOutcome> {
  if (typeof window === 'undefined') return 'unsupported';
  const blob = await buildNominaPlantillaPdfBlob(data);
  return sharePdfBlob(
    blob,
    fileName ?? defaultFileName(meta),
    `Nómina · ${meta.plantillaNombre}`,
  );
}

export { defaultFileName as defaultPlantillaPdfFileName };
export { canSharePdf };
export type { ShareOutcome };

// Helpers reusados por tests u otros generadores
export { PAGE_MARGIN_MM };

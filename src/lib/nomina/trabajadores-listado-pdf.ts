// ============================================================
// MineOS - Generador de PDF del Listado de Trabajadores
// Reutiliza las primitivas compartidas de nomina-pdf-primitives.ts
// para garantizar el mismo diseño que el PDF de plantilla de nómina.
// ============================================================

import { jsPDF } from 'jspdf';
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
  fmtDate,
  fmtDateTime,
  PAGE_FORMAT,
  PAGE_ORIENTATION,
  PAGE_BREAK_Y_MM,
  PAGE_BREAK_TOTAL_Y_MM,
  type MetaItem,
  type SectionSpec,
  type ColumnStyle,
  type ShareOutcome,
} from './nomina-pdf-primitives';

// ── Tipos públicos ──────────────────────────────────────────────────

export type TrabajadorListadoRow = {
  personalId: string;
  nombre_completo: string;
  cedula: string;
  cargo: string;
  area_detalle: string | null;
  cuadrilla: string | null;
  esquema_rotacion: string;
  perfil_nombre: string | null;
  salario_base: number;
  estado_laboral: string;
  fecha_ingreso: string;
};

export type CuadrillaBloque = {
  nombre: string;
  rows: TrabajadorListadoRow[];
  totalTrabajadores: number;
  totalSalarios: number;
};

export type ListadoData = {
  area: string;
  areaLabel: string;
  generatedAt: Date;
  bloques: CuadrillaBloque[];
  totalTrabajadores: number;
  totalSalarios: number;
};

// ── Builder de datos ────────────────────────────────────────────────

const SIN_CUADRILLA_KEY = '__sin_cuadrilla__';

/** Normaliza string vacío a null. */
function normC(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s.trim();
  return t || null;
}

/**
 * Agrupa trabajadores por cuadrilla, ordena A→Z, y deja 'Sin cuadrilla'
 * al final. El bloque "Sin cuadrilla" solo aparece si hay al menos un
 * trabajador sin cuadrilla asignada.
 */
export function buildTrabajadoresListadoData(
  rows: TrabajadorListadoRow[],
  opts: { area: string; areaLabel: string; generatedAt?: Date },
): ListadoData {
  const generatedAt = opts.generatedAt ?? new Date();
  const map = new Map<string, TrabajadorListadoRow[]>();
  let sinCuadrillaCount = 0;

  for (const r of rows) {
    const key = normC(r.cuadrilla) ?? SIN_CUADRILLA_KEY;
    if (key === SIN_CUADRILLA_KEY) sinCuadrillaCount += 1;
    const list = map.get(key) ?? [];
    list.push(r);
    map.set(key, list);
  }

  // Orden de claves: alfabético (A, B, C, ...), y 'Sin cuadrilla' al final
  const keys = Array.from(map.keys()).sort((a, b) => {
    if (a === SIN_CUADRILLA_KEY) return 1;
    if (b === SIN_CUADRILLA_KEY) return -1;
    return a.localeCompare(b, 'es', { sensitivity: 'base' });
  });

  const bloques: CuadrillaBloque[] = keys.map((k) => {
    const list = map.get(k)!;
    const totalSalarios = list.reduce((sum, r) => sum + (Number.isFinite(r.salario_base) ? r.salario_base : 0), 0);
    return {
      nombre: k === SIN_CUADRILLA_KEY ? 'Sin cuadrilla' : k,
      rows: list,
      totalTrabajadores: list.length,
      totalSalarios,
    };
  });

  const totalTrabajadores = rows.length;
  const totalSalarios = bloques.reduce((s, b) => s + b.totalSalarios, 0);
  const totalCuadrillas = bloques.filter((b) => b.nombre !== 'Sin cuadrilla').length;

  return {
    area: opts.area,
    areaLabel: opts.areaLabel,
    generatedAt,
    bloques,
    totalTrabajadores,
    totalSalarios,
  };
}

// ── Headers y body de la tabla ───────────────────────────────────────

const LISTADO_HEADERS = [
  '#',
  'Nombre',
  'C.I.',
  'Cargo',
  'Asignación',
  'Esquema',
  'Sueldo base',
  'Estado',
];

const LISTADO_COLUMN_STYLES: Record<number, ColumnStyle> = {
  0: { halign: 'center', cellWidth: 8 },
  1: { halign: 'left' },
  2: { halign: 'center', cellWidth: 28 },
  3: { halign: 'left' },
  4: { halign: 'left' },
  5: { halign: 'center', cellWidth: 28 },
  6: { halign: 'right', cellWidth: 30 },
  7: { halign: 'center', cellWidth: 22 },
};

function buildBloqueBody(bloque: CuadrillaBloque): (string | number)[][] {
  return bloque.rows.map((r, idx) => [
    idx + 1,
    r.nombre_completo,
    r.cedula,
    r.cargo || '—',
    r.area_detalle || '—',
    r.esquema_rotacion || '—',
    fmtMoney(r.salario_base),
    r.estado_laboral || '—',
  ]);
}

function buildBloqueSubtotal(bloque: CuadrillaBloque): (string | number)[] {
  return [
    '·',
    'Subtotal',
    '',
    '',
    '',
    '',
    fmtMoney(bloque.totalSalarios),
    `${bloque.totalTrabajadores} trab.`,
  ];
}

// ── Builder del documento PDF ───────────────────────────────────────

function buildDoc(data: ListadoData): jsPDF {
  const doc = new jsPDF({
    orientation: PAGE_ORIENTATION,
    unit: 'mm',
    format: PAGE_FORMAT,
  });

  const numCuadrillas = data.bloques.filter((b) => b.nombre !== 'Sin cuadrilla').length;
  const sinCuadrillaCount = data.bloques.find((b) => b.nombre === 'Sin cuadrilla')?.totalTrabajadores ?? 0;

  addHeader(doc, {
    titulo: 'MOLINOS LA FÉ — MINA BELÉN',
    subtitulo: `Listado de trabajadores · ${data.areaLabel}`,
    subtituloSecundario: `Generado ${fmtDateTime(data.generatedAt)}`,
  });

  const metaItems: MetaItem[] = [
    { label: 'Total trabajadores', value: `${data.totalTrabajadores}` },
    { label: 'Cuadrillas', value: `${numCuadrillas}` },
    { label: 'Sin cuadrilla', value: `${sinCuadrillaCount}` },
    { label: 'Total sueldos', value: fmtMoney(data.totalSalarios) },
    { label: 'Generado', value: fmtDate(data.generatedAt.toISOString()) },
  ];
  let cursor = addMetaBand(doc, metaItems, { y: 38 });

  for (const bloque of data.bloques) {
    if (cursor > PAGE_BREAK_Y_MM) {
      doc.addPage();
      cursor = 20;
    }

    const isSinCuadrilla = bloque.nombre === 'Sin cuadrilla';
    const subtitulo = isSinCuadrilla
      ? `${bloque.totalTrabajadores} trabajador(es) sin cuadrilla asignada`
      : `${bloque.totalTrabajadores} trabajador(es) · ${fmtMoney(bloque.totalSalarios)} en sueldos base`;

    const spec: SectionSpec = {
      titulo: isSinCuadrilla ? bloque.nombre : `Cuadrilla · ${bloque.nombre}`,
      subtitulo,
      headers: LISTADO_HEADERS,
      body: buildBloqueBody(bloque),
      subtotalRow: buildBloqueSubtotal(bloque),
      columnStyles: LISTADO_COLUMN_STYLES,
    };

    cursor = addSection(doc, spec, { startY: cursor });
  }

  if (cursor > PAGE_BREAK_TOTAL_Y_MM) {
    doc.addPage();
    cursor = 20;
  }
  cursor = addTotalGeneral(doc, data.totalSalarios, 'TOTAL GENERAL DE SUELDOS BASE', {
    startY: cursor,
  });
  addFooter(doc);
  return doc;
}

// ── API pública ────────────────────────────────────────────────────

export type ListadoMeta = {
  area: string;
  areaLabel: string;
  generatedAt?: Date;
};

function defaultFileName(meta: ListadoMeta): string {
  const fecha = (meta.generatedAt ?? new Date()).toISOString().slice(0, 10);
  const slugArea = (meta.area || 'general')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `listado-trabajadores-${slugArea}-${fecha}.pdf`;
}

export async function buildTrabajadoresListadoPdfBlob(data: ListadoData): Promise<Blob> {
  const doc = buildDoc(data);
  await applyLogoToAllPages(doc);
  return arrayBufferToPdfBlob(doc.output('arraybuffer'));
}

export async function downloadTrabajadoresListadoPdf(
  data: ListadoData,
  meta: ListadoMeta,
  fileName?: string,
): Promise<void> {
  if (typeof window === 'undefined') return;
  const blob = await buildTrabajadoresListadoPdfBlob(data);
  triggerPdfDownload(blob, fileName ?? defaultFileName(meta));
}

export async function previewTrabajadoresListadoPdf(
  data: ListadoData,
): Promise<{ blob: Blob; url: string }> {
  if (typeof window === 'undefined') {
    throw new Error('previewTrabajadoresListadoPdf requiere window');
  }
  const blob = await buildTrabajadoresListadoPdfBlob(data);
  const url = URL.createObjectURL(blob);
  return { blob, url };
}

export async function shareTrabajadoresListadoPdf(
  data: ListadoData,
  meta: ListadoMeta,
  fileName?: string,
): Promise<ShareOutcome> {
  if (typeof window === 'undefined') return 'unsupported';
  const blob = await buildTrabajadoresListadoPdfBlob(data);
  return sharePdfBlob(
    blob,
    fileName ?? defaultFileName(meta),
    `Listado de trabajadores · ${meta.areaLabel}`,
  );
}

export { defaultFileName as defaultTrabajadoresListadoFileName, canSharePdf };
export type { ShareOutcome };

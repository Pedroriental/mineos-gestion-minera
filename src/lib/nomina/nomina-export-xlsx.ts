import type { NominaPreviewReport } from '@/lib/nomina-preview';
import {
  splitNominaByDivisiones,
  formatNominaDivisionLabel,
  type NominaDivisionParam,
} from '@/lib/reconciliation/nomina-divisiones';

/**
 * Exportación de la planilla consolidada de nómina a Excel (.xlsx),
 * replicando la hoja que la empresa arma a mano:
 *
 *   1. Resumen global (concepto · total · partes)
 *   2. Un bloque por sección/cuadrilla con sus columnas de semana,
 *      observaciones, total por trabajador, cierre semanal y subtotal
 *   3. Novedades del periodo
 *
 * `buildNominaPreviewWorkbookData` es pura (testeable);
 * `downloadNominaPreviewXlsx` carga `xlsx` bajo demanda y descarga el archivo.
 */

type CellValue = string | number | null;

export type NominaXlsxSheetData = {
  rows: CellValue[][];
  /** Índices (base 0) de filas que son montos — para aplicar formato numérico. */
  moneyCols: number[];
  /** Anchos sugeridos por columna (caracteres). */
  colWidths: number[];
  /** Celdas combinadas: [filaInicio, colInicio, filaFin, colFin] (base 0). */
  merges: Array<[number, number, number, number]>;
  /** Filas de encabezado/subtotal (para estilos si el consumidor quiere). */
  headerRows: number[];
};

function fmtDate(s: string | null | undefined): string {
  if (!s) return '—';
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

const AREA_LABEL: Record<string, string> = {
  mina: 'Mina',
  planta: 'Molinos',
  administracion: 'Administración',
};

export function nominaXlsxFilename(rangeStart: string, rangeEnd: string): string {
  return `nomina_${rangeStart}_${rangeEnd}.xlsx`;
}

export function buildNominaPreviewWorkbookData(
  report: NominaPreviewReport,
  divisiones: NominaDivisionParam[] = [],
): NominaXlsxSheetData {
  const rows: CellValue[][] = [];
  const merges: Array<[number, number, number, number]> = [];
  const headerRows: number[] = [];

  const weekCount = report.weekColumns.length;
  // Bloques de detalle: Nombres · C.I. · F. Ingreso · semanas… · Observaciones · Total
  const detailCols = 3 + weekCount + 2;
  const summaryCols = 2 + divisiones.length;
  const totalCols = Math.max(detailCols, summaryCols, 5);

  const pad = (r: CellValue[]): CellValue[] => {
    while (r.length < totalCols) r.push(null);
    return r;
  };

  // ── Título ──
  rows.push(pad([report.periodLabel]));
  merges.push([0, 0, 0, totalCols - 1]);
  headerRows.push(0);
  rows.push(pad([`${fmtDate(report.rangeStart)} — ${fmtDate(report.rangeEnd)}`]));
  merges.push([1, 0, 1, totalCols - 1]);
  rows.push(pad([]));

  // ── Resumen global ──
  let r = rows.length;
  headerRows.push(r);
  rows.push(
    pad([
      'Concepto',
      'Total Nóminas (USD)',
      ...divisiones.map((d) => formatNominaDivisionLabel(d.porcentaje)),
    ]),
  );
  for (const s of report.summary) {
    const splits = splitNominaByDivisiones(s.total, divisiones);
    rows.push(pad([s.label, s.total, ...splits.map((p) => p.montoUsd)]));
  }
  const grandSplits = splitNominaByDivisiones(report.grandTotal, divisiones);
  r = rows.length;
  headerRows.push(r);
  rows.push(pad(['Total Nómina', report.grandTotal, ...grandSplits.map((p) => p.montoUsd)]));
  rows.push(pad([]));

  // ── Bloques por sección/cuadrilla ──
  for (const section of report.sections) {
    r = rows.length;
    headerRows.push(r);
    rows.push(pad([section.title]));
    merges.push([r, 0, r, totalCols - 1]);

    r = rows.length;
    headerRows.push(r);
    rows.push(
      pad([
        'Nombres',
        'C.I.',
        'Fecha de Ingreso',
        ...report.weekColumns.map((w) => w.header),
        'Observaciones',
        weekCount > 1 ? 'Total Rotación (USD)' : 'Total Nómina (USD)',
      ]),
    );

    for (const row of section.rows) {
      rows.push(
        pad([
          row.personal.nombre_completo,
          row.personal.cedula || '—',
          fmtDate(row.personal.fecha_ingreso),
          ...report.weekColumns.map((w) => {
            const cell = row.weeks[w.weekStart];
            return cell && cell.amount > 0 ? cell.amount : null;
          }),
          row.observaciones === '—' ? null : row.observaciones,
          row.total,
        ]),
      );
    }

    // Cierre semanal por columna + subtotal de la sección
    r = rows.length;
    headerRows.push(r);
    rows.push(
      pad([
        'Cierre Semanal (USD)',
        null,
        null,
        ...report.weekColumns.map((w) =>
          section.rows.reduce((sum, row) => sum + (row.weeks[w.weekStart]?.amount || 0), 0),
        ),
        null,
        section.sectionTotal,
      ]),
    );
    merges.push([r, 0, r, 2]);
    rows.push(pad([]));
  }

  // ── Novedades ──
  if (report.novedades.length) {
    r = rows.length;
    headerRows.push(r);
    rows.push(pad(['Novedades del periodo']));
    merges.push([r, 0, r, totalCols - 1]);
    r = rows.length;
    headerRows.push(r);
    rows.push(pad(['Nombre', 'C.I.', 'Área', 'Tipo', 'Detalle']));
    for (const n of report.novedades) {
      rows.push(pad([n.nombre, n.cedula, AREA_LABEL[n.area] || n.area, n.tipo, n.detalle]));
    }
  }

  // Columnas de dinero: semanas + total en bloques de detalle (cols 3..3+weekCount, y la última)
  const moneyCols: number[] = [1];
  for (let i = 0; i < weekCount; i++) moneyCols.push(3 + i);
  moneyCols.push(detailCols - 1);

  const colWidths: number[] = [];
  for (let c = 0; c < totalCols; c++) {
    if (c === 0) colWidths.push(28);
    else if (c === 1) colWidths.push(14);
    else if (c === 2) colWidths.push(14);
    else if (c === detailCols - 2) colWidths.push(26); // Observaciones
    else colWidths.push(15);
  }

  return { rows, moneyCols, colWidths, merges, headerRows };
}

export async function downloadNominaPreviewXlsx(
  report: NominaPreviewReport,
  divisiones: NominaDivisionParam[] = [],
  filename?: string,
): Promise<void> {
  const XLSX = await import('xlsx');
  const data = buildNominaPreviewWorkbookData(report, divisiones);

  const ws = XLSX.utils.aoa_to_sheet(data.rows);
  ws['!merges'] = data.merges.map(([sr, sc, er, ec]) => ({
    s: { r: sr, c: sc },
    e: { r: er, c: ec },
  }));
  ws['!cols'] = data.colWidths.map((wch) => ({ wch }));

  // Formato monetario en celdas numéricas de columnas de dinero
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
  for (let R = range.s.r; R <= range.e.r; R++) {
    for (const C of data.moneyCols) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[addr];
      if (cell && cell.t === 'n') cell.z = '#,##0.00';
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Nóminas');
  XLSX.writeFile(wb, filename ?? nominaXlsxFilename(report.rangeStart, report.rangeEnd));
}

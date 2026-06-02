import * as XLSX from 'xlsx';

export type CellValue = string | number | boolean | null | undefined;
export type ExcelMatrix = CellValue[][];

export interface ExcelParseResult {
  sheetName: string;
  matrix: ExcelMatrix;
  rowCount: number;
  colCount: number;
}

/**
 * Procesa un buffer de archivo Excel (.xlsx, .xls) de forma extremadamente robusta,
 * retornando una estructura matricial bi-dimensional agnóstica limpia de desfasamientos.
 * 
 * @param buffer Uint8Array o ArrayBuffer del archivo cargado.
 * @returns Estructura con el nombre de la hoja procesada y la matriz bi-dimensional.
 */
export function parseExcelToMatrix(buffer: ArrayBuffer | Uint8Array): ExcelParseResult {
  try {
    // 1. Cargar el libro utilizando SheetJS en formato array/binary
    const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const workbook = XLSX.read(data, {
      type: 'array',
      cellDates: true, // Auto-parsear fechas de celdas nativas de Excel
      cellNF: false,
      cellText: false,
    });

    // 2. Tomar la primera hoja (activa por defecto en los reportes de nómina)
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new Error('El archivo de cálculo no posee hojas válidas.');
    }
    const worksheet = workbook.Sheets[sheetName];

    // 3. Convertir a matriz bi-dimensional (Array of Arrays)
    // CRÍTICO: Se utiliza 'header: 1' para forzar matriz pura y 'defval: ""'
    // para garantizar que celdas vacías no desplacen las columnas adyacentes.
    const rawMatrix = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: '',
      blankrows: true, // Mantener las filas vacías para preservar los índices de fila originales
    }) as ExcelMatrix;

    // 4. Limpieza básica y cálculo de dimensiones máximas
    let maxCols = 0;
    const cleanMatrix = rawMatrix.map((row) => {
      // Si la fila viene vacía o no es un array, normalizar como array vacío
      const cells = Array.isArray(row) ? row : [];
      if (cells.length > maxCols) {
        maxCols = cells.length;
      }
      
      // Limpiar espacios en blanco de textos referenciales
      return cells.map((cell) => {
        if (typeof cell === 'string') {
          return cell.trim();
        }
        return cell;
      });
    });

    return {
      sheetName,
      matrix: cleanMatrix,
      rowCount: cleanMatrix.length,
      colCount: maxCols,
    };
  } catch (error) {
    console.error('[ExcelParser] Error extrayendo datos:', error);
    throw new Error(`Error en la extracción bi-dimensional de Excel: ${error instanceof Error ? error.message : 'Error desconocido'}`);
  }
}

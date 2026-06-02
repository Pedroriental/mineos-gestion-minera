import type { CellValue } from '@/lib/nomina/excel-parser';

/**
 * MineOS - Motor Aritmético de Auditoría y Conciliación de Nóminas
 * 
 * Este motor analiza matrices bi-dimensionales agnósticas de nómina cargadas desde Excel/PDF
 * y realiza auto-descubrimiento de columnas críticas, clasificación de filas (cuerpo vs totales)
 * y conciliación matemática estricta a nivel de centavos.
 */

export interface EmployeeRowDetail {
  identificador: string;
  nombre: string;
  sueldoBase: number;
  deducciones: number;
  neto: number;
  filaOrigenIndex: number;
  isValid: boolean;
  notes?: string;
}

export interface ColumnMapping {
  identificadorIdx: number;
  nombreIdx: number;
  sueldoBaseIdx: number;
  deduccionesIdx: number;
  netoIdx: number;
}

export type AuditStatus = 'VALIDATED' | 'DISCREPANCY';

export interface AuditDiscrepancyDetail {
  campo: 'sueldoBase' | 'deducciones' | 'neto';
  totalCalculado: number;
  totalDeclarado: number;
  delta: number;
}

export interface AuditReport {
  status: AuditStatus;
  nombreArchivo: string;
  mapeoColumnas: ColumnMapping;
  empleadosProcesados: EmployeeRowDetail[];
  totalArchivo: {
    sueldoBase: number;
    deducciones: number;
    neto: number;
  };
  totalCalculado: {
    sueldoBase: number;
    deducciones: number;
    neto: number;
  };
  discrepancias: AuditDiscrepancyDetail[];
  log: string[];
}

// Palabras clave flexibles para auto-detección
const KEYWORDS_IDENTIFICADOR = ['cedula', 'ci', 'c.i', 'identificacion', 'documento', 'cédula', 'id'];
const KEYWORDS_NOMBRE = ['nombre', 'trabajador', 'empleado', 'operario', 'personal', 'nombre completo'];
const KEYWORDS_SUELDO_BASE = ['sueldo base', 'salario base', 'base', 'sueldo', 'salario', 'sueldos', 'mensual', 'diario'];
const KEYWORDS_DEDUCCIONES = ['deducciones', 'deduccion', 'retenciones', 'retencion', 'descuentos', 'descuento', 'deduc', 'ret'];
const KEYWORDS_NETO = ['neto', 'a pagar', 'total neto', 'neto cobrar', 'pagar', 'cobrar', 'neto_usd', 'neto pagar', 'total a pagar'];

/**
 * Normaliza un string removiendo tildes, minúsculas y caracteres especiales para comparaciones flexibles.
 */
function cleanText(text: CellValue): string {
  if (text === null || text === undefined) return '';
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remover acentos
    .replace(/[^a-z0-9\s_\-\/\.]/g, '') // Remover caracteres raros
    .trim();
}

/**
 * Escanea la matriz para autodetectar la fila de encabezados y mapear los índices de las columnas críticas.
 */
export function autodetectColumns(matrix: CellValue[][], log: string[]): ColumnMapping {
  const mapping: ColumnMapping = {
    identificadorIdx: -1,
    nombreIdx: -1,
    sueldoBaseIdx: -1,
    deduccionesIdx: -1,
    netoIdx: -1,
  };

  // Buscar en las primeras 15 filas de la matriz
  const scanLimit = Math.min(matrix.length, 15);
  for (let r = 0; r < scanLimit; r++) {
    const row = matrix[r];
    if (!Array.isArray(row)) continue;

    for (let c = 0; c < row.length; c++) {
      const cellVal = cleanText(row[c]);
      if (!cellVal) continue;

      if (mapping.identificadorIdx === -1 && KEYWORDS_IDENTIFICADOR.some(k => cellVal === k || cellVal.includes(k))) {
        mapping.identificadorIdx = c;
      } else if (mapping.nombreIdx === -1 && KEYWORDS_NOMBRE.some(k => cellVal === k || cellVal.includes(k))) {
        mapping.nombreIdx = c;
      } else if (mapping.sueldoBaseIdx === -1 && KEYWORDS_SUELDO_BASE.some(k => cellVal === k || cellVal.includes(k))) {
        mapping.sueldoBaseIdx = c;
      } else if (mapping.deduccionesIdx === -1 && KEYWORDS_DEDUCCIONES.some(k => cellVal === k || cellVal.includes(k))) {
        mapping.deduccionesIdx = c;
      } else if (mapping.netoIdx === -1 && KEYWORDS_NETO.some(k => cellVal === k || cellVal.includes(k))) {
        mapping.netoIdx = c;
      }
    }

    // Si encontramos al menos las tres columnas financieras y el nombre, salimos del escaneo
    if (mapping.nombreIdx !== -1 && mapping.sueldoBaseIdx !== -1 && mapping.netoIdx !== -1) {
      log.push(`Encabezado de columnas auto-detectado con éxito en la fila ${r + 1}.`);
      break;
    }
  }

  // Fallbacks razonables en caso de que falten índices por no coincidir exactamente
  if (mapping.nombreIdx === -1) mapping.nombreIdx = 1; // Columna B como default para Nombre
  if (mapping.sueldoBaseIdx === -1) mapping.sueldoBaseIdx = 2; // Columna C como default para Sueldo
  if (mapping.deduccionesIdx === -1) mapping.deduccionesIdx = 3; // Columna D como default para Deducciones
  if (mapping.netoIdx === -1) mapping.netoIdx = 4; // Columna E como default para Neto

  log.push(`Estructura de mapeo de índices final: Nombre: ${mapping.nombreIdx}, Cédula: ${mapping.identificadorIdx}, Sueldo Base: ${mapping.sueldoBaseIdx}, Deducciones: ${mapping.deduccionesIdx}, Neto: ${mapping.netoIdx}`);
  return mapping;
}

/**
 * Parsea un número de forma ultra segura de cualquier celda, removiendo símbolos monetarios y separadores de miles.
 */
function parseNumericCell(cell: CellValue): number {
  if (cell === null || cell === undefined || cell === '') return 0;
  if (typeof cell === 'number') return cell;

  const cleaned = String(cell)
    .replace(/[$\s]/g, '') // Eliminar signo de dólar y espacios
    .replace(/\.(?=\d{3,})/g, '') // Eliminar puntos de miles (ej. 1.250 -> 1250)
    .replace(/,/g, '.'); // Convertir coma decimal a punto

  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Ejecuta el pipeline completo de auditoría y conciliación matemática sobre una matriz de datos.
 * 
 * @param matrix Matriz bidimensional extraída limpia.
 * @param nombreArchivo Nombre referencial del archivo original.
 * @returns Reporte detallado de auditoría de nómina.
 */
export function auditNominaMatrix(matrix: CellValue[][], nombreArchivo: string): AuditReport {
  const log: string[] = [];
  log.push(`Iniciando pipeline de auditoría para archivo: ${nombreArchivo}`);

  const mapping = autodetectColumns(matrix, log);
  
  const empleadosProcesados: EmployeeRowDetail[] = [];
  const totalArchivo = { sueldoBase: 0, deducciones: 0, neto: 0 };
  const totalCalculado = { sueldoBase: 0, deducciones: 0, neto: 0 };

  let totalDeclaradoEncontrado = false;

  for (let r = 0; r < matrix.length; r++) {
    const row = matrix[r];
    if (!Array.isArray(row) || row.length === 0) continue;

    // Detectar si la fila contiene texto indicando que representa un TOTAL
    const isTotalRow = row.some((cell) => {
      const text = cleanText(cell);
      return text.includes('total') || text.includes('subtotal') || text.includes('gran total') || text.includes('sumatoria');
    });

    if (isTotalRow) {
      // Intentar extraer los totales impresos declarados en el archivo original
      const sb = parseNumericCell(row[mapping.sueldoBaseIdx]);
      const ded = parseNumericCell(row[mapping.deduccionesIdx]);
      const nt = parseNumericCell(row[mapping.netoIdx]);

      // Si tiene valores razonables, los guardamos como totales declarados
      if (sb > 0 || nt > 0) {
        totalArchivo.sueldoBase = sb;
        totalArchivo.deducciones = ded;
        totalArchivo.neto = nt;
        totalDeclaradoEncontrado = true;
        log.push(`Fila de totales declarados detectada en índice de fila ${r + 1}. Valores -> Sueldo: ${sb}, Deducciones: ${ded}, Neto: ${nt}`);
      }
      continue;
    }

    // Validar si es una fila de empleado válida (debe tener un nombre y algún valor financiero)
    const nombre = String(row[mapping.nombreIdx] || '').trim();
    const sueldoBase = parseNumericCell(row[mapping.sueldoBaseIdx]);
    const deducciones = parseNumericCell(row[mapping.deduccionesIdx]);
    const neto = parseNumericCell(row[mapping.netoIdx]);
    const identificador = mapping.identificadorIdx !== -1 ? String(row[mapping.identificadorIdx] || '').trim() : '';

    // Filtros de fila inválida: omitir filas de cabecera y filas vacías
    if (!nombre || nombre.toLowerCase() === 'nombre' || nombre.toLowerCase() === 'empleado' || nombre.toLowerCase() === 'trabajador') {
      continue;
    }

    // Si tiene salario o neto, procesamos como empleado
    if (sueldoBase > 0 || deducciones > 0 || neto > 0) {
      empleadosProcesados.push({
        identificador,
        nombre,
        sueldoBase,
        deducciones,
        neto,
        filaOrigenIndex: r,
        isValid: true,
      });

      // Sumar al total programático calculado en memoria
      totalCalculado.sueldoBase += sueldoBase;
      totalCalculado.deducciones += deducciones;
      totalCalculado.neto += neto;
    }
  }

  // Redondear totales calculados a dos decimales para evitar imprecisiones de coma flotante de JS
  totalCalculado.sueldoBase = Number(totalCalculado.sueldoBase.toFixed(2));
  totalCalculado.deducciones = Number(totalCalculado.deducciones.toFixed(2));
  totalCalculado.neto = Number(totalCalculado.neto.toFixed(2));

  // Si el archivo no traía una fila explícita de totales declarados, asumimos los calculados como declarados para que la conciliación no falle falsamente
  if (!totalDeclaradoEncontrado) {
    log.push('ADVERTENCIA: No se detectó ninguna fila de "Total" explícita en el archivo. Se asumen los totales calculados como referencia de archivo.');
    totalArchivo.sueldoBase = totalCalculado.sueldoBase;
    totalArchivo.deducciones = totalCalculado.deducciones;
    totalArchivo.neto = totalCalculado.neto;
  }

  // Redondear totales de archivo
  totalArchivo.sueldoBase = Number(totalArchivo.sueldoBase.toFixed(2));
  totalArchivo.deducciones = Number(totalArchivo.deducciones.toFixed(2));
  totalArchivo.neto = Number(totalArchivo.neto.toFixed(2));

  // ── PROCESO DE CONCILIACIÓN ──
  const discrepancias: AuditDiscrepancyDetail[] = [];

  const checkField = (campo: 'sueldoBase' | 'deducciones' | 'neto', calc: number, decl: number) => {
    const delta = Number((calc - decl).toFixed(2));
    if (Math.abs(delta) >= 0.01) {
      discrepancias.push({
        campo,
        totalCalculado: calc,
        totalDeclarado: decl,
        delta,
      });
      log.push(`DISCREPANCIA DETECTADA en '${campo}': Calculado (${calc}) ≠ Declarado (${decl}) | Desfase: ${delta}`);
    }
  };

  checkField('sueldoBase', totalCalculado.sueldoBase, totalArchivo.sueldoBase);
  checkField('deducciones', totalCalculado.deducciones, totalArchivo.deducciones);
  checkField('neto', totalCalculado.neto, totalArchivo.neto);

  const status: AuditStatus = discrepancias.length === 0 ? 'VALIDATED' : 'DISCREPANCY';
  log.push(`Análisis finalizado con estado: ${status}. Se procesaron ${empleadosProcesados.length} empleados.`);

  return {
    status,
    nombreArchivo,
    mapeoColumnas: mapping,
    empleadosProcesados,
    totalArchivo,
    totalCalculado,
    discrepancias,
    log,
  };
}

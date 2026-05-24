import * as XLSX from 'xlsx';

export interface EmpleadoParseado {
  nombre_completo: string;
  cedula: string;
  cargo: string;
  area: 'mina' | 'planta' | 'administracion' | 'seguridad' | 'transporte';
  salario_semanal: number;
  fecha_ingreso: string;
  _valid: boolean;
  _error?: string;
}

export interface WeekRange {
  inicio: string | null;
  fin: string | null;
}

// ── Meses en español → número ────────────────────────────────────────────────
const MONTH_MAP: Record<string, string> = {
  enero: '01', febrero: '02', marzo: '03', abril: '04', mayo: '05',
  junio: '06', julio: '07', agosto: '08', septiembre: '09', octubre: '10',
  noviembre: '11', diciembre: '12',
};

function parseSpanishDate(day: string, month: string, year: string): string | null {
  const m = MONTH_MAP[month.toLowerCase()];
  if (!m) return null;
  return `${year}-${m}-${day.padStart(2, '0')}`;
}

function parseNumericDate(raw: string): string | null {
  const parts = raw.split('/');
  if (parts.length !== 3) return null;
  const [d, mo, y] = parts;
  if (y.length !== 4) return null;
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

/**
 * Intenta detectar el rango de la semana en texto extraído de un PDF o Excel.
 * Busca patrones como:
 *   "del 16 marzo al 05/04/2026"
 *   "Semana del 30 ABRIL 2026 al 05/04/2026"
 *   "16/03/2026 al 05/04/2026"
 */
export function detectWeekRange(text: string): WeekRange {
  // Pattern 1: Spanish month name — "30 ABRIL 2026" or "16 de marzo de 2026"
  const spanishPat = /(\d{1,2})\s+(?:de\s+)?([A-Za-záéíóúñ]+)\s+(?:de\s+)?(\d{4})/gi;
  const spanishMatches: RegExpMatchArray[] = [...text.matchAll(spanishPat)];

  if (spanishMatches.length >= 2) {
    const first = parseSpanishDate(spanishMatches[0][1], spanishMatches[0][2], spanishMatches[0][3]);
    const last = parseSpanishDate(
      spanishMatches[spanishMatches.length - 1][1],
      spanishMatches[spanishMatches.length - 1][2],
      spanishMatches[spanishMatches.length - 1][3]
    );
    if (first && last && first !== last) return { inicio: first, fin: last };
    if (first && last) return { inicio: first, fin: last };
  }

  // Pattern 2: DD/MM/YYYY numeric dates
  const numericPat = /\b(\d{1,2}\/\d{2}\/\d{4})\b/g;
  const numericMatches = [...text.matchAll(numericPat)];

  if (numericMatches.length >= 2) {
    const first = parseNumericDate(numericMatches[0][1]);
    const last = parseNumericDate(numericMatches[numericMatches.length - 1][1]);
    if (first && last) return { inicio: first, fin: last };
  }

  return { inicio: null, fin: null };
}

/**
 * Detecta si una celda individual contiene un rango semanal y lo devuelve de forma estructurada.
 * Infiere el fin sumándole 6 días si no hay una fecha de fin explícita.
 */
export function detectWeekRangeInCell(text: string, defaultYear: string): WeekRange {
  const textLower = text.toLowerCase();
  
  // 1. Patrón en español: número de día seguido por nombre de mes
  const spanishMonthRegex = /(\d{1,2})\s+(?:de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/gi;
  const matches = [...textLower.matchAll(spanishMonthRegex)];
  
  if (matches.length >= 1) {
    const firstDay = matches[0][1];
    const firstMonth = matches[0][2];
    const yearMatch = text.match(/\b(\d{4})\b/);
    const year = yearMatch ? yearMatch[1] : defaultYear;
    
    const firstDate = parseSpanishDate(firstDay, firstMonth, year);
    
    if (matches.length >= 2) {
      const secondDay = matches[1][1];
      const secondMonth = matches[1][2];
      const secondDate = parseSpanishDate(secondDay, secondMonth, year);
      return { inicio: firstDate, fin: secondDate };
    } else {
      if (firstDate) {
        const d = new Date(firstDate);
        d.setDate(d.getDate() + 6);
        const finDate = d.toISOString().split('T')[0];
        return { inicio: firstDate, fin: finDate };
      }
    }
  }
  
  // 2. Patrón numérico DD/MM
  const numericPat = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/g;
  const numMatches = [...text.matchAll(numericPat)];
  if (numMatches.length >= 1) {
    const d1 = numMatches[0][1];
    const m1 = numMatches[0][2];
    const y1 = numMatches[0][3] || defaultYear;
    const firstDate = `${y1}-${m1.padStart(2, '0')}-${d1.padStart(2, '0')}`;
    
    if (numMatches.length >= 2) {
      const d2 = numMatches[1][1];
      const m2 = numMatches[1][2];
      const y2 = numMatches[1][3] || defaultYear;
      const secondDate = `${y2}-${m2.padStart(2, '0')}-${d2.padStart(2, '0')}`;
      return { inicio: firstDate, fin: secondDate };
    } else {
      const d = new Date(firstDate);
      d.setDate(d.getDate() + 6);
      const finDate = d.toISOString().split('T')[0];
      return { inicio: firstDate, fin: finDate };
    }
  }
  
  return { inicio: null, fin: null };
}

/**
 * Detecta la semana desde las celdas de un archivo Excel.
 */
export function detectWeekRangeFromExcel(workbook: import('xlsx').WorkBook): WeekRange {
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
    // Scan first 10 rows looking for date range text
    for (let i = 0; i < Math.min(10, rows.length); i++) {
      const rowText = (rows[i] as unknown[]).map((c) => String(c ?? '')).join(' ');
      if (/semana|nómina|nomina/i.test(rowText)) {
        const range = detectWeekRange(rowText);
        if (range.inicio && range.fin) return range;
      }
    }
    // Broader scan of whole sheet text
    const allText = rows
      .slice(0, 20)
      .map((r) => (r as unknown[]).map((c) => String(c ?? '')).join(' '))
      .join('\n');
    const range = detectWeekRange(allText);
    if (range.inicio && range.fin) return range;
  }
  return { inicio: null, fin: null };
}


// ── Detección de área desde el nombre de la sección ──────────────────────────
export function inferArea(
  sectionName: string
): EmpleadoParseado['area'] {
  const lower = sectionName.toLowerCase();
  
  // 1. Transporte
  if (lower.includes('transporte') || lower.includes('chofer') || lower.includes('volque')) {
    return 'transporte';
  }

  // 2. Seguridad
  if (lower.includes('seguridad') || lower.includes('vigilancia') || lower.includes('sereno')) {
    return 'seguridad';
  }

  // 3. Planta / Molino (Molino La Fé)
  if (
    lower.includes('molino') || 
    lower.includes('planta') || 
    lower.includes('grupo') || 
    lower.includes('mixto') || 
    lower.includes('la fe') || 
    lower.includes('la fé')
  ) {
    return 'planta';
  }

  // 4. Mina (explicit check)
  if (lower.includes('mina') || lower.includes('vertical') || lower.includes('belen') || lower.includes('belén')) {
    return 'mina';
  }

  // 5. Administración (generic fallback for administrative sections)
  if (lower.includes('administra')) {
    return 'administracion';
  }

  // Default fallback
  return 'mina';
}


// ── Limpia el nombre de sección para usarlo como "cargo" ─────────────────────
export function cleanSectionName(section: string): string {
  return section
    .replace(/^n[oó]mina\s+/i, '')
    .replace(/^semanas?\s+/i, '')
    .replace(/^mina\s+bel[eé]n\s*[-–]\s*/i, '')
    .replace(/^molinos?\s+la\s+f[eé]\s*[-–]?\s*/i, '')
    .replace(/mina\s+bel[eé]n\s*[-–]?\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Normalizar cédula (quitar puntos y espacios) ─────────────────────────────
function normCedula(raw: string | number): string {
  return String(raw).replace(/[^0-9]/g, '');
}

// ── Normalizar monto (formato venezolano: 1.234,56 → 1234.56) ───────────────
function normAmount(raw: string | number): number {
  if (typeof raw === 'number') return raw;
  const cleaned = String(raw).replace(/\./g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

// ── Detectar si una celda es una C.I. venezolana ─────────────────────────────
const CI_WITH_DOTS = /^\d{1,2}\.\d{3}\.\d{3}$/;
const CI_PLAIN = /^\d{6,9}$/;

function isCedula(cell: unknown): boolean {
  const s = String(cell ?? '').trim();
  return CI_WITH_DOTS.test(s) || CI_PLAIN.test(s);
}

// ── Detectar si una celda es una fecha DD/MM/YYYY ────────────────────────────
const DATE_REGEX = /^(\d{2})\/(\d{2})\/(\d{4})$/;

function parseDate(cell: unknown): string | null {
  if (!cell) return null;
  if (typeof cell === 'number' && cell > 40000 && cell < 55000) {
    const d = XLSX.SSF.parse_date_code(cell);
    if (d) {
      return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
    }
  }
  const s = String(cell).trim();
  const m = s.match(DATE_REGEX);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

// ── Detectar si una celda es un número (monto) ───────────────────────────────
function isAmount(cell: unknown): boolean {
  if (typeof cell === 'number') return cell > 0;
  if (!cell || typeof cell !== 'string') return false;
  const n = normAmount(cell);
  return !isNaN(n) && n > 0;
}

// ── Keywords que identifican una fila de header de sección ───────────────────
const SECTION_KEYWORDS = [
  'administrativos molinos',
  'administrativos mina',
  'administrativo molinos',
  'administrativo mina',
  'nómina administrativo',
  'nomina administrativo',
  'molinos-grupo',
  'molinos grupo',
  'semanas mina',
  'semanas molinos',
  'cocinera',
  'tecnico',
  'técnico',
  'operador',
  'transporte',
  'seguridad',
  'vertical',
];

// ── Detectar filas que deben ignorarse (totales, sub-headers, etc.) ──────────
const SKIP_PATTERNS = [
  /^nombres?$/i,
  /^c\.?i\.?$/i,
  /^fecha/i,
  /^semana/i,
  /^total\s+n[oó]minas?/i,
  /^bono/i,
  /^nota/i,
  /^\*nota/i,
  /^salen\s+libre/i,
  /^total\s*$/i,
  /^acumulado/i,
  /^aportes/i,
];

function isSectionHeader(firstText: string): boolean {
  const lower = firstText.toLowerCase();
  return SECTION_KEYWORDS.some((kw) => lower.includes(kw));
}

function shouldSkipRow(text: string): boolean {
  return SKIP_PATTERNS.some((p) => p.test(text.trim()));
}

// ── PARSER PRINCIPAL DE EXCEL ─────────────────────────────────────────────────
export function parseExcelNomina(file: File, semanaInicio?: string): Promise<EmpleadoParseado[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result as ArrayBuffer;
        const workbook = XLSX.read(data, { type: 'array', cellDates: false });
        const results: EmpleadoParseado[] = [];

        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
            header: 1,
            defval: '',
          });

          let currentSection = 'Personal';
          let currentArea: EmpleadoParseado['area'] = 'mina';
          let activeWeekColIdx = -1;

          for (const rawRow of rows) {
            const row = rawRow as unknown[];
            if (!row || row.length === 0) continue;

            const nonEmpty = row.filter(
              (c) => c !== '' && c !== null && c !== undefined
            );
            if (nonEmpty.length < 2) continue;

            const firstCell = String(nonEmpty[0] ?? '').trim();

            // 1. Detectar si es una fila de cabecera de columnas para encontrar los índices semanales
            const rowText = row.map(c => String(c ?? '').trim()).join(' ');
            const isColHeader = /nombres?/i.test(rowText) && (/c\.?i\.?/i.test(rowText) || /fecha\s+de\s+ingreso/i.test(rowText));

            if (isColHeader) {
              activeWeekColIdx = -1;
              if (semanaInicio) {
                const defaultYear = semanaInicio.split('-')[0];
                for (let i = 0; i < row.length; i++) {
                  const cellText = String(row[i] ?? '').trim();
                  if (!cellText) continue;
                  
                  // Analizamos si la cabecera representa un periodo que coincide con la semanaInicio
                  const range = detectWeekRangeInCell(cellText, defaultYear);
                  if (range.inicio && range.inicio === semanaInicio) {
                    activeWeekColIdx = i;
                    break;
                  }
                }
              }
              continue;
            }

            if (shouldSkipRow(firstCell)) continue;

            // Check if section header
            if (isSectionHeader(firstCell)) {
              currentSection = firstCell;
              currentArea = inferArea(firstCell);
              activeWeekColIdx = -1; // Reset para la nueva sección
              continue;
            }

            let ciIdx = -1;
            let ciValue = '';
            let dateIdx = -1;

            for (let i = 0; i < row.length; i++) {
              const cell = row[i];
              if (!cell) continue;
              const s = String(cell).trim();
              if (isCedula(s)) {
                const norm = normCedula(s);
                if (norm.length >= 6) {
                  ciIdx = i;
                  ciValue = norm;
                  break;
                }
              } else if (ciIdx < 0 && parseDate(s)) {
                dateIdx = i;
              }
            }

            let nombre = '';
            const endIdx = ciIdx >= 0 ? ciIdx : dateIdx;
            if (endIdx < 0) continue;

            for (let i = 0; i < endIdx; i++) {
              const s = String(row[i] ?? '').trim();
              if (s) nombre += (nombre ? ' ' : '') + s;
            }
            nombre = nombre.trim();
            if (!nombre || shouldSkipRow(nombre)) continue;

            if (ciIdx < 0 && dateIdx >= 0) {
              ciValue = `SC-${nombre.replace(/[^A-Za-z0-9]/g, '').substring(0,8).toUpperCase()}`;
              ciIdx = dateIdx - 1;
            }

            let fechaIngreso = new Date().toISOString().split('T')[0];
            for (let i = ciIdx + 1; i < row.length; i++) {
              const d = parseDate(row[i]);
              if (d) {
                fechaIngreso = d;
                break;
              }
            }

            // 2. Extraer salario de la semana activa o usar el fallback anterior
            let salario = 0;
            if (activeWeekColIdx !== -1 && activeWeekColIdx < row.length) {
              const cell = row[activeWeekColIdx];
              if (cell !== '' && cell !== null && cell !== undefined) {
                const n = normAmount(cell as string | number);
                if (!isNaN(n)) salario = n;
              }
            } else {
              // Fallback: último número
              for (let i = ciIdx + 2; i < row.length; i++) {
                const cell = row[i];
                if (cell === '' || cell === null || cell === undefined) continue;
                if (typeof cell === 'string' && /^[a-záéíóún]/i.test(cell.trim())) break;
                if (isAmount(cell)) {
                  const n = normAmount(cell as string | number);
                  if (n > 15 && !(n >= 1900 && n <= 2100)) { salario = n; }
                }
              }
            }

            if (salario <= 0) continue;

            const emp: EmpleadoParseado = {
              nombre_completo: nombre,
              cedula: ciValue,
              cargo: cleanSectionName(currentSection),
              area: currentArea,
              salario_semanal: salario,
              fecha_ingreso: fechaIngreso,
              _valid: true,
            };

            if (!emp.cedula) {
              emp._valid = false;
              emp._error = 'Sin cédula';
            }

            results.push(emp);
          }
        }

        resolve(results);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => reject(new Error('Error leyendo el archivo'));
    reader.readAsArrayBuffer(file);
  });
}

// ── SECCIÓN DE KEYWORDS PARA PDF ─────────────────────────────────────────────
const SECTION_PATTERNS_PDF = [
  /n[oó]mina\s+administrativ/i,
  /semanas?\s+mina/i,
  /semanas?\s+molinos/i,
  /administrativ[ao]s?\s+mina/i,
  /administrativ[ao]s?\s+molinos/i,
  /cocinera/i,
  /t[eé]cnico\s+operador/i,
  /transporte/i,
  /seguridad/i,
  /vertical\s+\d/i,
  /grupo\s*\(mixto\)/i,
];

const SKIP_LINES_PDF = [
  /^nombres?\s*$/i,
  /^c\.?i\.?\s*$/i,
  /^fecha\s+de\s+ingreso/i,
  /^semana\s+(libre|trabajada)/i,
  /^total\s+n[oó]minas?/i,
  /^bono\s+de/i,
  /^\*?nota/i,
  /^salen?\s+libre/i,
  /^total\s*$/i,
  /^acumulado/i,
  /^aportes?\s+socios/i,
  /^[\d\s,./]+$/,
];

const CI_REGEX_PDF = /\b(\d{1,2}\.\d{3}\.\d{3})\b/;

function isSectionHeaderPDF(line: string): boolean {
  if (/\d{2}\/\d{2}\/\d{4}/.test(line) || CI_REGEX_PDF.test(line)) return false;
  return SECTION_PATTERNS_PDF.some((p) => p.test(line.trim()));
}

function shouldSkipLinePDF(line: string): boolean {
  const t = line.trim();
  if (!t) return true;
  if (/\d{2}\/\d{2}\/\d{4}/.test(line) || CI_REGEX_PDF.test(line)) return false;
  return SKIP_LINES_PDF.some((p) => p.test(t));
}

function parseEmployeeLine(
  line: string,
  currentSection: string,
  sectionWeeks: string[],
  activeWeekIdxInPDF: number,
  semanaInicio?: string
): EmpleadoParseado | null {
  const ciMatch = line.match(CI_REGEX_PDF);
  const dateMatch = line.match(/\d{2}\/\d{2}\/\d{4}/);
  
  let ciRaw = '';
  let namePart = '';
  let afterCI = line;

  if (ciMatch) {
    ciRaw = ciMatch[0];
    const ciIdx = line.indexOf(ciRaw);
    namePart = line.substring(0, ciIdx).trim();
    afterCI = line.substring(ciIdx + ciRaw.length).trim();
  } else if (dateMatch) {
    const dateIdx = line.indexOf(dateMatch[0]);
    namePart = line.substring(0, dateIdx).trim();
    afterCI = line.substring(dateIdx).trim();
    ciRaw = `SC-${namePart.replace(/[^A-Za-z0-9]/g, '').substring(0,8).toUpperCase()}`;
  } else {
    return null;
  }

  const knownHeaders = [
    /^Semanas?\s+Mina\s+Belen\s*-\s*Cocinera\s*/i,
    /^Semanas?\s+Mina\s+Belen\s*-\s*Tecnico\s+Operador\s+Compresor\s*/i,
    /^Semanas?\s+Mina\s+Belen\s*-\s*Vertical\s+1PD\s*/i,
    /^Semanas?\s+Mina\s+Belen\s*-\s*Vertical\s+2\s*/i,
    /^N[oó]minas?\s+Administrativos?\s+Mina\s*/i,
    /^(N[oó]minas?|Semanas?)\s+Mina\s+Belen\s*-\s*/i
  ];

  for (const headerRegex of knownHeaders) {
    namePart = namePart.replace(headerRegex, '');
  }
  namePart = namePart.trim();

  SECTION_PATTERNS_PDF.forEach(p => {
    namePart = namePart.replace(p, '').trim();
  });

  if (!namePart || namePart.length < 2) return null;
  if (shouldSkipLinePDF(namePart)) return null;

  let fechaIngreso = new Date().toISOString().split('T')[0];
  let afterDate = afterCI;

  if (dateMatch) {
    const parts = dateMatch[0].split('/');
    fechaIngreso = `${parts[2]}-${parts[1]}-${parts[0]}`;
    if (afterCI.includes(dateMatch[0])) {
      afterDate = afterCI.substring(afterCI.indexOf(dateMatch[0]) + dateMatch[0].length);
    }
  }

  const tokens = afterDate.split(/\s+/).filter(Boolean);
  const numbers: number[] = [];
  for (const token of tokens) {
    if (/^[a-zá-úñ]{3,}/i.test(token)) break;
    const n = parseFloat(token.replace(/\./g, '').replace(',', '.'));
    if (!isNaN(n) && n > 15 && !(n >= 1900 && n <= 2100)) {
      numbers.push(n);
    }
  }

  let salario = 0;
  if (numbers.length > 0) {
    const lastNum = numbers[numbers.length - 1];
    const sumOthers = numbers.slice(0, -1).reduce((a, b) => a + b, 0);
    const isTotal = Math.abs(sumOthers - lastNum) < 0.05 && numbers.length > 1;
    const weeklyAmounts = isTotal ? numbers.slice(0, -1) : numbers;

    // APLICACIÓN DE ALINEACIÓN INTELIGENTE POR INGRESO
    if (activeWeekIdxInPDF !== -1 && sectionWeeks.length > 0 && weeklyAmounts.length > 0 && semanaInicio) {
      const activeWeeksForWorker: string[] = [];
      sectionWeeks.forEach(w => {
        if (w >= fechaIngreso) {
          activeWeeksForWorker.push(w);
        }
      });
      const idxInActive = activeWeeksForWorker.indexOf(semanaInicio);
      if (idxInActive !== -1 && idxInActive < weeklyAmounts.length) {
        salario = weeklyAmounts[idxInActive];
      } else {
        salario = 0;
      }
    } else {
      salario = weeklyAmounts[weeklyAmounts.length - 1] || 0;
    }
  }

  if (salario <= 0) return null;

  return {
    nombre_completo: namePart.replace(/\s+/g, ' ').trim(),
    cedula: ciRaw.replace(/\./g, ''),
    cargo: cleanSectionName(currentSection),
    area: inferArea(currentSection),
    salario_semanal: salario,
    fecha_ingreso: fechaIngreso,
    _valid: !!ciRaw,
    _error: !ciRaw ? 'Sin cédula' : undefined,
  };
}

// ── PARSER PRINCIPAL DE PDF (client-side con pdfjs-dist) ─────────────────────
export async function parsePdfNomina(file: File, semanaInicio?: string): Promise<EmpleadoParseado[]> {
  const pdfjsLib = await import('pdfjs-dist');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (pdfjsLib as any).GlobalWorkerOptions.workerSrc =
    `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = '';
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    type TextItem = { str: string; transform: number[] };
    const items = content.items as TextItem[];

    const lineMap = new Map<number, string[]>();
    for (const item of items) {
      if (!item.str?.trim()) continue;
      const y = Math.round(item.transform[5]);
      if (!lineMap.has(y)) lineMap.set(y, []);
      lineMap.get(y)!.push(item.str);
    }

    const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a);
    for (const y of sortedYs) {
      fullText += lineMap.get(y)!.join(' ') + '\n';
    }
  }

  const lines = fullText.split('\n');
  const results: EmpleadoParseado[] = [];
  let currentSection = 'Personal';

  let sectionWeeks: string[] = [];
  let activeWeekIdxInPDF = -1;
  let lastUnusedText = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || shouldSkipLinePDF(trimmed)) {
      lastUnusedText = '';
      continue;
    }
    
    // Detectar si la línea es de cabecera de columnas en el PDF
    const isColHeader = /nombres?/i.test(trimmed) && (/c\.?i\.?/i.test(trimmed) || /fecha\s+de\s+ingreso/i.test(trimmed));
    if (isColHeader) {
      sectionWeeks = [];
      activeWeekIdxInPDF = -1;
      if (semanaInicio) {
        const defaultYear = semanaInicio.split('-')[0];
        // Buscamos todas las fechas de inicio de semana
        const datePat = /del\s+(\d{1,2})\s+(?:de\s+)?([A-Za-záéíóúñ]+)/gi;
        const matches = [...trimmed.matchAll(datePat)];
        for (let i = 0; i < matches.length; i++) {
          const day = matches[i][1];
          const month = matches[i][2];
          const dateStr = parseSpanishDate(day, month, defaultYear);
          if (dateStr) {
            sectionWeeks.push(dateStr);
            if (dateStr === semanaInicio) {
              activeWeekIdxInPDF = sectionWeeks.length - 1;
            }
          }
        }
      }
      continue;
    }

    if (isSectionHeaderPDF(trimmed)) {
      currentSection = trimmed;
      sectionWeeks = [];
      activeWeekIdxInPDF = -1;
      lastUnusedText = '';
      continue;
    }

    let emp = parseEmployeeLine(trimmed, currentSection, sectionWeeks, activeWeekIdxInPDF, semanaInicio);

    if (!emp && lastUnusedText) {
      emp = parseEmployeeLine(`${lastUnusedText} ${trimmed}`, currentSection, sectionWeeks, activeWeekIdxInPDF, semanaInicio);
    }

    if (emp) {
      results.push(emp);
      lastUnusedText = '';
    } else {
      lastUnusedText = trimmed;
    }
  }

  const seen = new Map<string, EmpleadoParseado>();
  for (const emp of results) {
    const key = emp.cedula || `no-ci-${seen.size}`;
    seen.set(key, emp);
  }

  return Array.from(seen.values());
}

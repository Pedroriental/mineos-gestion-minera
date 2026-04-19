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
  
  // Como se ve en el PDF: Administrativos Molinos, Semanas Molinos- Grupo, etc.
  if (lower.includes('molino') || lower.includes('planta')) {
    return 'planta';
  }

  // De lo contrario (ej: Administrativo Mina, Cocinera Mina, Vertical, Compresor)
  // todo pertenece a Mina.
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
  // Remove thousand separators (dots), then replace comma with dot
  const cleaned = String(raw).replace(/\./g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

// ── Detectar si una celda es una C.I. venezolana ─────────────────────────────
// Formato: 7-9 dígitos (con o sin puntos como separadores)
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
  // Excel serial number
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
export function parseExcelNomina(file: File): Promise<EmpleadoParseado[]> {
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

          for (const rawRow of rows) {
            const row = rawRow as unknown[];
            if (!row || row.length === 0) continue;

            // Collect non-empty cells
            const nonEmpty = row.filter(
              (c) => c !== '' && c !== null && c !== undefined
            );
            if (nonEmpty.length < 2) continue;

            // First meaningful cell as text
            const firstCell = String(nonEmpty[0] ?? '').trim();

            // Skip obvious header / total rows
            if (shouldSkipRow(firstCell)) continue;

            // Check if section header
            if (isSectionHeader(firstCell)) {
              currentSection = firstCell;
              currentArea = inferArea(firstCell);
              continue;
            }

            // Look for a cedula OR a date in the row
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
              } else if (ciIdx < 0 && parseDate(s)) { // if we find a date before finding CI
                dateIdx = i;
              }
            }

            // Name = concatenation of text cells before CI or Date
            let nombre = '';
            const endIdx = ciIdx >= 0 ? ciIdx : dateIdx;
            if (endIdx < 0) continue; // Not an employee row

            for (let i = 0; i < endIdx; i++) {
              const s = String(row[i] ?? '').trim();
              if (s) nombre += (nombre ? ' ' : '') + s;
            }
            nombre = nombre.trim();
            if (!nombre || shouldSkipRow(nombre)) continue;

            if (ciIdx < 0 && dateIdx >= 0) {
              // Generar seudo-cédula basada en el nombre
              ciValue = `SC-${nombre.replace(/[^A-Za-z0-9]/g, '').substring(0,8).toUpperCase()}`;
              ciIdx = dateIdx - 1; // Para la lógica que sigue
            }

            // Date = first date-like cell after CI
            let fechaIngreso = new Date().toISOString().split('T')[0];
            for (let i = ciIdx + 1; i < row.length; i++) {
              const d = parseDate(row[i]);
              if (d) {
                fechaIngreso = d;
                break;
              }
            }

            // Salary = LAST number before any text cell ("salen libre").
            // Toma la columna "Total Nóminas" acumulada que es la que se paga.
            let salario = 0;
            for (let i = ciIdx + 2; i < row.length; i++) {
              const cell = row[i];
              if (cell === '' || cell === null || cell === undefined) continue;
              if (typeof cell === 'string' && /^[a-záéíóún]/i.test(cell.trim())) break;
              if (isAmount(cell)) {
                const n = normAmount(cell as string | number);
                if (n > 15 && !(n >= 1900 && n <= 2100)) { salario = n; } // keeps updating to the last one
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
  // Si contiene fecha o cédula, definitivamente es un empleado (pdfjs pegó el header a la misma línea)
  if (/\d{2}\/\d{2}\/\d{4}/.test(line) || CI_REGEX_PDF.test(line)) return false;
  return SECTION_PATTERNS_PDF.some((p) => p.test(line.trim()));
}

function shouldSkipLinePDF(line: string): boolean {
  const t = line.trim();
  if (!t) return true;
  // Mismo principio: si tiene fecha/cédula, no saltar (aunque el nombre ensucie el inicio)
  if (/\d{2}\/\d{2}\/\d{4}/.test(line) || CI_REGEX_PDF.test(line)) return false;
  return SKIP_LINES_PDF.some((p) => p.test(t));
}

function parseEmployeeLine(
  line: string,
  currentSection: string
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
    // Si no hay cédula, dividimos usando la fecha
    const dateIdx = line.indexOf(dateMatch[0]);
    namePart = line.substring(0, dateIdx).trim();
    afterCI = line.substring(dateIdx).trim(); // Incluye la fecha para que el parser de fecha lo agarre luego
    // Generar una seudo-cédula única basada en el nombre para BD
    ciRaw = `SC-${namePart.replace(/[^A-Za-z0-9]/g, '').substring(0,8).toUpperCase()}`;
  } else {
    return null; // Imposible procesar si no hay CI ni Fecha que delimite el nombre
  }

  // Limpiar namePart por si el PDF pegó el header en la misma línea (ej: "Semanas Mina Belen - Cocinera NURBELIS")
  const knownHeaders = [
    /^Semanas?\s+Mina\s+Belen\s*-\s*Cocinera\s*/i,
    /^Semanas?\s+Mina\s+Belen\s*-\s*Tecnico\s+Operador\s+Compresor\s*/i,
    /^Semanas?\s+Mina\s+Belen\s*-\s*Vertical\s+1PD\s*/i,
    /^Semanas?\s+Mina\s+Belen\s*-\s*Vertical\s+2\s*/i,
    /^N[oó]minas?\s+Administrativos?\s+Mina\s*/i,
    /^(N[oó]minas?|Semanas?)\s+Mina\s+Belen\s*-\s*/i // fallback general si cambia algo
  ];

  for (const headerRegex of knownHeaders) {
    namePart = namePart.replace(headerRegex, '');
  }
  namePart = namePart.trim();

  // Si quedó alguna basura obvia al inicio que sea idéntica a SECTION_PATTERNS sin nombre, quitarla
  SECTION_PATTERNS_PDF.forEach(p => {
    namePart = namePart.replace(p, '').trim();
  });

  if (!namePart || namePart.length < 2) return null;
  if (shouldSkipLinePDF(namePart)) return null;

  // Date
  let fechaIngreso = new Date().toISOString().split('T')[0];
  let afterDate = afterCI;

  if (dateMatch) {
    const parts = dateMatch[0].split('/');
    fechaIngreso = `${parts[2]}-${parts[1]}-${parts[0]}`;
    // Si afterCI incluye la fecha, cortamos a partir de ahí
    if (afterCI.includes(dateMatch[0])) {
      afterDate = afterCI.substring(afterCI.indexOf(dateMatch[0]) + dateMatch[0].length);
    }
  }

  const tokens = afterDate.split(/\s+/).filter(Boolean);
  let salario = 0;
  for (const token of tokens) {
    if (/^[a-zá-úñ]{3,}/i.test(token)) break; // stop at words like "libre"
    const n = parseFloat(token.replace(/\./g, '').replace(',', '.'));
    // Skip week counts (1,2...), years (2019...), row nums; take the LAST real wage (Total)
    if (!isNaN(n) && n > 15 && !(n >= 1900 && n <= 2100)) { salario = n; } // keeps updating
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
export async function parsePdfNomina(file: File): Promise<EmpleadoParseado[]> {
  // Dynamic import — no aumenta el bundle inicial
  const pdfjsLib = await import('pdfjs-dist');

  // Worker desde CDN para evitar problemas de build
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (pdfjsLib as any).GlobalWorkerOptions.workerSrc =
    `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = '';
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    // Rebuild lines grouping text items by their Y position
    type TextItem = { str: string; transform: number[] };
    const items = content.items as TextItem[];

    // Group by rounded Y coordinate to reconstruct table rows
    const lineMap = new Map<number, string[]>();
    for (const item of items) {
      if (!item.str?.trim()) continue;
      const y = Math.round(item.transform[5]);
      if (!lineMap.has(y)) lineMap.set(y, []);
      lineMap.get(y)!.push(item.str);
    }

    // Sort Y descending (top of page first) and join each line
    const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a);
    for (const y of sortedYs) {
      fullText += lineMap.get(y)!.join(' ') + '\n';
    }
  }

  // Parse extracted text line by line
  const lines = fullText.split('\n');
  const results: EmpleadoParseado[] = [];
  let currentSection = 'Personal';

  let lastUnusedText = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || shouldSkipLinePDF(trimmed)) {
      lastUnusedText = ''; // Reseteamos si hay basura vacía
      continue;
    }
    
    if (isSectionHeaderPDF(trimmed)) {
      currentSection = trimmed;
      lastUnusedText = ''; // Al cambiar de sección, la línea anterior no nos sirve
      continue;
    }

    // Try parsing the line itself
    let emp = parseEmployeeLine(trimmed, currentSection);

    // Si falló, quizás pdfjs cortó el nombre en una línea y la cédula en otra (por 1 píxel de diferencia en la coordenada Y)
    // Ejemplo de Yánez: 
    // "Yánez Luis" (Falla y queda guardado) -> "19.039.337 24/02/2026..." (Falla porque no tiene nombre, PERO se combina!)
    if (!emp && lastUnusedText) {
      emp = parseEmployeeLine(`${lastUnusedText} ${trimmed}`, currentSection);
    }

    if (emp) {
      results.push(emp);
      lastUnusedText = ''; // Consumido exitosamente
    } else {
      lastUnusedText = trimmed; // Lo guardamos por si la siguiente línea es la cédula que le falta
    }
  }

  // Deduplicate by cedula
  const seen = new Map<string, EmpleadoParseado>();
  for (const emp of results) {
    const key = emp.cedula || `no-ci-${seen.size}`;
    seen.set(key, emp);
  }

  return Array.from(seen.values());
}


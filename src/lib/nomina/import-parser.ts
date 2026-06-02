import * as XLSX from 'xlsx';
import { format, parseISO } from 'date-fns';
import { detectWeekRangeInCell, detectWeekRangeFromExcel } from '@/lib/parse-nomina-file';
import {
  cleanSectionName,
  inferAreaFromSection,
  resolveSectionMeta,
} from '@/lib/nomina/section-resolver';
import {
  getWeekEnd,
  inferColumnKind,
  listWeekStartsInRange,
  normalizePreviewRange,
  normalizeWeekStart,
} from '@/lib/nomina/week-utils';
import type {
  ParsedNominaPeriod,
  ParsedNominaSection,
  ParsedWeekColumn,
  ParsedWorkerCell,
  ParsedWorkerRow,
} from '@/lib/nomina/types';

const CI_WITH_DOTS = /^\d{1,2}\.\d{3}\.\d{3}$/;
const CI_PLAIN = /^\d{6,9}$/;
const DATE_REGEX = /^(\d{2})\/(\d{2})\/(\d{4})$/;

function toTitleCase(name: string): string {
  if (!name) return '';
  return name
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word) => {
      if (!word) return '';
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

import {
  inferAreaFromBanner,
  isNominaSectionHeaderLoose,
} from '@/lib/nomina/section-headers';

const SKIP_PATTERNS = [
  /^nombres?$/i,
  /^c\.?i\.?$/i,
  /^fecha/i,
  /^semana\s*$/i,
  /^semana\s+(libre|trabajada)\b/i,
  /^total\s+n[oó]minas?/i,
  /^total\s*$/i,
  /^acumulado/i,
  /^aportes/i,
  /^bono/i,
  /^nota/i,
  /^ingreso\s*$/i,
  /^trabajada\s*$/i,
];

function normCedula(raw: string | number): string {
  return String(raw).replace(/[^0-9]/g, '');
}

function normAmount(raw: string | number): number {
  if (typeof raw === 'number') {
    if (raw > 40000 && raw < 55000) return 0;
    return raw;
  }
  let s = String(raw).trim();
  if (!s) return 0;

  const numVal = Number(s);
  if (!isNaN(numVal) && numVal > 40000 && numVal < 55000) return 0;

  // Eliminar cualquier fecha de la cadena para evitar que interfiera con los montos (ej. "27/01/2026            125" -> "125")
  s = s.replace(/\b\d{1,2}[/-]\d{1,2}[/-]\d{4}\b/g, '').trim();
  if (!s) return 0;

  // Si tiene coma y punto (ej. 1.234,56 o 1,234.56)
  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
    } else {
      return parseFloat(s.replace(/,/g, '')) || 0;
    }
  }

  // Si solo tiene comas
  if (s.includes(',')) {
    const parts = s.split(',');
    if (parts.length === 2 && parts[1].length !== 3) {
      return parseFloat(s.replace(',', '.')) || 0;
    }
    return parseFloat(s.replace(/,/g, '')) || 0;
  }

  // Si solo tiene puntos
  if (s.includes('.')) {
    const parts = s.split('.');
    if (parts.length === 2 && parts[1].length <= 2) {
      return parseFloat(s) || 0;
    }
    return parseFloat(s.replace(/\./g, '')) || 0;
  }

  return parseFloat(s) || 0;
}

function isCedula(cell: unknown): boolean {
  const s = String(cell ?? '').trim();
  return CI_WITH_DOTS.test(s) || CI_PLAIN.test(s);
}

function parseDate(cell: unknown): string | null {
  if (!cell) return null;
  if (typeof cell === 'number' && cell > 40000 && cell < 55000) {
    const d = XLSX.SSF.parse_date_code(cell);
    if (d) {
      return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
    }
  }
  const s = String(cell).trim();
  const m = s.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

function isSectionHeader(firstText: string, rowText?: string): boolean {
  return isNominaSectionHeaderLoose(firstText, rowText);
}

function extractWeekColumnsFromHeaderLine(line: string, defaultYear: string): ParsedWeekColumn[] {
  const cols: ParsedWeekColumn[] = [];
  
  // Proactivamente verificar si la cabecera completa contiene múltiples semanas fusionadas
  const delAlCols = extractWeekColumnsFromDelAlBlock(line, defaultYear);
  if (delAlCols.length > 1) {
    return delAlCols;
  }

  const chunks = line.split(/\s{2,}|\t|\|/).map((s) => s.trim()).filter(Boolean);
  const candidates = chunks.length > 1 ? chunks : [line];
  for (let i = 0; i < candidates.length; i++) {
    const cellText = candidates[i];
    const range = detectWeekRangeInCell(cellText, defaultYear);
    if (!range.inicio) continue;
    const weekStart = normalizeWeekStart(range.inicio);
    cols.push({
      weekStart,
      weekEnd: range.fin || getWeekEnd(weekStart),
      colIndex: i,
      rawHeader: cellText,
      rawRange: range,
      header: cellText,
      columnKind: inferColumnKind(cellText),
    });
  }
  if (!cols.length) {
    const datePat =
      /(\d{1,2})\s+(?:de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/gi;
    let m: RegExpExecArray | null;
    let idx = 0;
    while ((m = datePat.exec(line.toLowerCase())) !== null) {
      const range = detectWeekRangeInCell(`${m[1]} ${m[2]}`, defaultYear);
      if (range.inicio) {
        const weekStart = normalizeWeekStart(range.inicio);
        cols.push({
          weekStart,
          weekEnd: range.fin || getWeekEnd(weekStart),
          colIndex: idx++,
          rawHeader: m[0],
          rawRange: range,
          header: m[0],
          columnKind: inferColumnKind(m[0]),
        });
      }
    }
  }
  const byWeek = new Map<string, ParsedWeekColumn>();
  for (const c of cols) {
    if (!byWeek.has(c.weekStart)) byWeek.set(c.weekStart, c);
  }
  return [...byWeek.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

const CI_REGEX_LINE = /\b(\d{1,2}\.\d{3}\.\d{3}|\d{6,9})\b/;
const WORKER_ANCHOR_RE =
  /([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ\s'.-]{1,80}?)\s+(\d{1,2}\.\d{3}\.\d{3}|\d{6,9})(?:\s+(\d{2}\/\d{2}\/\d{4}))?/g;
const STATUS_WORDS = /^(salen|libre|retirado|semana|trabajada|ingreso|usd)$/i;
const SPANISH_MONTH =
  '(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)';
const SPANISH_DATE_RE = new RegExp(`(\\d{1,2})\\s+(?:de\\s+)?${SPANISH_MONTH}`, 'gi');

function inferYearFromNominaLines(lines: string[]): string {
  for (const l of lines.slice(0, 40)) {
    const y = l.match(/\b(202\d)\b/);
    if (y) return y[1];
  }
  return new Date().getFullYear().toString();
}

function isDocumentBanner(text: string): boolean {
  const t = text.trim();
  if (/^nominas?$/i.test(t)) return true;
  if (/^molinos?\s+la\s+f[eé]\s*[-–]\s*mina\s+bel[eé]n$/i.test(t)) return true;
  if (/^semana\s+del\s+\d/i.test(t)) return true;
  return false;
}

function isSubtotalOnlyLine(text: string): boolean {
  const t = text.trim();
  if (new RegExp(WORKER_ANCHOR_RE.source).test(t)) return false;
  if (/(?:usd|\$|dolares|dólares)\s*\d+/i.test(t) && (CI_REGEX_LINE.test(t) || /trabajador/i.test(t))) return false;
  if (/^(el trabajador|nota|usd\s+\d)/i.test(t)) return true;
  const nums = t.match(/[\d]+[.,]\d{2}|\d{2,}/g);
  return !!nums && nums.length >= 2 && /^[\d.,\s]+$/.test(t.replace(/\s+/g, ''));
}

function extractWorkerChunksFromLine(line: string): string[] {
  const re = new RegExp(WORKER_ANCHOR_RE.source, 'g');
  const matches = [...line.matchAll(re)];
  if (matches.length <= 1) return [line];

  const chunks: string[] = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index ?? 0;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? line.length) : line.length;
    let chunk = line.slice(start, end).trim();
    if (i === 0 && start > 0) {
      const prefix = line.slice(0, start).trim();
      if (prefix && /[\d,]/.test(prefix)) chunk = `${prefix} ${chunk}`;
    }
    chunks.push(chunk);
  }
  return chunks;
}

function workerLineHasPayAmounts(line: string): boolean {
  const ciMatch = line.match(CI_REGEX_LINE);
  if (!ciMatch) return false;
  const after = line.slice(line.indexOf(ciMatch[0]) + ciMatch[0].length);
  const dateRemoved = after.replace(/\d{2}\/\d{2}\/\d{4}/, ' ');
  const tokens = dateRemoved.split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    if (STATUS_WORDS.test(token)) continue;
    const n = parseFloat(token.replace(/\./g, '').replace(',', '.'));
    if (!isNaN(n) && n >= 1 && !(n >= 1900 && n <= 2100)) return true;
  }
  return false;
}

function mergePdfContinuationLines(lines: string[]): string[] {
  const out: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (out.length) {
      const prev = out[out.length - 1];
      const prevHasWorker = CI_REGEX_LINE.test(prev);
      const prevMissingPay = prevHasWorker && !workerLineHasPayAmounts(prev);
      const prevMissingDate = prevHasWorker && !/\d{2}\/\d{2}\/\d{4}/.test(prev);
      const startsWithAmounts = /^[\d.,]+\s/.test(line);
      const startsWithDate = /^\d{2}\/\d{2}\/\d{4}/.test(line);

      if (prevMissingPay && (startsWithAmounts || isSubtotalOnlyLine(line) || CI_REGEX_LINE.test(line))) {
        out[out.length - 1] = `${prev} ${line}`;
        continue;
      }
      if (prevMissingDate && startsWithDate) {
        out[out.length - 1] = `${prev} ${line}`;
        continue;
      }
    }

    out.push(line);
  }
  return out;
}

/** Parte líneas con varios trabajadores y toma montos iniciales de la línea siguiente si faltan. */
function expandMultiWorkerPdfLines(lines: string[]): string[] {
  const mutable = lines.map((l) => l.trim()).filter(Boolean);
  const out: string[] = [];

  for (let i = 0; i < mutable.length; i++) {
    const line = mutable[i];
    const chunks = extractWorkerChunksFromLine(line);
    if (chunks.length <= 1) {
      out.push(line);
      continue;
    }

    for (const chunk of chunks) {
      let row = chunk;
      if (!workerLineHasPayAmounts(row) && i + 1 < mutable.length) {
        const next = mutable[i + 1];
        const lead = next.match(/^([\d.,]+(?:\s+[\d.,]+)*)\s+(?=[A-ZÁÉÍÓÚÑ])/);
        if (lead) {
          row = `${row} ${lead[1].trim()}`;
          mutable[i + 1] = next.slice(lead[0].length).trim();
        } else if (isSubtotalOnlyLine(next)) {
          row = `${row} ${next}`;
          mutable[i + 1] = '';
        }
      }
      out.push(row);
    }
  }

  return out;
}

function cleanWorkerNamePart(raw: string): string {
  let n = raw.replace(/^\d{2}\/\d{2}\/\d{4}\s+/, '').trim();
  n = n.replace(/^(?:salen\s+libre|retirado)\s+/i, '').trim();
  n = n.replace(/^(?:el\s+)?trabajador\s+/i, '').trim();
  n = n.replace(/\b(?:c\.?i\.?|c[ií]dula)\b.*$/i, '').trim();
  while (/^[\d.,]+\s+/.test(n)) {
    n = n.replace(/^[\d.,]+\s+/, '').trim();
  }
  return n.replace(/\s+/g, ' ').trim();
}

function extractDeclaredPdfTotal(lines: string[]): number | null {
  for (let i = 0; i < lines.length; i++) {
    if (!/total\s+n[oó]mina/i.test(lines[i])) continue;
    for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
      const n = normAmount(String(lines[j]).replace(/[^\d.,]/g, ''));
      if (n >= 500) return n;
    }
  }
  return null;
}

function isSummaryBannerLine(text: string): boolean {
  const t = text.trim();
  if (!/n[oó]mina/i.test(t)) return false;
  if (CI_REGEX_LINE.test(t)) return false;
  if (/^semanas?\s+/i.test(t)) return false;
  const amounts = t.match(/\d[\d.,]*\d/g);
  return !!amounts && amounts.length >= 2;
}

function isLikelySectionHeader(text: string): boolean {
  if (isSummaryBannerLine(text)) return false;
  const t = text.trim();
  if (/^(semanas\s+(mina|molinos)|n[oó]mina\s+administrativ)/i.test(t)) return true;
  return isNominaSectionHeaderLoose(text);
}

function dedupeWeekCols(cols: ParsedWeekColumn[]): ParsedWeekColumn[] {
  const byWeek = new Map<string, ParsedWeekColumn>();
  for (const c of cols) {
    if (!byWeek.has(c.weekStart)) byWeek.set(c.weekStart, c);
  }
  return [...byWeek.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

function extractWeekColumnsFromDelAlBlock(
  text: string,
  defaultYear: string,
): ParsedWeekColumn[] {
  const year = text.match(/\b(202\d)\b/)?.[1] || defaultYear;
  const lower = text.toLowerCase();
  const alIdx = lower.search(/\bal\b/);

  if (alIdx > 0) {
    const delPart = text.slice(0, alIdx);
    const alPart = text.slice(alIdx);
    const starts = [...delPart.matchAll(SPANISH_DATE_RE)];
    const ends = [...alPart.matchAll(SPANISH_DATE_RE)];
    if (starts.length && ends.length) {
      const cols: ParsedWeekColumn[] = [];
      const count = Math.max(starts.length, ends.length);
      for (let i = 0; i < count; i++) {
        const s = starts[i] ?? starts[starts.length - 1];
        const e = ends[i] ?? ends[ends.length - 1];
        const range = detectWeekRangeInCell(`${s[1]} ${s[2]} ${year} al ${e[1]} ${e[2]} ${year}`, year);
        if (!range.inicio) continue;
        const weekStart = normalizeWeekStart(range.inicio);
        cols.push({
          weekStart,
          weekEnd: range.fin || getWeekEnd(weekStart),
          colIndex: i,
          rawHeader: `${s[0]} al ${e[0]}`,
          rawRange: range,
          header: `${s[0]} al ${e[0]}`,
          columnKind: inferColumnKind(text),
        });
      }
      return dedupeWeekCols(cols);
    }
  }

  const range = detectWeekRangeInCell(text, year);
  if (!range.inicio) return [];
  const weekStart = normalizeWeekStart(range.inicio);
  return [
    {
      weekStart,
      weekEnd: range.fin || getWeekEnd(weekStart),
      colIndex: 0,
      rawHeader: text,
      rawRange: range,
      header: text,
      columnKind: inferColumnKind(text),
    },
  ];
}

/** Une líneas partidas típicas de PDF (nombre/CI, Del/al, encabezados). */
export function preprocessNominaPdfLines(lines: string[]): string[] {
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) {
      i++;
      continue;
    }

    if (/^t\s*o\s*t\s*a\s*l$/i.test(line.replace(/\s+/g, ''))) {
      i++;
      continue;
    }
    if (/^\(usd\)$/i.test(line)) {
      i++;
      continue;
    }

    if (/^del\s+\d/i.test(line)) {
      let block = line;
      if (i + 1 < lines.length && /^al\s+\d/i.test(lines[i + 1].trim())) {
        block += ` ${lines[i + 1].trim()}`;
        i++;
      }
      out.push(block);
      i++;
      continue;
    }

    if (!CI_REGEX_LINE.test(line) && i + 1 < lines.length) {
      const next = lines[i + 1].trim();
      const looksLikeName =
        line.length >= 2 &&
        !/^(semana|n[oó]mina|total|del\s|al\s|ingreso|nombres)/i.test(line) &&
        !isNominaSectionHeaderLoose(line);
      
      const hasDate = /\d{2}\/\d{2}\/\d{4}/.test(line);
      const numTokens = line.split(/\s+/).filter(t => /^[\d.,]+$/.test(t) && !/^\d{4}$/.test(t));
      const isCompleteRow = hasDate || numTokens.length >= 1;

      if (looksLikeName && CI_REGEX_LINE.test(next) && !isCompleteRow) {
        out.push(`${line} ${next}`);
        i += 2;
        continue;
      }
    }

    if (/nombres/i.test(line) && /c\.?i\.?/i.test(line)) {
      let block = line;
      let j = i + 1;
      while (j < lines.length && j < i + 10) {
        const n = lines[j].trim();
        if (CI_REGEX_LINE.test(n) && /\d{2}\/\d{2}\/\d{4}/.test(n)) break;
        if (/^[A-ZÁÉÍÓÚÑ][a-záéíóúñA-ZÁÉÍÓÚÑ\s'.-]+$/.test(n) && n.length > 3 && !/n[oó]mina|semana/i.test(n)) {
          break;
        }
        if (/^(semanas?\s+(mina|molino)|n[oó]mina\s+administrativ)/i.test(n) && j > i + 1) break;
        block += ` ${n}`;
        j++;
        if (/al\s+\d/i.test(n)) break;
      }
      out.push(block);
      i = j;
      continue;
    }

    out.push(line);
    i++;
  }

  return expandMultiWorkerPdfLines(mergePdfContinuationLines(out));
}

/** Alias explícito para pipeline PDF (preprocess + multi-trabajador). */
export function postprocessNominaPdfLines(lines: string[]): string[] {
  return expandMultiWorkerPdfLines(mergePdfContinuationLines(lines));
}

function parseWorkerLineFromText(line: string, weekColumns: ParsedWeekColumn[]): ParsedWorkerRow | null {
  const ciMatch = line.match(CI_REGEX_LINE);
  const dateMatch = line.match(/\d{2}\/\d{2}\/\d{4}/);
  if (!ciMatch && !dateMatch) return null;

  let ciValue = '';
  let namePart = '';
  let afterCI = line;

  if (ciMatch) {
    ciValue = ciMatch[0].replace(/\./g, '');
    const ciIdx = line.indexOf(ciMatch[0]);
    namePart = line.substring(0, ciIdx).trim();
    afterCI = line.substring(ciIdx + ciMatch[0].length).trim();
    namePart = namePart.replace(/^\d{2}\/\d{2}\/\d{4}\s+/, '').trim();
  } else if (dateMatch) {
    const dateIdx = line.indexOf(dateMatch[0]);
    namePart = line.substring(0, dateIdx).trim();
    afterCI = line.substring(dateIdx).trim();
    ciValue = `SC-${namePart.replace(/[^A-Za-z0-9]/g, '').substring(0, 8).toUpperCase()}`;
  }

  namePart = cleanWorkerNamePart(namePart);
  if (!namePart || namePart.length < 2 || shouldSkipRow(namePart)) return null;

  let fechaIngreso = new Date().toISOString().split('T')[0];
  const hasExplicitDate = !!dateMatch;
  if (dateMatch) {
    const parts = dateMatch[0].split('/');
    fechaIngreso = `${parts[2]}-${parts[1]}-${parts[0]}`;
  } else if (weekColumns[0]?.weekStart) {
    fechaIngreso = weekColumns[0].weekStart;
  }

  const tokens = afterCI.replace(/\d{2}\/\d{2}\/\d{4}/, ' ').split(/\s+/).filter(Boolean);
  const numbers: number[] = [];
  for (const token of tokens) {
    if (STATUS_WORDS.test(token)) continue;
    if (/^[\d.,]+$/.test(token)) {
      const n = parseFloat(token.replace(/\./g, '').replace(',', '.'));
      if (!isNaN(n) && n >= 0 && !(n >= 1900 && n <= 2100)) numbers.push(n);
      continue;
    }
    if (/^[a-zá-úñ]{3,}/i.test(token)) break;
  }

  let weeklyAmounts = numbers;
  if (!numbers.length) {
    weeklyAmounts = weekColumns.map(() => 0);
  } else {
    if (
      numbers.length === 2 &&
      Math.abs(numbers[0] - numbers[1]) < 0.01
    ) {
      numbers.splice(1, 1);
    }

    if (numbers.length > weekColumns.length) {
      if (weekColumns.length === 1) {
        weeklyAmounts = [numbers[numbers.length - 1] ?? 0];
      } else if (numbers.length === weekColumns.length + 1) {
        weeklyAmounts = numbers.slice(0, -1);
      } else {
        weeklyAmounts = numbers.slice(0, weekColumns.length);
      }
    } else if (numbers.length === 1 && weekColumns.length > 1) {
      weeklyAmounts = weekColumns.map((_, i) => (i === 0 ? numbers[0] : 0));
    }
  }

  const weeks: Record<string, ParsedWorkerCell> = {};
  let total = 0;
  for (let i = 0; i < weekColumns.length; i++) {
    const col = weekColumns[i];
    const amount = weeklyAmounts[i] ?? 0;
    
    // Determinar estado inteligentemente según palabras clave en la línea
    let estado: 'libre' | 'no_laborado' | undefined = undefined;
    const lowerLine = line.toLowerCase();
    if (lowerLine.includes('retirado') || lowerLine.includes('despedido') || lowerLine.includes('inactivo')) {
      estado = 'no_laborado';
    } else if (lowerLine.includes('libre') || lowerLine.includes('salen') || lowerLine.includes('reposo')) {
      estado = 'libre';
    } else if (amount <= 0) {
      estado = 'no_laborado';
    }

    if (hasExplicitDate && fechaIngreso > col.weekEnd) {
      weeks[col.weekStart] = { amount: 0, estado: 'no_laborado' };
      continue;
    }
    weeks[col.weekStart] = { amount, estado };
    total += amount;
  }

  if (total <= 0 && !ciMatch && !hasExplicitDate) return null;

  return {
    nombre_completo: toTitleCase(namePart),
    cedula: ciValue,
    cargo: '',
    area: 'mina',
    fecha_ingreso: fechaIngreso,
    weeks,
    total: parseFloat(total.toFixed(2)),
    _valid: ciValue.length >= 6,
    _error: ciValue.length >= 6 ? undefined : 'Sin cédula',
  };
}

export function parseNominaMatrixFromTextLines(
  lines: string[],
  sourceFileName?: string,
): ParsedNominaPeriod {
  const sections: ParsedNominaSection[] = [];
  let currentSectionRaw = 'Personal';
  let currentArea = inferAreaFromSection(currentSectionRaw);
  let weekColumns: ParsedWeekColumn[] = [];
  let globalWeekColumns: ParsedWeekColumn[] = [];
  let sectionRows: ParsedWorkerRow[] = [];
  const defaultYear = inferYearFromNominaLines(lines);
  const declaredTotal = extractDeclaredPdfTotal(lines);

  const rememberWeekColumns = (cols: ParsedWeekColumn[]) => {
    if (!cols.length) return;
    weekColumns = cols;
    if (cols.length >= globalWeekColumns.length) globalWeekColumns = cols;
  };

  const flushSection = () => {
    if (!sectionRows.length) return;
    const colsForSection = weekColumns.length ? weekColumns : globalWeekColumns;
    const cargo = cleanSectionName(currentSectionRaw);
    const meta = resolveSectionMeta(currentArea, cargo);
    const sectionTotal = parseFloat(sectionRows.reduce((s, r) => s + r.total, 0).toFixed(2));
    sections.push({
      id: meta.id,
      rawTitle: currentSectionRaw,
      title: meta.title,
      subtitle: meta.subtitle,
      area: currentArea,
      cargo,
      areaDetalle: meta.areaDetalle,
      weekColumns: [...colsForSection],
      rows: sectionRows,
      sectionTotal,
    });
    sectionRows = [];
  };

  for (let idx = 0; idx < lines.length; idx++) {
    const rawLine = lines[idx];
    const trimmed = rawLine.trim();
    if (!trimmed || isDocumentBanner(trimmed) || isSubtotalOnlyLine(trimmed)) {
      continue;
    }
    if (shouldSkipRow(trimmed) && !isLikelySectionHeader(trimmed)) {
      continue;
    }

    const isColHeader =
      /nombres?/i.test(trimmed) &&
      (/c\.?i\.?/i.test(trimmed) || /fecha\s+de\s+ingreso/i.test(trimmed));

    if (isColHeader) {
      let headerBlock = trimmed;
      if (idx + 1 < lines.length && /^del\s+\d/i.test(lines[idx + 1].trim())) {
        headerBlock += ` ${lines[idx + 1].trim()}`;
        idx++;
        if (idx + 1 < lines.length && /^al\s+\d/i.test(lines[idx + 1].trim())) {
          headerBlock += ` ${lines[idx + 1].trim()}`;
          idx++;
        }
      }
      const cols = extractWeekColumnsFromHeaderLine(headerBlock, defaultYear);
      if (cols.length) rememberWeekColumns(cols);
      else {
        const fromDel = extractWeekColumnsFromDelAlBlock(headerBlock, defaultYear);
        if (fromDel.length) rememberWeekColumns(fromDel);
      }
      continue;
    }

    if (/^del\s+\d/i.test(trimmed)) {
      let block = trimmed;
      if (idx + 1 < lines.length && /^al\s+\d/i.test(lines[idx + 1].trim())) {
        block += ` ${lines[idx + 1].trim()}`;
        idx++;
      }
      const cols = extractWeekColumnsFromDelAlBlock(block, defaultYear);
      if (cols.length) rememberWeekColumns(cols);
      continue;
    }

    const bannerArea = inferAreaFromBanner(trimmed);
    if (bannerArea && isLikelySectionHeader(trimmed) && !isDocumentBanner(trimmed)) {
      flushSection();
      currentSectionRaw = trimmed;
      currentArea = bannerArea;
      continue;
    }

    if (isLikelySectionHeader(trimmed)) {
      flushSection();
      currentSectionRaw = trimmed;
      currentArea = inferAreaFromSection(trimmed);
      continue;
    }

    const activeWeekColumns = weekColumns.length ? weekColumns : globalWeekColumns;
    if (!activeWeekColumns.length) continue;

    const noteWorker = parseWorkerNoteRowUnified(trimmed, activeWeekColumns, idx);
    if (noteWorker) {
      flushSection();
      noteWorker.area = currentArea;
      noteWorker.cargo = "Novedades Especiales";
      const prevSectionRaw = currentSectionRaw;
      currentSectionRaw = "Novedades Especiales";
      sectionRows.push(noteWorker);
      flushSection();
      currentSectionRaw = prevSectionRaw;
      continue;
    }

    for (const chunk of extractWorkerChunksFromLine(trimmed)) {
      const worker = parseWorkerLineFromText(chunk, activeWeekColumns);
      if (!worker) continue;
      worker.area = currentArea;
      worker.cargo = cleanSectionName(currentSectionRaw);
      sectionRows.push(worker);
    }
  }

  flushSection();
  const period = finalizePeriod(sections, 'pdf', sourceFileName);
  if (declaredTotal != null) {
    period.stats.declaredSourceTotal = declaredTotal;
    if (Math.abs(period.grandTotal - declaredTotal) > 1) {
      period.stats.warnings.push(
        `Total detectado en archivo: $${declaredTotal.toLocaleString('es', { minimumFractionDigits: 2 })}; extraído: $${period.grandTotal.toLocaleString('es', { minimumFractionDigits: 2 })}.`,
      );
    }
  }
  return period;
}

function shouldSkipRow(text: string): boolean {
  return SKIP_PATTERNS.some((p) => p.test(text.trim()));
}

function isExcelDocumentBannerRow(firstCell: string, rowText: string): boolean {
  const t = firstCell.trim();
  if (isDocumentBanner(t)) return true;
  if (/molinos?\s+la\s+f[eé][\s\S]*mina\s+bel[eé]n/i.test(rowText) && !/semanas/i.test(rowText)) {
    return rowText.match(/\d[\d.,]{2,}/g)?.length !== undefined;
  }
  return false;
}

function inferYearFromExcelRows(rows: unknown[][]): string {
  const lines = rows.slice(0, 30).map((row) =>
    (row as unknown[]).map((c) => String(c ?? '')).join(' '),
  );
  return inferYearFromNominaLines(lines);
}

function isExcelSummaryTotalRow(firstCell: string, row: unknown[]): boolean {
  const t = firstCell.trim();
  if (/^total\s+n[oó]mina/i.test(t)) return true;
  if (/^n[oó]minas?\s+mina\s+bel[eé]n/i.test(t) && !/semanas/i.test(t)) {
    return row.some((c) => typeof c === 'number' && c >= 100);
  }
  if (/^n[oó]mina\s+(administrativo|molinos)/i.test(t) && !/semanas|administrativos/i.test(t)) {
    return row.some((c) => typeof c === 'number' && c >= 50);
  }
  return false;
}

function extractWeekColumnsFromHeaderRow(row: unknown[], defaultYear: string): ParsedWeekColumn[] {
  const cols: ParsedWeekColumn[] = [];
  for (let i = 0; i < row.length; i++) {
    const cellText = String(row[i] ?? '')
      .trim()
      .replace(/\s+/g, ' ');
    if (!cellText) continue;
    if (
      !/(del\s+\d|\/\d{2}\/|\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b)/i.test(
        cellText,
      )
    ) {
      continue;
    }

    const delCols = extractWeekColumnsFromDelAlBlock(cellText, defaultYear);
    if (delCols.length === 1) {
      cols.push({ ...delCols[0], colIndex: i });
      continue;
    }

    const range = detectWeekRangeInCell(cellText, defaultYear);
    if (!range.inicio) continue;
    const weekStart = normalizeWeekStart(range.inicio);
    cols.push({
      weekStart,
      weekEnd: range.fin || getWeekEnd(weekStart),
      colIndex: i,
      rawHeader: cellText,
      rawRange: range,
      header: cellText,
      columnKind: inferColumnKind(cellText),
    });
  }
  return dedupeWeekCols(cols);
}

function extractWeekColumnsFromExcelContext(
  rows: unknown[][],
  rowIndex: number,
  defaultYear: string,
): ParsedWeekColumn[] {
  for (let offset = 0; offset <= 2; offset++) {
    const row = rows[rowIndex + offset] as unknown[] | undefined;
    if (!row) break;
    const cols = extractWeekColumnsFromHeaderRow(row, defaultYear);
    if (cols.length) return cols;
  }
  return [];
}

function isExcelWeekSubHeaderRow(rowText: string): boolean {
  return (
    /del\s+\d/i.test(rowText) &&
    (/\bal\b/i.test(rowText) || /\d{1,2}\/\d{1,2}/.test(rowText)) &&
    !/nombres?/i.test(rowText)
  );
}

function readWorkerWeekAmounts(
  row: unknown[],
  sortedCols: ParsedWeekColumn[],
  scanStart: number,
): number[] {
  const byCol = sortedCols.map((col, idx) => {
    let raw = row[col.colIndex];
    if (raw === '' || raw === null || raw === undefined) {
      const left = row[col.colIndex - 1];
      if (left !== '' && left !== null && left !== undefined && !isCedula(left)) {
        const leftStr = String(left);
        const isNumericDate = typeof left === 'number' && left > 40000 && left < 55000;
        const leftWithoutDate = leftStr.replace(/\b\d{1,2}[/-]\d{1,2}[/-]\d{4}\b/g, '').trim();
        const isPureDate = isNumericDate || (parseDate(left) && !/\d+/.test(leftWithoutDate));
        if (!isPureDate) {
          const leftAmount = normAmount(String(left));
          const sumPrior = parseFloat(
            sortedCols
              .slice(0, idx)
              .reduce((sum, prevCol) => {
                const prevRaw = row[prevCol.colIndex];
                return sum + (prevRaw === '' || prevRaw == null ? 0 : normAmount(String(prevRaw)));
              }, 0)
              .toFixed(2),
          );
          if (!(sumPrior > 0 && Math.abs(leftAmount - sumPrior) < 0.02)) {
            raw = left;
          }
        }
      }
    }
    if (raw === '' || raw === null || raw === undefined) return 0;
    return normAmount(String(raw));
  });

  if (byCol.some((amount) => amount > 0)) {
    return byCol;
  }

  return extractWorkerAmountsForWeeks(row, scanStart, sortedCols.length);
}

function extractWorkerAmountsForWeeks(
  row: unknown[],
  scanStart: number,
  weekCount: number,
): number[] {
  const numericAmounts: number[] = [];
  for (let i = scanStart; i < row.length; i++) {
    const raw = row[i];
    if (raw === '' || raw === null || raw === undefined) continue;
    const s = String(raw).trim();
    if (isCedula(s) || parseDate(raw)) break;
    if (/^total/i.test(s)) break;
    if (/^el trabajador/i.test(s)) break;
    numericAmounts.push(normAmount(String(raw)));
  }

  if (weekCount <= 0) return numericAmounts;

  if (numericAmounts.length === weekCount + 1) {
    const weekPart = numericAmounts.slice(0, weekCount);
    const maybeTotal = numericAmounts[numericAmounts.length - 1];
    const sumWeek = parseFloat(weekPart.reduce((a, b) => a + b, 0).toFixed(2));
    if (Math.abs(maybeTotal - sumWeek) < 0.02) return weekPart;
  }

  if (numericAmounts.length > weekCount) {
    const weekPart = numericAmounts.slice(0, weekCount);
    const maybeTotal = numericAmounts[numericAmounts.length - 1];
    const sumWeek = parseFloat(weekPart.reduce((a, b) => a + b, 0).toFixed(2));
    if (Math.abs(maybeTotal - sumWeek) < 0.02) return weekPart;
    return numericAmounts.slice(-weekCount);
  }

  if (numericAmounts.length >= 2 && numericAmounts.length <= weekCount) {
    const maybeTotal = numericAmounts[numericAmounts.length - 1];
    const rest = numericAmounts.slice(0, -1);
    const sumRest = parseFloat(rest.reduce((a, b) => a + b, 0).toFixed(2));
    if (Math.abs(maybeTotal - sumRest) < 0.02 && rest.length > 0) return rest;
  }

  return numericAmounts;
}

export function parseWorkerNoteRowUnified(
  rowText: string,
  weekColumns: ParsedWeekColumn[],
  rowIndex: number
): ParsedWorkerRow | null {
  const cleanText = rowText.trim();
  
  // 1. Detectar si contiene palabras clave de novedad o "trabajador"
  const isNovelty = /trabajador|accidente|se\s+paga|enviado\s+a|reposo|vacaciones|m[eé]dico|operaci[oó]n|bono|pago/i.test(cleanText);
  if (!isNovelty) return null;

  // 2. Extraer Cédula de Identidad (C.I.)
  const cedulaMatch = cleanText.match(/\b(\d{6,9})\b/);
  const cedula = cedulaMatch ? cedulaMatch[1].replace(/\./g, '') : '';
  if (cedula.length < 6) return null;

  // 3. Extraer Nombre del Trabajador
  let nombre = '';
  const nameMatch = cleanText.match(/(?:el\s+)?trabajador\s+([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑa-záéíóúñ\s'.-]{2,50})/i) ||
                    cleanText.match(/^([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑa-záéíóúñ\s'.-]{2,50})\s+\d{6,9}/);
  if (nameMatch) {
    nombre = nameMatch[1].replace(/\s+/g, ' ').trim();
  } else {
    const beforeCedula = cleanText.split(cedulaMatch![0])[0].trim();
    const caps = beforeCedula.match(/[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑa-záéíóúñ']+/g);
    if (caps && caps.length >= 2) {
      nombre = caps.join(' ');
    }
  }

  if (!nombre) {
    nombre = 'Trabajador Nota';
  }

  nombre = cleanWorkerNamePart(nombre);

  // 4. Extraer el monto de pago (USD o $)
  let amount = 0;
  const usdMatch = cleanText.match(/(?:usd|\$|dolares|dólares)\s*(\d+(?:[.,]\d{1,2})?)\b/i) || 
                   cleanText.match(/\b(\d+(?:[.,]\d{1,2})?)\s*(?:usd|\$|dolares|dólares)\b/i);
  if (usdMatch) {
    amount = parseFloat(usdMatch[1].replace(',', '.'));
  } else {
    const amountMatches = [...cleanText.matchAll(/\b(\d{2,4}(?:[.,]\d{1,2})?)\b/g)]
      .map((m) => normAmount(m[1]))
      .filter((n) => n >= 20 && n <= 5000);
    amount = amountMatches.length ? amountMatches[amountMatches.length - 1] : 0;
  }

  if (amount <= 0) return null;

  // 5. Asignar el monto a las semanas activas
  const sortedCols = [...weekColumns].sort((a, b) => a.colIndex - b.colIndex);
  const targetWeek = sortedCols[sortedCols.length - 1] ?? weekColumns[weekColumns.length - 1];
  if (!targetWeek) return null;

  const weeks: Record<string, ParsedWorkerCell> = {};
  for (const col of sortedCols) {
    const isTarget = col.weekStart === targetWeek.weekStart;
    weeks[col.weekStart] = {
      amount: isTarget ? amount : 0,
      rawValue: isTarget ? amount : 0,
      estado: isTarget ? undefined : 'no_laborado',
      _warnings: [cleanText] // Almacenar el texto completo de la novedad para visibilidad en UI
    };
  }

  return {
    nombre_completo: toTitleCase(nombre),
    cedula,
    cargo: '',
    area: 'mina',
    fecha_ingreso: targetWeek.weekStart,
    weeks,
    total: amount,
    sourceRowIndex: rowIndex,
    _valid: true,
  };
}

function parseWorkerRow(
  row: unknown[],
  weekColumns: ParsedWeekColumn[],
  rowIndex: number,
): ParsedWorkerRow | null {
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

  let firstNumIdx = -1;
  for (let i = 1; i < row.length; i++) {
    const val = row[i];
    if (val != null && val !== '') {
      const sVal = String(val).trim();
      const n = typeof val === 'number' ? val : parseFloat(sVal.replace(/\./g, '').replace(',', '.'));
      const isDate = parseDate(val) || /^\b202\d\b$/.test(sVal);
      if (!isNaN(n) && n >= 0 && !isDate) {
        firstNumIdx = i;
        break;
      }
    }
  }

  let nombre = '';
  const endIdx = ciIdx >= 0 ? ciIdx : (dateIdx >= 0 ? dateIdx : firstNumIdx);
  if (endIdx < 0) return null;

  for (let i = 0; i < endIdx; i++) {
    const s = String(row[i] ?? '').trim();
    if (s) nombre += (nombre ? ' ' : '') + s;
  }
  nombre = nombre.trim();
  if (!nombre || shouldSkipRow(nombre)) return null;

  nombre = toTitleCase(nombre);

  if (ciIdx < 0) {
    ciValue = `SC-${nombre.replace(/[^A-Za-z0-9]/g, '').substring(0, 8).toUpperCase()}`;
  }

  const sortedCols = [...weekColumns].sort((a, b) => a.colIndex - b.colIndex);
  let fechaIngreso = sortedCols[0]?.weekStart ?? '2020-01-01';
  if (dateIdx >= 0) {
    const d = parseDate(row[dateIdx]);
    if (d) fechaIngreso = d;
  }
  for (let i = Math.max(ciIdx, dateIdx) + 1; i < row.length; i++) {
    const d = parseDate(row[i]);
    if (d) {
      fechaIngreso = d;
      break;
    }
  }

  let scanStart = Math.max(ciIdx, dateIdx) + 1;
  while (scanStart < row.length && parseDate(row[scanStart])) scanStart++;

  const amountValues = readWorkerWeekAmounts(row, sortedCols, scanStart);

  const weeks: Record<string, ParsedWorkerCell> = {};
  let total = 0;
  for (let k = 0; k < sortedCols.length; k++) {
    const col = sortedCols[k];
    const amount = amountValues[k] ?? 0;
    if (fechaIngreso > col.weekEnd) {
      weeks[col.weekStart] = { amount: 0, rawValue: amount, estado: 'no_laborado' };
      continue;
    }
    weeks[col.weekStart] = {
      amount,
      rawValue: amount,
      estado: amount <= 0 ? 'no_laborado' : undefined,
    };
    total += amount;
  }

  if (total <= 0 && !Object.values(weeks).some((c) => c.rawValue !== '' && c.rawValue != null)) {
    return null;
  }

  // Escanear observaciones escritas en celdas posteriores a las columnas de semanas (ej: 'reposo', 'retirado')
  let rowObservation = '';
  const lastWeekColIdx = sortedCols[sortedCols.length - 1]?.colIndex ?? -1;
  if (lastWeekColIdx >= 0) {
    for (let i = lastWeekColIdx + 1; i < row.length; i++) {
      const cell = row[i];
      if (cell != null && cell !== '') {
        const s = String(cell).trim();
        if (s) {
          const n = parseFloat(s.replace(/\./g, '').replace(',', '.'));
          const isNum = !isNaN(n);
          const isDt = parseDate(s);
          if (!isNum && !isDt && s.length > 0) {
            rowObservation = s;
            break;
          }
        }
      }
    }
  }

  return {
    nombre_completo: nombre,
    cedula: ciValue,
    cargo: '',
    area: 'mina',
    fecha_ingreso: fechaIngreso,
    weeks,
    total: parseFloat(total.toFixed(2)),
    sourceRowIndex: rowIndex,
    _valid: ciValue.length >= 6,
    _error: ciValue.length >= 6 ? undefined : 'Sin cédula',
    observaciones: rowObservation || undefined,
  };
}

function finalizePeriod(
  sections: ParsedNominaSection[],
  source: 'excel' | 'pdf',
  sourceFileName?: string,
  sheetName?: string,
): ParsedNominaPeriod {
  const allWeekCols = new Map<string, ParsedWeekColumn>();
  for (const s of sections) {
    for (const c of s.weekColumns) allWeekCols.set(c.weekStart, c);
  }
  const weekColumns = [...allWeekCols.values()].sort((a, b) =>
    a.weekStart.localeCompare(b.weekStart),
  );
  const rangeStart = weekColumns[0]?.weekStart ?? new Date().toISOString().split('T')[0];
  const rangeEnd = weekColumns[weekColumns.length - 1]?.weekEnd ?? rangeStart;
  const { start, end } = normalizePreviewRange(rangeStart, rangeEnd);

  const flatCells: ParsedNominaPeriod['flatCells'] = [];
  let cellCount = 0;
  const workerSet = new Set<string>();

  for (const section of sections) {
    for (const worker of section.rows) {
      workerSet.add(worker.cedula);
      for (const [weekStart, cell] of Object.entries(worker.weeks)) {
        flatCells.push({ sectionId: section.id, weekStart, worker, cell });
        cellCount += 1;
      }
    }
  }

  const grandTotal = parseFloat(
    sections.reduce((s, sec) => s + sec.sectionTotal, 0).toFixed(2),
  );

  return {
    source,
    sourceFileName,
    sheetName,
    rangeStart: start,
    rangeEnd: end,
    weekColumns,
    sections,
    flatCells,
    stats: {
      workerCount: workerSet.size,
      cellCount,
      skippedRows: 0,
      warnings: [],
    },
    grandTotal,
  };
}

export function parseExcelNominaMatrix(
  workbook: XLSX.WorkBook,
  sourceFileName?: string,
): ParsedNominaPeriod {
  const sections: ParsedNominaSection[] = [];
  const warnings: string[] = [];
  let declaredSourceTotal: number | null = null;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
    const defaultYear = inferYearFromExcelRows(rows as unknown[][]);

    let currentSectionRaw = 'Personal';
    let currentArea = inferAreaFromSection(currentSectionRaw);
    let weekColumns: ParsedWeekColumn[] = [];
    let sectionRows: ParsedWorkerRow[] = [];

    const flushSection = () => {
      if (!sectionRows.length) return;
      const cargo = cleanSectionName(currentSectionRaw);
      const meta = resolveSectionMeta(currentArea, cargo);
      const sectionTotal = parseFloat(
        sectionRows.reduce((s, r) => s + r.total, 0).toFixed(2),
      );
      sections.push({
        id: meta.id,
        rawTitle: currentSectionRaw,
        title: meta.title,
        subtitle: meta.subtitle,
        area: currentArea,
        cargo,
        areaDetalle: meta.areaDetalle,
        weekColumns: [...weekColumns],
        rows: sectionRows,
        sectionTotal,
      });
      sectionRows = [];
    };

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex] as unknown[];
      if (!row?.length) continue;

      const rowText = row.map((c) => String(c ?? '').trim()).join(' ');
      const nonEmpty = row.filter((c) => c !== '' && c !== null && c !== undefined);
      const firstCell = String(row[0] ?? '').trim() || String(nonEmpty[0] ?? '').trim();

      const isColHeader =
        /nombres?/i.test(rowText) &&
        (/c\.?i\.?/i.test(rowText) || /fecha\s+de\s+ingreso/i.test(rowText));
      const isSpecialRow =
        /^total\s+n[oó]mina/i.test(firstCell) ||
        isExcelSummaryTotalRow(firstCell, row) ||
        isExcelDocumentBannerRow(firstCell, rowText) ||
        isColHeader ||
        isExcelWeekSubHeaderRow(rowText) ||
        /^(?:el\s+)?trabajador/i.test(firstCell) ||
        /^(?:el\s+)?trabajador/i.test(rowText) ||
        isSectionHeader(firstCell, rowText);

      if (nonEmpty.length < 2 && !isSpecialRow) continue;

      if (/^total\s+n[oó]mina/i.test(firstCell)) {
        for (const c of row) {
          const n = typeof c === 'number' ? c : normAmount(String(c ?? ''));
          if (n >= 500) {
            declaredSourceTotal = n;
            break;
          }
        }
        continue;
      }

      if (isExcelSummaryTotalRow(firstCell, row)) continue;

      if (isExcelDocumentBannerRow(firstCell, rowText)) continue;

      if (isColHeader) {
        const cols = extractWeekColumnsFromExcelContext(rows as unknown[][], rowIndex, defaultYear);
        if (cols.length) weekColumns = cols;
        continue;
      }

      if (isExcelWeekSubHeaderRow(rowText)) {
        const cols = extractWeekColumnsFromHeaderRow(row, defaultYear);
        if (cols.length) weekColumns = cols;
        continue;
      }

      if (shouldSkipRow(firstCell)) continue;

      if (isSectionHeader(firstCell, rowText)) {
        flushSection();
        currentSectionRaw = rowText.length > firstCell.length ? rowText : firstCell;
        currentArea = inferAreaFromSection(currentSectionRaw);
        weekColumns = [];
        continue;
      }

      if (!weekColumns.length) continue;

      if (/^(?:el\s+)?trabajador/i.test(firstCell) || /^(?:el\s+)?trabajador/i.test(rowText) || (/trabajador/i.test(rowText) && /(?:usd|\$|dolares|dólares)\s*\d+/i.test(rowText))) {
        const noteWorker = parseWorkerNoteRowUnified(rowText, weekColumns, rowIndex);
        if (noteWorker) {
          flushSection();
          noteWorker.area = currentArea;
          noteWorker.cargo = "Novedades Especiales";
          const prevSectionRaw = currentSectionRaw;
          currentSectionRaw = "Novedades Especiales";
          sectionRows.push(noteWorker);
          flushSection();
          currentSectionRaw = prevSectionRaw;
        }
        continue;
      }

      const worker = parseWorkerRow(row, weekColumns, rowIndex);
      if (!worker) continue;

      worker.area = currentArea;
      worker.cargo = cleanSectionName(currentSectionRaw);
      sectionRows.push(worker);
    }

    flushSection();
  }

  const period = finalizePeriod(sections, 'excel', sourceFileName, workbook.SheetNames[0]);
  if (declaredSourceTotal != null) {
    period.stats.declaredSourceTotal = declaredSourceTotal;
    if (Math.abs(period.grandTotal - declaredSourceTotal) > 1) {
      period.stats.warnings.push(
        `Total en Excel: $${declaredSourceTotal.toLocaleString('es', { minimumFractionDigits: 2 })}; extraído: $${period.grandTotal.toLocaleString('es', { minimumFractionDigits: 2 })}.`,
      );
    }
  }
  period.stats.warnings = [...period.stats.warnings, ...warnings];
  return period;
}

export async function parseNominaMatrixFromFile(file: File): Promise<ParsedNominaPeriod> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: false });
    return parseExcelNominaMatrix(workbook, file.name);
  }

  if (name.endsWith('.pdf')) {
    const { parsePdfNominaMatrix } = await import('@/lib/nomina/import-parser-pdf');
    return parsePdfNominaMatrix(file);
  }

  throw new Error('Formato no soportado. Use .xlsx, .xls o .pdf');
}

export async function parseNominaMatrixFromArrayBuffer(
  buffer: ArrayBuffer,
  fileName: string,
): Promise<ParsedNominaPeriod> {
  const name = fileName.toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
    return parseExcelNominaMatrix(workbook, fileName);
  }
  throw new Error('Solo Excel soportado en CLI por ahora.');
}

export { detectWeekRangeFromExcel, listWeekStartsInRange };

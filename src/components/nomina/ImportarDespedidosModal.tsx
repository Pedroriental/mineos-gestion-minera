'use client';

import { useState, useRef, useTransition } from 'react';
import { Loader2, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { importarDespedidosLoteAction } from '@/lib/actions/importar-despedidos';
import type { ImportarDespedidosRow } from '@/lib/types/importar-despedidos';

type Props = {
  onClose: () => void;
  onSuccess?: () => void;
};

const PLANTILLA_TEXT = `Cédula,DespidoFecha,Causa,DiasTrabajados,CobraSemanaLibre,Bonificaciones
24.828.771,2026-06-11,Despido,10,SI,0
27.075.032,2026-06-11,Despido,3,NO,0
14.367.316,2026-06-11,Despido,10,SI,0
`;

export function ImportarDespedidosModal({ onClose, onSuccess }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ImportarDespedidosRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processing, startTransition] = useTransition();
  const [success, setSuccess] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setError(null);
    setSuccess(null);
    setParsing(true);
    try {
      const ext = file.name.toLowerCase().split('.').pop();
      let parsed: ImportarDespedidosRow[] = [];

      let json: Record<string, unknown>[] = [];
      if (ext === 'csv' || ext === 'txt') {
        const text = await file.text();
        parsed = parseCSV(text);
      } else if (ext === 'xlsx' || ext === 'xls') {
        const XLSX = await import('xlsx');
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        // Get all rows as arrays to find the actual header row (skip title rows)
        const allRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
        // Find the row that contains "Cédula" or "Cedula" (the actual headers)
        const headerRowIdx = allRows.findIndex((row) =>
          Array.isArray(row) && row.some((cell) => {
            const c = removeAccents(String(cell ?? '').toLowerCase().trim());
            return c === 'cedula' || c === 'ci' || c.includes('cedula');
          }),
        );

        if (headerRowIdx >= 0) {
          // Use the detected header row
          const headerRow = allRows[headerRowIdx] as unknown[];
          const dataRows = allRows.slice(headerRowIdx + 1);
          json = dataRows.map((row) => {
            const arr = Array.isArray(row) ? row : [];
            const obj: Record<string, unknown> = {};
            for (let i = 0; i < headerRow.length; i++) {
              const key = removeAccents(String(headerRow[i] ?? '').toLowerCase().trim());
              if (key) obj[key] = arr[i] ?? '';
            }
            return obj;
          });
        } else {
          // Fallback: assume first row is the header
          json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
        }

        if (typeof window !== 'undefined') {
          console.info('[ImportarDespedidos] XLSX header row index:', headerRowIdx);
          console.info('[ImportarDespedidos] XLSX keys raw:', json.length > 0 ? Object.keys(json[0]) : 'empty');
        }
      } else {
        throw new Error('Formato no soportado. Use .csv, .xlsx o .xls');
      }

      // Normalize keys: lowercase + trim + remove accents to make lookup case/accent-insensitive
      const normalized = json.map((row) => {
        const obj: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(row)) {
          const normKey = removeAccents(k.toLowerCase().trim());
          obj[normKey] = v;
        }
        return obj;
      });
      if (typeof window !== 'undefined') {
        console.info('[ImportarDespedidos] normalized keys:', normalized.length > 0 ? Object.keys(normalized[0]) : 'empty');
      }
      parsed = normalized.map((row) => rowToImportRow(row));
      if (typeof window !== 'undefined') {
        console.info('[ImportarDespedidos] parsed sample:', parsed[0]);
      }

      parsed = parsed.filter((r) => {
        // Filtrar filas completamente vacías o filas de totales/sumas
        const noCedula = !r.cedula;
        const noDias = !r.diasTrabajados;
        const noBono = !r.bonificaciones;
        const noDespidoFecha = !r.despidoFecha;
        if (noCedula && noDias && noBono && noDespidoFecha) return false;
        // Filtrar fila "Total" (la palabra 'total' en la cédula, causa o como cédula)
        const allValues = `${r.cedula} ${r.despidoCausa} ${r.despidoFecha}`.toLowerCase();
        if (allValues.includes('total')) return false;
        return true;
      });
      setRows(parsed);
      if (parsed.length === 0) {
        const rawKeys = json.length > 0 ? Object.keys(json[0]).join(', ') : 'ninguna';
        setError(
          `No se encontraron filas válidas. Encabezados detectados: [${rawKeys}]. Verifica que exista una columna "Cédula" con valores no vacíos.`,
        );
        if (typeof window !== 'undefined') {
          console.warn('[ImportarDespedidos] Filas parseadas pero sin cédula. Encabezados:', rawKeys);
        }
      } else if (typeof window !== 'undefined') {
        console.info(`[ImportarDespedidos] ${parsed.length} fila(s) parseada(s) correctamente.`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al parsear el archivo';
      setError(message);
    } finally {
      setParsing(false);
    }
  };

  const handleImportar = () => {
    setError(null);
    setSuccess(null);
    if (typeof window !== 'undefined') {
      console.info(`[ImportarDespedidos] handleImportar: enviando ${rows.length} filas`);
    }
    startTransition(async () => {
      try {
        const res = await importarDespedidosLoteAction(rows);
        if (typeof window !== 'undefined') {
          console.info('[ImportarDespedidos] respuesta:', res);
        }
        if (res.ok) {
          setSuccess(res.message);
          onSuccess?.();
        } else {
          setError(res.message);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error desconocido al importar';
        if (typeof window !== 'undefined') {
          console.error('[ImportarDespedidos] error:', err);
        }
        setError(message);
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl rounded-lg border border-white/10 bg-zinc-900/95 p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-zinc-100">Importar Despedidos desde Excel/CSV</h2>
          </div>
          <button onClick={onClose} className="rounded p-1 text-zinc-500 hover:bg-white/5 hover:text-zinc-300">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-3 text-[11px] text-zinc-400">
          Carga un archivo con las columnas: <strong className="text-zinc-200">Cédula</strong>, DespidoFecha, Causa, DiasTrabajados, CobraSemanaLibre, Bonificaciones.
          El sistema marcará cada trabajador como DESPEDIDO. La liquidación se procesa después en la pestaña &quot;Despedidos&quot;.
        </p>

        <details className="mb-3 rounded border border-white/5 bg-zinc-900/40 p-2 text-[10px] text-zinc-500">
          <summary className="cursor-pointer text-zinc-400">Ver plantilla CSV de ejemplo</summary>
          <pre className="mt-2 overflow-x-auto rounded bg-zinc-950/60 p-2 text-[10px] text-zinc-300">{PLANTILLA_TEXT}</pre>
        </details>

        <div className="mb-3">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls,.txt"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            className="block w-full text-[11px] text-zinc-400 file:mr-3 file:rounded file:border-0 file:bg-amber-500/15 file:px-3 file:py-1.5 file:text-[11px] file:font-semibold file:text-amber-300 hover:file:bg-amber-500/25"
          />
        </div>

        {parsing && (
          <div className="flex items-center gap-2 text-[11px] text-zinc-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Parseando archivo...
          </div>
        )}

        {rows.length > 0 && (
          <div className="mb-3 max-h-48 overflow-y-auto rounded border border-white/5 bg-zinc-950/40">
            <table className="w-full text-[10px]">
              <thead className="border-b border-white/5 bg-zinc-900/50 text-zinc-500">
                <tr>
                  <th className="px-2 py-1 text-left">Cédula</th>
                  <th className="px-2 py-1 text-left">Despido</th>
                  <th className="px-2 py-1 text-left">Causa</th>
                  <th className="px-2 py-1 text-right">Días</th>
                  <th className="px-2 py-1 text-center">Libre</th>
                  <th className="px-2 py-1 text-right">Bono</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-zinc-300">
                {rows.slice(0, 50).map((r, i) => (
                  <tr key={i}>
                    <td className="px-2 py-1">{r.cedula}</td>
                    <td className="px-2 py-1">{r.despidoFecha}</td>
                    <td className="px-2 py-1">{r.despidoCausa}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{r.diasTrabajados}</td>
                    <td className="px-2 py-1 text-center">{r.cobraSemanaLibre ? 'SI' : 'NO'}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{r.bonificaciones}</td>
                  </tr>
                ))}
                {rows.length > 50 && (
                  <tr><td colSpan={6} className="px-2 py-1 text-center text-zinc-500">... y {rows.length - 50} más</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {error && (
          <div className="mb-3 flex items-center gap-2 rounded border border-red-500/20 bg-red-500/5 px-3 py-2 text-[11px] text-red-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        {success && (
          <div className="mb-3 flex items-center gap-2 rounded border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-[11px] text-emerald-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {success}
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-white/10 bg-transparent px-3 py-1.5 text-[11px] text-zinc-300 hover:bg-white/5"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleImportar}
            disabled={rows.length === 0 || processing}
            className="flex items-center gap-1.5 rounded bg-amber-500/15 border border-amber-500/30 px-3 py-1.5 text-[11px] font-semibold text-amber-300 hover:bg-amber-500/25 transition-colors disabled:opacity-40"
          >
            {processing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Marcar {rows.length} como despedido{rows.length !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

function parseCSV(text: string): ImportarDespedidosRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => removeAccents(h.trim().toLowerCase().replace(/['"]/g, '')));
  return lines.slice(1).map((line) => {
    const cols = parseCSVLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = (cols[i] ?? '').trim().replace(/^["']|["']$/g, '');
    });
    return rowToImportRow(obj);
  });
}

function removeAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += c;
    }
  }
  result.push(current);
  return result;
}

function rowToImportRow(row: Record<string, unknown>): ImportarDespedidosRow {
  const get = (...keys: string[]): string => {
    const norm = (s: string) => removeAccents(s.toLowerCase().trim());
    for (const k of keys) {
      const kNorm = norm(k);
      const v = row[kNorm] ?? row[k];
      if (v !== undefined && v !== null && v !== '') return String(v).trim();
    }
    return '';
  };

  const cobraLibre = (() => {
    const v = get('cobra semana libre', 'cobra_semanalibre', 'semana libre', 'libre');
    if (!v) return false;
    return /^(si|sí|yes|true|1|x)$/i.test(v);
  })();

  return {
    cedula: get('cedula', 'ci', 'cédula'),
    despidoFecha: get('despido fecha', 'despido_fecha', 'despidofecha', 'fecha despido', 'fecha_despido', 'fecha'),
    despidoCausa: get('causa', 'despido_causa', 'motivo') || 'Despido',
    diasTrabajados: Number(get('dias trabajados', 'dias_trabajados', 'diastrabajados', 'dias', 'días', 'dias trab')) || 0,
    cobraSemanaLibre: cobraLibre,
    bonificaciones: Number(get('bonificaciones', 'bono', 'bono extra')) || 0,
  };
}

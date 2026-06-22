'use client';

import { useState, useRef, useTransition } from 'react';
import { Loader2, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { importarDespedidosLoteAction, type ImportarDespedidosRow } from '@/lib/actions/importar-despedidos';

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

      if (ext === 'csv' || ext === 'txt') {
        const text = await file.text();
        parsed = parseCSV(text);
      } else if (ext === 'xlsx' || ext === 'xls') {
        const XLSX = await import('xlsx');
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
        parsed = json.map((row) => rowToImportRow(row));
      } else {
        throw new Error('Formato no soportado. Use .csv, .xlsx o .xls');
      }

      parsed = parsed.filter((r) => r.cedula);
      setRows(parsed);
      if (parsed.length === 0) {
        setError('No se encontraron filas válidas. Verifica que el archivo tenga columna "Cédula".');
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
    startTransition(async () => {
      const res = await importarDespedidosLoteAction(rows);
      if (res.ok) {
        setSuccess(res.message);
        onSuccess?.();
      } else {
        setError(res.message);
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
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/['"]/g, ''));
  return lines.slice(1).map((line) => {
    const cols = parseCSVLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = (cols[i] ?? '').trim().replace(/^["']|["']$/g, '');
    });
    return rowToImportRow(obj);
  });
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
    for (const k of keys) {
      const norm = k.toLowerCase().replace(/['"]/g, '').trim();
      const v = row[norm] ?? row[k] ?? row[Object.keys(row).find((rk) => rk.toLowerCase() === norm) ?? ''];
      if (v !== undefined && v !== null && v !== '') return String(v).trim();
    }
    return '';
  };

  const cobraLibre = ['CobraSemanaLibre', 'cobra_semana_libre', 'cobra semana libre', 'semana libre', 'libre']
    .map((k) => k.toLowerCase())
    .some((k) => {
      const v = get(k);
      return v && /^(si|sí|yes|true|1|x)$/i.test(v);
    });

  return {
    cedula: get('Cédula', 'Cedula', 'cedula', 'CI', 'ci'),
    despidoFecha: get('DespidoFecha', 'Despido Fecha', 'despido_fecha', 'Fecha Despido', 'fecha_despido', 'Fecha'),
    despidoCausa: get('Causa', 'causa', 'despido_causa', 'Motivo') || 'Despido',
    diasTrabajados: Number(get('DiasTrabajados', 'Dias Trabajados', 'dias_trabajados', 'Días', 'dias', 'Dias Trab', 'DiasTrabajados')) || 0,
    cobraSemanaLibre: cobraLibre,
    bonificaciones: Number(get('Bonificaciones', 'bonificaciones', 'Bono', 'bono')) || 0,
  };
}

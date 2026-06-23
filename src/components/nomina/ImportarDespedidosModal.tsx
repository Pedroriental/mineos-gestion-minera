'use client';

import { useState, useRef, useTransition, useMemo } from 'react';
import {
  Loader2, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, X,
  UserPlus, RefreshCw, UserCheck, AlertCircle, Square, CheckSquare,
} from 'lucide-react';
import {
  importarDespedidosLoteAction,
  previsualizarImportAction,
} from '@/lib/actions/importar-despedidos';
import type {
  ImportarDespedidosRow,
  ImportarDespedidosDetalle,
  PrevisualizarImportFila,
} from '@/lib/types/importar-despedidos';

type Area = 'mina' | 'planta' | 'administracion' | 'seguridad' | 'transporte';

type Props = {
  area: Area;
  onClose: () => void;
  onSuccess?: () => void;
};

const PLANTILLA_TEXT = `Nombre,Cédula,Cargo,$/Semana,DespidoFecha,Causa,DiasTrabajados,CobraSemanaLibre,Bonificaciones
Renni Guzman,18234567,Supervisor,150,2026-06-11,Despido,4,NO,0
Juan Pérez,29.689.342,Palero,100,2026-06-11,Despido,10,SI,0
`;

export function ImportarDespedidosModal({ area, onClose, onSuccess }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ImportarDespedidosRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processing, startTransition] = useTransition();
  const [success, setSuccess] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<ImportarDespedidosDetalle[] | null>(null);

  const [previsualizacion, setPrevisualizacion] = useState<PrevisualizarImportFila[] | null>(null);
  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set());
  const [previsualizando, setPrevisualizando] = useState(false);

  const handleFile = async (file: File) => {
    setError(null);
    setSuccess(null);
    setDetalle(null);
    setPrevisualizacion(null);
    setSeleccionados(new Set());
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
        const allRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
        const headerRowIdx = allRows.findIndex((row) =>
          Array.isArray(row) && row.some((cell) => {
            const c = removeAccents(String(cell ?? '').toLowerCase().trim());
            return c === 'cedula' || c === 'ci' || c.includes('cedula');
          }),
        );

        if (headerRowIdx >= 0) {
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
          json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
        }
      } else {
        throw new Error('Formato no soportado. Use .csv, .xlsx o .xls');
      }

      const normalized = json.map((row) => {
        const obj: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(row)) {
          const normKey = removeAccents(k.toLowerCase().trim());
          obj[normKey] = v;
        }
        return obj;
      });
      parsed = normalized.map((row) => rowToImportRow(row));

      parsed = parsed.filter((r) => {
        const noCedula = !r.cedula;
        const noNombre = !r.nombre;
        const noDias = !r.diasTrabajados;
        const noSalario = !r.salarioSemana;
        const noDespidoFecha = !r.despidoFecha;
        if (noCedula && noNombre && noDias && noSalario && noDespidoFecha) return false;
        const allValues = `${r.cedula} ${r.nombre} ${r.despidoCausa} ${r.despidoFecha}`.toLowerCase();
        if (allValues.includes('total')) return false;
        return true;
      });
      setRows(parsed);
      if (parsed.length === 0) {
        const rawKeys = json.length > 0 ? Object.keys(json[0]).join(', ') : 'ninguna';
        setError(
          `No se encontraron filas válidas. Encabezados detectados: [${rawKeys}]. Verifica que existan al menos las columnas "Cédula" y "Nombre" con valores no vacíos.`,
        );
      }

      // Disparar previsualización automática
      if (parsed.length > 0) {
        setPrevisualizando(true);
        try {
          const prev = await previsualizarImportAction(parsed, area);
          if (prev.ok) {
            setPrevisualizacion(prev.filas);
            // Por defecto: marcar SOLO los nuevos (no existentes)
            const nuevos = new Set<number>();
            for (const f of prev.filas) {
              if (!f.existe) nuevos.add(f.rowIndex);
            }
            setSeleccionados(nuevos);
          } else {
            setError(`Error al previsualizar: ${prev.message}`);
          }
        } finally {
          setPrevisualizando(false);
        }
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
      console.info(`[ImportarDespedidos] handleImportar: enviando ${seleccionados.size} fila(s) de ${rows.length}`);
    }
    const filasAImportar = rows.filter((_, idx) => seleccionados.has(idx));
    if (filasAImportar.length === 0) {
      setError('No has seleccionado ninguna fila para importar');
      return;
    }
    startTransition(async () => {
      try {
        const res = await importarDespedidosLoteAction(filasAImportar, area);
        if (res.ok) {
          setSuccess(res.message);
          if (res.detalle) setDetalle(res.detalle);
          setTimeout(() => {
            onSuccess?.();
          }, 4000);
        } else {
          setError(res.message);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error desconocido al importar';
        setError(message);
      }
    });
  };

  const handleReset = () => {
    setRows([]);
    setDetalle(null);
    setError(null);
    setSuccess(null);
    setPrevisualizacion(null);
    setSeleccionados(new Set());
    if (fileRef.current) fileRef.current.value = '';
  };

  const counts = useMemo(() => {
    if (!previsualizacion) return null;
    return {
      existentes: previsualizacion.filter((f) => f.existe).length,
      nuevos: previsualizacion.filter((f) => !f.existe).length,
      incompletos: previsualizacion.filter((f) => f.incompleteData).length,
      seleccionadosCount: seleccionados.size,
    };
  }, [previsualizacion, seleccionados]);

  const toggleSeleccion = (rowIndex: number) => {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(rowIndex)) next.delete(rowIndex);
      else next.add(rowIndex);
      return next;
    });
  };

  const seleccionarTodos = () => {
    if (!previsualizacion) return;
    setSeleccionados(new Set(previsualizacion.map((f) => f.rowIndex)));
  };
  const limpiarSeleccion = () => setSeleccionados(new Set());
  const soloNuevos = () => {
    if (!previsualizacion) return;
    setSeleccionados(new Set(previsualizacion.filter((f) => !f.existe).map((f) => f.rowIndex)));
  };
  const soloExistentes = () => {
    if (!previsualizacion) return;
    setSeleccionados(new Set(previsualizacion.filter((f) => f.existe).map((f) => f.rowIndex)));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-5xl rounded-lg border border-white/10 bg-zinc-900/95 p-5 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-zinc-100">
              Importar Despedidos desde Excel/CSV — {areaLabel(area)}
            </h2>
          </div>
          <button onClick={onClose} className="rounded p-1 text-zinc-500 hover:bg-white/5 hover:text-zinc-300">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-3 text-[11px] text-zinc-400">
          Carga un archivo con las columnas: <strong className="text-zinc-200">Nombre</strong>,{' '}
          <strong className="text-zinc-200">Cédula</strong>, Cargo, $/Semana, DespidoFecha, Causa,
          DiasTrabajados, CobraSemanaLibre, Bonificaciones. El sistema mostrará una previsualización
          de qué trabajadores ya existen en la BD y cuáles se crearán nuevos. Marca solo las filas
          que quieres importar.
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
        {previsualizando && (
          <div className="flex items-center gap-2 text-[11px] text-zinc-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Previsualizando contra la BD...
          </div>
        )}

        {previsualizacion && previsualizacion.length > 0 && !detalle && (
          <>
            <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px]">
              <span className="text-zinc-400">Selección rápida:</span>
              <button
                type="button"
                onClick={seleccionarTodos}
                className="rounded border border-white/10 bg-zinc-900/40 px-2 py-1 text-zinc-300 hover:bg-white/5"
              >
                Todos
              </button>
              <button
                type="button"
                onClick={soloNuevos}
                className="rounded border border-emerald-500/20 bg-emerald-500/5 px-2 py-1 text-emerald-300 hover:bg-emerald-500/15"
              >
                Solo nuevos
              </button>
              <button
                type="button"
                onClick={soloExistentes}
                className="rounded border border-sky-500/20 bg-sky-500/5 px-2 py-1 text-sky-300 hover:bg-sky-500/15"
              >
                Solo existentes
              </button>
              <button
                type="button"
                onClick={limpiarSeleccion}
                className="rounded border border-white/10 bg-zinc-900/40 px-2 py-1 text-zinc-300 hover:bg-white/5"
              >
                Ninguno
              </button>
              {counts && (
                <span className="ml-auto text-zinc-400">
                  <span className="text-emerald-300">{counts.nuevos} nuevo(s)</span>
                  {' · '}
                  <span className="text-sky-300">{counts.existentes} existente(s)</span>
                  {counts.incompletos > 0 && (
                    <>
                      {' · '}
                      <span className="text-amber-300">{counts.incompletos} incompleto(s)</span>
                    </>
                  )}
                </span>
              )}
            </div>

            <div className="mb-3 max-h-72 overflow-y-auto rounded border border-white/5 bg-zinc-950/40">
              <table className="w-full text-[10px]">
                <thead className="sticky top-0 border-b border-white/5 bg-zinc-900/95 text-zinc-500">
                  <tr>
                    <th className="w-8 px-2 py-1.5"></th>
                    <th className="px-2 py-1.5 text-left">Estado</th>
                    <th className="px-2 py-1.5 text-left">Nombre</th>
                    <th className="px-2 py-1.5 text-left">Cédula</th>
                    <th className="px-2 py-1.5 text-left">Cargo</th>
                    <th className="px-2 py-1.5 text-right">Días</th>
                    <th className="px-2 py-1.5 text-center">Libre</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-zinc-300">
                  {previsualizacion.map((f) => {
                    const checked = seleccionados.has(f.rowIndex);
                    return (
                      <tr
                        key={f.rowIndex}
                        onClick={() => toggleSeleccion(f.rowIndex)}
                        className={`cursor-pointer transition-colors ${
                          checked ? 'bg-amber-500/5' : 'hover:bg-white/[0.02]'
                        }`}
                      >
                        <td className="px-2 py-1 text-zinc-400">
                          {checked
                            ? <CheckSquare className="h-3.5 w-3.5 text-amber-400" />
                            : <Square className="h-3.5 w-3.5 text-zinc-600" />}
                        </td>
                        <td className="px-2 py-1">
                          {f.existe ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 border border-sky-500/30 px-1.5 py-0.5 text-[9px] font-medium text-sky-300">
                              <UserCheck className="h-2.5 w-2.5" />
                              Existente
                            </span>
                          ) : f.incompleteData ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 text-[9px] font-medium text-amber-300">
                              <AlertCircle className="h-2.5 w-2.5" />
                              Nuevo
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 text-[9px] font-medium text-emerald-300">
                              <UserPlus className="h-2.5 w-2.5" />
                              Nuevo
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-1 truncate max-w-[180px]">
                          {f.nombreEfectivo || '—'}
                          {f.incompleteData && (
                            <div className="text-[9px] text-amber-400">
                              (generado automáticamente)
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-1">
                          {f.cedulaEfectiva || '—'}
                          {f.cedulaEfectiva !== f.cedulaOriginal && f.cedulaEfectiva && (
                            <div className="text-[9px] text-amber-400">
                              era &ldquo;{f.cedulaOriginal || 'vacía'}&rdquo;
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-1">{f.cargo || '—'}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{f.diasTrabajados}</td>
                        <td className="px-2 py-1 text-center">{f.cobraSemanaLibre ? 'SI' : 'NO'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {error && (
          <div className="mb-3 flex items-center gap-2 rounded border border-red-500/20 bg-red-500/5 px-3 py-2 text-[11px] text-red-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        {success && (
          <div className="mb-3 rounded border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-[11px] text-emerald-400">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {success}
            </div>
            {detalle && detalle.length > 0 && (
              <div className="mt-2 max-h-40 overflow-y-auto rounded border border-emerald-500/10 bg-zinc-950/30">
                <table className="w-full text-[10px]">
                  <thead className="text-emerald-300">
                    <tr>
                      <th className="px-2 py-1 text-left">Estado</th>
                      <th className="px-2 py-1 text-left">Nombre</th>
                      <th className="px-2 py-1 text-left">Detalle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-zinc-300">
                    {detalle.map((d, i) => (
                      <tr key={i}>
                        <td className="px-2 py-1">
                          {d.estado === 'created' && <span className="text-emerald-300">Creado</span>}
                          {d.estado === 'updated' && <span className="text-sky-300">Actualizado</span>}
                          {d.estado === 'skipped' && <span className="text-zinc-500">Omitido</span>}
                          {d.estado === 'error' && <span className="text-red-300">Error</span>}
                        </td>
                        <td className="px-2 py-1 truncate max-w-[200px]">{d.nombre || '—'}</td>
                        <td className="px-2 py-1 text-zinc-400">{d.message || d.matchedBy || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          {detalle ? (
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 rounded border border-white/10 bg-transparent px-3 py-1.5 text-[11px] text-zinc-300 hover:bg-white/5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Otro archivo
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-white/10 bg-transparent px-3 py-1.5 text-[11px] text-zinc-300 hover:bg-white/5"
          >
            {detalle ? 'Cerrar' : 'Cancelar'}
          </button>
          {!detalle && previsualizacion && previsualizacion.length > 0 && (
            <button
              type="button"
              onClick={handleImportar}
              disabled={processing || seleccionados.size === 0}
              className="flex items-center gap-1.5 rounded bg-amber-500/15 border border-amber-500/30 px-3 py-1.5 text-[11px] font-semibold text-amber-300 hover:bg-amber-500/25 transition-colors disabled:opacity-40"
            >
              {processing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              Importar {seleccionados.size} seleccionada{seleccionados.size !== 1 ? 's' : ''}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function areaLabel(area: Area): string {
  switch (area) {
    case 'mina': return 'Mina Belén';
    case 'planta': return 'Molino';
    case 'administracion': return 'Administración';
    case 'seguridad': return 'Seguridad';
    case 'transporte': return 'Transporte';
    default: return area;
  }
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

function toNumber(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return v;
  const cleaned = String(v).replace(/[^\d.,\-]/g, '').replace(/,/g, '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
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
    nombre: get(
      'nombre', 'nombre y apellido', 'nombre_apellido', 'nombrecompleto',
      'nombre completo', 'empleado', 'trabajador', 'nombre y apellido del trabajador',
    ),
    cedula: get('cedula', 'ci', 'cédula'),
    cargo: get('cargo', 'rol', 'puesto', 'funcion', 'función') || 'Palero',
    salarioSemana: toNumber(get('$/semana', 'salario_semana', 'salario', 'salario semanal', 'pago semanal', 'semanal')),
    despidoFecha: get('despido fecha', 'despido_fecha', 'despidofecha', 'fecha despido', 'fecha_despido', 'fecha'),
    despidoCausa: get('causa', 'despido_causa', 'motivo') || 'Despido',
    diasTrabajados: toNumber(get('dias trabajados', 'dias_trabajados', 'diastrabajados', 'dias', 'días', 'dias trab')),
    cobraSemanaLibre: cobraLibre,
    bonificaciones: toNumber(get('bonificaciones', 'bono', 'bono extra')),
  };
}

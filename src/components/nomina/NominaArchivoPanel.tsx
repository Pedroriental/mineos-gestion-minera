'use client';

import { useEffect, useState, useTransition } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Archive, Calendar, Loader2, FileSpreadsheet, Upload, Trash2 } from 'lucide-react';
import {
  consolidarNominaPeriodoAction,
  eliminarImportNominaAction,
  listNominaPeriodosAction,
} from '@/lib/actions/nomina-actions';
import type { NominaPeriodoSummary } from '@/lib/nomina/types';
import { useConfirm } from '@/components/ui/ConfirmDialogProvider';
import { AppDatePicker } from '@/components/ui/AppDatePicker';

export function NominaArchivoPanel({
  userId,
  embedded = false,
  onImportHistorico,
  onVistaPrevia,
}: {
  userId?: string;
  embedded?: boolean;
  onImportHistorico?: () => void;
  onVistaPrevia?: () => void;
}) {
  const [periodos, setPeriodos] = useState<NominaPeriodoSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [consolidateStart, setConsolidateStart] = useState('');
  const [consolidateEnd, setConsolidateEnd] = useState('');
  const [consolidateLabel, setConsolidateLabel] = useState('');
  const confirmDialog = useConfirm();

  function refresh() {
    setLoading(true);
    listNominaPeriodosAction().then((res) => {
      setLoading(false);
      if (res.ok) setPeriodos(res.periodos);
      else setMsg(res.message ?? 'Error al cargar');
    });
  }

  useEffect(() => {
    refresh();
  }, []);

  function handleConsolidate() {
    if (!consolidateStart || !consolidateEnd || !consolidateLabel.trim()) return;
    startTransition(async () => {
      const res = await consolidarNominaPeriodoAction({
        label: consolidateLabel.trim(),
        rangeStart: consolidateStart,
        rangeEnd: consolidateEnd,
        userId,
      });
      setMsg(res.ok ? res.message : res.message);
      if (res.ok) refresh();
    });
  }

  async function handleDeleteImport(periodo: NominaPeriodoSummary) {
    if (periodo.origen !== 'import_historico') return;
    const ok = await confirmDialog({
      title: 'Eliminar importación',
      message: `¿Eliminar el import "${periodo.label}"?\n\nSe borrarán las semanas y registros de este import. Los trabajadores no se eliminan.`,
      variant: 'danger'
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await eliminarImportNominaAction({ periodoId: periodo.id, userId });
      setMsg(res.message);
      if (res.ok) refresh();
    });
  }

  return (
    <div className="space-y-5">
      {!embedded && (
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <Archive className="h-5 w-5 text-amber-500" />
            Archivo de nóminas
          </h1>
          <p className="text-xs text-zinc-500 mt-1">Periodos cerrados e importaciones históricas</p>
        </div>
      )}

      {embedded && (
        <div>
          <h2 className="text-base font-bold text-white/90 flex items-center gap-2 pr-8">
            <Archive className="h-4 w-4 text-amber-500" />
            Archivo de periodos
          </h2>
          <p className="text-[11px] text-zinc-500 mt-1">
            Nóminas ya cerradas o importadas. La vista Excel muestra histórico + proyección del rango.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {onImportHistorico && (
          <button type="button" onClick={onImportHistorico} className="btn-primary text-xs h-9 px-3 gap-1.5">
            <Upload className="h-3.5 w-3.5" /> Importar histórico
          </button>
        )}
        {onVistaPrevia && (
          <button type="button" onClick={onVistaPrevia} className="btn-secondary text-xs h-9 px-3 gap-1.5">
            <FileSpreadsheet className="h-3.5 w-3.5" /> Vista consolidada
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-zinc-400 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
        </div>
      ) : (
        <div className="rounded-xl border border-white/5 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900/80 text-[10px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="text-left p-3">Periodo</th>
                <th className="text-left p-3">Rango</th>
                <th className="text-right p-3">Total USD</th>
                <th className="text-left p-3">Origen</th>
                <th className="text-right p-3 w-12" />
              </tr>
            </thead>
            <tbody>
              {periodos.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-zinc-500 text-xs">
                    Sin periodos archivados aún.
                  </td>
                </tr>
              ) : (
                periodos.map((p) => (
                  <tr key={p.id} className="border-t border-white/5">
                    <td className="p-3 font-medium text-zinc-200">{p.label}</td>
                    <td className="p-3 text-zinc-400 text-xs tabular-nums">
                      {format(parseISO(p.rangeStart), 'dd MMM yyyy', { locale: es })} —{' '}
                      {format(parseISO(p.rangeEnd), 'dd MMM yyyy', { locale: es })}
                    </td>
                    <td className="p-3 text-right tabular-nums text-amber-400 font-semibold">
                      ${p.totalUsd.toLocaleString('es', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-xs text-zinc-500">{p.origen}</td>
                    <td className="p-3 text-right">
                      {p.origen === 'import_historico' ? (
                        <button
                          type="button"
                          onClick={() => handleDeleteImport(p)}
                          disabled={isPending}
                          title="Eliminar import"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-red-400/70 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-40"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-xl border border-white/5 bg-zinc-900/25 p-4 space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5" /> Consolidar semanas cerradas
        </h3>
        <input
          type="text"
          placeholder="Etiqueta del periodo"
          value={consolidateLabel}
          onChange={(e) => setConsolidateLabel(e.target.value)}
          className="w-full rounded-lg border border-white/5 bg-zinc-900/40 px-3 py-2 text-sm text-white"
        />
        <div className="grid grid-cols-2 gap-2">
          <AppDatePicker value={consolidateStart} onChange={(val) => setConsolidateStart(val)} />
          <AppDatePicker value={consolidateEnd} onChange={(val) => setConsolidateEnd(val)} />
        </div>
        <button
          type="button"
          onClick={handleConsolidate}
          disabled={isPending}
          className="btn-secondary text-xs w-full justify-center"
        >
          {isPending ? 'Consolidando…' : 'Crear periodo'}
        </button>
      </div>

      {msg && <p className="text-xs text-zinc-400">{msg}</p>}
    </div>
  );
}

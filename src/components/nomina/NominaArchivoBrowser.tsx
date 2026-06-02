'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Archive, Calendar, Loader2, Trash2 } from 'lucide-react';
import {
  consolidarNominaPeriodoAction,
  eliminarImportNominaAction,
  listNominaPeriodosAction,
} from '@/lib/actions/nomina-actions';
import type { NominaPeriodoSummary } from '@/lib/nomina/types';
import { useConfirm } from '@/components/ui/ConfirmDialogProvider';

export function NominaArchivoBrowser({ userId }: { userId?: string }) {
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
import { AppDatePicker } from '@/components/ui/AppDatePicker';
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
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <Archive className="h-5 w-5 text-amber-500" />
            Archivo de nóminas
          </h1>
          <p className="text-xs text-zinc-500 mt-1">Periodos cerrados e importaciones históricas</p>
        </div>
        <Link
          href="/operaciones/nomina-importar"
          className="btn-primary text-xs h-9 px-4"
        >
          Importar histórico
        </Link>
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
                <th className="text-right p-3">Semanas</th>
                <th className="text-right p-3 w-12" />
              </tr>
            </thead>
            <tbody>
              {periodos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-zinc-500 text-xs">
                    Sin periodos archivados.{' '}
                    <Link href="/operaciones/nomina-importar" className="text-amber-500 underline">
                      Importar histórico
                    </Link>
                  </td>
                </tr>
              ) : (
                periodos.map((p) => (
                  <tr key={p.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                    <td className="p-3 font-medium text-zinc-200">{p.label}</td>
                    <td className="p-3 text-zinc-400 text-xs tabular-nums">
                      {format(parseISO(p.rangeStart), 'dd MMM yyyy', { locale: es })} —{' '}
                      {format(parseISO(p.rangeEnd), 'dd MMM yyyy', { locale: es })}
                    </td>
                    <td className="p-3 text-right tabular-nums text-amber-400 font-semibold">
                      ${p.totalUsd.toLocaleString('es', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-xs text-zinc-500">{p.origen}</td>
                    <td className="p-3 text-right tabular-nums text-zinc-400">{p.semanaCount}</td>
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

      <div className="rounded-xl border border-white/5 bg-zinc-900/25 p-4 space-y-3 max-w-lg">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5" /> Consolidar periodo manual
        </h2>
        <p className="text-[11px] text-zinc-500">
          Agrupa semanas ya cerradas en un periodo de pago (estilo Excel).
        </p>
        <input
          type="text"
          placeholder="Etiqueta del periodo"
          value={consolidateLabel}
          onChange={(e) => setConsolidateLabel(e.target.value)}
          className="w-full rounded-lg border border-white/5 bg-zinc-900/40 px-3 py-2 text-sm text-white"
        />
        <div className="grid grid-cols-2 gap-2">
          <AppDatePicker value={consolidateStart} onChange={(val) => setConsolidateStart(e.target.value)} />
          <AppDatePicker value={consolidateEnd} onChange={(val) => setConsolidateEnd(e.target.value)} />
        </div>
        <button
          type="button"
          onClick={handleConsolidate}
          disabled={isPending}
          className="btn-secondary text-xs w-full justify-center"
        >
          {isPending ? 'Consolidando…' : 'Consolidar'}
        </button>
      </div>

      {msg && <p className="text-xs text-zinc-400">{msg}</p>}

      <Link
        href={`/operaciones/nomina-vista-previa`}
        className="text-xs text-amber-500/80 hover:text-amber-400 underline-offset-2 hover:underline"
      >
        Abrir vista previa con rango personalizado →
      </Link>
    </div>
  );
}

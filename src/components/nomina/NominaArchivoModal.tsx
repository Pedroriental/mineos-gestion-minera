'use client';

import { useEffect, useState, useTransition, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Archive,
  Calendar,
  ChevronDown,
  ChevronUp,
  Eye,
  Loader2,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { PageFormModal } from '@/components/ui/PageFormModal';
import { NominaPeriodPreviewPane } from '@/components/nomina/NominaPeriodPreviewPane';
import {
  consolidarNominaPeriodoAction,
  eliminarImportNominaAction,
  listNominaPeriodosAction,
} from '@/lib/actions/nomina-actions';
import type { NominaPeriodoSummary } from '@/lib/nomina/types';
import { cn } from '@/lib/utils';
import { useConfirm } from '@/components/ui/ConfirmDialogProvider';

type Props = {
  open: boolean;
  onClose: () => void;
  userId?: string;
  onImport?: () => void;
  onPeriodDeleted?: () => void;
  refreshKey?: number;
};

export function NominaArchivoModal({ open, onClose, userId, onImport, onPeriodDeleted, refreshKey = 0 }: Props) {
  const [periodos, setPeriodos] = useState<NominaPeriodoSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showConsolidate, setShowConsolidate] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [consolidateStart, setConsolidateStart] = useState('');
  const [consolidateEnd, setConsolidateEnd] = useState('');
  const [consolidateLabel, setConsolidateLabel] = useState('');
  const confirmDialog = useConfirm();

  function refresh() {
    setLoading(true);
    listNominaPeriodosAction().then((res) => {
      setLoading(false);
      if (res.ok) {
        setPeriodos(res.periodos);
        if (res.periodos.length && !selectedId) {
          const first = res.periodos.find((p) => p.totalUsd > 0 || p.semanaCount > 0) ?? res.periodos[0];
          setSelectedId(first?.id ?? null);
        }
      } else setMsg(res.message ?? 'Error al cargar');
    });
  }

  useEffect(() => {
    if (open) refresh();
  }, [open, refreshKey]);

  const selected = useMemo(
    () => periodos.find((p) => p.id === selectedId) ?? null,
    [periodos, selectedId],
  );

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
      message: `¿Eliminar el import "${periodo.label}"?\n\nSe borrarán ${periodo.semanaCount} semana(s) y todos sus registros de nómina. Los trabajadores en la base de datos no se eliminan.`,
      variant: 'danger'
    });
    if (!ok) return;

    startTransition(async () => {
      const res = await eliminarImportNominaAction({ periodoId: periodo.id, userId });
      setMsg(res.message);
      if (res.ok) {
        if (selectedId === periodo.id) setSelectedId(null);
        onPeriodDeleted?.();
        refresh();
      }
    });
  }

  const canDeleteSelected = selected?.origen === 'import_historico';

  return (
    <PageFormModal
      open={open}
      onClose={onClose}
      panelClassName="flex max-h-[min(92dvh,860px)] w-full flex-col overflow-hidden p-0 sm:max-w-[min(96vw,1280px)] sm:rounded-2xl"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-white/5 bg-zinc-950/95 px-4 py-3 sm:px-5">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-white/90">
            <Archive className="h-4 w-4 text-amber-500" />
            Archivo de nóminas
          </h2>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            Periodos importados o cerrados · seleccione uno para ver la planilla generada
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onImport ? (
            <button type="button" onClick={onImport} className="btn-primary h-9 gap-1.5 px-3 text-xs">
              <Upload className="h-3.5 w-3.5" /> Importar
            </button>
          ) : null}
          {canDeleteSelected && selected ? (
            <button
              type="button"
              onClick={() => handleDeleteImport(selected)}
              disabled={isPending}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 text-xs font-semibold text-red-300 hover:bg-red-500/20 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Eliminar import
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-white/40 hover:bg-white/5 hover:text-white"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(280px,38%)_1fr]">
        <aside className="flex min-h-0 flex-col border-b border-white/5 bg-zinc-950/80 lg:border-b-0 lg:border-r">
          <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
            {loading ? (
              <div className="flex items-center gap-2 py-8 text-sm text-zinc-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando periodos…
              </div>
            ) : periodos.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/30 p-6 text-center">
                <p className="text-xs text-zinc-400">Sin periodos archivados aún.</p>
                {onImport ? (
                  <button type="button" onClick={onImport} className="btn-primary mt-3 text-xs">
                    Importar planilla
                  </button>
                ) : null}
              </div>
            ) : (
              <ul className="space-y-1.5">
                {periodos.map((p) => {
                  const active = p.id === selectedId;
                  const empty = p.totalUsd <= 0 && p.semanaCount <= 0;
                  return (
                    <li
                      key={p.id}
                      className={cn(
                        'flex items-stretch overflow-hidden rounded-xl border transition-colors',
                        active
                          ? 'border-amber-500/40 bg-amber-500/10'
                          : 'border-white/5 bg-zinc-900/40 hover:border-white/10 hover:bg-zinc-900/60',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedId(p.id)}
                        className="min-w-0 flex-1 px-3 py-2.5 text-left"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-semibold text-zinc-100 line-clamp-2">{p.label}</span>
                          <Eye
                            className={cn(
                              'h-3.5 w-3.5 shrink-0',
                              active ? 'text-amber-400' : 'text-zinc-600',
                            )}
                          />
                        </div>
                        <p className="mt-1 text-[10px] tabular-nums text-zinc-500">
                          {format(parseISO(p.rangeStart), 'dd MMM yyyy', { locale: es })} —{' '}
                          {format(parseISO(p.rangeEnd), 'dd MMM yyyy', { locale: es })}
                        </p>
                        <div className="mt-1.5 flex items-center justify-between gap-2">
                          <span
                            className={cn(
                              'text-xs font-bold tabular-nums',
                              empty ? 'text-red-400/80' : 'text-amber-400',
                            )}
                          >
                            ${p.totalUsd.toLocaleString('es', { minimumFractionDigits: 2 })}
                          </span>
                          <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] uppercase text-zinc-500">
                            {p.origen.replace('_', ' ')}
                          </span>
                        </div>
                        {empty ? (
                          <p className="mt-1 text-[9px] text-red-400/70">
                            Import vacío — vuelva a importar el archivo
                          </p>
                        ) : null}
                      </button>
                      {p.origen === 'import_historico' ? (
                        <button
                          type="button"
                          onClick={() => handleDeleteImport(p)}
                          disabled={isPending}
                          title="Eliminar import"
                          aria-label={`Eliminar import ${p.label}`}
                          className="flex w-10 shrink-0 items-center justify-center border-l border-white/5 text-red-400/70 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-40"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="shrink-0 border-t border-white/5 p-3 sm:p-4">
            <button
              type="button"
              onClick={() => setShowConsolidate((v) => !v)}
              className="flex w-full items-center justify-between rounded-lg border border-white/5 bg-zinc-900/40 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500"
            >
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> Consolidar semanas
              </span>
              {showConsolidate ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            {showConsolidate ? (
              <div className="mt-2 space-y-2 rounded-lg border border-white/5 bg-zinc-900/25 p-3">
                <input
                  type="text"
                  placeholder="Etiqueta del periodo"
                  value={consolidateLabel}
                  onChange={(e) => setConsolidateLabel(e.target.value)}
                  className="w-full rounded-lg border border-white/5 bg-zinc-900/40 px-3 py-2 text-xs text-white"
                />
                <div className="grid grid-cols-2 gap-2">
                  <AppDatePicker value={consolidateStart} onChange={(val) => setConsolidateStart(val)} />
                  <AppDatePicker value={consolidateEnd} onChange={(val) => setConsolidateEnd(val)} />
                </div>
                <button
                  type="button"
                  onClick={handleConsolidate}
                  disabled={isPending}
                  className="btn-secondary w-full justify-center text-xs"
                >
                  {isPending ? 'Consolidando…' : 'Crear periodo'}
                </button>
              </div>
            ) : null}
            {msg ? <p className="mt-2 text-[10px] text-zinc-400">{msg}</p> : null}
          </div>
        </aside>

        <section className="flex min-h-[320px] min-w-0 flex-col bg-[#eef2f6] lg:min-h-0">
          {selected && selected.totalUsd > 0 ? (
            <NominaPeriodPreviewPane
              key={selected.id}
              rangeStart={selected.rangeStart}
              rangeEnd={selected.rangeEnd}
              label={selected.label}
              refreshKey={refreshKey}
              periodoId={selected.id}
            />
          ) : selected ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <p className="text-sm font-semibold text-slate-600">Periodo sin datos</p>
              <p className="max-w-sm text-xs text-slate-500">
                Este import no guardó semanas ni montos. Elimínelo e importe de nuevo con{' '}
                <strong>Importar</strong> (planilla matricial Excel/PDF).
              </p>
              {selected.origen === 'import_historico' ? (
                <button
                  type="button"
                  onClick={() => handleDeleteImport(selected)}
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Eliminar import vacío
import { AppDatePicker } from '@/components/ui/AppDatePicker';
                </button>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center p-8 text-xs text-slate-500">
              Seleccione un periodo para ver la planilla
            </div>
          )}
        </section>
      </div>
    </PageFormModal>
  );
}

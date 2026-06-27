'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { LayoutGrid, Square, Download, Loader2, Pencil, Users, Trash2, Eye, Share2 } from 'lucide-react';
import type { RotacionPlantillaRecord } from '@/lib/rotacion-plantillas/types';
import { totalTrabajadoresPlantilla } from '@/lib/rotacion-plantillas/types';
import type { InstanciaActivaSerialized } from '@/lib/rotacion-plantillas/instancia-serialize';
import { estatusRotacionShort } from '@/lib/rotacion-plantillas/types';
import { posicionEfectivaCuadrilla } from '@/lib/rotacion-plantillas/projection';
import {
  cancelarInstanciaAction,
  exportarBalanceRotacionAction,
} from '@/lib/actions/rotacion-instancias';
import { deleteRotacionPlantillaAction } from '@/lib/actions/rotacion-plantillas';
import {
  MINEOS_BTN_NOMINA_PRIMARY,
  MINEOS_TABLE_ACTION_DELETE,
  MINEOS_TABLE_ACTION_EDIT,
  mineosPanel,
} from '@/lib/mineos-visual';
import { useConfirm } from '@/components/ui/ConfirmDialogProvider';
import { cn } from '@/lib/utils';

type Props = {
  area: string;
  plantillas: RotacionPlantillaRecord[];
  instanciaActiva: InstanciaActivaSerialized | null;
  canEdit: boolean;
  onOpenSandbox: () => void;
  onEditPlantilla: (plantillaId: string) => void;
  onInstanciaChange?: () => void;
  migrationRequired?: boolean;
  onPreviewPdf?: () => void;
  onDownloadPdf?: () => void;
  onSharePdf?: () => void;
  canSharePdf?: boolean;
};

export function RotacionInstanciaPanel({
  area,
  plantillas,
  instanciaActiva,
  canEdit,
  onOpenSandbox,
  onEditPlantilla,
  onInstanciaChange,
  migrationRequired = false,
  onPreviewPdf,
  onDownloadPdf,
  onSharePdf,
  canSharePdf = false,
}: Props) {
  const [pending, startTransition] = useTransition();
  const confirmDialog = useConfirm();

  function handleCancelar() {
    if (!instanciaActiva) return;
    startTransition(async () => {
      const res = await cancelarInstanciaAction(instanciaActiva.id);
      if (res.ok) {
        toast.success(res.message);
        onInstanciaChange?.();
      } else toast.error(res.message);
    });
  }

  function handleExport() {
    if (!instanciaActiva) return;
    startTransition(async () => {
      const res = await exportarBalanceRotacionAction(instanciaActiva.id);
      if (res.ok && res.json) {
        await navigator.clipboard.writeText(res.json);
        toast.success('Export copiado al portapapeles.');
      } else if (!res.ok) toast.error(res.message);
    });
  }

  async function handleDeletePlantilla(p: RotacionPlantillaRecord) {
    if (instanciaActiva?.plantillaId === p.id) {
      toast.error('Cancele el ciclo activo antes de eliminar esta plantilla.');
      return;
    }
    const ok = await confirmDialog({
      title: 'Eliminar plantilla',
      message: `¿Desactivar «${p.nombre}»? No se borra el historial, pero dejará de aparecer en la lista.`,
      variant: 'danger',
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await deleteRotacionPlantillaAction(p.id);
      if (res.ok) {
        toast.success(res.message);
        onInstanciaChange?.();
      } else toast.error(res.message);
    });
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-3 text-left">
      <div className="flex items-start gap-2 border-b border-[var(--card-border)] pb-2.5">
        <LayoutGrid className="mt-0.5 h-5 w-5 shrink-0 text-amber-500/80" aria-hidden />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-white/90">Rotación operativa</h3>
          <p className="mt-0.5 text-[11px] leading-snug text-white/45">
            Diseñe plantillas con cuadrillas y guárdelas para usarlas en los periodos manuales de
            nómina.
          </p>
        </div>
        {canEdit && plantillas.length > 0 && (
          <button
            type="button"
            onClick={onOpenSandbox}
            className="shrink-0 text-[10px] font-bold text-[var(--mineos-general-bright)] hover:opacity-90"
          >
            + Nueva plantilla
          </button>
        )}
      </div>

      {migrationRequired && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-200">
          <p className="font-bold">Migración de base de datos pendiente</p>
          <p className="mt-1 text-[11px] text-red-200/80">
            Falta la tabla <code>rotacion_plantilla_cuadrillas</code>. En la raíz del proyecto ejecute:{' '}
            <code className="rounded bg-black/30 px-1 py-0.5">npm run supabase:migrate:rotacion</code>
          </p>
        </div>
      )}

      {instanciaActiva ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-amber-200">{instanciaActiva.plantillaNombre}</p>
              <p className="text-[10px] text-white/40">
                Desde {instanciaActiva.fechaInicioCiclo}
                {instanciaActiva.periodoOperativo
                  ? ` · Periodo ${instanciaActiva.periodoOperativo.label} (${instanciaActiva.periodoOperativo.inicio} — ${instanciaActiva.periodoOperativo.fin})`
                  : ''}
                {' · '}
                {instanciaActiva.cuadrillas.length} cuadrilla(s)
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {onPreviewPdf && (
                <button
                  type="button"
                  onClick={onPreviewPdf}
                  disabled={pending}
                  className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-200 hover:bg-amber-500/20 disabled:opacity-40"
                  title="Ver PDF"
                >
                  <Eye className="h-3 w-3" /> Ver PDF
                </button>
              )}
              {onDownloadPdf && (
                <button
                  type="button"
                  onClick={onDownloadPdf}
                  disabled={pending}
                  className="inline-flex items-center gap-1 rounded-md border border-zinc-700 px-2 py-1 text-[10px] text-white/70 hover:bg-zinc-800/40 disabled:opacity-40"
                  title="Descargar PDF"
                >
                  <Download className="h-3 w-3" /> PDF
                </button>
              )}
              {onSharePdf && canSharePdf && (
                <button
                  type="button"
                  onClick={onSharePdf}
                  disabled={pending}
                  className="inline-flex items-center gap-1 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-2 py-1 text-[10px] font-semibold text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-40"
                  title="Compartir PDF"
                >
                  <Share2 className="h-3 w-3" /> Compartir
                </button>
              )}
              <button
                type="button"
                onClick={handleExport}
                disabled={pending}
                className="inline-flex items-center gap-1 rounded-md border border-zinc-700 px-2 py-1 text-[10px] text-white/70"
              >
                <Download className="h-3 w-3" /> Balance
              </button>
              {canEdit && (
                <button
                  type="button"
                  onClick={handleCancelar}
                  disabled={pending}
                  className="inline-flex items-center gap-1 rounded-md border border-red-500/40 px-2 py-1 text-[10px] text-red-300"
                >
                  <Square className="h-3 w-3" /> Cancelar ciclo
                </button>
              )}
            </div>
          </div>
          <ul className="mt-3 space-y-1.5">
            {instanciaActiva.cuadrillas.map((c) => {
              const pos = posicionEfectivaCuadrilla(c.semanas.length, c.posicionActiva);
              const sem = c.semanas[pos];
              return (
                <li
                  key={c.cuadrillaId}
                  className="flex items-center justify-between rounded-lg border border-zinc-800/80 bg-zinc-950/50 px-3 py-2 text-xs"
                >
                  <span className="font-medium text-white/85">{c.cuadrillaNombre}</span>
                  <span className="text-white/45">
                    {sem ? `${sem.nombre} · ${estatusRotacionShort(sem.estatusDefault)}` : '—'}
                    {c.filas.length > 0 && ` · ${c.filas.length} trab.`}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {plantillas.length > 0 && (
        <div className={cn(mineosPanel('neutral'), 'w-full min-w-0 p-3')}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Plantillas almacenadas ({plantillas.length})
            </span>
          </div>
          <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {plantillas.map((p) => {
              const trab = totalTrabajadoresPlantilla(p);
              const isActive = instanciaActiva?.plantillaId === p.id;
              return (
                <li
                  key={p.id}
                  className={cn(
                    'flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2.5',
                    isActive
                      ? 'border-[var(--mineos-general-border)] bg-[var(--mineos-general-soft)]'
                      : 'border-[var(--card-border)] bg-[var(--card-bg)]',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-[var(--text-primary)]">{p.nombre}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-[var(--text-muted)]">
                      <span>{p.cuadrillas.length} cuadrilla(s)</span>
                      <span className="inline-flex items-center gap-0.5">
                        <Users className="h-3 w-3" /> {trab} trab.
                      </span>
                      {p.descripcion ? (
                        <span className="truncate opacity-70">{p.descripcion}</span>
                      ) : null}
                      {isActive && (
                        <span className="rounded bg-[var(--mineos-general-soft)] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[var(--mineos-general-bright)]">
                          Ciclo activo
                        </span>
                      )}
                    </p>
                  </div>
                  {canEdit && (
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onEditPlantilla(p.id)}
                        className={MINEOS_TABLE_ACTION_EDIT}
                        title="Editar plantilla"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePlantilla(p)}
                        disabled={pending || isActive}
                        className={MINEOS_TABLE_ACTION_DELETE}
                        title={isActive ? 'Cancele el ciclo antes de eliminar' : 'Eliminar plantilla'}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {plantillas.length === 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onOpenSandbox}
            className={`${MINEOS_BTN_NOMINA_PRIMARY} inline-flex h-9 items-center gap-2 px-4 text-xs`}
          >
            <LayoutGrid className="h-4 w-4" /> Crear primera plantilla
          </button>
          <p className="w-full text-[11px] text-white/35">
            No hay plantillas guardadas en {area}. Cree una con cuadrillas (Vertical, Cocina, Admin…)
            y asígnelas a trabajadores.
          </p>
        </div>
      )}
    </div>
  );
}

/** Banner compacto para vista semanal */
export function RotacionInstanciaBanner({
  instanciaActiva,
  weekStart,
}: {
  instanciaActiva: InstanciaActivaSerialized | null;
  weekStart?: string;
}) {
  if (!instanciaActiva) return null;

  const resumen = instanciaActiva.cuadrillas
    .slice(0, 4)
    .map((c) => {
      const pos = posicionEfectivaCuadrilla(c.semanas.length, c.posicionActiva);
      const sem = c.semanas[pos];
      return `${c.cuadrillaNombre}: ${sem?.nombre ?? '—'}`;
    })
    .join(' · ');

  const fueraPeriodo =
    weekStart &&
    instanciaActiva.periodoOperativo &&
    (weekStart < instanciaActiva.periodoOperativo.inicio ||
      weekStart > instanciaActiva.periodoOperativo.fin);

  return (
    <div
      className={`rounded-lg border px-3 py-2 text-[11px] ${
        fueraPeriodo
          ? 'border-zinc-700/80 bg-zinc-900/50 text-white/50'
          : 'border-amber-500/25 bg-amber-500/5 text-amber-100/90'
      }`}
    >
      {fueraPeriodo ? (
        <>
          <span className="font-bold text-white/60">Semana fuera del periodo operativo</span>
          <span className="text-white/40">
            {' '}
            — La plantilla &quot;{instanciaActiva.plantillaNombre}&quot; aplica solo{' '}
            {instanciaActiva.periodoOperativo?.inicio} — {instanciaActiva.periodoOperativo?.fin}. Esta
            semana usa histórico o esquema legacy.
          </span>
        </>
      ) : (
        <>
          <span className="font-bold">{instanciaActiva.plantillaNombre}</span>
          {instanciaActiva.periodoOperativo ? (
            <span className="text-amber-200/50"> · {instanciaActiva.periodoOperativo.label} · </span>
          ) : (
            <span className="text-amber-200/60"> — </span>
          )}
          <span className="text-amber-100/75">{resumen}</span>
        </>
      )}
    </div>
  );
}

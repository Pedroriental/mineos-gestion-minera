'use client';

import { cn } from '@/lib/utils';
import type { NominaSemana, Personal } from '@/lib/types';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  Edit2,
  FileText,
  Hammer,
  Loader2,
  Lock,
  MoreHorizontal,
  Plus,
  Printer,
  Receipt,
  RefreshCw,
  Search,
  Trash2,
  Umbrella,
  Upload,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';

export interface PreNominaRowState {
  personal: Personal;
  esSemanaLibre: boolean;
  bonoTransporte: number;
  bonificaciones: number;
  deducciones: number;
  total: number;
  estadoAsistencia: 'trabajada' | 'libre' | 'no_laborado';
  valesPendientes: { id: string; monto: number | string }[];
  totalVales: number;
}

type CargoTheme = { bg: string; text: string; border: string };

export function NominaMobileKpiStrip({
  totalSemana,
  activos,
  promedio,
  valesPend,
  fmtMoney,
}: {
  totalSemana: number;
  activos: number;
  promedio: number;
  valesPend: number;
  fmtMoney: (n: number) => string;
}) {
  const items = [
    { label: 'Semana', value: fmtMoney(totalSemana), accent: 'text-amber-400' },
    { label: 'Activos', value: String(activos), accent: 'text-white/90' },
    { label: 'Promedio', value: fmtMoney(promedio), accent: 'text-white/80' },
    { label: 'Vales', value: fmtMoney(valesPend), accent: 'text-red-400' },
  ];

  return (
    <div className="nomina-mobile-kpis -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 snap-x snap-mandatory scroll-smooth">
      {items.map((k) => (
        <div
          key={k.label}
          className="nomina-mobile-kpi snap-start shrink-0 min-w-[7.25rem] rounded-xl border border-zinc-800/80 bg-zinc-900/90 px-3 py-2.5 backdrop-blur-md"
        >
          <p className="text-[9px] font-bold uppercase tracking-wider text-white/40">{k.label}</p>
          <p className={cn('mt-1 text-sm font-extrabold tabular-nums', k.accent)}>{k.value}</p>
        </div>
      ))}
    </div>
  );
}

export function NominaMobileSteps({
  activeStep,
  onStep,
}: {
  activeStep: 1 | 2 | 3;
  onStep: (s: 1 | 2 | 3) => void;
}) {
  const steps = [
    { n: 1 as const, short: 'Asist.', full: 'Asistencia' },
    { n: 2 as const, short: 'Vales', full: 'Vales y bonos' },
    { n: 3 as const, short: 'Cierre', full: 'Cierre' },
  ];

  return (
    <div className="nomina-mobile-steps flex gap-2 overflow-x-auto pb-0.5 snap-x snap-mandatory">
      {steps.map((s) => {
        const active = activeStep === s.n;
        const done = activeStep > s.n;
        return (
          <button
            key={s.n}
            type="button"
            onClick={() => onStep(s.n)}
            className={cn(
              'snap-start shrink-0 flex items-center gap-2 rounded-full border px-3 py-2 text-left transition-all',
              active
                ? 'border-amber-500/50 bg-amber-500/15 text-amber-400 shadow-sm shadow-amber-500/10'
                : done
                  ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400'
                  : 'border-zinc-800 bg-zinc-950/50 text-white/45',
            )}
          >
            <span
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold',
                active ? 'bg-amber-500 text-black' : done ? 'bg-emerald-500 text-black' : 'bg-zinc-800 text-white/50',
              )}
            >
              {done ? '✓' : s.n}
            </span>
            <span className="text-[11px] font-bold leading-none">{s.full}</span>
          </button>
        );
      })}
    </div>
  );
}

export function NominaMobileStatusCard({
  cerrada,
  semanaActual,
  weekRange,
  setWeekRange,
  preNominaCount,
  totalSemana,
  procesadoOk,
  fmtMoney,
  fmtDate,
}: {
  cerrada: boolean;
  semanaActual?: NominaSemana;
  weekRange: { inicio: string; fin: string };
  setWeekRange: React.Dispatch<React.SetStateAction<{ inicio: string; fin: string }>>;
  preNominaCount: number;
  totalSemana: number;
  procesadoOk: string | null;
  fmtMoney: (n: number) => string;
  fmtDate: (iso: string) => string;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border px-4 py-3.5 backdrop-blur-xl',
        cerrada ? 'border-emerald-500/15 bg-emerald-500/5' : 'border-amber-500/20 bg-amber-500/5',
      )}
    >
      <div className="mb-3 flex items-center gap-2.5">
        <div
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
            cerrada ? 'bg-emerald-500/10' : 'bg-amber-500/10',
          )}
        >
          {cerrada ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn('text-sm font-bold', cerrada ? 'text-emerald-400' : 'text-amber-500')}>
            {cerrada ? 'Nómina cerrada' : 'Nómina pendiente'}
          </p>
          <p className="text-[10px] text-white/40">
            {cerrada && semanaActual
              ? `${semanaActual.total_trabajadores} trabajadores · ${fmtMoney(Number(semanaActual.total_pagado))}`
              : `${preNominaCount} activos · ${fmtMoney(totalSemana)}`}
          </p>
        </div>
        {cerrada && (
          <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-emerald-400">
            <Lock className="h-2.5 w-2.5" /> Frozen
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/70 px-2.5 py-2">
          <Calendar className={cn('h-3.5 w-3.5 shrink-0', cerrada ? 'text-emerald-400' : 'text-amber-500')} />
          <div className="min-w-0 flex-1">
            <span className="block text-[8px] font-bold uppercase text-white/35">Desde</span>
            <input
              type="date"
              value={weekRange.inicio}
              onChange={(e) => {
                const newInicio = e.target.value;
                const d = new Date(newInicio);
                d.setDate(d.getDate() + 6);
                setWeekRange({ inicio: newInicio, fin: d.toISOString().split('T')[0] });
              }}
              className="nomina-page__date-input w-full cursor-pointer border-0 bg-transparent p-0 text-xs text-white/90 outline-none"
            />
          </div>
        </label>
        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/70 px-2.5 py-2">
          <Calendar className={cn('h-3.5 w-3.5 shrink-0', cerrada ? 'text-emerald-400' : 'text-amber-500')} />
          <div className="min-w-0 flex-1">
            <span className="block text-[8px] font-bold uppercase text-white/35">Hasta</span>
            <input
              type="date"
              value={weekRange.fin}
              onChange={(e) => setWeekRange((prev) => ({ ...prev, fin: e.target.value }))}
              className="nomina-page__date-input w-full cursor-pointer border-0 bg-transparent p-0 text-xs text-white/90 outline-none"
            />
          </div>
        </label>
      </div>

      {procesadoOk && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {procesadoOk}
        </p>
      )}
    </div>
  );
}

export function NominaMobileHistorial({
  semanas,
  showHistorial,
  setShowHistorial,
  canEdit,
  isPending,
  onRevertir,
  fmtMoney,
  fmtDate,
}: {
  semanas: NominaSemana[];
  showHistorial: boolean;
  setShowHistorial: (v: boolean) => void;
  canEdit: boolean;
  isPending: boolean;
  onRevertir: (sem: NominaSemana) => void;
  fmtMoney: (n: number) => string;
  fmtDate: (iso: string) => string;
}) {
  if (semanas.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/80 backdrop-blur-md">
      <button
        type="button"
        onClick={() => setShowHistorial(!showHistorial)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/50">
          <Clock className="h-4 w-4 text-amber-500" />
          Historial de cierres
        </span>
        {showHistorial ? (
          <ChevronUp className="h-4 w-4 text-white/30" />
        ) : (
          <ChevronDown className="h-4 w-4 text-white/30" />
        )}
      </button>
      {showHistorial && (
        <div className="max-h-52 space-y-2 overflow-y-auto scroll-y-fade border-t border-zinc-800/80 p-3">
          {semanas.map((sem) => (
            <div key={sem.id} className="rounded-xl border border-zinc-850 bg-zinc-950/50 p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] font-bold text-white/90">
                  {fmtDate(sem.semana_inicio)} – {fmtDate(sem.semana_fin)}
                </p>
                <span className="shrink-0 rounded border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-bold uppercase text-emerald-400">
                  OK
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-zinc-800/50 pt-2">
                <p className="text-sm font-bold text-amber-500 tabular-nums">{fmtMoney(Number(sem.total_pagado))}</p>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => onRevertir(sem)}
                    disabled={isPending}
                    className="text-[9px] font-bold uppercase text-red-400 disabled:opacity-40"
                  >
                    Revertir
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function NominaMobileWorkerCard({
  row,
  activeStep,
  locked,
  canEdit,
  theme,
  initials,
  avatarColor,
  baseSal,
  onOpenDrawer,
  onOpenReceipt,
  onEdit,
  onDelete,
  onUpdateRow,
  fmtMoney,
}: {
  row: PreNominaRowState;
  activeStep: 1 | 2 | 3;
  locked: boolean;
  canEdit: boolean;
  theme?: CargoTheme;
  initials: string;
  avatarColor: string;
  baseSal: number;
  onOpenDrawer: () => void;
  onOpenReceipt: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onUpdateRow: (fields: Partial<PreNominaRowState>) => void;
  fmtMoney: (n: number) => string;
}) {
  const p = row.personal;

  return (
    <article className="nomina-mobile-worker rounded-2xl border border-zinc-800/90 bg-zinc-900/70 p-3.5 backdrop-blur-sm">
      <button type="button" onClick={onOpenDrawer} className="flex w-full items-start gap-3 text-left">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm',
            avatarColor,
          )}
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-white/95">{p.nombre_completo}</p>
          <p className="mt-0.5 truncate text-[10px] text-white/40">
            {p.cedula} · {p.cargo}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[9px] font-bold uppercase text-white/35">Neto</p>
          <p className="text-base font-black tabular-nums text-amber-500">{fmtMoney(row.total)}</p>
        </div>
      </button>

      {activeStep === 1 && (
        <div className="mt-3">
          <p className="mb-1.5 text-[9px] font-bold uppercase tracking-wider text-white/35">Asistencia</p>
          <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-zinc-800/80 bg-zinc-950/50 p-1">
            {(
              [
                ['trabajada', 'Turno', Hammer, 'amber'],
                ['libre', 'Libre', Umbrella, 'cyan'],
                ['no_laborado', 'Falta', XCircle, 'red'],
              ] as const
            ).map(([estado, label, Icon, color]) => {
              const on = row.estadoAsistencia === estado;
              return (
                <button
                  key={estado}
                  type="button"
                  disabled={locked}
                  onClick={() => onUpdateRow({ estadoAsistencia: estado })}
                  className={cn(
                    'flex flex-col items-center gap-0.5 rounded-lg py-2 text-[9px] font-bold uppercase transition-all disabled:opacity-45',
                    on && color === 'amber' && 'bg-amber-500/15 text-amber-400',
                    on && color === 'cyan' && 'bg-cyan-500/15 text-cyan-400',
                    on && color === 'red' && 'bg-red-500/15 text-red-400',
                    !on && 'text-white/40',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {(activeStep === 2 || activeStep === 3) && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-2.5 py-2">
            <span className="text-[9px] font-bold uppercase text-white/35">Sueldo</span>
            <p className="mt-0.5 font-semibold tabular-nums text-white/85">{fmtMoney(baseSal)}</p>
          </div>
          {activeStep >= 2 && (
            <>
              <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-2.5 py-2">
                <span className="text-[9px] font-bold uppercase text-white/35">Bono T.</span>
                <input
                  type="number"
                  value={row.bonoTransporte || ''}
                  disabled={locked}
                  onChange={(e) => onUpdateRow({ bonoTransporte: Number(e.target.value) || 0 })}
                  className="mt-0.5 w-full border-0 bg-transparent p-0 text-right font-semibold tabular-nums text-white/90 outline-none"
                  placeholder="0"
                />
              </div>
              <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-2.5 py-2">
                <span className="text-[9px] font-bold uppercase text-white/35">Bonos</span>
                <input
                  type="number"
                  value={row.bonificaciones || ''}
                  disabled={locked}
                  onChange={(e) => onUpdateRow({ bonificaciones: Number(e.target.value) || 0 })}
                  className="mt-0.5 w-full border-0 bg-transparent p-0 text-right font-semibold tabular-nums text-white/90 outline-none"
                  placeholder="0"
                />
              </div>
              <button
                type="button"
                onClick={onOpenDrawer}
                className={cn(
                  'flex items-center justify-between rounded-lg border px-2.5 py-2',
                  row.totalVales > 0
                    ? 'border-red-500/25 bg-red-500/10 text-red-400'
                    : 'border-zinc-800/80 bg-zinc-950/40 text-white/50',
                )}
              >
                <span className="flex items-center gap-1 text-[9px] font-bold uppercase">
                  <FileText className="h-3.5 w-3.5" />
                  Vales
                </span>
                <span className="font-bold tabular-nums">{fmtMoney(row.totalVales)}</span>
              </button>
            </>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center justify-end gap-1 border-t border-zinc-800/60 pt-2">
        <button
          type="button"
          onClick={onOpenReceipt}
          className="rounded-lg p-2 text-white/40 hover:bg-white/5 hover:text-white"
          aria-label="Comprobante"
        >
          <Receipt className="h-4 w-4" />
        </button>
        {canEdit && !locked && (
          <>
            <button
              type="button"
              onClick={onEdit}
              className="rounded-lg p-2 text-white/40 hover:bg-white/5 hover:text-amber-400"
              aria-label="Editar"
            >
              <Edit2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="rounded-lg p-2 text-white/40 hover:bg-red-500/10 hover:text-red-400"
              aria-label="Eliminar"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </article>
  );
}

export function NominaMobileActionBar({
  cerrada,
  canEdit,
  hasRows,
  isPending,
  onCerrar,
  onRevertir,
  onRegistrar,
  onMore,
}: {
  cerrada: boolean;
  canEdit: boolean;
  hasRows: boolean;
  isPending: boolean;
  onCerrar: () => void;
  onRevertir: () => void;
  onRegistrar: () => void;
  onMore: () => void;
}) {
  return (
    <div
      className="nomina-mobile-action-bar lg:hidden"
      role="toolbar"
      aria-label="Acciones de nómina"
    >
      <div className="nomina-mobile-action-bar__glass mx-3 flex items-stretch gap-2 rounded-2xl border border-white/[0.08] p-1.5 shadow-[0_-8px_32px_rgba(0,0,0,0.45)]">
        {cerrada ? (
          <button
            type="button"
            onClick={onRevertir}
            disabled={!canEdit || isPending}
            className="flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-2.5 text-red-400 disabled:opacity-40"
          >
            {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
            <span className="text-[9px] font-bold uppercase tracking-wide">Revertir</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onCerrar}
            disabled={!canEdit || !hasRows}
            className="flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl bg-amber-500 py-2.5 text-black disabled:opacity-40"
          >
            <Wallet className="h-5 w-5" />
            <span className="text-[9px] font-bold uppercase tracking-wide">Cerrar</span>
          </button>
        )}
        <button
          type="button"
          onClick={onRegistrar}
          disabled={!canEdit}
          className="flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl border border-amber-500/30 bg-amber-500/10 py-2.5 text-amber-400 disabled:opacity-40"
        >
          <Plus className="h-5 w-5" />
          <span className="text-[9px] font-bold uppercase tracking-wide">Alta</span>
        </button>
        <button
          type="button"
          onClick={onMore}
          className="flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-2.5 text-white/55"
        >
          <MoreHorizontal className="h-5 w-5" />
          <span className="text-[9px] font-bold uppercase tracking-wide">Más</span>
        </button>
      </div>
    </div>
  );
}

export function NominaMobileMoreSheet({
  open,
  onClose,
  canEdit,
  hasData,
  onImport,
  onPdf,
  onCsv,
  onBorrar,
}: {
  open: boolean;
  onClose: () => void;
  canEdit: boolean;
  hasData: boolean;
  onImport: () => void;
  onPdf: () => void;
  onCsv: () => void;
  onBorrar: () => void;
}) {
  if (!open) return null;

  const items = [
    { label: 'Importar nómina', icon: Upload, onClick: onImport, needsEdit: true },
    { label: 'Exportar PDF', icon: Printer, onClick: onPdf, needsEdit: false },
    { label: 'Exportar CSV', icon: Download, onClick: onCsv, needsEdit: false },
    { label: 'Dar de baja todo', icon: Trash2, onClick: onBorrar, needsEdit: true, danger: true },
  ];

  return (
    <div className="fixed inset-0 z-[55] lg:hidden" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-label="Cerrar" />
      <div className="nomina-mobile-sheet absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-white/10 bg-zinc-950/95 px-4 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-2xl">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-zinc-700" />
        <p className="mb-3 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Más acciones</p>
        <div className="space-y-1.5">
          {items.map((item) => {
            const Icon = item.icon;
            const disabled = item.needsEdit && !canEdit;
            if (item.label.includes('baja') && !hasData) return null;
            return (
              <button
                key={item.label}
                type="button"
                disabled={disabled}
                onClick={() => {
                  item.onClick();
                  onClose();
                }}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-left transition-colors disabled:opacity-40',
                  item.danger
                    ? 'text-red-400 hover:bg-red-500/10'
                    : 'text-white/85 hover:bg-white/[0.04]',
                )}
              >
                <span
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-xl border',
                    item.danger ? 'border-red-500/20 bg-red-500/10' : 'border-zinc-800 bg-zinc-900',
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-sm font-semibold">{item.label}</span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-800 py-3 text-sm font-semibold text-white/60"
        >
          <X className="h-4 w-4" />
          Cerrar
        </button>
      </div>
    </div>
  );
}

export function NominaMobileSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/80 px-3 py-2.5 backdrop-blur-md">
      <Search className="h-4 w-4 shrink-0 text-white/35" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Buscar nombre o cédula…"
        className="min-w-0 flex-1 border-0 bg-transparent text-sm text-white/90 placeholder:text-white/30 outline-none"
      />
    </div>
  );
}

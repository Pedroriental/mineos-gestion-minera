'use client';

import NominaNovedadTurnoCell from '@/components/nomina/NominaNovedadTurnoCell';
import { MobileSheetActionList } from '@/components/mobile/MobileSheetActionList';
import { SheetIconBadge } from '@/components/mobile/SheetIconBadge';
import { PageFormModal } from '@/components/ui/PageFormModal';
import { cn } from '@/lib/utils';
import { NOMINA_DIAS_POR_SEMANA } from '@/lib/nomina-calculo';
import { AppDatePicker } from '@/components/ui/AppDatePicker';
import type { NominaNovedadTurno } from '@/lib/nomina-novedad-turno';
import type { NominaSemana, NominaVale, Personal } from '@/lib/types';
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
  XCircle,
  FileSpreadsheet,
  Archive,
  Home,
} from 'lucide-react';

export interface PreNominaRowState {
  personal: Personal;
  esSemanaLibre: boolean;
  bonoTransporte: number;
  bonificaciones: number;
  deducciones: number;
  total: number;
  estadoAsistencia: 'trabajada' | 'libre' | 'no_laborado';
  diasTrabajados: number;
  salarioBaseCalculado: number;
  valesPendientes: NominaVale[];
  totalVales: number;
  novedadTurno: NominaNovedadTurno;
  novedadTurnoObs: string;
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
    <div className="nomina-mobile-kpis flex gap-2 overflow-x-auto pb-0.5 snap-x snap-mandatory scroll-smooth">
      {items.map((k) => (
        <div key={k.label} className="nomina-mobile-kpi snap-start shrink-0 min-w-[6.75rem] px-3 py-2">
          <p className="nomina-mobile-kpi__label">{k.label}</p>
          <p className={cn('nomina-mobile-kpi__value tabular-nums', k.accent)}>{k.value}</p>
        </div>
      ))}
    </div>
  );
}

export type NominaMobileStep = 1 | 2;

const NOMINA_MOBILE_STEPS = [
  { n: 1 as const, label: 'Asistencia', Icon: Hammer },
  { n: 2 as const, label: 'Vales', Icon: FileText },
] as const;

function NominaMobileStepTabs({
  activeStep,
  onStep,
  className,
}: {
  activeStep: NominaMobileStep;
  onStep: (s: NominaMobileStep) => void;
  className?: string;
}) {
  return (
    <div
      className={cn('mobile-hotbar__dock grid grid-cols-2 gap-px p-px', className)}
      role="tablist"
      aria-label="Pasos de nómina"
    >
      {NOMINA_MOBILE_STEPS.map((s) => {
        const active = activeStep === s.n;
        const Icon = s.Icon;
        return (
          <button
            key={s.n}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onStep(s.n)}
            className={cn(
              'mobile-hotbar__item relative flex flex-col items-center justify-center gap-px rounded-[0.55rem] py-px outline-none transition-all active:scale-[0.97]',
              active && 'mobile-hotbar__item--active',
            )}
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <span className="mobile-hotbar__icon-wrap flex items-center justify-center transition-[color,filter,box-shadow] duration-200">
              <Icon className="h-3 w-3" strokeWidth={2.25} />
            </span>
            <span className="mobile-hotbar__label max-w-full truncate px-0.5 font-semibold">{s.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function NominaMobileSteps({
  activeStep,
  onStep,
}: {
  activeStep: NominaMobileStep;
  onStep: (s: NominaMobileStep) => void;
}) {
  return <NominaMobileStepTabs activeStep={activeStep} onStep={onStep} />;
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
    <div className={cn('nomina-mobile-status', cerrada && 'nomina-mobile-status--closed')}>
      <div className="nomina-mobile-status__head">
        <div className={cn('nomina-mobile-status__icon', cerrada ? 'nomina-mobile-status__icon--closed' : '')}>
          {cerrada ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn('nomina-mobile-status__title', cerrada ? 'text-emerald-400' : 'text-amber-400')}>
            {cerrada ? 'Nómina cerrada' : 'Nómina pendiente'}
          </p>
          <p className="nomina-mobile-status__meta">
            {cerrada && semanaActual
              ? `${semanaActual.total_trabajadores} trabajadores · ${fmtMoney(Number(semanaActual.total_pagado))}`
              : `${preNominaCount} activos · ${fmtMoney(totalSemana)}`}
          </p>
        </div>
        {cerrada && (
          <span className="nomina-mobile-status__badge">
            <Lock className="h-2.5 w-2.5" /> Bloqueada
          </span>
        )}
      </div>

      <div className="nomina-mobile-status__dates">
        <label className="nomina-mobile-status__date">
          <Calendar className={cn('h-3.5 w-3.5 shrink-0', cerrada ? 'text-emerald-400' : 'text-amber-500')} />
          <div className="min-w-0 flex-1">
            <span className="nomina-mobile-status__date-label">Desde</span>
            <AppDatePicker
              value={weekRange.inicio}
              onChange={(val) => {
                const d = new Date(val);
                d.setDate(d.getDate() + 6);
                setWeekRange({ inicio: val, fin: d.toISOString().split('T')[0] });
              }}
            />
          </div>
        </label>
        <label className="nomina-mobile-status__date">
          <Calendar className={cn('h-3.5 w-3.5 shrink-0', cerrada ? 'text-emerald-400' : 'text-amber-500')} />
          <div className="min-w-0 flex-1">
            <span className="nomina-mobile-status__date-label">Hasta</span>
            <AppDatePicker
              value={weekRange.fin}
              onChange={(val) => setWeekRange((prev) => ({ ...prev, fin: val }))}
            />
          </div>
        </label>
      </div>

      {procesadoOk && (
        <p className="nomina-mobile-status__ok">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
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
    <div className="nomina-mobile-historial">
      <button
        type="button"
        onClick={() => setShowHistorial(!showHistorial)}
        className="nomina-mobile-historial__toggle"
      >
        <span className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-amber-500" />
          Historial de cierres
        </span>
        {showHistorial ? (
          <ChevronUp className="h-4 w-4 text-white/35" />
        ) : (
          <ChevronDown className="h-4 w-4 text-white/35" />
        )}
      </button>
      {showHistorial && (
        <div className="nomina-mobile-historial__list">
          {semanas.map((sem) => (
            <div key={sem.id} className="nomina-mobile-historial__item">
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
  onOpenDrawer,
  onOpenReceipt,
  onEdit,
  onDelete,
  onUpdateRow,
  onNovedadTurnoChange,
  fmtMoney,
}: {
  row: PreNominaRowState;
  activeStep: NominaMobileStep;
  locked: boolean;
  canEdit: boolean;
  onNovedadTurnoChange: (fields: Partial<Pick<PreNominaRowState, 'novedadTurno' | 'novedadTurnoObs'>>) => void;
  theme?: CargoTheme;
  initials: string;
  avatarColor: string;
  onOpenDrawer: () => void;
  onOpenReceipt: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onUpdateRow: (fields: Partial<PreNominaRowState>) => void;
  fmtMoney: (n: number) => string;
}) {
  const p = row.personal;

  return (
    <article className="nomina-mobile-worker rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-2.5 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onOpenDrawer} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <div
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white',
              avatarColor,
            )}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold leading-tight text-white/95">{p.nombre_completo}</p>
            <p className="truncate text-[9px] text-white/40">
              {p.cedula}
              {theme ? (
                <>
                  {' · '}
                  <span className={cn(theme.text)}>{p.cargo}</span>
                </>
              ) : (
                <> · {p.cargo}</>
              )}
            </p>
          </div>
        </button>
        <div className="shrink-0 text-right">
          <p className="text-[8px] font-bold uppercase text-white/30">Neto</p>
          <p className="text-sm font-black tabular-nums leading-none text-amber-500">{fmtMoney(row.total)}</p>
        </div>
        <div className="nomina-mobile-worker__actions flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={onOpenReceipt}
            className="rounded-md p-1.5 text-white/35 hover:bg-white/5 hover:text-white"
            aria-label="Comprobante"
          >
            <Receipt className="h-3.5 w-3.5" />
          </button>
          {canEdit && !locked && (
            <>
              <button
                type="button"
                onClick={onEdit}
                className="rounded-md p-1.5 text-white/35 hover:bg-white/5 hover:text-amber-400"
                aria-label="Editar"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="rounded-md p-1.5 text-white/35 hover:bg-red-500/10 hover:text-red-400"
                aria-label="Eliminar"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {activeStep === 1 && (
        <div className="nomina-mobile-worker__step mt-2 space-y-1.5">
          <div className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800/70 bg-zinc-950/40 px-2 py-1.5">
            <span className="text-[8px] font-bold uppercase tracking-wide text-white/35">Novedad</span>
            <NominaNovedadTurnoCell
              value={row.novedadTurno}
              observacion={row.novedadTurnoObs}
              disabled={locked || !canEdit}
              workerName={p.nombre_completo}
              onChange={(novedadTurno) => onNovedadTurnoChange({ novedadTurno })}
              onObservacionChange={(novedadTurnoObs) => onNovedadTurnoChange({ novedadTurnoObs })}
            />
          </div>
          <div className="flex gap-1 rounded-lg border border-zinc-800/70 bg-zinc-950/40 p-0.5">
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
                    'flex flex-1 items-center justify-center gap-1 rounded-md py-1.5 text-[8px] font-bold uppercase transition-all disabled:opacity-45',
                    on && color === 'amber' && 'bg-amber-500/15 text-amber-400',
                    on && color === 'cyan' && 'bg-cyan-500/15 text-cyan-400',
                    on && color === 'red' && 'bg-red-500/15 text-red-400',
                    !on && 'text-white/40',
                  )}
                >
                  <Icon className="h-3 w-3 shrink-0" />
                  {label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between gap-2 px-0.5">
            <span className="text-[8px] font-bold uppercase text-white/35">Días trabajados</span>
            <input
              type="number"
              min={0}
              max={NOMINA_DIAS_POR_SEMANA}
              step={1}
              disabled={locked}
              value={row.diasTrabajados}
              onChange={(e) => onUpdateRow({ diasTrabajados: Number(e.target.value) })}
              className="w-12 rounded-md border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-center text-xs font-bold tabular-nums text-amber-400 outline-none focus:border-amber-500/50 disabled:opacity-45"
            />
          </div>
        </div>
      )}

      {activeStep === 2 && (
        <div className="nomina-mobile-worker__step mt-2 space-y-1.5">
          <div className="grid grid-cols-3 gap-1 text-[10px]">
            <div className="rounded-md border border-zinc-800/70 bg-zinc-950/35 px-2 py-1.5">
              <span className="text-[8px] font-bold uppercase text-white/35">Sueldo</span>
              <p className="mt-0.5 font-semibold tabular-nums text-white/85">
                {fmtMoney(row.salarioBaseCalculado)}
              </p>
            </div>
            <label className="rounded-md border border-zinc-800/70 bg-zinc-950/35 px-2 py-1.5">
              <span className="text-[8px] font-bold uppercase text-white/35">Bono T.</span>
              <input
                type="number"
                value={row.bonoTransporte || ''}
                disabled={locked}
                onChange={(e) => onUpdateRow({ bonoTransporte: Number(e.target.value) || 0 })}
                className="mt-0.5 w-full border-0 bg-transparent p-0 text-right text-[11px] font-semibold tabular-nums text-white/90 outline-none"
                placeholder="0"
              />
            </label>
            <label className="rounded-md border border-zinc-800/70 bg-zinc-950/35 px-2 py-1.5">
              <span className="text-[8px] font-bold uppercase text-white/35">Bonos</span>
              <input
                type="number"
                value={row.bonificaciones || ''}
                disabled={locked}
                onChange={(e) => onUpdateRow({ bonificaciones: Number(e.target.value) || 0 })}
                className="mt-0.5 w-full border-0 bg-transparent p-0 text-right text-[11px] font-semibold tabular-nums text-white/90 outline-none"
                placeholder="0"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={onOpenDrawer}
            className={cn(
              'flex w-full items-center justify-between rounded-md border px-2.5 py-1.5',
              row.totalVales > 0
                ? 'border-red-500/25 bg-red-500/10 text-red-400'
                : 'border-zinc-800/70 bg-zinc-950/35 text-white/50',
            )}
          >
            <span className="flex items-center gap-1 text-[8px] font-bold uppercase">
              <FileText className="h-3 w-3" />
              Vales
              {row.valesPendientes.length > 0 ? (
                <span className="rounded bg-red-500/20 px-1 text-[7px]">{row.valesPendientes.length}</span>
              ) : null}
            </span>
            <span className="text-[11px] font-bold tabular-nums">{fmtMoney(row.totalVales)}</span>
          </button>
        </div>
      )}

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
          <span className="text-[9px] font-bold uppercase tracking-wide">Asignar</span>
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
  onArchivo,
  onPdf,
  onCsv,
  onExcel,
  onBorrar,
  onInicio,
}: {
  open: boolean;
  onClose: () => void;
  canEdit: boolean;
  hasData: boolean;
  onImport: () => void;
  onArchivo?: () => void;
  onPdf: () => void;
  onCsv: () => void;
  onExcel?: () => void;
  onBorrar: () => void;
  onInicio?: () => void;
}) {
  const items = [
    ...(onInicio
      ? [{ label: 'Ir al inicio', icon: Home, onClick: onInicio, needsEdit: false }]
      : []),
    { label: 'Importar planilla / roster', icon: Upload, onClick: onImport, needsEdit: true },
    ...(onArchivo
      ? [{ label: 'Archivo de periodos', icon: Archive, onClick: onArchivo, needsEdit: false }]
      : []),
    ...(onExcel
      ? [{ label: 'Vista Excel (propuesta)', icon: FileSpreadsheet, onClick: onExcel, needsEdit: false }]
      : []),
    { label: 'Exportar PDF', icon: Printer, onClick: onPdf, needsEdit: false },
    { label: 'Exportar CSV', icon: Download, onClick: onCsv, needsEdit: false },
    { label: 'Dar de baja todo', icon: Trash2, onClick: onBorrar, needsEdit: true, danger: true },
  ];

  return (
    <PageFormModal
      open={open}
      onClose={onClose}
      align="bottom"
      sheetTitle="Más acciones"
      sheetIcon={<SheetIconBadge icon={MoreHorizontal} />}
      backdropClassName="lg:hidden"
      panelClassName="nomina-mobile-sheet"
    >
      <div className="lg:hidden">
        <MobileSheetActionList
          actions={items.map((item) => ({
            label: item.label,
            icon: item.icon,
            destructive: item.danger,
            disabled: item.needsEdit && !canEdit,
            hidden: item.label.includes('baja') && !hasData,
            onClick: () => {
              item.onClick();
              onClose();
            },
          }))}
        />
      </div>
    </PageFormModal>
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
    <div className="nomina-mobile-chrome__search flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/80 px-2.5 py-1.5 backdrop-blur-md">
      <Search className="h-3.5 w-3.5 shrink-0 text-white/35" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Buscar"
        className="min-w-0 flex-1 border-0 bg-transparent text-sm text-white/90 placeholder:text-white/30 outline-none"
      />
    </div>
  );
}

/** Cabecera fija: estado, semana, total y pasos de la nómina guiada. */
export function NominaMobileStickyChrome({
  pageTitle,
  cerrada,
  weekLabel,
  totalSemana,
  preNominaCount,
  activeStep,
  onStep,
  onOpenSemana,
  search,
  onSearchChange,
  fmtMoney,
}: {
  pageTitle: string;
  cerrada: boolean;
  weekLabel: string;
  totalSemana: number;
  preNominaCount: number;
  activeStep: NominaMobileStep;
  onStep: (s: NominaMobileStep) => void;
  onOpenSemana: () => void;
  search: string;
  onSearchChange: (v: string) => void;
  fmtMoney: (n: number) => string;
}) {
  return (
    <div className="nomina-mobile-chrome sticky top-0 z-20 shrink-0 space-y-1.5 border-b border-zinc-800/80 bg-[var(--dashboard-bg,#09090b)]/95 px-3 py-2 backdrop-blur-xl lg:hidden">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[9px] font-bold uppercase tracking-[0.12em] text-amber-500/90">
            {pageTitle}
          </p>
          <button
            type="button"
            onClick={onOpenSemana}
            className="mt-0.5 flex max-w-full items-center gap-1 text-left"
          >
            <Calendar className="h-3 w-3 shrink-0 text-white/40" />
            <span className="truncate text-[11px] font-semibold text-white/85">{weekLabel}</span>
            <ChevronDown className="h-3 w-3 shrink-0 text-white/30" />
          </button>
        </div>
        <div className="shrink-0 text-right">
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded border px-1 py-px text-[7px] font-black uppercase tracking-widest',
              cerrada
                ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400'
                : 'border-amber-500/25 bg-amber-500/10 text-amber-400',
            )}
          >
            {cerrada ? <Lock className="h-2 w-2" /> : <Clock className="h-2 w-2" />}
            {cerrada ? 'Cerrada' : 'Abierta'}
          </span>
          <p className="mt-0.5 text-xs font-black tabular-nums leading-none text-amber-400">{fmtMoney(totalSemana)}</p>
          <p className="text-[8px] text-white/35">{preNominaCount} activos</p>
        </div>
      </div>

      <NominaMobileStepTabs activeStep={activeStep} onStep={onStep} />

      <NominaMobileSearch value={search} onChange={onSearchChange} />
    </div>
  );
}

/** Panel semana: fechas, KPIs, historial y distribución. */
export function NominaMobileSemanaSheet({
  open,
  onClose,
  cerrada,
  semanaActual,
  weekRange,
  setWeekRange,
  preNominaCount,
  totalSemana,
  activos,
  promedio,
  valesPend,
  procesadoOk,
  semanas,
  showHistorial,
  setShowHistorial,
  canEdit,
  isPending,
  onRevertir,
  anomalyPct,
  temporalHint,
  onGoWorkingWeek,
  distribucionPanel,
  fmtMoney,
  fmtDate,
}: {
  open: boolean;
  onClose: () => void;
  cerrada: boolean;
  semanaActual?: NominaSemana;
  weekRange: { inicio: string; fin: string };
  setWeekRange: React.Dispatch<React.SetStateAction<{ inicio: string; fin: string }>>;
  preNominaCount: number;
  totalSemana: number;
  activos: number;
  promedio: number;
  valesPend: number;
  procesadoOk: string | null;
  semanas: NominaSemana[];
  showHistorial: boolean;
  setShowHistorial: (v: boolean) => void;
  canEdit: boolean;
  isPending: boolean;
  onRevertir: (sem: NominaSemana) => void;
  anomalyPct: number | null;
  temporalHint: string | null;
  onGoWorkingWeek: () => void;
  distribucionPanel?: React.ReactNode;
  fmtMoney: (n: number) => string;
  fmtDate: (iso: string) => string;
}) {
  return (
    <PageFormModal
      open={open}
      onClose={onClose}
      align="bottom"
      sheetTitle="Semana y resumen"
      sheetIcon={<SheetIconBadge icon={Calendar} tone="info" />}
      backdropClassName="lg:hidden"
      panelClassName="nomina-mobile-sheet"
    >
      <div className="nomina-mobile-sheet__content lg:hidden">
        <NominaMobileStatusCard
          cerrada={cerrada}
          semanaActual={semanaActual}
          weekRange={weekRange}
          setWeekRange={setWeekRange}
          preNominaCount={preNominaCount}
          totalSemana={totalSemana}
          procesadoOk={procesadoOk}
          fmtMoney={fmtMoney}
          fmtDate={fmtDate}
        />

        <div className="nomina-mobile-sheet__section">
          <NominaMobileKpiStrip
            totalSemana={totalSemana}
            activos={activos}
            promedio={promedio}
            valesPend={valesPend}
            fmtMoney={fmtMoney}
          />
        </div>

        {temporalHint ? (
          <div className="mobile-sheet-callout mobile-sheet-callout--info">
            <p className="text-[10px] leading-snug text-sky-200/90">{temporalHint}</p>
            <button
              type="button"
              onClick={onGoWorkingWeek}
              className="mt-2 text-[10px] font-bold uppercase tracking-wide text-sky-400 hover:text-sky-300"
            >
              Ir a semana de curso
            </button>
          </div>
        ) : null}

        {anomalyPct != null && Math.abs(anomalyPct) > 15 ? (
          <div className="mobile-sheet-callout mobile-sheet-callout--warn flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
            <p className="text-[10px] leading-snug text-yellow-300">
              <strong>Anomalía:</strong> {Math.abs(anomalyPct).toFixed(1)}% vs semana anterior.
            </p>
          </div>
        ) : null}

        {distribucionPanel ? (
          <div className="nomina-mobile-sheet__section max-h-[min(16rem,35vh)] overflow-y-auto">
            {distribucionPanel}
          </div>
        ) : null}

        <div className="nomina-mobile-sheet__section">
          <NominaMobileHistorial
            semanas={semanas}
            showHistorial={showHistorial}
            setShowHistorial={setShowHistorial}
            canEdit={canEdit}
            isPending={isPending}
            onRevertir={onRevertir}
            fmtMoney={fmtMoney}
            fmtDate={fmtDate}
          />
        </div>
      </div>
    </PageFormModal>
  );
}

/** Dock contextual de nómina — sustituye hotbar global y barra de acciones flotante. */
export function NominaMobileDock({
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
    <nav
      className="nomina-mobile-dock lg:hidden"
      role="toolbar"
      aria-label="Acciones de nómina"
    >
      <div className="nomina-mobile-dock__inner mx-3 flex items-stretch gap-1 rounded-xl border border-white/[0.08] bg-zinc-950/92 p-1 shadow-[0_-4px_20px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <button
          type="button"
          onClick={onRegistrar}
          disabled={!canEdit}
          className="nomina-mobile-dock__btn flex flex-1 flex-col items-center justify-center gap-px rounded-lg py-1.5 text-amber-400 disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
          <span className="text-[8px] font-bold uppercase tracking-wide">Asignar</span>
        </button>
        {cerrada ? (
          <button
            type="button"
            onClick={onRevertir}
            disabled={!canEdit || isPending}
            className="nomina-mobile-dock__btn nomina-mobile-dock__btn--primary flex flex-[1.25] flex-col items-center justify-center gap-px rounded-lg bg-red-500/15 py-1.5 text-red-400 disabled:opacity-40"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="text-[8px] font-bold uppercase tracking-wide">Revertir</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onCerrar}
            disabled={!canEdit || !hasRows}
            className="nomina-mobile-dock__btn nomina-mobile-dock__btn--primary flex flex-[1.25] flex-col items-center justify-center gap-px rounded-lg bg-amber-500 py-1.5 text-black disabled:opacity-40"
          >
            <Wallet className="h-4 w-4" />
            <span className="text-[8px] font-bold uppercase tracking-wide">Cerrar</span>
          </button>
        )}
        <button
          type="button"
          onClick={onMore}
          className="nomina-mobile-dock__btn flex flex-1 flex-col items-center justify-center gap-px rounded-lg py-1.5 text-white/55"
        >
          <MoreHorizontal className="h-4 w-4" />
          <span className="text-[8px] font-bold uppercase tracking-wide">Más</span>
        </button>
      </div>
    </nav>
  );
}

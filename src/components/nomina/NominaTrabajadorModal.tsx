'use client';

import { useEffect, useState } from 'react';
import {
  Calendar,
  DollarSign,
  Edit2,
  Hammer,
  History,
  Loader2,
  Lock,
  Plus,
  Receipt,
  Trash2,
  Umbrella,
  X,
  XCircle,
} from 'lucide-react';
import { PageFormModal, PageFormModalFooter } from '@/components/ui/PageFormModal';
import type { PreNominaRowState } from '@/components/nomina/nomina-mobile';
import {
  NOVEDAD_TURNO_LABEL,
  novedadTurnoTone,
} from '@/lib/nomina-novedad-turno';
import { getGrupoNominaKey } from '@/lib/personal-master';
import {
  MINEOS_BTN_NOMINA_PRIMARY,
  mineosBtnSubtleClass,
  mineosPanel,
} from '@/lib/mineos-visual';
import { cn } from '@/lib/utils';
import type { HistorialPagoRow, NominaVale } from '@/lib/types';

function Sparkline({
  data,
  width = 200,
  height = 40,
  color = 'var(--mineos-general-bright)',
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

const ASISTENCIA_META = {
  trabajada: {
    label: 'Turno',
    Icon: Hammer,
    tone: 'text-[var(--mineos-general-bright)] bg-[var(--mineos-general-soft)] border-[var(--mineos-general-border)]',
  },
  libre: {
    label: 'Libre',
    Icon: Umbrella,
    tone: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/25',
  },
  no_laborado: {
    label: 'Falta',
    Icon: XCircle,
    tone: 'text-[var(--mineos-expense)] bg-[var(--mineos-expense-soft)] border-[var(--mineos-expense-border)]',
  },
} as const;

type Props = {
  open: boolean;
  onClose: () => void;
  row: PreNominaRowState;
  vales: NominaVale[];
  historial: HistorialPagoRow[];
  loading: boolean;
  canEdit: boolean;
  locked: boolean;
  isPending: boolean;
  weekStart: string;
  weekEnd: string;
  newValeMonto: string;
  newValeMotivo: string;
  onNewValeMontoChange: (v: string) => void;
  onNewValeMotivoChange: (v: string) => void;
  onAddVale: () => void;
  onDeleteVale: (valeId: string) => void;
  onEditPerfil: () => void;
  onFichaPago: () => void;
  fmtMoney: (n: number) => string;
  fmtDate: (d: string | null | undefined) => string;
  initials: string;
  avatarColor: string;
};

function BreakdownLine({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'benefit' | 'expense' | 'accent';
}) {
  const valueClass =
    tone === 'benefit'
      ? 'text-[var(--mineos-benefit)]'
      : tone === 'expense'
        ? 'text-[var(--mineos-expense)]'
        : tone === 'accent'
          ? 'text-[var(--mineos-general-bright)]'
          : 'text-[var(--text-primary)]';
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className={cn('font-semibold tabular-nums', valueClass)}>{value}</span>
    </div>
  );
}

export default function NominaTrabajadorModal({
  open,
  onClose,
  row,
  vales,
  historial,
  loading,
  canEdit,
  locked,
  isPending,
  weekStart,
  weekEnd,
  newValeMonto,
  newValeMotivo,
  onNewValeMontoChange,
  onNewValeMotivoChange,
  onAddVale,
  onDeleteVale,
  onEditPerfil,
  onFichaPago,
  fmtMoney,
  fmtDate,
  initials,
  avatarColor,
}: Props) {
  const [tab, setTab] = useState<'semana' | 'vales' | 'historial'>('semana');
  const p = row.personal;

  useEffect(() => {
    if (open) setTab('semana');
  }, [open, p.id]);
  const totalVales = vales.reduce((s, v) => s + Number(v.monto), 0);
  const asistencia = ASISTENCIA_META[row.estadoAsistencia];
  const AsistenciaIcon = asistencia.Icon;
  const asignacion =
    row.cuadrillaNombre?.trim() ||
    getGrupoNominaKey(p) ||
    p.area_detalle?.trim() ||
    p.cargo ||
    'Sin asignación';
  const salarioLibre = Number(p.salario_libre) || Number(p.salario_base);

  return (
    <PageFormModal open={open} onClose={onClose} panelClassName="sm:max-w-lg">
      <button
        type="button"
        onClick={onClose}
        className="absolute right-5 top-5 rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-white/[0.06] hover:text-[var(--text-primary)] sm:right-6 sm:top-6"
        aria-label="Cerrar"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Identidad */}
      <div className="flex items-start gap-3 pr-10">
        <div
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm',
            avatarColor,
          )}
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-bold text-[var(--text-primary)]">
            {p.nombre_completo}
          </h3>
          <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
            C.I. {p.cedula}
            {p.cargo ? ` · ${p.cargo}` : ''}
          </p>
          <p className="mt-1 truncate text-[11px] font-medium text-[var(--mineos-general-bright)]">
            {asignacion}
            {row.rotacionFuente === 'plantilla' && row.estatusPlantillaLabel
              ? ` · ${row.estatusPlantillaLabel}`
              : ''}
          </p>
        </div>
      </div>

      {/* Semana + total destacado */}
      <div className={cn(mineosPanel('general'), 'mt-4 !p-3.5')}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2 text-xs text-[var(--text-muted)]">
            <Calendar className="h-3.5 w-3.5 shrink-0 text-[var(--mineos-general-bright)]" />
            <span className="font-medium">
              {fmtDate(weekStart)} — {fmtDate(weekEnd)}
            </span>
            {locked ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-[var(--mineos-general-border)] bg-[var(--mineos-general-soft)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--mineos-general-bright)]">
                <Lock className="h-3 w-3" />
                Cerrada
              </span>
            ) : null}
          </div>
          <p className="text-xl font-black tabular-nums text-[var(--mineos-general-bright)]">
            {fmtMoney(row.total)}
          </p>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide',
              asistencia.tone,
            )}
          >
            <AsistenciaIcon className="h-3 w-3" />
            {asistencia.label}
          </span>
          <span className="text-[11px] tabular-nums text-[var(--text-muted)]">
            {row.diasTrabajados} de 7 días
          </span>
          {row.novedadTurno !== 'ACTIVO' ? (
            <span
              className={cn(
                'rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                novedadTurnoTone(row.novedadTurno),
              )}
            >
              {NOVEDAD_TURNO_LABEL[row.novedadTurno]}
            </span>
          ) : null}
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-4 flex border-b border-[var(--card-border)]">
        {(
          [
            ['semana', 'Semana'],
            ['vales', 'Vales'],
            ['historial', 'Historial'],
          ] as const
        ).map(([t, label]) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'border-b-2 px-3 pb-2.5 text-xs font-bold uppercase tracking-wider transition-all',
              tab === t
                ? 'border-[var(--mineos-general-bright)] text-[var(--mineos-general-bright)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 max-h-[min(48dvh,440px)] space-y-4 overflow-y-auto pr-1">
        {tab === 'semana' ? (
          <>
            <div className={cn(mineosPanel('neutral'), '!p-4')}>
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                Desglose de la semana
              </h4>
              <div className="mt-3 space-y-2">
                <BreakdownLine
                  label={
                    row.estadoAsistencia === 'libre'
                      ? 'Sueldo libre'
                      : row.estadoAsistencia === 'no_laborado'
                        ? 'Sin labor'
                        : 'Sueldo labor'
                  }
                  value={fmtMoney(row.salarioBaseCalculado)}
                />
                {row.bonoTransporte > 0 ? (
                  <BreakdownLine
                    label="Bono transporte"
                    value={`+${fmtMoney(row.bonoTransporte)}`}
                    tone="benefit"
                  />
                ) : null}
                {row.bonificaciones > 0 ? (
                  <BreakdownLine
                    label="Bonificaciones"
                    value={`+${fmtMoney(row.bonificaciones)}`}
                    tone="benefit"
                  />
                ) : null}
                {row.totalVales > 0 ? (
                  <BreakdownLine
                    label="Vales / adelantos"
                    value={`−${fmtMoney(row.totalVales)}`}
                    tone="expense"
                  />
                ) : null}
                {row.deducciones > row.totalVales ? (
                  <BreakdownLine
                    label="Otras deducciones"
                    value={`−${fmtMoney(row.deducciones - row.totalVales)}`}
                    tone="expense"
                  />
                ) : null}
                <div className="border-t border-[var(--card-border)] pt-2">
                  <BreakdownLine label="Total neto" value={fmtMoney(row.total)} tone="accent" />
                </div>
              </div>
            </div>

            <details className={cn(mineosPanel('neutral'), '!p-0 overflow-hidden')}>
              <summary className="cursor-pointer list-none px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] marker:content-none [&::-webkit-details-marker]:hidden">
                Perfil y tarifas
                <span className="ml-1 text-[var(--text-muted)]">▸</span>
              </summary>
              <div className="grid grid-cols-2 gap-3 border-t border-[var(--card-border)] px-4 py-3 text-xs">
                <div>
                  <span className="text-[var(--text-muted)]">Salario labor</span>
                  <p className="font-semibold tabular-nums text-[var(--text-primary)]">
                    {fmtMoney(Number(p.salario_base))}
                  </p>
                </div>
                <div>
                  <span className="text-[var(--text-muted)]">Salario libre</span>
                  <p className="font-semibold tabular-nums text-[var(--text-primary)]">
                    {fmtMoney(salarioLibre)}
                  </p>
                </div>
                <div>
                  <span className="text-[var(--text-muted)]">Bono transporte</span>
                  <p className="font-semibold tabular-nums text-[var(--text-primary)]">
                    {fmtMoney(Number(p.bono_transporte))}
                  </p>
                </div>
                <div>
                  <span className="text-[var(--text-muted)]">Ingreso</span>
                  <p className="font-semibold text-[var(--text-primary)]">{fmtDate(p.fecha_ingreso)}</p>
                </div>
              </div>
            </details>
          </>
        ) : null}

        {tab === 'vales' ? (
          <div className={cn(mineosPanel('expense'), '!p-4')}>
            <div className="flex items-center justify-between gap-2">
              <h4 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                <DollarSign className="h-3.5 w-3.5 text-[var(--mineos-expense)]" />
                Vales / adelantos
              </h4>
              <span className="text-xs font-bold tabular-nums text-[var(--mineos-expense)]">
                Total: {fmtMoney(totalVales)}
              </span>
            </div>
            {loading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-[var(--mineos-general-bright)]" />
              </div>
            ) : vales.length > 0 ? (
              <div className="mt-3 max-h-40 space-y-2 overflow-y-auto">
                {vales.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-[var(--card-border)] bg-[var(--surface-elevated)] px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-[var(--text-primary)]">
                        {v.motivo || 'Adelanto'}
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)]">{fmtDate(v.fecha)}</p>
                    </div>
                    <p className="shrink-0 text-xs font-bold tabular-nums text-[var(--mineos-expense)]">
                      {fmtMoney(Number(v.monto))}
                    </p>
                    {canEdit && !locked ? (
                      <button
                        type="button"
                        onClick={() => onDeleteVale(v.id)}
                        disabled={isPending}
                        className="shrink-0 rounded p-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--mineos-expense-soft)] hover:text-[var(--mineos-expense)]"
                        aria-label="Eliminar vale"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-xs text-[var(--text-muted)]">
                No hay vales pendientes
              </p>
            )}
            {canEdit && !locked ? (
              <div className="mt-3 space-y-2.5 border-t border-[var(--card-border)] pt-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                  Registrar vale
                </p>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="$ Monto"
                    value={newValeMonto}
                    onChange={(e) => onNewValeMontoChange(e.target.value)}
                    className="input-field w-24 text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Motivo"
                    value={newValeMotivo}
                    onChange={(e) => onNewValeMotivoChange(e.target.value)}
                    className="input-field flex-1 text-xs"
                  />
                </div>
                <button
                  type="button"
                  onClick={onAddVale}
                  disabled={isPending || !newValeMonto}
                  className={cn(MINEOS_BTN_NOMINA_PRIMARY, 'h-9 w-full text-xs disabled:opacity-40')}
                >
                  {isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  Registrar vale
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {tab === 'historial' ? (
          <div className={cn(mineosPanel('general'), '!p-4')}>
            <h4 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
              <History className="h-3.5 w-3.5 text-[var(--mineos-general-bright)]" />
              Historial de pagos
            </h4>
            {loading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-[var(--mineos-general-bright)]" />
              </div>
            ) : historial.length > 0 ? (
              <div className="mt-3 space-y-2">
                {historial.length >= 2 ? (
                  <div className="flex justify-center border-b border-[var(--card-border)] pb-2">
                    <Sparkline
                      data={[...historial].reverse().map((h) => Number(h.monto_pagado))}
                    />
                  </div>
                ) : null}
                {historial.map((h) => (
                  <div
                    key={h.semana_id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-[var(--card-border)] bg-[var(--surface-elevated)] px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-[var(--text-primary)]">
                        {fmtDate(h.semana_inicio)} — {fmtDate(h.semana_fin)}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            'rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase',
                            h.es_semana_libre
                              ? 'border-cyan-500/25 bg-cyan-500/10 text-cyan-300'
                              : 'border-[var(--mineos-general-border)] bg-[var(--mineos-general-soft)] text-[var(--mineos-general-bright)]',
                          )}
                        >
                          {h.es_semana_libre ? 'Libre' : 'Labor'}
                        </span>
                        {Number(h.bono_transporte_pagado) > 0 ? (
                          <span className="text-[8px] text-[var(--text-muted)]">
                            +Trans. {fmtMoney(Number(h.bono_transporte_pagado))}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <p className="shrink-0 text-sm font-bold tabular-nums text-[var(--mineos-general-bright)]">
                      {fmtMoney(Number(h.monto_pagado))}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-xs text-[var(--text-muted)]">
                No hay pagos registrados aún
              </p>
            )}
          </div>
        ) : null}
      </div>

      <PageFormModalFooter className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onEditPerfil} className={cn(mineosBtnSubtleClass('neutral'), 'h-10 px-4')}>
          <Edit2 className="h-3.5 w-3.5" />
          Editar perfil
        </button>
        <button
          type="button"
          onClick={onFichaPago}
          className={cn(MINEOS_BTN_NOMINA_PRIMARY, 'h-10 px-4 text-xs')}
        >
          <Receipt className="h-3.5 w-3.5" />
          Ficha de pago
        </button>
      </PageFormModalFooter>
    </PageFormModal>
  );
}

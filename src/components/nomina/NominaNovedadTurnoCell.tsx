'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { AppSelect } from '@/components/ui/AppSelect';
import {
  NOVEDAD_TURNO_LABEL,
  NOVEDAD_TURNO_OPTIONS,
  REPOSO_MODO_SUELDO_LABEL_SHORT,
  REPOSO_MODO_SUELDO_OPTIONS,
  defaultReposoCondicionSemana,
  novedadTurnoTone,
  parseNovedadTurno,
  type NominaNovedadTurno,
  type ReposoModoSueldoSemana,
} from '@/lib/nomina-novedad-turno';
import { MAX_DIAS_TRABAJADOS, NOMINA_DIAS_POR_SEMANA } from '@/lib/nomina-calculo';

type Props = {
  value: NominaNovedadTurno;
  observacion?: string;
  reposoCondicion?: ReposoModoSueldoSemana | null;
  reposoDiasPagados?: number;
  reposoCompensacionMonto?: number;
  disabled?: boolean;
  workerName: string;
  onChange: (next: NominaNovedadTurno) => void;
  onObservacionChange?: (obs: string) => void;
  onReposoCondicionChange?: (condicion: ReposoModoSueldoSemana) => void;
  onReposoDiasPagadosChange?: (dias: number) => void;
  onReposoCompensacionMontoChange?: (monto: number) => void;
};

export default function NominaNovedadTurnoCell({
  value,
  observacion = '',
  reposoCondicion,
  reposoDiasPagados = 0,
  reposoCompensacionMonto = 0,
  disabled,
  workerName,
  onChange,
  onObservacionChange,
  onReposoCondicionChange,
  onReposoDiasPagadosChange,
  onReposoCompensacionMontoChange,
}: Props) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const estado = parseNovedadTurno(value);
  const condicionActiva = reposoCondicion ?? defaultReposoCondicionSemana();

  const reposoModoOptions = useMemo(
    () =>
      REPOSO_MODO_SUELDO_OPTIONS.map((opt) => ({
        value: opt,
        label: REPOSO_MODO_SUELDO_LABEL_SHORT[opt],
      })),
    [],
  );

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('[data-novedad-turno-menu]') || t.closest('[data-novedad-turno-trigger]')) return;
      setMenu(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menu]);

  return (
    <div className="flex flex-col items-center justify-center gap-1">
      <div className="relative inline-flex max-w-full justify-center">
        <button
          type="button"
          data-novedad-turno-trigger
          disabled={disabled}
          onClick={(e) => {
            if (disabled) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const menuWidth = 148;
            const x = Math.max(8, Math.min(rect.left + rect.width / 2 - menuWidth / 2, window.innerWidth - menuWidth - 8));
            const y = rect.bottom + 6;
            setMenu((prev) => (prev ? null : { x, y }));
          }}
          className={`inline-flex max-w-[7.5rem] items-center justify-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide transition-opacity disabled:cursor-not-allowed disabled:opacity-45 ${novedadTurnoTone(estado)}`}
          title="Novedad del turno (solo esta semana)"
          aria-label={`Novedad de turno de ${workerName}`}
        >
          <span className="truncate">{NOVEDAD_TURNO_LABEL[estado]}</span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-75" />
        </button>
      </div>

      {estado === 'REPOSO' && onReposoCondicionChange && !disabled ? (
        <>
          <AppSelect
            className="app-select--sm"
            value={condicionActiva}
            disabled={disabled}
            options={reposoModoOptions}
            onChange={(next) => onReposoCondicionChange(next as ReposoModoSueldoSemana)}
          />

          {condicionActiva === 'PARCIAL' && onReposoDiasPagadosChange ? (
            <div className="inline-flex items-center gap-1">
              <input
                type="number"
                min={0}
                max={MAX_DIAS_TRABAJADOS}
                step={1}
                value={reposoDiasPagados}
                onChange={(e) => onReposoDiasPagadosChange(Number(e.target.value))}
                className="nomina-reposo-field tabular-nums"
                aria-label={`Días pagados por reposo parcial de ${workerName}`}
                title={`Días a pagar (0–${MAX_DIAS_TRABAJADOS}) para cálculo proporcional`}
              />
              <span className="nomina-reposo-field__hint">días</span>
            </div>
          ) : null}

          {condicionActiva === 'PAGO_UNICO' && onReposoCompensacionMontoChange ? (
            <input
              type="number"
              min={0}
              step={0.01}
              value={reposoCompensacionMonto || ''}
              onChange={(e) => onReposoCompensacionMontoChange(Number(e.target.value) || 0)}
              placeholder="Monto"
              className="nomina-reposo-field tabular-nums"
              aria-label={`Monto pago único de ${workerName}`}
              title="Monto del pago único (novedad, no sueldo de cuadrilla)"
            />
          ) : null}
        </>
      ) : null}

      {estado !== 'ACTIVO' && onObservacionChange && !disabled ? (
        <input
          type="text"
          value={observacion}
          onChange={(e) => onObservacionChange(e.target.value)}
          placeholder="Nota…"
          className="w-[6.5rem] rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-1.5 py-0.5 text-center text-[9px] text-[var(--text-secondary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--mineos-general-border,rgba(212,175,55,0.35))]"
          aria-label={`Observación de novedad de ${workerName}`}
        />
      ) : observacion.trim() ? (
        <span
          className="max-w-[6.5rem] truncate text-[9px] text-[var(--text-muted)]"
          title={observacion.trim()}
        >
          {observacion.trim()}
        </span>
      ) : null}

      {menu ? (
        <div
          data-novedad-turno-menu
          className="fixed z-[220] w-[9.25rem] overflow-hidden rounded-lg border border-[var(--card-border)] bg-[var(--surface-elevated)] p-1 shadow-2xl backdrop-blur-md"
          style={{ left: `${menu.x}px`, top: `${menu.y}px` }}
        >
          {NOVEDAD_TURNO_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                setMenu(null);
                onChange(opt);
              }}
              className={`block w-full rounded-md px-2 py-1.5 text-left text-[11px] font-semibold transition-colors ${
                opt === estado
                  ? 'bg-[var(--mineos-general-soft,rgba(212,175,55,0.12))] text-[var(--accent)]'
                  : 'text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]'
              }`}
            >
              {NOVEDAD_TURNO_LABEL[opt]}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

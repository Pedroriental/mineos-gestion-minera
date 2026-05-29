'use client';

import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  NOVEDAD_TURNO_LABEL,
  NOVEDAD_TURNO_OPTIONS,
  novedadTurnoTone,
  parseNovedadTurno,
  type NominaNovedadTurno,
} from '@/lib/nomina-novedad-turno';

type Props = {
  value: NominaNovedadTurno;
  observacion?: string;
  disabled?: boolean;
  workerName: string;
  onChange: (next: NominaNovedadTurno) => void;
  onObservacionChange?: (obs: string) => void;
};

export default function NominaNovedadTurnoCell({
  value,
  observacion = '',
  disabled,
  workerName,
  onChange,
  onObservacionChange,
}: Props) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const estado = parseNovedadTurno(value);

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

      {estado !== 'ACTIVO' && onObservacionChange && !disabled ? (
        <input
          type="text"
          value={observacion}
          onChange={(e) => onObservacionChange(e.target.value)}
          placeholder="Nota…"
          className="w-[6.5rem] rounded-md border border-zinc-800/80 bg-zinc-950/50 px-1.5 py-0.5 text-center text-[9px] text-white/70 outline-none placeholder:text-white/25 focus:border-amber-500/40"
          aria-label={`Observación de novedad de ${workerName}`}
        />
      ) : observacion.trim() ? (
        <span className="max-w-[6.5rem] truncate text-[9px] text-white/40" title={observacion.trim()}>
          {observacion.trim()}
        </span>
      ) : null}

      {menu ? (
        <div
          data-novedad-turno-menu
          className="fixed z-[220] w-[9.25rem] overflow-hidden rounded-lg border border-white/10 bg-zinc-950/95 p-1 shadow-2xl backdrop-blur-md"
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
                  ? 'bg-amber-500/15 text-amber-300'
                  : 'text-white/75 hover:bg-white/5 hover:text-white'
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

'use client';

import { useEffect, useState, useTransition } from 'react';
import { PageFormModal, PageFormModalFooter } from '@/components/ui/PageFormModal';
import { updateTrabajadorEstadoAction } from '@/lib/actions/trabajadores-registry';
import {
  ESTADO_LABORAL_LABEL,
  getEstadoLaboral,
  type EstadoLaboral,
} from '@/lib/personal-master';
import type { Personal } from '@/lib/types';

export type EstadoModalState = {
  open: boolean;
  worker: Personal | null;
  nextEstado: EstadoLaboral;
  motivo: string;
  inicio: string;
  fin: string;
  duracion: string;
  despidoFecha: string;
  despidoCausa: string;
  reengancheFecha: string;
  reengancheCargo: string;
  reengancheObservacion: string;
};

export function emptyEstadoModal(): EstadoModalState {
  return {
    open: false,
    worker: null,
    nextEstado: 'ACTIVO',
    motivo: '',
    inicio: '',
    fin: '',
    duracion: '',
    despidoFecha: '',
    despidoCausa: '',
    reengancheFecha: '',
    reengancheCargo: '',
    reengancheObservacion: '',
  };
}

export function estadoModalFromWorker(worker: Personal, nextEstado: EstadoLaboral): EstadoModalState {
  return {
    open: true,
    worker,
    nextEstado,
    motivo: worker.observacion_estado || '',
    inicio: worker.estado_inicio_fecha || '',
    fin: worker.estado_fin_fecha || '',
    duracion: worker.estado_duracion_dias ? String(worker.estado_duracion_dias) : '',
    despidoFecha: worker.despido_fecha || '',
    despidoCausa: worker.despido_causa || '',
    reengancheFecha: worker.reenganche_fecha || '',
    reengancheCargo: worker.reenganche_cargo || worker.cargo || '',
    reengancheObservacion: worker.reenganche_observacion || '',
  };
}

function addDaysIso(dateIso: string, days: number): string {
  const start = new Date(`${dateIso}T00:00:00`);
  if (Number.isNaN(start.getTime())) return '';
  const out = new Date(start);
  out.setDate(out.getDate() + days);
  return out.toISOString().slice(0, 10);
}

function diffDaysIso(startIso: string, endIso: string): number | null {
  const start = new Date(`${startIso}T00:00:00`);
  const end = new Date(`${endIso}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const diff = Math.round((end.getTime() - start.getTime()) / 86400000);
  return diff >= 0 ? diff : null;
}

type Props = {
  state: EstadoModalState;
  onClose: () => void;
  onSaved: () => void;
};

export default function EstadoLaboralChangeModal({ state, onClose, onSaved }: Props) {
  const [isPending, startTransition] = useTransition();
  const [draft, setDraft] = useState(state);

  useEffect(() => {
    if (state.open) setDraft(state);
  }, [state]);

  function onEstadoInicioChange(value: string) {
    setDraft((prev) => {
      const next = { ...prev, inicio: value };
      const dur = Number(next.duracion || '0');
      if (value && Number.isFinite(dur) && dur >= 0) next.fin = addDaysIso(value, dur);
      return next;
    });
  }

  function onEstadoFinChange(value: string) {
    setDraft((prev) => {
      const next = { ...prev, fin: value };
      if (next.inicio && value) {
        const dd = diffDaysIso(next.inicio, value);
        if (dd !== null) next.duracion = String(dd);
      }
      return next;
    });
  }

  function onEstadoDuracionChange(value: string) {
    setDraft((prev) => {
      const next = { ...prev, duracion: value };
      const dur = Number(value || '0');
      if (next.inicio && Number.isFinite(dur) && dur >= 0) next.fin = addDaysIso(next.inicio, dur);
      return next;
    });
  }

  function submit() {
    if (!draft.worker) return;
    const payload = {
      id: draft.worker.id,
      estado_laboral: draft.nextEstado,
      observacion_estado:
        draft.nextEstado === 'DESPEDIDO'
          ? draft.despidoCausa
          : draft.nextEstado === 'REENGANCHADO'
            ? draft.reengancheObservacion
            : draft.motivo,
      estado_inicio_fecha: draft.inicio || undefined,
      estado_fin_fecha: draft.fin || undefined,
      estado_duracion_dias: draft.duracion ? Number(draft.duracion) : null,
      despido_fecha: draft.nextEstado === 'DESPEDIDO' ? draft.despidoFecha : undefined,
      despido_causa: draft.nextEstado === 'DESPEDIDO' ? draft.despidoCausa : undefined,
      reenganche_fecha: draft.nextEstado === 'REENGANCHADO' ? draft.reengancheFecha : undefined,
      reenganche_cargo: draft.nextEstado === 'REENGANCHADO' ? draft.reengancheCargo : undefined,
      reenganche_observacion:
        draft.nextEstado === 'REENGANCHADO' ? draft.reengancheObservacion : undefined,
    } as const;

    if (
      draft.nextEstado === 'DESPEDIDO' &&
      (!draft.despidoFecha || !draft.despidoCausa.trim())
    ) {
      alert('Para retiro debes indicar fecha y causa/observación.');
      return;
    }
    if (
      draft.nextEstado === 'REENGANCHADO' &&
      (!draft.reengancheFecha || !draft.reengancheCargo.trim())
    ) {
      alert('Para reenganche debes indicar fecha de reintegro y cargo.');
      return;
    }

    startTransition(async () => {
      const res = await updateTrabajadorEstadoAction(payload);
      if (!res.ok) return alert(res.message);
      onClose();
      onSaved();
    });
  }

  if (!state.open || !state.worker) return null;

  return (
    <PageFormModal open={state.open} onClose={onClose} panelClassName="sm:max-w-xl">
      <h3 className="mb-1 text-lg font-bold text-white">
        {state.worker.nombre_completo}
      </h3>
      <p className="mb-3 text-xs text-white/45">
        Estado:{' '}
        <span className="text-amber-400">
          {ESTADO_LABORAL_LABEL[getEstadoLaboral(state.worker)] || getEstadoLaboral(state.worker)}
        </span>
        {' → '}
        <span className="text-white/80">
          {ESTADO_LABORAL_LABEL[draft.nextEstado] || draft.nextEstado}
        </span>
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {(draft.nextEstado === 'REPOSO' || draft.nextEstado === 'VACACIONES') && (
          <>
            <div>
              <label className="input-label">Inicio</label>
              <input
                className="input-field"
                type="date"
                value={draft.inicio}
                onChange={(e) => onEstadoInicioChange(e.target.value)}
              />
            </div>
            <div>
              <label className="input-label">Fin (estimado)</label>
              <input
                className="input-field"
                type="date"
                value={draft.fin}
                onChange={(e) => onEstadoFinChange(e.target.value)}
              />
            </div>
            <div>
              <label className="input-label">Duración (días)</label>
              <input
                className="input-field"
                type="number"
                value={draft.duracion}
                onChange={(e) => onEstadoDuracionChange(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="input-label">Observación</label>
              <textarea
                className="input-field min-h-[70px]"
                value={draft.motivo}
                onChange={(e) => setDraft((prev) => ({ ...prev, motivo: e.target.value }))}
                placeholder="Ej.: reposo médico repentino…"
              />
            </div>
          </>
        )}
        {draft.nextEstado === 'DESPEDIDO' && (
          <>
            <div>
              <label className="input-label">Fecha de retiro *</label>
              <input
                className="input-field"
                type="date"
                value={draft.despidoFecha}
                onChange={(e) => setDraft((prev) => ({ ...prev, despidoFecha: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="input-label">Causa / observación *</label>
              <textarea
                className="input-field min-h-[86px]"
                value={draft.despidoCausa}
                onChange={(e) => setDraft((prev) => ({ ...prev, despidoCausa: e.target.value }))}
              />
            </div>
          </>
        )}
        {draft.nextEstado === 'REENGANCHADO' && (
          <>
            <div>
              <label className="input-label">Fecha de reintegro *</label>
              <input
                className="input-field"
                type="date"
                value={draft.reengancheFecha}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, reengancheFecha: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="input-label">Cargo *</label>
              <input
                className="input-field"
                value={draft.reengancheCargo}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, reengancheCargo: e.target.value }))
                }
              />
            </div>
            <div className="sm:col-span-2">
              <label className="input-label">Observación</label>
              <textarea
                className="input-field min-h-[86px]"
                value={draft.reengancheObservacion}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, reengancheObservacion: e.target.value }))
                }
              />
            </div>
          </>
        )}
      </div>
      <PageFormModalFooter className="mt-5 flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onClose}>
          Cancelar
        </button>
        <button type="button" className="btn-primary" onClick={submit} disabled={isPending}>
          {isPending ? 'Guardando…' : 'Guardar'}
        </button>
      </PageFormModalFooter>
    </PageFormModal>
  );
}

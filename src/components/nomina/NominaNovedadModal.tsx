'use client';

import { useEffect, useMemo, useState } from 'react';
import { FileText, Plus, X } from 'lucide-react';
import { PageFormModal, PageFormModalFooter } from '@/components/ui/PageFormModal';
import { AppSelect } from '@/components/ui/AppSelect';
import {
  type NominaNovedadManual,
  type TipoNovedadManual,
  TIPO_NOVEDAD_LABELS,
} from '@/lib/nomina-novedades-manuales';
import type { Personal } from '@/lib/types';
import {
  mineosModalHeading,
  MINEOS_BTN_PRIMARY,
  mineosBtnSubtleClass,
} from '@/lib/mineos-visual';

type Props = {
  open: boolean;
  onClose: () => void;
  onSave: (item: NominaNovedadManual) => void;
  personalCatalog?: Personal[];
  initialData?: NominaNovedadManual | null;
  area: string;
  weekStart: string;
};

const TIPO_OPTIONS = (Object.keys(TIPO_NOVEDAD_LABELS) as TipoNovedadManual[]).map((k) => ({
  value: k,
  label: TIPO_NOVEDAD_LABELS[k],
}));

export function NominaNovedadModal({
  open,
  onClose,
  onSave,
  personalCatalog = [],
  initialData,
  area,
  weekStart,
}: Props) {
  const [nombre, setNombre] = useState('');
  const [cedula, setCedula] = useState('');
  const [cargo, setCargo] = useState('');
  const [tipo, setTipo] = useState<TipoNovedadManual>('PAGO_EXTRAORDINARIO');
  const [montoUsd, setMontoUsd] = useState('');
  const [detalle, setDetalle] = useState('');
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');

  useEffect(() => {
    if (initialData) {
      setNombre(initialData.nombre);
      setCedula(initialData.cedula);
      setCargo(initialData.cargo);
      setTipo(initialData.tipo);
      setMontoUsd(String(initialData.montoUsd));
      setDetalle(initialData.detalle);
      setSelectedWorkerId('');
    } else {
      setNombre('');
      setCedula('');
      setCargo('');
      setTipo('PAGO_EXTRAORDINARIO');
      setMontoUsd('');
      setDetalle('');
      setSelectedWorkerId('');
    }
  }, [initialData, open]);

  const handleSelectWorker = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedWorkerId(id);
    if (!id) return;
    const worker = personalCatalog.find((p) => p.id === id);
    if (worker) {
      setNombre(worker.nombre_completo);
      setCedula(worker.cedula || '');
      setCargo(worker.cargo || '');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNombre = nombre.trim();
    if (!cleanNombre) return;
    const numMonto = parseFloat(montoUsd) || 0;

    const item: NominaNovedadManual = {
      id: initialData?.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `nov-${Date.now()}`),
      nombre: cleanNombre,
      cedula: cedula.trim(),
      cargo: cargo.trim(),
      tipo,
      montoUsd: numMonto,
      detalle: detalle.trim(),
      area,
      semanaInicio: weekStart,
      createdAt: initialData?.createdAt || new Date().toISOString(),
    };

    onSave(item);
    onClose();
  };

  return (
    <PageFormModal open={open} onClose={onClose} panelClassName="max-w-md w-full">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <header className="border-b border-[var(--card-border)] pb-3">
          <div className="flex items-center justify-between">
            <div className={mineosModalHeading('general')}>
              <div className="flex size-8 items-center justify-center rounded-lg border border-[var(--mineos-general-border)] bg-[var(--mineos-general-soft)] text-[var(--mineos-general-bright)]">
                <FileText className="size-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                  {initialData ? 'Editar Novedad' : 'Nueva Novedad o Pago Extraordinario'}
                </h3>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Semana {weekStart} · {area === 'mina' ? 'Mina' : area === 'planta' ? 'Molinos' : 'Nómina'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--surface-elevated)] hover:text-[var(--text-primary)]"
            >
              <X className="size-4" />
            </button>
          </div>
        </header>

        {personalCatalog.length > 0 && !initialData && (
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-[var(--text-secondary)]">
              Cargar desde el personal registrado (Opcional):
            </label>
            <select
              value={selectedWorkerId}
              onChange={handleSelectWorker}
              className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--mineos-general-border)]"
            >
              <option value="">-- Ingresar trabajador manualmente o seleccionar --</option>
              {personalCatalog.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre_completo} {p.cedula ? `(${p.cedula})` : ''} - {p.cargo || 'Sin cargo'}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-[11px] font-semibold text-[var(--text-secondary)]">
              Nombre y Apellido <span className="text-amber-400">*</span>
            </label>
            <input
              type="text"
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Alexander Díaz"
              className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--mineos-general-border)]"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold text-[var(--text-secondary)]">
              Cédula
            </label>
            <input
              type="text"
              value={cedula}
              onChange={(e) => setCedula(e.target.value)}
              placeholder="Ej: 25.552.939"
              className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--mineos-general-border)]"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold text-[var(--text-secondary)]">
              Cargo
            </label>
            <input
              type="text"
              value={cargo}
              onChange={(e) => setCargo(e.target.value)}
              placeholder="Ej: Ay. Barrenador"
              className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--mineos-general-border)]"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold text-[var(--text-secondary)]">
              Tipo de Novedad
            </label>
            <AppSelect
              value={tipo}
              onChange={(val) => setTipo(val as TipoNovedadManual)}
              options={TIPO_OPTIONS}
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold text-[var(--text-secondary)]">
              Monto en USD ($) <span className="text-amber-400">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={montoUsd}
              onChange={(e) => setMontoUsd(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-xs font-semibold tabular-nums text-amber-400 outline-none focus:border-[var(--mineos-general-border)]"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1 block text-[11px] font-semibold text-[var(--text-secondary)]">
              Detalle / Observación
            </label>
            <input
              type="text"
              value={detalle}
              onChange={(e) => setDetalle(e.target.value)}
              placeholder="Ej: Pago de nómina extraordinaria 03/09/2026"
              className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--mineos-general-border)]"
            />
          </div>
        </div>

        <PageFormModalFooter className="mt-2 flex items-center justify-end gap-2 border-t border-[var(--card-border)] pt-3">
          <button
            type="button"
            onClick={onClose}
            className={`${mineosBtnSubtleClass('neutral')} px-3 py-1.5 text-xs`}
          >
            Cancelar
          </button>
          <button type="submit" className={`${MINEOS_BTN_PRIMARY} px-4 py-1.5 text-xs`}>
            {initialData ? 'Guardar Cambios' : 'Agregar Novedad'}
          </button>
        </PageFormModalFooter>
      </form>
    </PageFormModal>
  );
}

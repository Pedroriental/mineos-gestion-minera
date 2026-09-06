'use client';

import { Edit2, FileText, Plus, Trash2 } from 'lucide-react';
import {
  type NominaNovedadManual,
  TIPO_NOVEDAD_LABELS,
  totalNovedadesManuales,
} from '@/lib/nomina-novedades-manuales';
import {
  mineosBtnSubtleClass,
  mineosKpiValue,
  mineosPanel,
  MINEOS_BTN_NOMINA_PRIMARY,
} from '@/lib/mineos-visual';
import { cn } from '@/lib/utils';

type Props = {
  items: NominaNovedadManual[];
  onAdd: () => void;
  onEdit: (item: NominaNovedadManual) => void;
  onDelete: (id: string) => void;
  canEdit: boolean;
};

function fmtMoney(n: number) {
  return n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function NominaNovedadesManualesSection({
  items,
  onAdd,
  onEdit,
  onDelete,
  canEdit,
}: Props) {
  const total = totalNovedadesManuales(items);

  return (
    <section className={cn(mineosPanel('general'), 'w-full min-w-0 !p-0')}>
      <header className="border-b border-[var(--card-border)] bg-[var(--surface-elevated)]/20 px-3.5 py-3 lg:px-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-[var(--mineos-general-border)] bg-[var(--mineos-general-soft)] text-[var(--mineos-general-bright)]">
              <FileText className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                  Novedades y Pagos Extraordinarios
                </h3>
                {items.length > 0 && (
                  <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                    {items.length}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[var(--text-muted)]">
                Pagos adicionales o novedades de referencia (no se suman al total de la nómina)
              </p>
            </div>
          </div>

          {canEdit && (
            <button
              type="button"
              onClick={onAdd}
              className={`${MINEOS_BTN_NOMINA_PRIMARY} h-8 px-3 text-xs`}
            >
              <Plus className="size-3.5" /> Agregar Novedad
            </button>
          )}
        </div>
      </header>

      <div className="p-3.5 lg:p-4">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <p className="text-xs text-[var(--text-muted)]">
              No hay pagos extraordinarios ni novedades manuales registradas en esta semana.
            </p>
            {canEdit && (
              <button
                type="button"
                onClick={onAdd}
                className={cn(mineosBtnSubtleClass('general'), 'mt-2 text-xs')}
              >
                <Plus className="size-3" /> Registrar primer pago extraordinario
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[550px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--card-border)]/60 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    <th className="py-2 pl-1 pr-3">#</th>
                    <th className="py-2 px-3">Trabajador</th>
                    <th className="py-2 px-3">Cédula</th>
                    <th className="py-2 px-3">Cargo</th>
                    <th className="py-2 px-3">Tipo</th>
                    <th className="py-2 px-3">Detalle / Observación</th>
                    <th className="py-2 px-3 text-right">Monto</th>
                    {canEdit && <th className="py-2 pl-3 pr-1 text-right">Acciones</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--card-border)]/30">
                  {items.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-[var(--surface-elevated)]/25">
                      <td className="py-2.5 pl-1 pr-3 text-[11px] text-[var(--text-muted)]">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-[var(--text-primary)]">
                        {item.nombre}
                      </td>
                      <td className="py-2.5 px-3 tabular-nums text-[var(--text-secondary)]">
                        {item.cedula || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-[var(--text-secondary)]">
                        {item.cargo || '—'}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="inline-block rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                          {TIPO_NOVEDAD_LABELS[item.tipo] || item.tipo}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-[11px] text-[var(--text-muted)]">
                        {item.detalle || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold tabular-nums text-[var(--mineos-general-bright)]">
                        ${fmtMoney(item.montoUsd)}
                      </td>
                      {canEdit && (
                        <td className="py-2.5 pl-3 pr-1 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => onEdit(item)}
                              title="Editar novedad"
                              className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--surface-elevated)] hover:text-[var(--text-primary)]"
                            >
                              <Edit2 className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDelete(item.id)}
                              title="Eliminar novedad"
                              className="rounded p-1 text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-400"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between border-t border-[var(--card-border)] pt-2.5">
              <span className="text-xs text-[var(--text-muted)]">
                {items.length} {items.length === 1 ? 'registro' : 'registros'} extraordinarios
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-semibold text-[var(--text-secondary)]">
                  Subtotal Novedades (no sumado a nómina):
                </span>
                <span className={cn(mineosKpiValue('general'), 'text-sm font-bold')}>
                  ${fmtMoney(total)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

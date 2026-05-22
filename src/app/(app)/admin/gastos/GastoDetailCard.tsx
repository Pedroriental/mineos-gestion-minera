'use client';

import { X, Edit2, Receipt } from 'lucide-react';
import type { Gasto } from '@/lib/types';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

const CAT_TIPO_LABEL: Record<string, string> = {
  mina: 'Mina',
  planta: 'Planta',
  general: 'General',
  transporte: 'Transporte',
  seguridad: 'Seguridad',
  administrativo: 'Administrativo',
};

function formatDateTime(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function DetailField({
  label,
  value,
  mono,
  highlight,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="gastos-detail-label mb-0.5 text-[9px] font-bold uppercase tracking-wider">{label}</p>
      <p
        className={`text-[11px] leading-snug break-words ${
          highlight
            ? 'gastos-amount text-[11px]'
            : mono
              ? 'gastos-detail-value--mono'
              : 'gastos-detail-value'
        }`}
      >
        {value || '—'}
      </p>
    </div>
  );
}

interface GastoDetailCardProps {
  gasto: Gasto;
  registradoPor: string;
  onClose: () => void;
  onEdit?: () => void;
  canEdit?: boolean;
}

export function GastoDetailCard({ gasto, registradoPor, onClose, onEdit, canEdit }: GastoDetailCardProps) {
  const cat = gasto.categorias_gasto;

  return (
    <div className="gastos-detail-card rounded-xl px-4 py-3">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border"
            style={{
              borderColor: 'var(--dashboard-danger-soft)',
              backgroundColor: 'var(--dashboard-danger-soft)',
            }}
          >
            <Receipt className="h-3.5 w-3.5" style={{ color: 'var(--dashboard-danger)' }} />
          </div>
          <div className="min-w-0">
            <p className="gastos-detail-eyebrow text-[9px] font-bold uppercase tracking-wider">
              Detalle del gasto
            </p>
            <p className="gastos-detail-title truncate text-sm font-semibold">{gasto.descripcion}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {canEdit && onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="gastos-page-btn gastos-detail-btn rounded-md px-2 py-1 text-[10px] font-semibold"
            >
              <Edit2 className="mr-1 inline h-3 w-3" />
              Editar
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="gastos-page-btn rounded-md p-1"
            aria-label="Cerrar detalle"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
        <DetailField label="Fecha" value={gasto.fecha} mono />
        <DetailField label="Monto" value={fmt(Number(gasto.monto))} highlight />
        <DetailField label="Categoría" value={cat?.nombre ?? '—'} />
        <DetailField
          label="Tipo categoría"
          value={cat?.tipo ? (CAT_TIPO_LABEL[cat.tipo] ?? cat.tipo) : '—'}
        />
        <DetailField label="Proveedor" value={gasto.proveedor ?? '—'} />
        <DetailField label="Referencia factura" value={gasto.factura_referencia ?? '—'} mono />
        <DetailField label="Registrado por" value={registradoPor} />
        <DetailField label="ID registro" value={gasto.id} mono />
        <div className="col-span-2 min-w-0 sm:col-span-3 lg:col-span-4">
          <DetailField label="Descripción" value={gasto.descripcion} />
        </div>
        {(gasto.notas?.trim() ?? '') !== '' && (
          <div className="col-span-2 min-w-0 sm:col-span-3 lg:col-span-4">
            <DetailField label="Notas" value={gasto.notas ?? ''} />
          </div>
        )}
        <DetailField label="Creado" value={formatDateTime(gasto.created_at)} mono />
        <DetailField label="Última actualización" value={formatDateTime(gasto.updated_at)} mono />
      </div>
    </div>
  );
}

'use client';

import { createColumnHelper, type FilterFn } from '@tanstack/react-table';
import { Edit2, Trash2 } from 'lucide-react';
import type { InventarioItem } from '@/lib/types';
import { codigoDisplay, CODIGO_SIN_DATOS } from './codigo';
import { normalizeDestino } from './destino';

const helper = createColumnHelper<InventarioItem>();

const fmtCostoUnitario = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(n) || 0);

type ColAlign = 'left' | 'right' | 'center';

function InventarioTh({ label, align }: { label: string; align: ColAlign }) {
  const alignClass =
    align === 'right'
      ? 'justify-end text-right'
      : align === 'center'
        ? 'justify-center text-center'
        : 'justify-start text-left';
  return (
    <span
      className={`gastos-th inline-flex w-full items-center text-[10px] font-semibold uppercase tracking-wide ${alignClass}`}
    >
      {label}
    </span>
  );
}

export function inventarioGlobalFilter(
  catLabels: Record<string, string>,
  destinoLabel: (value?: string | null) => string,
): FilterFn<InventarioItem> {
  return (row, _columnId, value) => {
    const q = String(value).toLowerCase();
    const cat = row.original.categoria?.toLowerCase() ?? '';
    const catLabel = (catLabels[row.original.categoria] ?? '').toLowerCase();
    const dest = destinoLabel(row.original.ubicacion).toLowerCase();
    const cod = codigoDisplay(row.original.codigo).toLowerCase();
    const costo = fmtCostoUnitario(row.original.costo_unitario_promedio).toLowerCase();
    return (
      row.original.nombre.toLowerCase().includes(q) ||
      cod.includes(q) ||
      costo.includes(q) ||
      cat.includes(q) ||
      catLabel.includes(q) ||
      dest.includes(q)
    );
  };
}

interface GetColumnsOptions {
  onEdit: (item: InventarioItem) => void;
  onDelete: (item: InventarioItem) => void;
  canEdit: boolean;
  catLabels: Record<string, string>;
  destinoLabel: (value?: string | null) => string;
}

export function getInventarioColumns({
  onEdit,
  onDelete,
  canEdit,
  catLabels,
  destinoLabel,
}: GetColumnsOptions) {
  return [
    helper.accessor('codigo', {
      meta: { align: 'left' as ColAlign },
      header: () => <InventarioTh label="Código" align="left" />,
      cell: (info) => {
        const label = codigoDisplay(info.getValue());
        const sinDatos = label === CODIGO_SIN_DATOS;
        return (
          <span
            className={`gastos-td block w-full truncate text-[11px] tabular-nums ${
              sinDatos
                ? 'font-medium opacity-70'
                : 'font-mono text-[var(--dashboard-accent)]'
            }`}
            title={label}
          >
            {label}
          </span>
        );
      },
    }),
    helper.accessor('nombre', {
      meta: { align: 'left' as ColAlign },
      header: () => <InventarioTh label="Nombre" align="left" />,
      cell: (info) => (
        <span className="gastos-td block w-full truncate text-[11px] font-medium" title={info.getValue()}>
          {info.getValue()}
        </span>
      ),
    }),
    helper.accessor('costo_unitario_promedio', {
      meta: { align: 'center' as ColAlign },
      header: () => <InventarioTh label="Costo Unitario" align="center" />,
      cell: (info) => {
        const formatted = fmtCostoUnitario(info.getValue());
        return (
          <div className="flex w-full justify-center">
            <span
              className="gastos-td inline-block max-w-full truncate text-center text-[11px] font-medium tabular-nums opacity-90"
              title={formatted}
            >
              {formatted}
            </span>
          </div>
        );
      },
    }),
    helper.accessor('categoria', {
      meta: { align: 'left' as ColAlign },
      header: () => <InventarioTh label="Categoría" align="left" />,
      cell: (info) => (
        <span
          className="gastos-cat-pill inline-block max-w-full truncate rounded px-1.5 py-0.5 text-[10px] font-semibold"
          title={catLabels[info.getValue()] ?? '—'}
        >
          {catLabels[info.getValue()] ?? '—'}
        </span>
      ),
    }),
    helper.accessor('ubicacion', {
      meta: { align: 'center' as ColAlign },
      header: () => <InventarioTh label="Ubicación" align="center" />,
      cell: (info) => {
        const label = destinoLabel(info.getValue());
        const hasDestino = normalizeDestino(info.getValue()) !== '';
        return (
          <div className="flex w-full justify-center">
            <span
              className={`gastos-cat-pill gastos-td inline-block max-w-full truncate rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                hasDestino ? '' : 'opacity-80'
              }`}
              title={label}
            >
              {label}
            </span>
          </div>
        );
      },
    }),
    helper.accessor('stock_actual', {
      meta: { align: 'center' as ColAlign },
      header: () => <InventarioTh label="Stock Actual" align="center" />,
      cell: (info) => {
        const row = info.row.original;
        const low = row.stock_actual <= row.stock_minimo;
        return (
          <span
            className={`gastos-td block w-full text-center text-[11px] font-semibold tabular-nums ${
              low ? 'text-[var(--dashboard-danger)]' : 'text-[var(--gastos-body)]'
            }`}
          >
            {info.getValue()}
          </span>
        );
      },
    }),
    helper.accessor('stock_minimo', {
      meta: { align: 'center' as ColAlign },
      header: () => <InventarioTh label="Stock Mínimo" align="center" />,
      cell: (info) => (
        <span className="gastos-td block w-full text-center text-[11px] font-medium tabular-nums text-[var(--gastos-subtle)]">
          {info.getValue()}
        </span>
      ),
    }),
    helper.accessor('unidad_medida', {
      meta: { align: 'center' as ColAlign },
      header: () => <InventarioTh label="Unidad de Medida" align="center" />,
      cell: (info) => (
        <span
          className="gastos-td block w-full truncate text-center text-[11px] opacity-80"
          title={info.getValue()}
        >
          {info.getValue()}
        </span>
      ),
    }),
    helper.display({
      id: 'actions',
      meta: { align: 'right' as ColAlign },
      header: () => <InventarioTh label="Acciones" align="right" />,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-0.5">
          <button
            type="button"
            onClick={() => onEdit(row.original)}
            disabled={!canEdit}
            className="gastos-page-btn rounded-lg p-1.5 transition-colors disabled:opacity-30"
            title={!canEdit ? 'Modo observador: solo lectura' : 'Editar'}
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(row.original)}
            disabled={!canEdit}
            className="gastos-page-btn rounded-lg p-1.5 transition-colors hover:!text-[var(--dashboard-danger)] disabled:opacity-30"
            title={!canEdit ? 'Modo observador: solo lectura' : 'Eliminar'}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    }),
  ];
}

'use client';

/**
 * Definiciones de columnas TanStack Table v8 para la tabla de Gastos.
 * Separadas del componente para facilitar reutilización y testing.
 */

import { createColumnHelper, type FilterFn } from '@tanstack/react-table';
import { ArrowUpDown, ArrowUp, ArrowDown, Edit2, Trash2 } from 'lucide-react';
import type { Gasto } from '@/lib/types';
import { formatGastoOroResumen, isGastoPagoOro } from '@/lib/gastos-oro';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

const helper = createColumnHelper<Gasto>();

/** ISO YYYY-MM-DD → DD/MM/YY compacto */
export function formatGastoFecha(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1].slice(-2)}`;
}

export function parseDescripcion(desc: string) {
  const match = /(.*)\s+\(Cant:\s*(.*?)\)$/.exec(desc || '');
  if (match) {
    return { cleanDesc: match[1], cantidad: match[2] };
  }
  return { cleanDesc: desc || '', cantidad: '—' };
}

function SortIcon({ direction }: { direction: 'asc' | 'desc' | false }) {
  if (direction === 'asc') {
    return <ArrowUp className="gastos-sort-icon gastos-sort-icon--active ml-1.5 h-3 w-3" />;
  }
  if (direction === 'desc') {
    return <ArrowDown className="gastos-sort-icon gastos-sort-icon--active ml-1.5 h-3 w-3" />;
  }
  return <ArrowUpDown className="gastos-sort-icon ml-1.5 h-3 w-3" />;
}

export const gastoGlobalFilter: FilterFn<Gasto> = (row, _columnId, value) => {
  const q = String(value).toLowerCase();
  return (
    row.original.descripcion?.toLowerCase().includes(q)              ||
    (row.original.categorias_gasto?.nombre ?? '').toLowerCase().includes(q) ||
    (row.original.proveedor ?? '').toLowerCase().includes(q)         ||
    (row.original.factura_referencia ?? '').toLowerCase().includes(q) ||
    row.original.fecha.includes(q) ||
    formatGastoFecha(row.original.fecha).includes(q)
  );
};

interface GetColumnsOptions {
  onEdit:   (item: Gasto) => void;
  onDelete: (id: string)  => void;
  canEdit:  boolean;
  isPending: boolean;
  onToggleFechaSort: () => void;
  fechaSortDirection: 'asc' | 'desc' | false;
}

export function getGastoColumns({
  onEdit, onDelete, canEdit, isPending, onToggleFechaSort, fechaSortDirection,
}: GetColumnsOptions) {
  return [
    helper.accessor('fecha', {
      meta: { align: 'left' },
      header: () => (
        <button
          type="button"
          className="group gastos-th inline-flex w-full items-center text-[10px] font-bold uppercase tracking-widest transition-colors"
          onClick={onToggleFechaSort}
        >
          Fecha <SortIcon direction={fechaSortDirection} />
        </button>
      ),
      cell: (info) => (
        <span className="gastos-td font-mono text-[11px] tabular-nums opacity-90">
          {info.getValue()}
        </span>
      ),
      sortingFn: 'alphanumeric',
    }),

    helper.accessor('descripcion', {
      meta: { align: 'left' },
      header: () => (
        <span className="gastos-th text-[10px] font-bold uppercase tracking-widest">
          Descripción
        </span>
      ),
      cell: (info) => {
        const { cleanDesc } = parseDescripcion(info.getValue());
        return (
          <span
            className="gastos-td block max-w-full truncate text-[11px] font-medium"
            title={cleanDesc}
          >
            {cleanDesc}
          </span>
        );
      },
      enableSorting: false,
    }),

    helper.accessor('descripcion', {
      id: 'cantidad',
      meta: { align: 'center' },
      header: () => (
        <span className="gastos-th text-[10px] font-bold uppercase tracking-wide text-center w-full block">
          Cantidad
        </span>
      ),
      cell: (info) => {
        const { cantidad } = parseDescripcion(info.getValue());
        return (
          <span className="gastos-td block text-center max-w-full truncate text-[11px] opacity-80" title={cantidad !== '—' ? cantidad : undefined}>
            {cantidad}
          </span>
        );
      },
      enableSorting: false,
    }),

    helper.accessor((row) => row.categorias_gasto?.nombre ?? '—', {
      id: 'categoria',
      meta: { align: 'left' },
      header: () => (
        <span className="gastos-th text-[10px] font-bold uppercase tracking-wide">
          Categoría
        </span>
      ),
      cell: (info) => (
        <span
          className="gastos-cat-pill block w-full min-w-0 truncate rounded px-1.5 py-0.5 text-[10px] font-medium leading-tight"
          title={info.getValue()}
        >
          {info.getValue()}
        </span>
      ),
      enableSorting: false,
    }),

    helper.accessor('proveedor', {
      meta: { align: 'left' },
      header: () => (
        <span className="gastos-th text-[10px] font-bold uppercase tracking-wide">
          Proveedor
        </span>
      ),
      cell: (info) => (
        <span className="gastos-td block max-w-full truncate text-[11px] opacity-80" title={info.getValue() || undefined}>
          {info.getValue() || '—'}
        </span>
      ),
      enableSorting: false,
    }),

    helper.accessor('factura_referencia', {
      meta: { align: 'left' },
      header: () => (
        <span className="gastos-th text-[10px] font-bold uppercase tracking-wide" title="Referencia de factura">
          Factura
        </span>
      ),
      cell: (info) => (
        <span
          className="gastos-td block max-w-full truncate font-mono text-[11px] opacity-80"
          title={info.getValue() || undefined}
        >
          {info.getValue() || '—'}
        </span>
      ),
      enableSorting: false,
    }),

    helper.accessor('monto', {
      meta: { align: 'right' },
      header: ({ column }) => (
        <button
          type="button"
          className="group gastos-th inline-flex w-full items-center justify-end text-[10px] font-bold uppercase tracking-widest transition-colors"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Monto <SortIcon direction={column.getIsSorted()} />
        </button>
      ),
      cell: ({ row }) => {
        const gasto = row.original;
        const oroResumen = formatGastoOroResumen(gasto);
        return (
          <span className="gastos-amount block text-[11px]" title={oroResumen || undefined}>
            {fmt(gasto.monto)}
            {isGastoPagoOro(gasto) ? (
              <span className="block text-[9px] font-normal text-amber-400/85">{oroResumen}</span>
            ) : null}
          </span>
        );
      },
      sortingFn: 'basic',
    }),

    helper.accessor((row) => row.gastos_empresas ?? [], {
      id: 'pagado_por',
      meta: { align: 'left' },
      header: () => (
        <span className="gastos-th text-[10px] font-bold uppercase tracking-wide">
          Pagado por
        </span>
      ),
      cell: (info) => {
        const geList = info.getValue() as Array<{
          empresa_id: string;
          monto_pagado: number;
          porcentaje: number;
          empresas_inversoras?: { nombre: string; color: string } | null;
        }>;
        if (!geList || geList.length === 0) {
          return (
            <span className="gastos-td block max-w-full truncate text-[10px] opacity-60">
              —
            </span>
          );
        }
        if (geList.length === 1) {
          const ge = geList[0];
          const emp = ge.empresas_inversoras;
          return (
            <span className="gastos-td flex items-center gap-1.5 text-[10px]">
              {emp && (
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: emp.color }}
                />
              )}
              <span className="truncate">{emp?.nombre ?? ge.empresa_id}</span>
              <span className="shrink-0 opacity-60">({ge.porcentaje}%)</span>
            </span>
          );
        }
        return (
          <div className="gastos-td flex max-w-full flex-wrap items-center gap-1 text-[10px]">
            {geList.map((ge) => {
              const emp = ge.empresas_inversoras;
              return (
                <span
                  key={ge.empresa_id}
                  className="flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 font-medium"
                  title={`${emp?.nombre ?? ge.empresa_id}: $${ge.monto_pagado.toFixed(2)} (${ge.porcentaje}%)`}
                >
                  {emp && (
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: emp.color }}
                    />
                  )}
                  <span className="truncate">{emp?.nombre ?? ge.empresa_id}</span>
                  <span className="shrink-0 opacity-70">({ge.porcentaje}%)</span>
                </span>
              );
            })}
          </div>
        );
      },
      enableSorting: false,
    }),

    helper.display({
      id: 'actions',
      meta: { align: 'right' },
      header: () => <span className="sr-only">Acciones</span>,
      cell: ({ row }) =>
        canEdit ? (
          <div className="flex justify-end gap-0.5">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onEdit(row.original); }}
              disabled={isPending}
              className="gastos-page-btn rounded-lg p-1 transition-colors hover:!text-[var(--dashboard-accent)] disabled:opacity-30"
              title="Editar"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete(row.original.id); }}
              disabled={isPending}
              className="gastos-page-btn rounded-lg p-1 transition-colors hover:!text-[var(--dashboard-danger)] disabled:opacity-30"
              title="Eliminar"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null,
    }),
  ];
}

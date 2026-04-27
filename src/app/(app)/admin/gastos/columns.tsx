'use client';

/**
 * Definiciones de columnas TanStack Table v8 para la tabla de Gastos.
 * Separadas del componente para facilitar reutilización y testing.
 */

import { createColumnHelper, type FilterFn } from '@tanstack/react-table';
import { ArrowUpDown, ArrowUp, ArrowDown, Edit2, Trash2 } from 'lucide-react';
import type { Gasto } from '@/lib/types';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

// ── Función de sort para monto (numérico) ────────────────────
const helper = createColumnHelper<Gasto>();

// ── Ícono de ordenamiento ────────────────────────────────────
function SortIcon({ direction }: { direction: 'asc' | 'desc' | false }) {
  if (direction === 'asc')  return <ArrowUp   className="ml-1.5 w-3 h-3 text-amber-400" />;
  if (direction === 'desc') return <ArrowDown className="ml-1.5 w-3 h-3 text-amber-400" />;
  return <ArrowUpDown className="ml-1.5 w-3 h-3 text-white/20 group-hover:text-white/40 transition-colors" />;
}

// ── Filtro global personalizado ──────────────────────────────
// Busca en descripción, nombre de categoría y proveedor
export const gastoGlobalFilter: FilterFn<Gasto> = (row, _columnId, value) => {
  const q = String(value).toLowerCase();
  return (
    row.original.descripcion?.toLowerCase().includes(q)              ||
    (row.original.categorias_gasto?.nombre ?? '').toLowerCase().includes(q) ||
    (row.original.proveedor ?? '').toLowerCase().includes(q)         ||
    row.original.fecha.includes(q)
  );
};

// ── Columnas ─────────────────────────────────────────────────
interface GetColumnsOptions {
  onEdit:   (item: Gasto) => void;
  onDelete: (id: string)  => void;
  canEdit:  boolean;
  isPending: boolean;
}

export function getGastoColumns({
  onEdit, onDelete, canEdit, isPending,
}: GetColumnsOptions) {
  return [
    helper.accessor('fecha', {
      header: ({ column }) => (
        <button
          className="group flex items-center text-[10px] font-bold uppercase tracking-widest text-white/35 hover:text-white/60 transition-colors"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Fecha <SortIcon direction={column.getIsSorted()} />
        </button>
      ),
      cell: (info) => (
        <span className="text-white/40 text-xs whitespace-nowrap font-mono">
          {info.getValue()}
        </span>
      ),
      sortingFn: 'alphanumeric',
    }),

    helper.accessor('descripcion', {
      header: 'Descripción',
      cell: (info) => (
        <span
          className="text-white/80 font-medium max-w-[220px] truncate block"
          title={info.getValue()}
        >
          {info.getValue()}
        </span>
      ),
      enableSorting: false,
    }),

    helper.accessor((row) => row.categorias_gasto?.nombre ?? '—', {
      id: 'categoria',
      header: 'Categoría',
      cell: (info) => (
        <span className="badge badge-neutral text-[10px]">{info.getValue()}</span>
      ),
      enableSorting: false,
    }),

    helper.accessor('proveedor', {
      header: 'Proveedor',
      cell: (info) => (
        <span className="text-white/40 text-xs truncate block max-w-[120px]">
          {info.getValue() || '—'}
        </span>
      ),
      enableSorting: false,
    }),

    helper.accessor('monto', {
      header: ({ column }) => (
        <button
          className="group flex items-center text-[10px] font-bold uppercase tracking-widest text-white/35 hover:text-white/60 transition-colors ml-auto"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Monto <SortIcon direction={column.getIsSorted()} />
        </button>
      ),
      cell: (info) => (
        <span className="text-right font-semibold text-red-400 whitespace-nowrap block">
          {fmt(info.getValue())}
        </span>
      ),
      sortingFn: 'basic',
    }),

    helper.display({
      id: 'actions',
      header: '',
      cell: ({ row }) =>
        canEdit ? (
          <div className="flex gap-1 justify-end">
            <button
              onClick={() => onEdit(row.original)}
              disabled={isPending}
              className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-amber-400 transition-colors disabled:opacity-30"
              title="Editar"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(row.original.id)}
              disabled={isPending}
              className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-colors disabled:opacity-30"
              title="Eliminar"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ) : null,
    }),
  ];
}

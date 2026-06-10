'use client';

import { ColumnDef } from '@tanstack/react-table';
import { MINEOS_TABLE_ACTION_DELETE, MINEOS_TABLE_ACTION_EDIT } from '@/lib/mineos-visual';
import type { ReporteAcarreo } from '@/lib/types';
import { formatLineaAcarreo } from '@/lib/acarreo-format';
import { Edit2, Trash2 } from 'lucide-react';

const fmtDate = (fecha?: string | null) => {
  if (!fecha) return '—';
  return new Date(fecha + 'T12:00:00').toLocaleDateString('es-ES', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export const columns = (
  openEdit: (item: ReporteAcarreo) => void,
  handleDelete: (id: string) => void,
  canEdit: boolean,
): ColumnDef<ReporteAcarreo>[] => [
  {
    accessorKey: 'fecha',
    header: 'Fecha',
    cell: ({ row }) => (
      <span className="whitespace-nowrap font-medium text-white/70">{fmtDate(row.original.fecha)}</span>
    ),
  },
  {
    accessorKey: 'turno',
    header: 'Servicio',
    cell: ({ row }) => {
      const val = row.getValue('turno') as string;
      return (
        <span className="whitespace-nowrap rounded-sm bg-white/[0.04] px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-white/50">
          {val === 'dia' ? '☀ Diurno' : val === 'noche' ? '🌙 Nocturno' : '🔄 Completo'}
        </span>
      );
    },
  },
  {
    accessorKey: 'mina',
    header: 'Mina',
    cell: ({ row }) => <span className="font-medium text-white/80">{row.getValue('mina') || '—'}</span>,
  },
  {
    accessorKey: 'molino',
    header: 'Molino',
    cell: ({ row }) => <span className="text-white/70">{row.getValue('molino') || '—'}</span>,
  },
  {
    id: 'detalle',
    header: 'Detalle de carga',
    cell: ({ row }) => {
      const lineas = row.original.lineas ?? [];
      return (
        <div className="acarreo-table-lines max-w-md space-y-0.5">
          {lineas.slice(0, 2).map((linea, index) => (
            <p key={index} className="truncate text-[11px] leading-snug text-white/55">
              {formatLineaAcarreo(linea)}
            </p>
          ))}
          {lineas.length > 2 ? (
            <p className="text-[10px] text-white/35">+{lineas.length - 2} líneas más</p>
          ) : null}
        </div>
      );
    },
  },
  {
    accessorKey: 'carga_total',
    header: () => <div className="text-center">Carga total</div>,
    cell: ({ row }) => (
      <div className="text-center font-bold tabular-nums text-amber-400">
        {row.getValue('carga_total')} <span className="text-[10px] font-normal text-white/35">sacos</span>
      </div>
    ),
  },
  {
    accessorKey: 'sacos_libres',
    header: () => <div className="text-center">Sacos libres</div>,
    cell: ({ row }) => (
      <div className="text-center tabular-nums text-white/70">
        {row.getValue('sacos_libres')}
      </div>
    ),
  },
  {
    id: 'acciones',
    header: 'Acciones',
    cell: ({ row }) => {
      if (!canEdit) return null;
      return (
        <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => openEdit(row.original)}
            className={MINEOS_TABLE_ACTION_EDIT}
            title="Editar"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => handleDelete(row.original.id)}
            className={MINEOS_TABLE_ACTION_DELETE}
            title="Eliminar"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      );
    },
  },
];

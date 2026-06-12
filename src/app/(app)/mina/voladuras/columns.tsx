'use client';

import { ColumnDef } from '@tanstack/react-table';
import { MINEOS_TABLE_ACTION_DELETE, MINEOS_TABLE_ACTION_EDIT } from '@/lib/mineos-visual';
import { formatTime12h } from '@/lib/format-time';
import type { ReporteVoladura } from '@/lib/types';
import { VoladurasChupisCell, VoladurasHuecosCell } from '@/components/voladuras/VoladurasPerforacionCell';
import { Edit2, Trash2 } from 'lucide-react';

const fmtDate = (fecha?: string | null) => {
  if (!fecha) return '—';
  return new Date(fecha + 'T12:00:00').toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const turnoLabel = (val: string) => {
  if (val === 'dia') return 'Día';
  if (val === 'noche') return 'Noche';
  return 'Comp.';
};

const WRAP_CELL_META = { wrap: true as const };

export const columns = (
  openEdit: (item: ReporteVoladura) => void,
  handleDelete: (id: string) => void,
  canEdit: boolean,
): ColumnDef<ReporteVoladura>[] => [
  {
    accessorKey: 'fecha',
    header: 'Fecha',
    cell: ({ row }) => (
      <span className="whitespace-nowrap font-medium text-white/70">{fmtDate(row.original.fecha)}</span>
    ),
  },
  {
    accessorKey: 'turno',
    header: 'Turno',
    cell: ({ row }) => {
      const val = row.getValue('turno') as string;
      return (
        <span className="whitespace-nowrap text-xs font-bold uppercase tracking-wider text-white/50 bg-white/[0.04] px-2 py-0.5 rounded-sm">
          {turnoLabel(val)}
        </span>
      );
    },
  },
  {
    accessorKey: 'mina',
    header: 'Mina',
    cell: ({ row }) => (
      <span className="text-white/80 font-medium">{row.getValue('mina') || '—'}</span>
    ),
  },
  {
    accessorKey: 'vertical_disparo',
    header: 'Vertical',
    cell: ({ row }) => (
      <span className="text-white/60">{row.original.vertical_disparo || '—'}</span>
    ),
  },
  {
    accessorKey: 'responsable',
    header: 'Responsable',
    cell: ({ row }) => (
      <span className="max-w-[8rem] truncate text-white/60" title={row.original.responsable || undefined}>
        {row.original.responsable || '—'}
      </span>
    ),
  },
  {
    id: 'disparo',
    header: 'Disparo',
    cell: ({ row }) => {
      const nd = row.original.numero_disparo;
      const hd = row.original.hora_disparo;
      return (
        <div className="text-white/55 whitespace-nowrap">
          {nd ? `N°${nd}` : '—'}
          {hd && <span className="text-white/30 text-xs ml-1">· {formatTime12h(hd)}</span>}
        </div>
      );
    },
  },
  {
    id: 'huecos',
    header: 'Huecos',
    meta: WRAP_CELL_META,
    cell: ({ row }) => <VoladurasHuecosCell record={row.original} />,
  },
  {
    id: 'chupis',
    header: 'Chupis',
    meta: WRAP_CELL_META,
    cell: ({ row }) => <VoladurasChupisCell record={row.original} />,
  },
  {
    accessorKey: 'fosforos_lp',
    header: () => <div className="text-center">Fósforos</div>,
    cell: ({ row }) => {
      const value = Number(row.getValue('fosforos_lp')) || 0;
      return <div className="mineos-cell-general text-center">{value > 0 ? value : '—'}</div>;
    },
  },
  {
    accessorKey: 'espaguetis',
    header: () => <div className="text-center">Espag.</div>,
    cell: ({ row }) => {
      const value = Number(row.getValue('espaguetis')) || 0;
      return <div className="text-center text-white/60">{value > 0 ? value : '—'}</div>;
    },
  },
  {
    accessorKey: 'vitamina_e',
    header: () => <div className="text-center">Vit. E</div>,
    cell: ({ row }) => {
      const value = Number(row.getValue('vitamina_e')) || 0;
      return <div className="mineos-cell-general text-center">{value > 0 ? value : '—'}</div>;
    },
  },
  {
    accessorKey: 'trenza_metros',
    header: () => <div className="text-center">Trenza</div>,
    cell: ({ row }) => {
      const value = Number(row.getValue('trenza_metros')) || 0;
      return <div className="text-center text-white/60">{value > 0 ? `${value} m` : '—'}</div>;
    },
  },
  {
    accessorKey: 'arroz_kg',
    header: () => <div className="text-right">Arroz (kg)</div>,
    cell: ({ row }) => {
      const value = Number(row.getValue('arroz_kg')) || 0;
      return (
        <div className="mineos-cell-general text-right font-semibold">
          {value > 0 ? `${value} kg` : '—'}
        </div>
      );
    },
  },
  {
    accessorKey: 'sin_novedad',
    header: 'Estado',
    cell: ({ row }) => {
      const ok = row.getValue('sin_novedad') as boolean;
      return (
        <span className={`badge ${ok ? 'badge-success' : 'badge-danger'}`}>
          {ok ? 'Sin novedad' : 'Novedad'}
        </span>
      );
    },
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

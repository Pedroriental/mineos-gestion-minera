'use client';

import { ColumnDef } from '@tanstack/react-table';
import type { ReporteProduccion } from '@/lib/types';
import { Edit2, Trash2 } from 'lucide-react';
import { MINEOS_TABLE_ACTION_DELETE, MINEOS_TABLE_ACTION_EDIT } from '@/lib/mineos-visual';

const PESO_SACO_KG = 50;

const fmtNum = (n: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 }).format(n);

const fmtDate = (fecha?: string | null) => {
  if (!fecha) return '—';
  return new Date(fecha + 'T12:00:00').toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const getMermaBadge = (pct: number) => {
  if (pct <= 0) return 'badge-neutral';
  if (pct < 50) return 'badge-success';
  if (pct < 65) return 'badge-warning';
  return 'badge-danger';
};

export const columns = (
  openEdit: (item: ReporteProduccion) => void,
  handleDelete: (id: string) => void
): ColumnDef<ReporteProduccion>[] => [
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
        <span className="text-xs whitespace-nowrap uppercase font-bold tracking-wider text-white/50 bg-white/[0.04] px-2 py-0.5 rounded-sm">
          {val === 'dia' ? '☀ Día' : val === 'noche' ? '🌙 Noche' : '🔄 Comp.'}
        </span>
      );
    },
  },
  {
    accessorKey: 'molino',
    header: 'Molino',
    cell: ({ row }) => <span className="text-white/80 font-medium">{row.getValue('molino') || '—'}</span>,
  },
  {
    id: 'material',
    header: 'Material',
    cell: ({ row }) => {
      const mat = row.original.material;
      const cod = row.original.material_codigo;
      return (
        <div className="produccion-material-cell">
          <span className="block truncate font-medium text-white/75">{mat || '—'}</span>
          {cod && <span className="block truncate text-[10px] text-white/35">{cod}</span>}
        </div>
      );
    },
  },
  {
    accessorKey: 'amalgama_1_g',
    header: () => <div className="text-right">Amalg 1 (g)</div>,
    cell: ({ row }) => {
      const val = row.getValue('amalgama_1_g') as number | null;
      return <div className="text-right text-white/55">{val ? `${fmtNum(val)}` : '—'}</div>;
    },
  },
  {
    accessorKey: 'amalgama_2_g',
    header: () => <div className="text-right">Amalg 2 (g)</div>,
    cell: ({ row }) => {
      const val = row.getValue('amalgama_2_g') as number | null;
      return <div className="text-right text-white/55">{val ? `${fmtNum(val)}` : '—'}</div>;
    },
  },
  {
    accessorKey: 'oro_recuperado_g',
    header: () => <div className="text-right text-amber-400">Au Recup. (g)</div>,
    cell: ({ row }) => <div className="text-right font-bold text-amber-400 text-base">{fmtNum(row.getValue('oro_recuperado_g'))}</div>,
  },
  {
    accessorKey: 'merma_1_pct',
    header: 'Merma 1',
    cell: ({ row }) => {
      const val = row.getValue('merma_1_pct') as number | null;
      return val ? <span className={`badge ${getMermaBadge(val)}`}>{val}%</span> : <span className="text-white/30">—</span>;
    },
  },
  {
    accessorKey: 'merma_2_pct',
    header: 'Merma 2',
    cell: ({ row }) => {
      const val = row.getValue('merma_2_pct') as number | null;
      return val ? <span className={`badge ${getMermaBadge(val)}`}>{val}%</span> : <span className="text-white/30">—</span>;
    },
  },
  {
    accessorKey: 'sacos',
    header: () => <div className="text-center">Sacos (×50kg)</div>,
    cell: ({ row }) => {
      const sacos = row.getValue('sacos') as number;
      return (
        <div className="produccion-sacos-cell text-white/65">
          <span className="block font-semibold tabular-nums">{sacos}</span>
          <span className="block truncate text-[10px] text-white/30 tabular-nums">
            ×50 = {sacos * PESO_SACO_KG}kg
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: 'toneladas_procesadas',
    header: 'Ton.',
    cell: ({ row }) => <span className="text-white/40">{row.getValue('toneladas_procesadas') || '—'}</span>,
  },
  {
    accessorKey: 'tenor_tonelada_gpt',
    header: 'Tenor g/t',
    cell: ({ row }) => {
      const val = row.getValue('tenor_tonelada_gpt') as number | null;
      return <span className="mineos-cell-general font-medium">{val ? `${fmtNum(val)}` : '—'}</span>;
    },
  },
  {
    id: 'acciones',
    header: 'Acciones',
    cell: ({ row }) => (
      <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={() => openEdit(row.original)} className={MINEOS_TABLE_ACTION_EDIT}>
          <Edit2 className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => handleDelete(row.original.id)} className={MINEOS_TABLE_ACTION_DELETE}>
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    ),
  },
];

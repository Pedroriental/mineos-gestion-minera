'use client';

import { ColumnDef } from '@tanstack/react-table';
import type { ReporteQuemado } from '@/lib/types';
import { Edit2, Trash2 } from 'lucide-react';

const fmtN = (n: number) =>
  new Intl.NumberFormat('es-VE', { maximumFractionDigits: 4, minimumFractionDigits: 2 }).format(n);

const fmtDate = (fecha?: string | null) => {
  if (!fecha) return '—';
  return new Date(fecha + 'T12:00:00').toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export const columns = (
  openEdit: (item: ReporteQuemado) => void,
  handleDelete: (id: string) => void,
  canEdit: boolean,
): ColumnDef<ReporteQuemado>[] => [
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
    accessorKey: 'numero_quemada',
    header: 'N° Quemada',
    cell: ({ row }) => <span className="text-white/60 font-medium">{row.getValue('numero_quemada') || '—'}</span>,
  },
  {
    id: 'planchas',
    header: () => <div className="text-center">Planchas</div>,
    cell: ({ row }) => {
      const planchas = row.original.planchas;
       return <div className="text-center text-white/65">{planchas?.length || 0}</div>;
    },
  },
  {
    accessorKey: 'total_amalgama_g',
    header: () => <div className="text-right">Amalgama (g)</div>,
    cell: ({ row }) => <div className="text-right text-white/65 tabular-nums">{fmtN(row.getValue('total_amalgama_g'))} g</div>,
  },
  {
    accessorKey: 'total_oro_g',
    header: () => <div className="text-right text-amber-400">Au (g)</div>,
    cell: ({ row }) => <div className="text-right font-bold text-amber-400 tabular-nums">{fmtN(row.getValue('total_oro_g'))} g</div>,
  },
  {
    id: 'merma',
    header: 'Merma',
    cell: ({ row }) => {
      const amalgama = row.original.total_amalgama_g;
      const oro = row.original.total_oro_g;
      if (amalgama > 0) {
        const merma = ((amalgama - oro) / amalgama) * 100;
        return <span className="badge badge-danger">{merma.toFixed(1)}%</span>;
      }
      return <span className="text-white/40">—</span>;
    },
  },
  {
    id: 'porcentaje_rec',
    header: '% Rec.',
    cell: ({ row }) => {
      const amalgama = row.original.total_amalgama_g;
      const oro = row.original.total_oro_g;
      if (amalgama > 0) {
        const rec = (oro / amalgama) * 100;
        return <span className={`badge ${rec >= 40 ? 'badge-success' : 'badge-warning'}`}>{rec.toFixed(1)}%</span>;
      }
      return <span className="text-white/40">—</span>;
    },
  },
  {
    accessorKey: 'retorta_oro_g',
    header: 'Retorta',
    cell: ({ row }) => {
      const val = row.getValue('retorta_oro_g') as number | null;
      return <span className="text-white/40 tabular-nums">{val != null ? `${fmtN(val)} g` : '—'}</span>;
    },
  },
  {
    accessorKey: 'responsable',
    header: 'Responsable',
    cell: ({ row }) => <span className="text-white/40">{row.getValue('responsable') || '—'}</span>,
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
            className="rounded-lg p-1.5 text-white/40 transition-colors hover:bg-white/[0.06] hover:text-[var(--mineos-general-bright)]"
            title="Editar"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => handleDelete(row.original.id)}
            className="rounded-lg p-1.5 text-white/40 transition-colors hover:bg-red-500/10 hover:text-red-400"
            title="Eliminar"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      );
    },
  },
];

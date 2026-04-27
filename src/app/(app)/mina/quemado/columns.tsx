'use client';

import { ColumnDef } from '@tanstack/react-table';
import type { ReporteQuemado } from '@/lib/types';
import { Edit2, Trash2 } from 'lucide-react';

const fmtN = (n: number) =>
  new Intl.NumberFormat('es-VE', { maximumFractionDigits: 4, minimumFractionDigits: 2 }).format(n);

export const columns = (
  openEdit: (item: ReporteQuemado) => void,
  handleDelete: (id: string) => void
): ColumnDef<ReporteQuemado>[] => [
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
    header: () => <div className="text-right">Total Amalgama (g)</div>,
    cell: ({ row }) => <div className="text-right text-white/65">{fmtN(row.getValue('total_amalgama_g'))} g</div>,
  },
  {
    accessorKey: 'total_oro_g',
    header: () => <div className="text-right text-amber-400">Total Au (g)</div>,
    cell: ({ row }) => <div className="text-right font-bold text-amber-400">{fmtN(row.getValue('total_oro_g'))} g</div>,
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
    header: 'Retorta (g)',
    cell: ({ row }) => {
      const val = row.getValue('retorta_oro_g') as number | null;
      return <span className="text-white/40">{val != null ? `${fmtN(val)} g` : '—'}</span>;
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
    cell: ({ row }) => (
      <div className="flex gap-1 justify-end">
        <button
          onClick={() => openEdit(row.original)}
          className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-orange-400 transition-colors"
        >
          <Edit2 className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleDelete(row.original.id)}
          className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    ),
  },
];

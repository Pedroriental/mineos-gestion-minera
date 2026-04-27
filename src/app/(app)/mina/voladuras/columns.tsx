'use client';

import { ColumnDef } from '@tanstack/react-table';
import type { ReporteVoladura } from '@/lib/types';
import { Edit2, Trash2 } from 'lucide-react';

export const columns = (
  openEdit: (item: ReporteVoladura) => void,
  handleDelete: (id: string) => void
): ColumnDef<ReporteVoladura>[] => [
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
    accessorKey: 'frente',
    header: 'Frente',
    cell: ({ row }) => {
      const f = row.getValue('frente') as string;
      return <span className="text-amber-400 font-bold whitespace-nowrap">{f || '—'}</span>;
    },
  },
  {
    accessorKey: 'mina',
    header: 'Mina',
    cell: ({ row }) => {
      return <span className="text-white/80 font-medium">{row.getValue('mina') || '—'}</span>;
    },
  },
  {
    id: 'disparo',
    header: 'Disparo',
    cell: ({ row }) => {
      const nd = row.original.numero_disparo;
      const hd = row.original.hora_disparo;
      const vd = row.original.vertical_disparo;
      return (
        <div className="text-white/55 whitespace-nowrap">
          {nd ? `N°${nd}` : '—'}
          {hd && <span className="text-white/30 text-xs ml-1">— {hd.slice(0, 5)}</span>}
          {vd && <span className="block text-[10px] text-purple-400/70 mt-0.5">{vd}</span>}
        </div>
      );
    },
  },
  {
    id: 'huecos',
    header: () => <div className="text-center">Huecos</div>,
    cell: ({ row }) => (
      <div className="text-center font-semibold text-blue-400">
        {row.original.huecos_cantidad}{' '}
        <span className="text-white/30 text-xs">×{row.original.huecos_pies}p</span>
      </div>
    ),
  },
  {
    id: 'chupis',
    header: () => <div className="text-center">Chupis</div>,
    cell: ({ row }) => (
      <div className="text-center font-semibold text-amber-400">
        {row.original.chupis_cantidad}{' '}
        <span className="text-white/30 text-xs">×{row.original.chupis_pies}p</span>
      </div>
    ),
  },
  {
    accessorKey: 'fosforos_lp',
    header: () => <div className="text-center">Fósforos</div>,
    cell: ({ row }) => <div className="text-center text-purple-400">{row.getValue('fosforos_lp')}</div>,
  },
  {
    accessorKey: 'espaguetis',
    header: () => <div className="text-center">Espag.</div>,
    cell: ({ row }) => <div className="text-center text-white/60">{row.getValue('espaguetis')}</div>,
  },
  {
    accessorKey: 'vitamina_e',
    header: () => <div className="text-center">Vit. E</div>,
    cell: ({ row }) => <div className="text-center text-cyan-400">{row.getValue('vitamina_e')}</div>,
  },
  {
    accessorKey: 'arroz_kg',
    header: () => <div className="text-right">Arroz (kg)</div>,
    cell: ({ row }) => <div className="text-right font-semibold text-red-400">{row.getValue('arroz_kg')} kg</div>,
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
    cell: ({ row }) => (
      <div className="flex gap-1 justify-end">
        <button
          onClick={() => openEdit(row.original)}
          className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-amber-400 transition-colors"
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

import { ColumnDef } from '@tanstack/react-table';
import type { ReporteExtraccion } from '@/lib/types';
import { Edit2, Trash2 } from 'lucide-react';

const turnoLabel = (t: string) =>
  t === 'dia' ? '☀ Día' : t === 'noche' ? '🌙 Noche' : '🔄 Completo';

const fmtTime = (t?: string | null) => (t ? t.slice(0, 5) : '—');

export const columns = (
  onEdit: (item: ReporteExtraccion) => void,
  onDelete: (id: string) => void,
  canEdit: boolean
): ColumnDef<ReporteExtraccion>[] => [
  {
    accessorKey: 'turno',
    header: 'Turno',
    cell: ({ row }) => <span className="font-medium whitespace-nowrap">{turnoLabel(row.original.turno)}</span>,
  },
  {
    accessorKey: 'vertical',
    header: 'Vertical',
    cell: ({ row }) => <span className="text-amber-400 font-bold whitespace-nowrap">{row.original.vertical || '—'}</span>,
  },
  {
    accessorKey: 'mina',
    header: 'Mina',
    cell: ({ row }) => <span className="text-white/80 font-medium whitespace-nowrap">{row.original.mina || '—'}</span>,
  },
  {
    accessorKey: 'numero_disparo',
    header: 'Disparo',
    cell: ({ row }) => <span className="text-white/55 whitespace-nowrap">{row.original.numero_disparo ? `N°${row.original.numero_disparo}` : '—'}</span>,
  },
  {
    id: 'horario',
    header: 'Horario',
    cell: ({ row }) => (
      <span className="text-white/40 whitespace-nowrap text-xs">
        {fmtTime(row.original.hora_inicio)} → {fmtTime(row.original.hora_fin)}
      </span>
    ),
  },
  {
    accessorKey: 'sacos_extraidos',
    header: 'Sacos',
    cell: ({ row }) => (
      <span className="font-bold text-amber-400 text-lg flex justify-center">
        {row.original.sacos_extraidos}
      </span>
    ),
  },
  {
    id: 'eventos',
    header: 'Eventos',
    cell: ({ row }) => {
      const evs = row.original.eventos;
      if (!evs || evs.length === 0) return <span className="text-white/30 text-xs">—</span>;
      return (
        <div className="space-y-0.5 max-w-[260px]">
          {evs.map((ev, i) => (
            <p key={i} className="text-xs text-white/50 truncate">
              <span className="text-blue-400/60 font-semibold">{ev.hora}</span> {ev.descripcion}
            </p>
          ))}
        </div>
      );
    },
  },
  {
    accessorKey: 'observaciones',
    header: 'Observaciones',
    cell: ({ row }) => (
      <span className="text-white/35 text-xs max-w-[200px] truncate block">
        {row.original.observaciones || '—'}
      </span>
    ),
  },
  {
    id: 'acciones',
    header: 'Acciones',
    cell: ({ row }) => {
      if (!canEdit) return null;
      return (
        <div className="flex gap-1 justify-end">
          <button
            onClick={() => onEdit(row.original)}
            className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-amber-400 transition-colors"
            title="Editar Registro"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(row.original.id)}
            className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-colors"
            title="Eliminar Registro"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      );
    },
  },
];

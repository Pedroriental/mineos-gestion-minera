import { ColumnDef } from '@tanstack/react-table';
import type { Personal } from '@/lib/types';
import { Edit2, Trash2, Eye } from 'lucide-react';

const fmtMoney = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

export const columns = (
  openEdit: (item: Personal) => void,
  handleDelete: (id: string) => void,
  canEdit: boolean,
  isHistorical: boolean
): ColumnDef<Personal>[] => {
  const baseCols: ColumnDef<Personal>[] = [
    {
      accessorKey: 'nombre_completo',
      header: 'Nombre',
      cell: ({ row }) => <span className="font-semibold text-white/90">{row.getValue('nombre_completo')}</span>,
    },
    {
      accessorKey: 'cedula',
      header: 'Cédula',
      cell: ({ row }) => <span className="text-white/60 font-mono text-xs">{row.getValue('cedula') || '—'}</span>,
    },
    {
      accessorKey: 'cargo',
      header: 'Cargo',
      cell: ({ row }) => <span className="text-white/70">{row.getValue('cargo') || '—'}</span>,
    },
    {
      accessorKey: 'salario_base',
      header: () => <div className="text-right text-amber-400">Salario (sem)</div>,
      cell: ({ row }) => <div className="text-right font-bold text-amber-400">{fmtMoney(row.getValue('salario_base'))}</div>,
    },
  ];

  if (!isHistorical) {
    baseCols.push({
      id: 'acciones',
      header: () => <div className="text-right">Acciones</div>,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          {canEdit && (
            <>
              <button onClick={() => openEdit(row.original)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-amber-400 transition-colors">
                <Edit2 className="w-4 h-4" />
              </button>
              <button onClick={() => handleDelete(row.original.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      ),
    });
  } else {
    // If historical, perhaps read-only, we don't show edit/delete
    baseCols.push({
      id: 'estado',
      header: () => <div className="text-right">Estado</div>,
      cell: () => <div className="text-right"><span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-sm">Pagado</span></div>,
    });
  }

  return baseCols;
};

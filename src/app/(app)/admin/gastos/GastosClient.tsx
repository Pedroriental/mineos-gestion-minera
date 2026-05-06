'use client';

import { useState, useTransition, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type SortingState,
} from '@tanstack/react-table';
import {
  DollarSign, Plus, Search, X, Loader2, AlertCircle,
  Download, TrendingDown, Tag, FileText, ChevronLeft, ChevronRight,
  Receipt, Wallet, BarChart3, FileDown,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Gasto, CategoriaGasto } from '@/lib/types';
import EmptyState from '@/components/EmptyState';
import { useAuth } from '@/lib/auth-context';
import { useCanEdit } from '@/lib/use-can-edit';
import { createGasto, updateGasto, deleteGasto } from '@/lib/actions/gastos';
import { getGastoColumns, gastoGlobalFilter } from './columns';

// ── Helpers ──────────────────────────────────────────────────
interface GastosClientProps {
  data:       Gasto[];
  categorias: CategoriaGasto[];
}

const EMPTY_FORM = {
  fecha:              new Date().toISOString().split('T')[0],
  categoria_id:       '',
  descripcion:        '',
  monto:              '',
  proveedor:          '',
  factura_referencia: '',
  notas:              '',
};

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

const fmtShort = (n: number) => {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return fmt(n);
};

// Colores por categoría para el gráfico
const CAT_COLORS = [
  '#DAA520', '#FB923C', '#34D399', '#60A5FA', '#A78BFA',
  '#F472B6', '#FBBF24', '#4ADE80', '#38BDF8', '#E879F9',
];

// ─────────────────────────────────────────────────────────────
export default function GastosClient({ data, categorias }: GastosClientProps) {
  const { user }  = useAuth();
  const canEdit   = useCanEdit();
  const [isPending, startTransition] = useTransition();

  const [showModal, setShowModal] = useState(false);
  const [editItem,  setEditItem]  = useState<Gasto | null>(null);
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [sorting,   setSorting]   = useState<SortingState>([{ id: 'fecha', desc: true }]);
  const [globalFilter, setGlobalFilter] = useState('');

  const columns = useMemo(
    () => getGastoColumns({ onEdit: openEdit, onDelete: handleDelete, canEdit, isPending }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canEdit, isPending],
  );

  const table = useReactTable({
    data,
    columns,
    state:               { sorting, globalFilter },
    filterFns:           { gastoFilter: gastoGlobalFilter },
    globalFilterFn:      'gastoFilter' as any,
    onSortingChange:     setSorting,
    onGlobalFilterChange:setGlobalFilter,
    getCoreRowModel:     getCoreRowModel(),
    getSortedRowModel:   getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 20, pageIndex: 0 } },
  });

  // ── KPIs ──────────────────────────────────────────────────
  const totalGastos  = data.reduce((s, g) => s + Number(g.monto), 0);
  const numRegistros = data.length;

  // Gasto más alto
  const maxGasto = data.reduce((max, g) => Number(g.monto) > Number(max.monto) ? g : max, data[0] ?? { monto: 0, descripcion: '-' });

  // Agrupación por categoría para el gráfico
  const porCategoria = useMemo(() => {
    const map: Record<string, { nombre: string; total: number }> = {};
    data.forEach(g => {
      const nombre = g.categorias_gasto?.nombre || 'Sin categoría';
      if (!map[nombre]) map[nombre] = { nombre, total: 0 };
      map[nombre].total += Number(g.monto);
    });
    return Object.values(map)
      .sort((a, b) => b.total - a.total)
      .slice(0, 8); // top 8
  }, [data]);

  const maxCatTotal = porCategoria[0]?.total || 1;

  // ── Exportación CSV ───────────────────────────────────────
  function exportToCSV() {
    const rows    = table.getFilteredRowModel().rows;
    const headers = ['Fecha', 'Descripcion', 'Categoria', 'Proveedor', 'Monto USD'];
    const escape  = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
    const lines   = rows.map(row => {
      const g = row.original;
      return [g.fecha, escape(g.descripcion), g.categorias_gasto?.nombre || '', g.proveedor || '', g.monto].join(',');
    });
    const csv  = [headers.join(','), ...lines].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href = url;
    a.download = `gastos_${new Date().toISOString().split('T')[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  // ── Exportación PDF ───────────────────────────────────────
  async function exportToPDF() {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'), import('jspdf-autotable'),
    ]);
    const doc  = new (jsPDF as any)({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const rows = table.getFilteredRowModel().rows;
    const date = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });

    doc.setFillColor(9, 9, 11);
    doc.rect(0, 0, 297, 22, 'F');
    doc.setTextColor(218, 165, 32);
    doc.setFontSize(13); doc.setFont('helvetica', 'bold');
    doc.text('MineOS', 10, 10);
    doc.setTextColor(200, 200, 200);
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    doc.text('Reporte de Gastos Operativos', 10, 17);
    doc.text(date, 287, 17, { align: 'right' });

    autoTable(doc, {
      startY: 26,
      head:   [['Fecha', 'Descripcion', 'Categoria', 'Proveedor', 'Monto USD']],
      body:   rows.map(row => {
        const g = row.original;
        return [g.fecha, g.descripcion, g.categorias_gasto?.nombre || '-', g.proveedor || '-', fmt(g.monto)];
      }),
      foot: [['', '', '', 'TOTAL', fmt(rows.reduce((s, r) => s + Number(r.original.monto), 0))]],
      styles:             { fontSize: 8, cellPadding: 3, textColor: [210, 210, 210] },
      headStyles:         { fillColor: [24, 24, 27], textColor: [218, 165, 32], fontStyle: 'bold' },
      footStyles:         { fillColor: [24, 24, 27], textColor: [218, 165, 32], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [20, 20, 24] },
      bodyStyles:         { fillColor: [13, 13, 16] },
    });
    doc.save(`gastos_${new Date().toISOString().split('T')[0]}.pdf`);
  }

  // ── Modal helpers ─────────────────────────────────────────
  function resetForm() { setForm(EMPTY_FORM); setEditItem(null); setFormError(null); }
  function openNew()   { resetForm(); setShowModal(true); }
  function openEdit(item: Gasto) {
    setEditItem(item);
    setForm({
      fecha:              item.fecha,
      categoria_id:       item.categoria_id,
      descripcion:        item.descripcion,
      monto:              String(item.monto),
      proveedor:          item.proveedor          || '',
      factura_referencia: item.factura_referencia || '',
      notas:              item.notas              || '',
    });
    setShowModal(true);
  }
  function closeModal() { setShowModal(false); resetForm(); }

  // ── Mutaciones ────────────────────────────────────────────
  function handleSave() {
    setFormError(null);
    const montoNum = parseFloat(form.monto);
    if (!form.categoria_id)                                  { setFormError('Selecciona una categoría.'); return; }
    if (!form.descripcion.trim())                            { setFormError('La descripción es obligatoria.'); return; }
    if (!form.monto || isNaN(montoNum) || montoNum <= 0)     { setFormError('El monto debe ser mayor que cero.'); return; }

    const payload = {
      fecha: form.fecha, categoria_id: form.categoria_id, descripcion: form.descripcion,
      monto: montoNum, proveedor: form.proveedor || null,
      factura_referencia: form.factura_referencia || null, notas: form.notas || null,
      registrado_por: user?.id || null,
      ...(editItem ? { id: editItem.id } : {}),
    };
    startTransition(async () => {
      const result = editItem ? await updateGasto(payload) : await createGasto(payload);
      if (result.ok) { toast.success(result.message); closeModal(); }
      else           { setFormError(result.message); toast.error(result.message); }
    });
  }

  function handleDelete(id: string) {
    if (!confirm('¿Eliminar este gasto?')) return;
    startTransition(async () => {
      const result = await deleteGasto(id);
      result.ok ? toast.success(result.message) : toast.error(result.message);
    });
  }

  // ─────────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-[1600px] mx-auto h-[calc(100vh-80px)] p-4 md:p-6 flex flex-col overflow-hidden">

      {/* ── Header ── */}
      <div className="flex-shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="text-white/90 font-bold tracking-tight text-2xl flex items-center gap-3">
            <TrendingDown className="w-6 h-6 text-red-400" /> Gastos Operativos
          </h1>
          <p className="text-white/40 text-sm mt-1">
            Control de egresos y costos operacionales.
          </p>
        </div>
        <button
          onClick={openNew}
          disabled={!canEdit || isPending}
          className="bg-amber-600 hover:bg-amber-500 text-black font-bold h-10 px-5 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-lg shadow-amber-900/20 disabled:opacity-40 self-start sm:self-auto"
        >
          <Plus className="w-5 h-5" /> Registrar Gasto
        </button>
      </div>

      {/* ── Split Layout ── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-0">

        {/* PANEL IZQUIERDO — KPIs + Gráfico */}
        <div className="lg:col-span-4 flex flex-col gap-4 overflow-y-auto lg:overflow-hidden">

          {/* KPI Cards */}
          <div className="grid grid-cols-2 gap-3 flex-shrink-0">
            {/* Total Gastado */}
            <div className="col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl p-4 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent pointer-events-none" />
              <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">Total Gastado</p>
              <p className="text-3xl font-black text-red-400 leading-none">{fmtShort(totalGastos)}</p>
              <p className="text-xs text-white/30 mt-1">{numRegistros} registros</p>
            </div>

            {/* Mayor Gasto */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent pointer-events-none" />
              <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest mb-1">Mayor Gasto</p>
              <p className="text-lg font-black text-amber-400 leading-none">{fmtShort(Number(maxGasto?.monto || 0))}</p>
              <p className="text-[10px] text-white/30 mt-1 truncate">{maxGasto?.descripcion || '-'}</p>
            </div>

            {/* Promedio */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-zinc-500/5 to-transparent pointer-events-none" />
              <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest mb-1">Promedio</p>
              <p className="text-lg font-black text-white/70 leading-none">
                {numRegistros > 0 ? fmtShort(totalGastos / numRegistros) : '$0'}
              </p>
              <p className="text-[10px] text-white/30 mt-1">por registro</p>
            </div>
          </div>

          {/* Gráfico de barras por categoría */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex-1 min-h-0 overflow-hidden">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-bold text-white/50 uppercase tracking-widest">Gasto por Categoría</span>
            </div>
            {porCategoria.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-white/20 text-sm">Sin datos</div>
            ) : (
              <div className="space-y-2.5 overflow-y-auto max-h-[calc(100%-40px)] pr-1 custom-scrollbar">
                {porCategoria.map((cat, i) => (
                  <div key={cat.nombre}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-white/60 truncate max-w-[60%]">{cat.nombre}</span>
                      <span className="text-[10px] font-bold text-white/70 font-mono">{fmtShort(cat.total)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${(cat.total / maxCatTotal) * 100}%`,
                          backgroundColor: CAT_COLORS[i % CAT_COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* PANEL DERECHO — Tabla */}
        <div className="lg:col-span-8 flex flex-col min-h-0 bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">

          {/* Action Bar */}
          <div className="flex-shrink-0 flex flex-col sm:flex-row items-center gap-3 p-3 border-b border-zinc-800">
            <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 w-full flex-1">
              <Search className="w-4 h-4 text-white/40 mr-2 flex-shrink-0" />
              <input
                type="text"
                placeholder="Buscar por descripción, categoría o proveedor..."
                value={globalFilter ?? ''}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="bg-transparent border-none outline-none text-sm text-white/90 placeholder:text-white/30 w-full"
              />
              {globalFilter && (
                <button onClick={() => setGlobalFilter('')} className="text-white/30 hover:text-white/70 transition-colors ml-1">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={exportToCSV}
                className="btn-secondary h-9 px-3 flex items-center gap-2 text-xs whitespace-nowrap flex-1 sm:flex-none"
              >
                <FileDown className="w-3.5 h-3.5" /> CSV
              </button>
              <button
                onClick={exportToPDF}
                className="btn-secondary h-9 px-3 flex items-center gap-2 text-xs whitespace-nowrap flex-1 sm:flex-none"
              >
                <FileText className="w-3.5 h-3.5" /> PDF
              </button>
              {canEdit && (
                <button
                  onClick={openNew}
                  className="bg-amber-600 hover:bg-amber-500 text-black font-bold h-9 px-4 rounded-lg flex items-center gap-2 text-xs whitespace-nowrap transition-colors flex-1 sm:flex-none"
                >
                  <Plus className="w-4 h-4" /> Nuevo
                </button>
              )}
            </div>
          </div>

          {/* Tabla con scroll independiente */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-zinc-900 border-b border-zinc-800 z-10">
                {table.getHeaderGroups().map(hg => (
                  <tr key={hg.id}>
                    {hg.headers.map(header => (
                      <th
                        key={header.id}
                        onClick={header.column.getToggleSortingHandler()}
                        className={`px-4 py-2.5 text-[10px] font-bold text-white/50 uppercase tracking-wider whitespace-nowrap ${header.column.getCanSort() ? 'cursor-pointer select-none hover:text-white/80' : ''}`}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="py-16">
                      <EmptyState
                        icon={<Receipt className="w-6 h-6" />}
                        title="Sin gastos registrados"
                        description={globalFilter ? 'Ningún resultado para esa búsqueda.' : 'Registra el primer gasto operativo.'}
                        action={canEdit && !globalFilter ? { label: 'Registrar gasto', onClick: openNew } : undefined}
                      />
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map(row => (
                    <tr key={row.id} className="border-b border-zinc-800/30 hover:bg-zinc-800/40 transition-colors">
                      {row.getVisibleCells().map(cell => (
                        <td key={cell.id} className="px-4 py-2.5 text-xs text-white/80 whitespace-nowrap">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pie de tabla: total + paginación */}
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 border-t border-zinc-800 bg-zinc-950/60">
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-white/30 uppercase tracking-wider">Total visible</span>
              <span className="text-sm font-bold text-red-400">
                {fmt(table.getFilteredRowModel().rows.reduce((s, r) => s + Number(r.original.monto), 0))}
              </span>
              <span className="text-xs text-white/30">· {table.getFilteredRowModel().rows.length} registros</span>
            </div>
            {table.getPageCount() > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  className="p-1 rounded text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs text-white/40 px-2">
                  {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
                </span>
                <button
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  className="p-1 rounded text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Modal ── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/70 backdrop-blur-sm"
          onClick={closeModal}
        >
          <div
            className="relative w-full sm:max-w-2xl bg-zinc-950 border border-zinc-800 sm:rounded-2xl rounded-t-2xl shadow-2xl p-6 sm:p-8 max-h-[92dvh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="sm:hidden flex justify-center mb-4 -mt-1">
              <div className="w-8 h-1 rounded-full bg-zinc-700" />
            </div>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                  <Wallet className="w-4 h-4 text-red-400" />
                </div>
                <h2 className="text-lg font-semibold text-white/90">
                  {editItem ? 'Editar Gasto' : 'Nuevo Gasto'}
                </h2>
              </div>
              <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/40">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 mb-4">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span className="text-sm text-red-400">{formError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="input-label">Fecha *</label>
                <input type="date" value={form.fecha}
                  onChange={e => setForm({ ...form, fecha: e.target.value })}
                  className="input-field" />
              </div>
              <div>
                <label className="input-label">Categoría *</label>
                <select value={form.categoria_id}
                  onChange={e => { setForm({ ...form, categoria_id: e.target.value }); setFormError(null); }}
                  className="input-field">
                  <option value="">Seleccionar...</option>
                  {categorias.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="input-label">Descripción *</label>
                <input value={form.descripcion}
                  onChange={e => { setForm({ ...form, descripcion: e.target.value }); setFormError(null); }}
                  className="input-field" placeholder="Ej: Compra de combustible" />
              </div>
              <div>
                <label className="input-label">Monto (USD) *</label>
                <input type="number" step="0.01" min="0.01" value={form.monto}
                  onChange={e => { setForm({ ...form, monto: e.target.value }); setFormError(null); }}
                  className="input-field" placeholder="0.00" />
              </div>
              <div>
                <label className="input-label">Proveedor</label>
                <input value={form.proveedor}
                  onChange={e => setForm({ ...form, proveedor: e.target.value })}
                  className="input-field" />
              </div>
              <div>
                <label className="input-label">Ref. Factura</label>
                <input value={form.factura_referencia}
                  onChange={e => setForm({ ...form, factura_referencia: e.target.value })}
                  className="input-field" />
              </div>
              <div>
                <label className="input-label">Notas</label>
                <input value={form.notas}
                  onChange={e => setForm({ ...form, notas: e.target.value })}
                  className="input-field" />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-zinc-800">
              <button onClick={closeModal} disabled={isPending} className="btn-secondary">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={isPending}
                className="btn-primary min-w-[110px] justify-center">
                {isPending
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
                  : editItem ? 'Actualizar' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

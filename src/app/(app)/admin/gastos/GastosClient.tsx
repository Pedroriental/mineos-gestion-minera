'use client';

/**
 * GastosClient — Client Component para la página de Gastos.
 *
 * Recibe `data` y `categorias` como props desde el Server Component.
 * NO tiene useEffect ni loadData — la revalidación del servidor
 * (revalidatePath) inyecta el nuevo RSC payload automáticamente,
 * actualizando estas props sin recarga manual.
 *
 * Estado local: solo UI (modal, form, table state).
 * Mutaciones: exclusivamente via Server Actions.
 */

import { useState, useTransition, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type SortingState,
  type PaginationState,
} from '@tanstack/react-table';

import { DollarSign, Plus, Search, X, Loader2, AlertCircle, ChevronLeft, ChevronRight, FileDown, FileText } from 'lucide-react';
import { toast } from 'sonner';

import type { Gasto, CategoriaGasto } from '@/lib/types';
import EmptyState from '@/components/EmptyState';
import { useAuth } from '@/lib/auth-context';
import { useCanEdit } from '@/lib/use-can-edit';
import { createGasto, updateGasto, deleteGasto } from '@/lib/actions/gastos';
import { getGastoColumns, gastoGlobalFilter } from './columns';

import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';

// ── Props ─────────────────────────────────────────────────────
interface GastosClientProps {
  data:       Gasto[];
  categorias: CategoriaGasto[];
}

// ── Formulario vacío ──────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
export default function GastosClient({ data, categorias }: GastosClientProps) {
  const { user }  = useAuth();
  const canEdit   = useCanEdit();
  const [isPending, startTransition] = useTransition();

  // ── Modal / Form state ────────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [editItem,  setEditItem]  = useState<Gasto | null>(null);
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  // ── TanStack Table state ──────────────────────────────────
  const [sorting,      setSorting]      = useState<SortingState>([
    { id: 'fecha', desc: true }, // default: fecha descendente
  ]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [pagination,   setPagination]   = useState<PaginationState>({
    pageIndex: 0,
    pageSize:  15,
  });

  // ── Columnas (memoizadas para estabilidad referencial) ────
  const columns = useMemo(
    () => getGastoColumns({
      onEdit:    openEdit,
      onDelete:  handleDelete,
      canEdit,
      isPending,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canEdit, isPending],
  );

  // ── Tabla TanStack ────────────────────────────────────────
  const table = useReactTable({
    data,
    columns,
    state:     { sorting, globalFilter, pagination },
    filterFns: { gastoFilter: gastoGlobalFilter },
    globalFilterFn:          'gastoFilter' as any,
    onSortingChange:         setSorting,
    onGlobalFilterChange:    setGlobalFilter,
    onPaginationChange:      setPagination,
    getCoreRowModel:         getCoreRowModel(),
    getSortedRowModel:       getSortedRowModel(),
    getFilteredRowModel:     getFilteredRowModel(),
    getPaginationRowModel:   getPaginationRowModel(),
  });

  const totalGastos = data.reduce((s, g) => s + Number(g.monto), 0);

  // ── Exportación CSV (nativa, sin dependencias) ───────────────
  function exportToCSV() {
    const rows = table.getFilteredRowModel().rows;
    const headers = ['Fecha', 'Descripcion', 'Categoria', 'Proveedor', 'Monto USD'];
    const escape  = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
    const lines   = rows.map((row) => {
      const g = row.original;
      return [
        g.fecha,
        escape(g.descripcion),
        g.categorias_gasto?.nombre || '',
        g.proveedor               || '',
        g.monto,
      ].join(',');
    });
    const csv  = [headers.join(','), ...lines].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `gastos_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Exportación PDF (jspdf + jspdf-autotable, import dinámico) ─
  async function exportToPDF() {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);

    const doc  = new (jsPDF as any)({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const rows = table.getFilteredRowModel().rows;
    const date = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });

    // Header corporativo
    doc.setFillColor(9, 9, 11);
    doc.rect(0, 0, 297, 22, 'F');
    doc.setTextColor(245, 158, 11);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('MineOS', 10, 10);
    doc.setTextColor(200, 200, 200);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Reporte de Gastos', 10, 17);
    doc.text(date, 287, 17, { align: 'right' });

    autoTable(doc, {
      startY: 26,
      head:   [['Fecha', 'Descripción', 'Categoría', 'Proveedor', 'Monto USD']],
      body:   rows.map((row) => {
        const g = row.original;
        return [
          g.fecha,
          g.descripcion,
          g.categorias_gasto?.nombre || '—',
          g.proveedor               || '—',
          fmt(g.monto),
        ];
      }),
      foot:   [['', '', '', 'TOTAL', fmt(rows.reduce((s, r) => s + Number(r.original.monto), 0))]],
      styles:              { fontSize: 8,  cellPadding: 3, textColor: [210, 210, 210] },
      headStyles:          { fillColor: [24, 24, 27], textColor: [245, 158, 11], fontStyle: 'bold' },
      footStyles:          { fillColor: [24, 24, 27], textColor: [245, 158, 11], fontStyle: 'bold' },
      alternateRowStyles:  { fillColor: [20, 20, 24] },
      bodyStyles:          { fillColor: [13, 13, 16] },
    });

    doc.save(`gastos_${new Date().toISOString().split('T')[0]}.pdf`);
  }

  // ── Helpers de modal ──────────────────────────────────────
  function resetForm() {
    setForm(EMPTY_FORM);
    setEditItem(null);
    setFormError(null);
  }

  function openNew() { resetForm(); setShowModal(true); }

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

  // ── Mutaciones via Server Actions ─────────────────────────
  function handleSave() {
    setFormError(null);
    const montoNum = parseFloat(form.monto);
    if (!form.categoria_id)              { setFormError('Selecciona una categoría.');              return; }
    if (!form.descripcion.trim())        { setFormError('La descripción es obligatoria.');        return; }
    if (!form.monto || isNaN(montoNum) || montoNum <= 0) {
      setFormError('El monto debe ser un número mayor que cero.');
      return;
    }

    const payload = {
      fecha:              form.fecha,
      categoria_id:       form.categoria_id,
      descripcion:        form.descripcion,
      monto:              montoNum,
      proveedor:          form.proveedor          || null,
      factura_referencia: form.factura_referencia || null,
      notas:              form.notas              || null,
      registrado_por:     user?.id                || null,
      ...(editItem ? { id: editItem.id } : {}),
    };

    startTransition(async () => {
      const result = editItem ? await updateGasto(payload) : await createGasto(payload);
      if (result.ok) {
        toast.success(result.message);
        closeModal();
        // Sin loadData(): revalidatePath ya disparó el RSC payload actualizado
      } else {
        setFormError(result.message);
        toast.error(result.message);
      }
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
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white/90 font-bold tracking-tight text-2xl flex items-center gap-3">
            <DollarSign className="w-6 h-6 text-red-400" /> Gastos
          </h1>
          <p className="text-white/40 text-sm mt-1">
            Total: {fmt(totalGastos)} — {data.length} registros
          </p>
        </div>
        <button
          onClick={openNew}
          disabled={!canEdit || isPending}
          className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" /> Registrar Gasto
        </button>
      </div>

      {/* Toolbar: Search + Export buttons */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            value={globalFilter}
            onChange={(e) => {
              setGlobalFilter(e.target.value);
              setPagination((p) => ({ ...p, pageIndex: 0 }));
            }}
            placeholder="Buscar por descripción, categoría o proveedor..."
            className="input-field pl-10"
          />
        </div>

        {/* Export buttons */}
        <div className="flex gap-2 shrink-0">
          <button
            onClick={exportToCSV}
            title={`Exportar ${table.getFilteredRowModel().rows.length} registros a CSV`}
            className="btn-secondary !py-2 !px-3 gap-1.5 text-xs"
          >
            <FileDown className="w-3.5 h-3.5" />
            CSV
          </button>
          <button
            onClick={exportToPDF}
            title={`Exportar ${table.getFilteredRowModel().rows.length} registros a PDF`}
            className="btn-secondary !py-2 !px-3 gap-1.5 text-xs"
          >
            <FileText className="w-3.5 h-3.5" />
            PDF
          </button>
        </div>
      </div>

      {/* ── VISTA MÓVIL (Tarjetas TanStack — sorted + filtered) ── */}
      <div className="md:hidden space-y-3">
        {/* Paginación móvil top — solo si hay resultados */}
        {table.getFilteredRowModel().rows.length > 0 && table.getPageCount() > 1 && (
          <div className="flex items-center justify-between py-1">
            <span className="text-xs text-white/35">
              {table.getState().pagination.pageIndex + 1} / {table.getPageCount()} · {table.getFilteredRowModel().rows.length} gastos
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors disabled:opacity-30"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors disabled:opacity-30"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {table.getRowModel().rows.length === 0 ? (
          <EmptyState
            icon={<DollarSign className="w-8 h-8" />}
            title="Sin gastos"
            description={globalFilter ? 'Ningún resultado para esa búsqueda.' : 'Registra el primer gasto operativo.'}
            action={canEdit && !globalFilter ? { label: 'Registrar gasto', onClick: openNew } : undefined}
          />
        ) : (
          table.getRowModel().rows.map((row) => {
            const g = row.original;
            return (
              <div key={g.id} className="card-glass rounded-xl overflow-hidden">
                {/* ── Franja superior: monto + categoría ── */}
                <div className="flex items-center justify-between px-4 pt-4 pb-2">
                  <span className="badge badge-neutral text-[10px]">
                    {g.categorias_gasto?.nombre || '—'}
                  </span>
                  <span className="font-black text-red-400 text-xl leading-none">
                    {fmt(g.monto)}
                  </span>
                </div>

                {/* ── Descripción + fecha ── */}
                <div className="px-4 pb-3">
                  <h3 className="font-semibold text-white/85 text-[15px] leading-snug">
                    {g.descripcion}
                  </h3>
                  <p className="text-xs text-white/35 mt-0.5 font-mono">{g.fecha}</p>
                </div>

                {/* ── Detalles secundarios (si existen) ── */}
                {(g.proveedor || g.factura_referencia || g.notas) && (
                  <div className="px-4 pb-3 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-white/[0.05] pt-2.5">
                    {g.proveedor && (
                      <div>
                        <span className="text-[9px] text-white/30 uppercase tracking-wider font-bold block">Proveedor</span>
                        <span className="text-xs text-white/60 truncate block">{g.proveedor}</span>
                      </div>
                    )}
                    {g.factura_referencia && (
                      <div>
                        <span className="text-[9px] text-white/30 uppercase tracking-wider font-bold block">Factura</span>
                        <span className="text-xs text-white/60 truncate block">{g.factura_referencia}</span>
                      </div>
                    )}
                    {g.notas && (
                      <div className="col-span-2">
                        <span className="text-[9px] text-white/30 uppercase tracking-wider font-bold block">Notas</span>
                        <span className="text-xs text-white/50 line-clamp-2">{g.notas}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Acciones táctiles (≥44px) ── */}
                {canEdit && (
                  <div className="flex border-t border-white/[0.07]">
                    <button
                      onClick={() => openEdit(g)}
                      disabled={isPending}
                      className="flex-1 flex items-center justify-center gap-2 min-h-[48px] text-sm font-medium text-white/50 hover:text-amber-400 hover:bg-white/[0.04] transition-colors disabled:opacity-30"
                      style={{ WebkitTapHighlightColor: 'transparent' }}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Editar
                    </button>
                    <div className="w-px bg-white/[0.07]" />
                    <button
                      onClick={() => handleDelete(g.id)}
                      disabled={isPending}
                      className="flex-1 flex items-center justify-center gap-2 min-h-[48px] text-sm font-medium text-white/50 hover:text-red-400 hover:bg-red-500/[0.06] transition-colors disabled:opacity-30"
                      style={{ WebkitTapHighlightColor: 'transparent' }}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Eliminar
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ── VISTA ESCRITORIO (TanStack Table) ── */}
      <div className="table-container hidden md:block">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent border-b border-white/[0.06]">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} style={{ width: header.getSize() }}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-0">
                  <EmptyState
                    icon={<DollarSign className="w-8 h-8" />}
                    title="Sin resultados"
                    description={globalFilter ? 'Prueba con otro término de búsqueda.' : 'Registra el primer gasto operativo.'}
                    action={canEdit && !globalFilter ? { label: 'Registrar gasto', onClick: openNew } : undefined}
                  />
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* ── Paginación ── */}
        {table.getPageCount() > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
            <span className="text-xs text-white/35">
              Página {table.getState().pagination.pageIndex + 1} de {table.getPageCount()} —{' '}
              {table.getFilteredRowModel().rows.length} registros
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {/* Page numbers (max 5 visible) */}
              {Array.from({ length: Math.min(table.getPageCount(), 5) }).map((_, i) => {
                const page = i + Math.max(0, table.getState().pagination.pageIndex - 2);
                if (page >= table.getPageCount()) return null;
                return (
                  <button
                    key={page}
                    onClick={() => table.setPageIndex(page)}
                    className={`w-7 h-7 text-xs rounded-lg transition-colors ${
                      table.getState().pagination.pageIndex === page
                        ? 'bg-amber-500/25 text-amber-300 border border-amber-400/30'
                        : 'text-white/40 hover:bg-white/[0.06] hover:text-white'
                    }`}
                  >
                    {page + 1}
                  </button>
                );
              })}
              <button
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Modal ── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/70 backdrop-blur-sm"
          onClick={closeModal}
        >
          <div
            className="relative w-full sm:max-w-2xl bg-zinc-950 border border-zinc-800 sm:rounded-2xl rounded-t-2xl shadow-2xl p-6 sm:p-8 max-h-[92dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle — visual cue for bottom sheet */}
            <div className="sm:hidden flex justify-center mb-4 -mt-1">
              <div className="w-8 h-1 rounded-full bg-zinc-700" />
            </div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white/90">
                {editItem ? 'Editar Gasto' : 'Nuevo Gasto'}
              </h2>
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
                  onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                  className="input-field" />
              </div>
              <div>
                <label className="input-label">Categoría *</label>
                <select value={form.categoria_id}
                  onChange={(e) => { setForm({ ...form, categoria_id: e.target.value }); setFormError(null); }}
                  className="input-field">
                  <option value="">Seleccionar...</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="input-label">Descripción *</label>
                <input value={form.descripcion}
                  onChange={(e) => { setForm({ ...form, descripcion: e.target.value }); setFormError(null); }}
                  className="input-field" placeholder="Ej: Compra de combustible" />
              </div>
              <div>
                <label className="input-label">Monto (USD) *</label>
                <input type="number" step="0.01" min="0.01" value={form.monto}
                  onChange={(e) => { setForm({ ...form, monto: e.target.value }); setFormError(null); }}
                  className="input-field" placeholder="0.00" />
              </div>
              <div>
                <label className="input-label">Proveedor</label>
                <input value={form.proveedor}
                  onChange={(e) => setForm({ ...form, proveedor: e.target.value })}
                  className="input-field" />
              </div>
              <div>
                <label className="input-label">Ref. Factura</label>
                <input value={form.factura_referencia}
                  onChange={(e) => setForm({ ...form, factura_referencia: e.target.value })}
                  className="input-field" />
              </div>
              <div>
                <label className="input-label">Notas</label>
                <input value={form.notas}
                  onChange={(e) => setForm({ ...form, notas: e.target.value })}
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

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

import { DollarSign, Plus, Search, X, Loader2, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
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

      {/* Search + filtro global */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
        <input
          value={globalFilter}
          onChange={(e) => {
            setGlobalFilter(e.target.value);
            // Volver a la primera página al filtrar
            setPagination((p) => ({ ...p, pageIndex: 0 }));
          }}
          placeholder="Buscar por descripción, categoría o proveedor..."
          className="input-field pl-10"
        />
      </div>

      {/* ── VISTA MÓVIL (Tarjetas) ── */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
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
              <div key={g.id} className="card-glass p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/45 bg-white/[0.07] px-2 py-0.5 rounded-sm">
                      {g.fecha}
                    </span>
                    <h3 className="font-bold text-white/85 mt-2 text-base leading-tight">{g.descripcion}</h3>
                    <p className="text-sm text-white/55 mt-1">
                      <span className="badge badge-neutral scale-90 origin-left">
                        {g.categorias_gasto?.nombre || '—'}
                      </span>
                    </p>
                  </div>
                  <span className="font-black text-red-400 text-lg">{fmt(g.monto)}</span>
                </div>
                {canEdit && (
                  <div className="flex gap-2 justify-end pt-3 border-t border-white/[0.07]">
                    <button onClick={() => openEdit(g)} disabled={isPending} className="btn-secondary !py-1.5 !px-3 !text-xs">
                      Editar
                    </button>
                    <button onClick={() => handleDelete(g.id)} disabled={isPending} className="btn-danger !py-1.5 !px-3 !text-xs">
                      Borrar
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={closeModal}
        >
          <div
            className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-8 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
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

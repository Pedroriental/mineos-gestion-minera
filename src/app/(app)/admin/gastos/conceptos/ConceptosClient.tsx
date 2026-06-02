'use client';

import { useState, useTransition, useMemo, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
  BookOpen, Plus, Search, X, Loader2, AlertCircle,
  Tag, FileText, ChevronLeft, ChevronRight,
  Receipt, Wallet, Trash2, Edit2, CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import type { GastoConcepto, CategoriaGasto } from '@/lib/types';
import EmptyState from '@/components/EmptyState';
import { useAuth } from '@/lib/auth-context';
import { useCanEdit } from '@/lib/use-can-edit';
import { upsertGastoConcepto, deleteGastoConcepto, getOrCreateCategoria } from '@/lib/actions/gastos';
import { PageFormModal, PageFormModalFooter } from '@/components/ui/PageFormModal';
import { AppSelect } from '@/components/ui/AppSelect';

interface ConceptosClientProps {
  conceptos: GastoConcepto[];
  categorias: CategoriaGasto[];
}

const EMPTY_FORM = {
  descripcion: '',
  categoria_id: '',
  proveedor_sugerido: '',
  notas: '',
  activo: true,
};

const CONCEPTOS_PAGE_MAX = 15;
const CONCEPTOS_ROW_MIN_PX = 44;
const CONCEPTOS_HEAD_FALLBACK_PX = 40;

export default function ConceptosClient({ conceptos, categorias }: ConceptosClientProps) {
  const { user } = useAuth();
  const canEdit = useCanEdit();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<GastoConcepto | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: CONCEPTOS_PAGE_MAX });
  const tableBodyRef = useRef<HTMLDivElement>(null);

  // Filtro de categorías en la barra lateral
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);

  // Estados para creación rápida/inline de nuevas categorías
  const [showNewCatInput, setShowNewCatInput] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [isCreatingCat, setIsCreatingCat] = useState(false);

  const categoryNameMap = useMemo(() => {
    const map = new Map<string, string>();
    categorias.forEach((c) => map.set(c.id, c.nombre));
    return map;
  }, [categorias]);

  // Conteos dinámicos de conceptos por categoría
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    conceptos.forEach((c) => {
      if (c.categoria_default_id) {
        counts.set(c.categoria_default_id, (counts.get(c.categoria_default_id) || 0) + 1);
      }
    });
    return counts;
  }, [conceptos]);

  // Filtrado reactivo en el cliente
  const filteredData = useMemo(() => {
    let result = conceptos;

    if (selectedCategoryFilter) {
      result = result.filter((c) => c.categoria_default_id === selectedCategoryFilter);
    }

    const q = globalFilter.toLowerCase().trim();
    if (!q) return result;
    return result.filter((c) => {
      const catName = c.categorias_gasto?.nombre || categoryNameMap.get(c.categoria_default_id || '') || '';
      return (
        c.descripcion.toLowerCase().includes(q) ||
        catName.toLowerCase().includes(q) ||
        (c.proveedor_sugerido || '').toLowerCase().includes(q) ||
        (c.notas || '').toLowerCase().includes(q)
      );
    });
  }, [conceptos, globalFilter, selectedCategoryFilter, categoryNameMap]);

  // Definición de columnas para TanStack Table
  const columns = useMemo(
    () => [
      {
        accessorKey: 'descripcion',
        header: 'Concepto / Descripción',
        cell: ({ row }: any) => (
          <div className="font-semibold text-white truncate max-w-[18rem]" title={row.original.descripcion}>
            {row.original.descripcion}
          </div>
        ),
      },
      {
        accessorKey: 'categoria',
        header: 'Categoría Asignada',
        cell: ({ row }: any) => {
          const catName = row.original.categorias_gasto?.nombre || categoryNameMap.get(row.original.categoria_default_id || '') || 'Sin categoría';
          return (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/5 bg-white/[0.03] px-2 py-0.5 text-[10px] text-zinc-300">
              <Tag className="h-3 w-3 text-zinc-500" />
              {catName}
            </span>
          );
        },
      },

      {
        accessorKey: 'proveedor_sugerido',
        header: 'Proveedor',
        cell: ({ row }: any) => row.original.proveedor_sugerido || <span className="text-zinc-600">—</span>,
      },
      {
        accessorKey: 'estado',
        header: 'Estatus',
        cell: ({ row }: any) => (
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
              row.original.activo
                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                : 'bg-zinc-800 border border-zinc-700 text-zinc-500'
            }`}
          >
            {row.original.activo ? 'Activo' : 'Inactivo'}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        meta: { align: 'right' as const },
        cell: ({ row }: any) => {
          if (!canEdit) return null;
          return (
            <div className="flex justify-end gap-1.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openEdit(row.original);
                }}
                disabled={isPending}
                className="rounded-lg p-1 text-zinc-400 hover:bg-white/[0.06] hover:text-white"
                title="Editar concepto"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(row.original.id);
                }}
                disabled={isPending}
                className="rounded-lg p-1 text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
                title="Eliminar concepto"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        },
      },
    ],
    [canEdit, isPending, categoryNameMap],
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const syncTableLayout = useCallback(() => {
    const el = tableBodyRef.current;
    if (!el) return;

    const thead = el.querySelector('thead');
    const headH = thead?.getBoundingClientRect().height ?? CONCEPTOS_HEAD_FALLBACK_PX;
    const bodyAvailable = Math.max(0, el.clientHeight - headH);

    const pageRows = Math.min(
      CONCEPTOS_PAGE_MAX,
      Math.max(1, Math.floor(bodyAvailable / CONCEPTOS_ROW_MIN_PX)),
    );
    setPagination((prev) => (prev.pageSize === pageRows ? prev : { ...prev, pageSize: pageRows }));
  }, []);

  const GASTOS_PAGE_BUTTONS_MAX = 5;
  const pageCount = table.getPageCount();
  const pageIndex = table.getState().pagination.pageIndex;
  const pageWindowStart =
    Math.floor(pageIndex / GASTOS_PAGE_BUTTONS_MAX) * GASTOS_PAGE_BUTTONS_MAX;
  const pageNumbers = useMemo(
    () =>
      Array.from(
        { length: Math.min(GASTOS_PAGE_BUTTONS_MAX, Math.max(0, pageCount - pageWindowStart)) },
        (_, i) => pageWindowStart + i,
      ),
    [pageCount, pageWindowStart],
  );

  useEffect(() => {
    const el = tableBodyRef.current;
    if (!el) return;
    const run = () => syncTableLayout();
    run();
    const ro = new ResizeObserver(run);
    ro.observe(el);
    return () => ro.disconnect();
  }, [syncTableLayout]);

  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [globalFilter]);

  // KPIs
  const kpiTotal = conceptos.length;
  const kpiActivos = conceptos.filter((c) => c.activo).length;
  const kpiInactivos = kpiTotal - kpiActivos;

  // Modal helpers
  function resetForm() {
    setForm(EMPTY_FORM);
    setEditItem(null);
    setFormError(null);
    setShowNewCatInput(false);
    setNewCatName('');
  }
  function openNew() {
    resetForm();
    setShowModal(true);
  }
  function openEdit(item: GastoConcepto) {
    setEditItem(item);
    setForm({
      descripcion: item.descripcion,
      categoria_id: item.categoria_default_id || '',
      proveedor_sugerido: item.proveedor_sugerido || '',
      notas: item.notas || '',
      activo: item.activo,
    });
    setShowModal(true);
  }
  function closeModal() {
    setShowModal(false);
    resetForm();
  }

  // Crear categoría inline/rápida en formulario
  const handleCreateCategory = async () => {
    const cleanName = newCatName.trim();
    if (!cleanName) {
      toast.error('El nombre de la categoría no puede estar vacío.');
      return;
    }
    setIsCreatingCat(true);
    try {
      const res = await getOrCreateCategoria(cleanName);
      if (res.ok) {
        toast.success('Categoría registrada correctamente.');
        setForm((prev) => ({ ...prev, categoria_id: res.id }));
        setNewCatName('');
        setShowNewCatInput(false);
        router.refresh();
      } else {
        toast.error(res.message || 'Error al registrar categoría.');
      }
    } catch (err) {
      toast.error('Error de red al crear categoría.');
    } finally {
      setIsCreatingCat(false);
    }
  };

  // Mutaciones
  function handleSave() {
    setFormError(null);
    if (!form.descripcion.trim() || form.descripcion.trim().length < 3) {
      setFormError('La descripción debe tener al menos 3 caracteres.');
      return;
    }
    if (!form.categoria_id) {
      setFormError('Selecciona una categoría predeterminada.');
      return;
    }

    startTransition(async () => {
      const payload = {
        descripcion: form.descripcion,
        categoria_default_id: form.categoria_id,
        proveedor_sugerido: form.proveedor_sugerido || null,
        monto_sugerido: null,
        notas: form.notas || null,
        activo: form.activo,
        ...(editItem ? { id: editItem.id } : {}),
      };

      const result = await upsertGastoConcepto(payload);
      if (result.ok) {
        toast.success(result.message);
        closeModal();
      } else {
        setFormError(result.message);
        toast.error(result.message);
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm('¿Eliminar este concepto del catálogo? Esta acción no afectará tus gastos registrados.')) return;
    startTransition(async () => {
      const result = await deleteGastoConcepto(id);
      if (result.ok) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="gastos-page flex min-h-0 w-full flex-1 flex-col overflow-hidden">
      <div className="gastos-page__grid min-h-0 flex-1">
        
        {/* PANEL IZQUIERDO — KPIs */}
        <aside className="gastos-page__summary flex h-full min-h-0 flex-col gap-2">
          <div className="grid shrink-0 grid-cols-1 gap-2">
            <div className="app-surface-card gastos-kpi-card gastos-kpi-card--total relative overflow-hidden p-3">
              <div className="gastos-kpi-glow gastos-kpi-glow--total" aria-hidden />
              <p className="relative mb-0.5 text-[9px] font-bold uppercase tracking-widest text-[var(--dashboard-text-muted)]">Conceptos Totales</p>
              <p className="gastos-kpi-value gastos-kpi-value--total relative text-2xl font-black leading-none">{kpiTotal}</p>
              <p className="relative mt-0.5 text-[11px] text-[var(--dashboard-text-muted)]">plantillas registradas</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="app-surface-card gastos-kpi-card gastos-kpi-card--accent relative overflow-hidden p-2.5">
                <div className="gastos-kpi-glow gastos-kpi-glow--accent" aria-hidden />
                <p className="relative mb-0.5 text-[9px] font-bold uppercase tracking-widest text-[var(--dashboard-text-muted)]">Activos</p>
                <p className="gastos-kpi-value gastos-kpi-value--accent relative text-lg font-black leading-none text-emerald-400">{kpiActivos}</p>
                <p className="relative mt-0.5 text-[9px] text-[var(--dashboard-text-muted)]">disponibles</p>
              </div>

              <div className="app-surface-card gastos-kpi-card gastos-kpi-card--neutral relative overflow-hidden p-2.5">
                <div className="gastos-kpi-glow gastos-kpi-glow--neutral" aria-hidden />
                <p className="relative mb-0.5 text-[9px] font-bold uppercase tracking-widest text-[var(--dashboard-text-muted)]">Inactivos</p>
                <p className="gastos-kpi-value gastos-kpi-value--neutral relative text-lg font-black leading-none text-zinc-500">{kpiInactivos}</p>
                <p className="relative mt-0.5 text-[9px] text-[var(--dashboard-text-muted)]">pausados</p>
              </div>
            </div>
          </div>

          {/* Tarjeta 1: Guía de Catálogo (Más pequeña y compacta) */}
          <div className="app-surface-card flex shrink-0 flex-col p-3.5 leading-relaxed text-zinc-400 text-[11px]">
            <div className="mb-2 flex shrink-0 items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5 text-amber-500" aria-hidden />
              <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--dashboard-text-muted)]">
                Guía del Catálogo
              </span>
            </div>
            <div className="space-y-1.5">
              <p>
                Este catálogo actúa como un diccionario de plantillas para autocompletar tus gastos.
              </p>
              <p>
                Al registrar un concepto, el formulario completará predictivamente su categoría y proveedor al escribir.
              </p>
            </div>
          </div>

          {/* Tarjeta 2: Filtrar por Categoría */}
          <div className="app-surface-card flex min-h-0 flex-1 flex-col p-4">
            <div className="mb-2.5 flex shrink-0 items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-red-400" aria-hidden />
                <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--dashboard-text-muted)]">
                  Filtrar por Categoría
                </span>
              </div>
              {selectedCategoryFilter && (
                <button
                  type="button"
                  onClick={() => setSelectedCategoryFilter(null)}
                  className="text-[10px] text-zinc-500 hover:text-white transition-colors animate-fade-in"
                >
                  Limpiar
                </button>
              )}
            </div>

            <div className="space-y-1 overflow-y-auto min-h-0 flex-1 pr-1 custom-scrollbar">
              <button
                type="button"
                onClick={() => setSelectedCategoryFilter(null)}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition-all ${
                  selectedCategoryFilter === null
                    ? 'bg-red-500/10 text-red-400 font-semibold font-bold'
                    : 'text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-200'
                }`}
              >
                <span>Todas las categorías</span>
                <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold shrink-0 ${
                  selectedCategoryFilter === null ? 'bg-red-500/20 text-red-400' : 'bg-zinc-800 text-zinc-500'
                }`}>
                  {conceptos.length}
                </span>
              </button>

              {categorias.map((cat) => {
                const count = categoryCounts.get(cat.id) || 0;
                const isSelected = selectedCategoryFilter === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategoryFilter(cat.id)}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition-all ${
                      isSelected
                        ? 'bg-red-500/10 text-red-400 font-semibold font-bold'
                        : 'text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-200'
                    }`}
                  >
                    <span className="truncate mr-2">{cat.nombre}</span>
                    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold shrink-0 ${
                      isSelected ? 'bg-red-500/20 text-red-400' : 'bg-zinc-800 text-zinc-500'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* PANEL DERECHO — Tabla */}
        <div className="gastos-page__table app-surface-card relative flex min-h-0 flex-col overflow-hidden">
          
          <div className="gastos-page__toolbar flex shrink-0 items-center gap-2 px-3 py-1.5">
            <div className="gastos-search-wrap flex h-8 min-w-0 flex-1 items-center gap-2.5 rounded-lg pl-3 pr-2">
              <Search className="gastos-icon-muted h-3.5 w-3.5 shrink-0" aria-hidden />
              <input
                type="text"
                placeholder="Buscar conceptos en el catálogo por descripción, categoría, proveedor..."
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="min-w-0 w-full border-none bg-transparent text-xs outline-none"
              />
              {globalFilter ? (
                <button
                  type="button"
                  onClick={() => setGlobalFilter('')}
                  className="gastos-page-btn ml-1 shrink-0"
                  aria-label="Limpiar búsqueda"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>

            {canEdit && (
              <button
                type="button"
                onClick={openNew}
                disabled={isPending}
                className="app-btn-primary h-8 shrink-0 px-4 text-xs"
              >
                <Plus className="h-3.5 w-3.5" /> Registrar Concepto
              </button>
            )}
          </div>

          <div ref={tableBodyRef} className="gastos-page__table-body relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
            <table className="gastos-table w-full border-collapse">
              <colgroup>
                <col />
                <col style={{ width: '13rem' }} />
                <col style={{ width: '12rem' }} />
                <col style={{ width: '5rem' }} />
                <col style={{ width: '4.5rem' }} />
              </colgroup>
              <thead className="gastos-thead">
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id}>
                    {hg.headers.map((header) => {
                      const align =
                        (header.column.columnDef.meta as { align?: 'left' | 'right' | 'center' } | undefined)
                          ?.align ?? 'left';
                      return (
                        <th
                          key={header.id}
                          className={`gastos-th max-w-0 overflow-hidden px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                            align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
                          }`}
                        >
                          <span className="block truncate">
                            {flexRender(header.column.columnDef.header, header.getContext())}
                          </span>
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="py-8 text-center">
                      <EmptyState
                        icon={<Receipt className="h-6 w-6" />}
                        title="Catálogo vacío"
                        description={
                          globalFilter
                            ? 'Ningún concepto coincide con tu búsqueda.'
                            : 'Agrega tu primer concepto de gasto operativo al catálogo.'
                        }
                        action={canEdit && !globalFilter ? { label: 'Agregar concepto', onClick: openNew } : undefined}
                      />
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      className="gastos-table__row gastos-tr"
                    >
                      {row.getVisibleCells().map((cell) => {
                        const align =
                          (cell.column.columnDef.meta as { align?: 'left' | 'right' | 'center' } | undefined)
                            ?.align ?? 'left';
                        return (
                          <td
                            key={cell.id}
                            className={`gastos-table__cell gastos-td max-w-0 overflow-hidden px-2.5 py-2.5 text-[11px] ${
                              align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
                            }`}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="gastos-page__table-footer gastos-footer-bar flex shrink-0 items-center justify-between px-3 py-1.5">
            <div className="flex min-w-0 items-center gap-2">
              <span className="gastos-footer-label text-[9px] uppercase tracking-wider">Conceptos visibles</span>
              <span className="font-bold text-xs text-white">
                {table.getFilteredRowModel().rows.length}
              </span>
            </div>
            {table.getFilteredRowModel().rows.length > 0 && pageCount > 0 && (
              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  className="gastos-page-btn rounded p-1 transition-colors disabled:opacity-30"
                  aria-label="Página anterior"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                {pageNumbers.map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => table.setPageIndex(page)}
                    aria-label={`Página ${page + 1}`}
                    aria-current={page === pageIndex ? 'page' : undefined}
                    className={`gastos-page-btn min-w-[1.35rem] rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums transition-colors ${
                      page === pageIndex ? 'gastos-page-btn--active' : ''
                    }`}
                  >
                    {page + 1}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  className="gastos-page-btn rounded p-1 transition-colors disabled:opacity-30"
                  aria-label="Página siguiente"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

      </div>

      <PageFormModal open={showModal} onClose={closeModal}>
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10">
              <Wallet className="h-4 w-4 text-red-400" />
            </div>
            <h2 className="text-lg font-semibold text-white/90">
              {editItem ? 'Editar Concepto' : 'Nuevo Concepto'}
            </h2>
          </div>
          <button
            type="button"
            onClick={closeModal}
            className="rounded-lg p-1.5 text-white/40 hover:bg-white/[0.06]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {formError && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            <span className="text-sm text-red-400">{formError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="input-label">Descripción / Nombre del Concepto *</label>
            <input
              value={form.descripcion}
              onChange={(e) => {
                setForm({ ...form, descripcion: e.target.value });
                setFormError(null);
              }}
              className="input-field"
              placeholder="Ej: Compra de Gasoil / Diesel"
            />
          </div>
          <div className="md:col-span-2">
            <div className="flex items-center justify-between">
              <label className="input-label">Categoría Sugerida *</label>
              {!showNewCatInput && canEdit && (
                <button
                  type="button"
                  onClick={() => {
                    setShowNewCatInput(true);
                    setNewCatName('');
                  }}
                  className="text-[11px] font-bold text-amber-500 hover:text-amber-400 flex items-center gap-0.5 transition-colors"
                >
                  <Plus className="h-3 w-3" /> + Nueva Categoría
                </button>
              )}
            </div>

            {showNewCatInput ? (
              <div className="flex gap-2 mt-1">
                <input
                  value={newCatName}
                  onChange={(e) => {
                    setNewCatName(e.target.value);
                    setFormError(null);
                  }}
                  className="input-field flex-1"
                  placeholder="Nombre de la nueva categoría..."
                  disabled={isCreatingCat}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleCreateCategory}
                  disabled={isCreatingCat}
                  className="app-btn-primary h-[38px] px-3 text-xs shrink-0 flex items-center gap-1"
                >
                  {isCreatingCat ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Guardar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowNewCatInput(false);
                    setNewCatName('');
                  }}
                  disabled={isCreatingCat}
                  className="btn-secondary h-[38px] px-3 text-xs shrink-0"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <AppSelect
                value={form.categoria_id}
                onChange={(val) => {
                  setForm({ ...form, categoria_id: val });
                  setFormError(null);
                }}
                options={[
                  { value: '', label: 'Selecciona la categoría...' },
                  ...categorias.map((c) => ({ value: c.id, label: c.nombre })),
                ]}
              />
            )}
          </div>
          <div>
            <label className="input-label">Proveedor Sugerido (Opcional)</label>
            <input
              value={form.proveedor_sugerido}
              onChange={(e) => setForm({ ...form, proveedor_sugerido: e.target.value })}
              className="input-field"
              placeholder="Ej: Gasolinera El Faro"
            />
          </div>
          <div>
            <label className="input-label">Estatus</label>
            <div className="mt-2.5 flex items-center gap-2">
              <input
                type="checkbox"
                id="form-activo"
                checked={form.activo}
                onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                className="h-4 w-4 rounded border-zinc-800 bg-zinc-950 text-amber-500 focus:ring-amber-500/50"
              />
              <label htmlFor="form-activo" className="text-xs text-white/70 select-none cursor-pointer">
                Concepto activo y visible para autocompletar
              </label>
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="input-label">Notas o Recomendaciones</label>
            <input
              value={form.notas}
              onChange={(e) => setForm({ ...form, notas: e.target.value })}
              className="input-field"
              placeholder="Ej: Revisar nivel de combustible antes de despachar"
            />
          </div>
        </div>

        <PageFormModalFooter>
          <button type="button" onClick={closeModal} disabled={isPending} className="btn-secondary">
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="btn-primary min-w-[110px] justify-center"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Guardando...
              </>
            ) : editItem ? (
              'Actualizar'
            ) : (
              'Guardar'
            )}
          </button>
        </PageFormModalFooter>
      </PageFormModal>
    </div>
  );
}

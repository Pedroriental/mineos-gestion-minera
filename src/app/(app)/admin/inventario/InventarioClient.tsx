'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
} from '@tanstack/react-table';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useCanEdit } from '@/lib/use-can-edit';
import {
  Plus, Search, X, Loader2, Edit2, Trash2, ArrowUpCircle, Package,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import EmptyState from '@/components/EmptyState';
import { PageFormModal, PageFormModalFooter } from '@/components/ui/PageFormModal';
import { AppSelect } from '@/components/ui/AppSelect';
import type { InventarioItem, InventarioMovimiento } from '@/lib/types';
import { getInventarioColumns, inventarioGlobalFilter } from './columns';
import {
  codigoDisplay,
  CODIGO_SIN_DATOS,
  codigoForSave,
  digitsOnlyCodigo,
  needsCodigoReset,
} from './codigo';
import { useBibliotecaLabelsMap, useBibliotecaOptions } from '@/contexts/biblioteca-context';
import {
  buildDestinoLabelsFromOptions,
  destinoLabel,
  getValidDestinos,
  needsUbicacionReset,
  normalizeDestino,
} from './destino';
import { useConfirm } from '@/components/ui/ConfirmDialogProvider';

const INVENTARIO_PAGE_MAX = 50;
const INVENTARIO_PAGE_BUTTONS_MAX = 5;
const INVENTARIO_ROW_MIN_PX = 44;
const INVENTARIO_HEAD_FALLBACK_PX = 40;
const INVENTARIO_MOBILE_CARD_MIN_PX = 132;

const EMPTY_MOV_FORM = {
  item_id: '',
  tipo_movimiento: 'entrada' as InventarioMovimiento['tipo_movimiento'],
  cantidad: '',
  costo_unitario: '',
  referencia: '',
  destino_area: '' as string,
  observaciones: '',
};

const fmtUsd = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n) || 0);

const EMPTY_ITEM_FORM = {
  codigo: '',
  nombre: '',
  categoria: 'herramientas' as InventarioItem['categoria'],
  unidad_medida: '',
  stock_minimo: '',
  stock_actual: '',
  costo_unitario_promedio: '',
  destino: '',
};

export default function InventarioClient() {
  const { user } = useAuth();
  const canEdit = useCanEdit();
  const categoriaOptions = useBibliotecaOptions('inventario_categoria');
  const movimientoOptions = useBibliotecaOptions('inventario_movimiento');
  const destinoSelectOptions = useBibliotecaOptions('inventario_destino');
  const catLabelsMap = useBibliotecaLabelsMap('inventario_categoria');
  const destinoLabels = useMemo(
    () => buildDestinoLabelsFromOptions(destinoSelectOptions),
    [destinoSelectOptions],
  );
  const validDestinos = useMemo(() => getValidDestinos(destinoLabels), [destinoLabels]);
  const labelDestino = useCallback(
    (value?: string | null) => destinoLabel(value, destinoLabels),
    [destinoLabels],
  );
  const [items, setItems] = useState<InventarioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalFilter, setGlobalFilter] = useState('');
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: INVENTARIO_PAGE_MAX });
  const tableAreaRef = useRef<HTMLDivElement>(null);
  const [showItemModal, setShowItemModal] = useState(false);
  const [showMovModal, setShowMovModal] = useState(false);
  const [editItem, setEditItem] = useState<InventarioItem | null>(null);
  const [saving, setSaving] = useState(false);
  const confirmDialog = useConfirm();

  const [itemForm, setItemForm] = useState(EMPTY_ITEM_FORM);
  const [movForm, setMovForm] = useState(EMPTY_MOV_FORM);

  const loadData = useCallback(async () => {
    const { data } = await supabase.from('inventario_items').select('*').eq('activo', true).order('nombre');
    let list = data || [];

    const staleUbicacionIds = list
      .filter((i) => needsUbicacionReset(i.ubicacion, validDestinos))
      .map((i) => i.id);
    const staleCodigoIds = list.filter((i) => needsCodigoReset(i.codigo)).map((i) => i.id);
    const staleIds = [...new Set([...staleUbicacionIds, ...staleCodigoIds])];
    if (staleIds.length > 0) {
      if (staleUbicacionIds.length > 0) {
        await supabase.from('inventario_items').update({ ubicacion: null }).in('id', staleUbicacionIds);
      }
      if (staleCodigoIds.length > 0) {
        await supabase.from('inventario_items').update({ codigo: '' }).in('id', staleCodigoIds);
      }
      const { data: refreshed } = await supabase
        .from('inventario_items')
        .select('*')
        .eq('activo', true)
        .order('nombre');
      list = refreshed || [];
    }

    setItems(list);
    setLoading(false);
    return list;
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveItem = async () => {
    setSaving(true);
    const payload = {
      codigo: codigoForSave(itemForm.codigo),
      nombre: itemForm.nombre,
      categoria: itemForm.categoria,
      unidad_medida: itemForm.unidad_medida,
      stock_minimo: parseFloat(itemForm.stock_minimo) || 0,
      stock_actual: parseFloat(itemForm.stock_actual) || 0,
      costo_unitario_promedio: parseFloat(itemForm.costo_unitario_promedio) || 0,
      ubicacion: itemForm.destino || null,
    };
    let savedId = editItem?.id;
    if (editItem) {
      await supabase.from('inventario_items').update(payload).eq('id', editItem.id);
    } else {
      const { data: created } = await supabase
        .from('inventario_items')
        .insert(payload)
        .select('id')
        .single();
      savedId = created?.id;
    }
    const list = await loadData();
    const idx = savedId ? list.findIndex((i) => i.id === savedId) : -1;
    if (idx >= 0) {
      setPagination((p) => ({
        ...p,
        pageIndex: Math.floor(idx / Math.max(1, p.pageSize)),
      }));
    } else if (!editItem && list.length > 0) {
      setPagination((p) => ({
        ...p,
        pageIndex: Math.max(0, Math.ceil(list.length / Math.max(1, p.pageSize)) - 1),
      }));
    }
    setSaving(false);
    setShowItemModal(false);
    setEditItem(null);
  };

  const selectedMovItem = useMemo(
    () => items.find((i) => i.id === movForm.item_id) ?? null,
    [items, movForm.item_id],
  );
  const movFieldsEnabled = Boolean(movForm.item_id);

  const openMovModal = useCallback(() => {
    setMovForm(EMPTY_MOV_FORM);
    setShowMovModal(true);
  }, []);

  const closeMovModal = useCallback(() => {
    setShowMovModal(false);
    setMovForm(EMPTY_MOV_FORM);
  }, []);

  const handleMovItemSelect = useCallback(
    (itemId: string) => {
      if (!itemId) {
        setMovForm(EMPTY_MOV_FORM);
        return;
      }
      const item = items.find((i) => i.id === itemId);
      if (!item) return;
      setMovForm({
        item_id: item.id,
        tipo_movimiento: 'entrada',
        cantidad: '',
        costo_unitario:
          item.costo_unitario_promedio > 0 ? String(item.costo_unitario_promedio) : '',
        referencia: '',
        destino_area: normalizeDestino(item.ubicacion, validDestinos),
        observaciones: '',
      });
    },
    [items],
  );

  const handleSaveMov = async () => {
    if (!movForm.item_id || !selectedMovItem) return;
    const qty = parseFloat(movForm.cantidad);
    if (Number.isNaN(qty) || movForm.cantidad.trim() === '') return;
    if (movForm.tipo_movimiento !== 'ajuste' && qty <= 0) return;
    if (movForm.tipo_movimiento === 'ajuste' && qty < 0) return;
    if (movForm.tipo_movimiento === 'salida' && qty > selectedMovItem.stock_actual) {
      window.alert('La salida no puede superar el stock actual del item.');
      return;
    }

    setSaving(true);
    const cost = parseFloat(movForm.costo_unitario) || 0;
    await supabase.from('inventario_movimientos').insert({
      item_id: movForm.item_id,
      tipo_movimiento: movForm.tipo_movimiento,
      cantidad: qty,
      costo_unitario: cost,
      costo_total: qty * cost,
      referencia: movForm.referencia || null,
      destino_area: movForm.destino_area || null,
      observaciones: movForm.observaciones || null,
      registrado_por: user?.id,
    });
    setSaving(false);
    closeMovModal();
    loadData();
  };

  const openEditItem = (item: InventarioItem) => {
    setEditItem(item);
    setItemForm({
      codigo: digitsOnlyCodigo(item.codigo || ''),
      nombre: item.nombre,
      categoria: item.categoria,
      unidad_medida: item.unidad_medida,
      stock_minimo: String(item.stock_minimo),
      stock_actual: String(item.stock_actual),
      costo_unitario_promedio: String(item.costo_unitario_promedio),
      destino: normalizeDestino(item.ubicacion, validDestinos),
    });
    setShowItemModal(true);
  };

  const handleDeleteItem = useCallback(async (item: InventarioItem) => {
    if (!(await confirmDialog({
      title: 'Eliminar item',
      message: `¿Eliminar el item "${item.nombre}"? Se desactivará y dejará de aparecer en el inventario.`,
      variant: 'danger'
    }))) return;
    await supabase.from('inventario_items').update({ activo: false }).eq('id', item.id);
    loadData();
  }, [loadData, confirmDialog]);

  const columns = useMemo(
    () =>
      getInventarioColumns({
        onEdit: openEditItem,
        onDelete: handleDeleteItem,
        canEdit,
        catLabels: catLabelsMap,
        destinoLabel: labelDestino,
      }),
    [canEdit, handleDeleteItem],
  );

  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: inventarioGlobalFilter(catLabelsMap, labelDestino),
    state: { globalFilter, pagination },
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
  });

  const syncTableLayout = useCallback(() => {
    const el = tableAreaRef.current;
    if (!el) return;

    const available = el.clientHeight;
    const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches;

    let pageRows: number;
    if (isDesktop) {
      const thead = el.querySelector('thead');
      const headH = thead?.getBoundingClientRect().height ?? INVENTARIO_HEAD_FALLBACK_PX;
      const bodyAvailable = Math.max(0, available - headH);
      pageRows = Math.max(1, Math.floor(bodyAvailable / INVENTARIO_ROW_MIN_PX));
    } else {
      pageRows = Math.max(1, Math.floor(available / INVENTARIO_MOBILE_CARD_MIN_PX));
    }

    pageRows = Math.min(INVENTARIO_PAGE_MAX, pageRows);
    setPagination((prev) => (prev.pageSize === pageRows ? prev : { ...prev, pageSize: pageRows }));
  }, []);

  useEffect(() => {
    const el = tableAreaRef.current;
    if (!el) return;
    const run = () => syncTableLayout();
    run();
    const ro = new ResizeObserver(run);
    ro.observe(el);
    const mq = window.matchMedia('(min-width: 768px)');
    mq.addEventListener('change', run);
    return () => {
      ro.disconnect();
      mq.removeEventListener('change', run);
    };
  }, [syncTableLayout, loading]);

  useEffect(() => {
    setPagination((prev) => (prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }));
  }, [globalFilter]);

  const filteredCount = table.getFilteredRowModel().rows.length;
  const pageRows = table.getPaginationRowModel().rows;
  const emptyRowSlots = Math.max(0, pagination.pageSize - pageRows.length);
  const pageCount = table.getPageCount();
  const displayPageCount = Math.max(1, pageCount);
  const pageIndex = Math.min(pagination.pageIndex, displayPageCount - 1);
  const activePageIndex = filteredCount === 0 ? 0 : pageIndex;
  const pageWindowStart =
    Math.floor(pageIndex / INVENTARIO_PAGE_BUTTONS_MAX) * INVENTARIO_PAGE_BUTTONS_MAX;
  const pageNumbers = useMemo(() => {
    const len = Math.min(INVENTARIO_PAGE_BUTTONS_MAX, Math.max(0, displayPageCount - pageWindowStart));
    if (len === 0) return [0];
    return Array.from({ length: len }, (_, i) => pageWindowStart + i);
  }, [displayPageCount, pageWindowStart]);

  useEffect(() => {
    const maxIndex = Math.max(0, displayPageCount - 1);
    if (pagination.pageIndex > maxIndex) {
      setPagination((p) => ({ ...p, pageIndex: maxIndex }));
    }
  }, [displayPageCount, pagination.pageIndex]);

  return (
    <div className="inventario-page flex min-h-0 w-full flex-1 flex-col gap-4 overflow-hidden">
      <div className="inventario-page__toolbar flex shrink-0 items-center gap-2">
        <div className="gastos-search-wrap flex h-8 min-w-0 flex-1 items-center gap-2 rounded-lg px-3">
          <Search className="gastos-icon-muted h-4 w-4 shrink-0" aria-hidden />
          <input
            type="text"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Buscar por código, nombre o categoría..."
            className="min-w-0 flex-1 border-none bg-transparent text-sm outline-none"
          />
          {globalFilter ? (
            <button
              type="button"
              onClick={() => setGlobalFilter('')}
              className="gastos-page-btn shrink-0 rounded p-0.5"
              aria-label="Limpiar búsqueda"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={openMovModal}
          disabled={!canEdit}
          className="btn-secondary inline-flex h-8 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap px-3 text-xs disabled:cursor-not-allowed disabled:opacity-40"
          title={!canEdit ? 'Modo observador: solo lectura' : undefined}
        >
          <ArrowUpCircle className="h-3.5 w-3.5" /> Registrar Movimiento
        </button>
        <button
          type="button"
          onClick={() => {
            setEditItem(null);
            setItemForm(EMPTY_ITEM_FORM);
            setShowItemModal(true);
          }}
          disabled={!canEdit}
          className="app-btn-primary inline-flex h-8 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap px-3 text-xs disabled:cursor-not-allowed disabled:opacity-40"
          title={!canEdit ? 'Modo observador: solo lectura' : undefined}
        >
          <Plus className="h-3.5 w-3.5" /> Nuevo Item
        </button>
      </div>

      <div className="app-surface-card relative flex min-h-0 flex-1 flex-col overflow-hidden">
        {loading ? (
          <div className="flex flex-1 items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--dashboard-accent)]" />
          </div>
        ) : (
          <>
            <div ref={tableAreaRef} className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="block min-h-0 flex-1 overflow-hidden p-3 md:hidden">
              {filteredCount === 0 ? (
                <EmptyState icon={<Package className="h-6 w-6" />} title="Sin items en inventario" />
              ) : (
                <div className="space-y-3">
                  {pageRows.map((row) => {
                    const item = row.original;
                    const low = item.stock_actual <= item.stock_minimo;
                    return (
                      <div
                        key={row.id}
                        className="rounded-xl border border-[var(--gastos-border)] bg-[var(--gastos-input-bg)] p-4"
                      >
                        <div className="mb-3 flex items-start justify-between">
                          <div>
                            <span
                              className={`rounded-sm border px-2 py-0.5 text-[10px] font-bold tracking-wider ${
                                codigoDisplay(item.codigo) === CODIGO_SIN_DATOS
                                  ? 'border-[var(--gastos-pill-border)] bg-[var(--gastos-pill-bg)] text-[var(--gastos-subtle)]'
                                  : 'border-[var(--dashboard-accent-soft)] bg-[var(--dashboard-accent-soft)] font-mono text-[var(--dashboard-accent)]'
                              }`}
                            >
                              {codigoDisplay(item.codigo)}
                            </span>
                            <h3 className="mt-2 text-base font-bold leading-tight text-[var(--gastos-body)]">
                              {item.nombre}
                            </h3>
                            <p className="mt-1 text-sm text-[var(--gastos-subtle)]">
                              {catLabelsMap[item.categoria] || '—'}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <span
                              className={`block text-lg font-black leading-none tabular-nums ${
                                low ? 'text-[var(--dashboard-danger)]' : 'text-[var(--gastos-body)]'
                              }`}
                            >
                              {item.stock_actual}
                            </span>
                            <span className="text-[10px] uppercase tracking-wide text-[var(--gastos-subtle)]">
                              Unidades
                            </span>
                            <span className="mt-0.5 block text-[9px] text-[var(--gastos-label)]">
                              Ud. medida: {item.unidad_medida || '—'}
                            </span>
                          </div>
                        </div>
                        <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg border border-[var(--gastos-border)] bg-[var(--gastos-pill-bg)] p-2.5 text-xs">
                          <div>
                            <span className="mb-0.5 block text-[var(--gastos-label)]">Stock actual</span>
                            <span
                              className={`font-semibold tabular-nums ${
                                low ? 'text-[var(--dashboard-danger)]' : 'font-medium text-[var(--gastos-body)]'
                              }`}
                            >
                              {item.stock_actual}
                            </span>
                          </div>
                          <div>
                            <span className="mb-0.5 block text-[var(--gastos-label)]">Stock mínimo</span>
                            <span className="font-medium tabular-nums text-[var(--gastos-body)]">{item.stock_minimo}</span>
                          </div>
                          <div className="col-span-2">
                            <span className="mb-0.5 block text-[var(--gastos-label)]">Ubicación</span>
                            <span
                              className={`gastos-cat-pill inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                normalizeDestino(item.ubicacion, validDestinos) ? '' : 'opacity-80'
                              }`}
                            >
                              {labelDestino(item.ubicacion)}
                            </span>
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 border-t border-[var(--gastos-border)] pt-3">
                          <button
                            type="button"
                            onClick={() => openEditItem(item)}
                            disabled={!canEdit}
                            className="btn-secondary !px-3 !py-1.5 !text-xs disabled:opacity-40"
                          >
                            <Edit2 className="h-3.5 w-3.5" /> Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item)}
                            disabled={!canEdit}
                            className="btn-secondary !px-3 !py-1.5 !text-xs text-[var(--dashboard-danger)] disabled:opacity-40"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Eliminar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="gastos-page__table-body hidden min-h-0 flex-1 flex-col overflow-hidden md:flex">
              <table className="gastos-table w-full table-fixed border-collapse">
                <colgroup>
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '10.5%' }} />
                  <col style={{ width: '13%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '8.5%' }} />
                  <col style={{ width: '8.5%' }} />
                  <col style={{ width: '9.5%' }} />
                  <col style={{ width: '4.75rem' }} />
                </colgroup>
                <thead className="gastos-thead sticky top-0 z-[1]">
                  {table.getHeaderGroups().map((hg) => (
                    <tr key={hg.id}>
                      {hg.headers.map((header) => {
                        const align =
                          (header.column.columnDef.meta as { align?: 'left' | 'right' | 'center' } | undefined)
                            ?.align ?? 'left';
                        return (
                          <th
                            key={header.id}
                            className={`max-w-0 overflow-hidden align-middle ${
                              header.column.id === 'actions'
                                ? 'inventario-table__actions-cell text-right'
                                : 'px-3'
                            } ${
                              align === 'right'
                                ? 'text-right'
                                : align === 'center'
                                  ? 'text-center'
                                  : 'text-left'
                            } ${header.column.id === 'actions' ? '!max-w-none' : ''}`}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                          </th>
                        );
                      })}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {filteredCount === 0 ? (
                    <tr>
                      <td colSpan={columns.length} className="py-12 text-center">
                        <EmptyState icon={<Package className="h-6 w-6" />} title="Sin items en inventario" />
                      </td>
                    </tr>
                  ) : (
                    <>
                      {pageRows.map((row) => (
                        <tr key={row.id} className="gastos-table__row gastos-tr">
                          {row.getVisibleCells().map((cell) => {
                            const align =
                              (cell.column.columnDef.meta as { align?: 'left' | 'right' | 'center' } | undefined)
                                ?.align ?? 'left';
                            return (
                              <td
                                key={cell.id}
                                className={`gastos-table__cell gastos-td max-w-0 overflow-hidden ${
                                  cell.column.id === 'actions'
                                    ? 'inventario-table__actions-cell text-right'
                                    : 'px-3'
                                } ${
                                  align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
                                } ${cell.column.id === 'actions' ? '!max-w-none overflow-visible' : ''}`}
                              >
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      {Array.from({ length: emptyRowSlots }, (_, i) => (
                        <tr
                          key={`pad-${i}`}
                          className="inventario-table__row-pad gastos-table__row gastos-tr"
                          aria-hidden
                        >
                          <td colSpan={columns.length} className="gastos-table__cell" />
                        </tr>
                      ))}
                    </>
                  )}
                </tbody>
              </table>
            </div>
            </div>

            <div className="gastos-footer-bar flex shrink-0 items-center justify-between border-t px-3 py-1.5">
              <span className="gastos-footer-label text-[10px]">
                {filteredCount === 0
                  ? '0 items'
                  : `${pageIndex * pagination.pageSize + 1}–${Math.min(
                      (pageIndex + 1) * pagination.pageSize,
                      filteredCount,
                    )} de ${filteredCount} items`}
              </span>
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
                    disabled={filteredCount === 0 && page > 0}
                    aria-label={`Página ${page + 1}`}
                    aria-current={page === activePageIndex ? 'page' : undefined}
                    className={`gastos-page-btn min-w-[1.35rem] rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums transition-colors ${
                      page === activePageIndex ? 'gastos-page-btn--active' : ''
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
            </div>
          </>
        )}
      </div>

      <PageFormModal open={showItemModal} onClose={() => setShowItemModal(false)}>
        <div className="mb-4 flex justify-center sm:hidden">
          <div className="h-1 w-8 rounded-full bg-zinc-700" />
        </div>
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--dashboard-accent-soft)] bg-[var(--dashboard-accent-soft)]">
              <Package className="h-4 w-4 text-[var(--dashboard-accent)]" />
            </div>
            <h2 className="text-lg font-semibold text-white/90">{editItem ? 'Editar Item' : 'Nuevo Item'}</h2>
          </div>
          <button
            type="button"
            onClick={() => setShowItemModal(false)}
            className="rounded-lg p-1.5 text-white/40 hover:bg-white/[0.06]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="input-label">Código</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={itemForm.codigo}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, codigo: digitsOnlyCodigo(e.target.value) })
                  }
                  className="input-field font-mono tabular-nums"
                  placeholder="Opcional — solo números (vacío = Sin Datos)"
                />
              </div>
              <div>
                <label className="input-label">Categoría *</label>
                <AppSelect
                  value={itemForm.categoria}
                  onChange={(v) =>
                    setItemForm({ ...itemForm, categoria: v as InventarioItem['categoria'] })
                  }
                  options={categoriaOptions}
                />
              </div>
              <div className="md:col-span-2">
                <label className="input-label">Nombre *</label>
                <input
                  value={itemForm.nombre}
                  onChange={(e) => setItemForm({ ...itemForm, nombre: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="input-label">Unidad de Medida *</label>
                <input
                  value={itemForm.unidad_medida}
                  onChange={(e) => setItemForm({ ...itemForm, unidad_medida: e.target.value })}
                  className="input-field"
                  placeholder="kg, litros, unidades..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Stock Mínimo</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={itemForm.stock_minimo}
                    onChange={(e) => setItemForm({ ...itemForm, stock_minimo: e.target.value })}
                    className="input-field tabular-nums"
                  />
                </div>
                <div>
                  <label className="input-label">Stock Actual</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={itemForm.stock_actual}
                    onChange={(e) => setItemForm({ ...itemForm, stock_actual: e.target.value })}
                    className="input-field tabular-nums"
                    title="Valor mostrado en la columna Stock Actual de la tabla"
                  />
                </div>
              </div>
              <div>
                <label className="input-label">Costo Unit. Promedio (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  value={itemForm.costo_unitario_promedio}
                  onChange={(e) => setItemForm({ ...itemForm, costo_unitario_promedio: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="input-label">Ubicación</label>
                <AppSelect
                  value={itemForm.destino}
                  onChange={(v) => setItemForm({ ...itemForm, destino: v })}
                  options={destinoSelectOptions}
                />
              </div>
            </div>
        <PageFormModalFooter>
          <button type="button" onClick={() => setShowItemModal(false)} className="btn-secondary">
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSaveItem}
            disabled={saving || !itemForm.nombre.trim()}
            className="app-btn-primary min-w-[110px] justify-center text-sm"
          >
            {saving ? 'Guardando...' : editItem ? 'Actualizar' : 'Guardar'}
          </button>
        </PageFormModalFooter>
      </PageFormModal>

      <PageFormModal
        open={showMovModal}
        onClose={closeMovModal}
        panelClassName="page-form-modal-panel--mov overflow-hidden !max-h-[min(92dvh,40rem)] sm:max-w-2xl"
      >
        <div className="mb-2 flex justify-center sm:hidden">
          <div className="h-1 w-8 rounded-full bg-zinc-700" />
        </div>
        <div className="mb-4 flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--dashboard-accent-soft)] bg-[var(--dashboard-accent-soft)]">
              <ArrowUpCircle className="h-3.5 w-3.5 text-[var(--dashboard-accent)]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold leading-tight text-white/90">Registrar Movimiento</h2>
              <p className="text-[10px] leading-snug text-white/45">
                Entrada, salida o ajuste — no edita la ficha del item
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeMovModal}
            className="shrink-0 rounded-lg p-1 text-white/40 hover:bg-white/[0.06]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="input-label">Item *</label>
            <AppSelect
              value={movForm.item_id}
              onChange={handleMovItemSelect}
              placeholder="Seleccionar item..."
              options={[
                { value: '', label: 'Seleccionar item...' },
                ...items.map((i) => ({
                  value: i.id,
                  label: `[${codigoDisplay(i.codigo)}] ${i.nombre}`,
                })),
              ]}
            />
          </div>

          {selectedMovItem && (
            <div className="md:col-span-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-[var(--gastos-border)] bg-[var(--gastos-pill-bg)] px-2.5 py-2 text-[10px] text-[var(--gastos-body)]">
              <span>
                <span className="text-[var(--gastos-label)]">Stock actual </span>
                <strong className="tabular-nums">{selectedMovItem.stock_actual}</strong>
                <span className="text-[var(--gastos-subtle)]"> u.</span>
              </span>
              <span className="text-[var(--gastos-border)]">|</span>
              <span>
                <span className="text-[var(--gastos-label)]">Mín. </span>
                <strong className="tabular-nums">{selectedMovItem.stock_minimo}</strong>
                <span className="text-[var(--gastos-subtle)]"> u.</span>
              </span>
              <span className="text-[var(--gastos-border)]">|</span>
              <span>
                <span className="text-[var(--gastos-label)]">Ud. medida </span>
                <strong>{selectedMovItem.unidad_medida || '—'}</strong>
              </span>
              <span className="text-[var(--gastos-border)]">|</span>
              <span>
                <span className="text-[var(--gastos-label)]">Ref. </span>
                <strong className="tabular-nums">{fmtUsd(selectedMovItem.costo_unitario_promedio)}</strong>
              </span>
              <span className="text-[var(--gastos-border)]">|</span>
              <span className="gastos-cat-pill rounded px-1 py-px font-semibold">
                {labelDestino(selectedMovItem.ubicacion)}
              </span>
            </div>
          )}

          <div>
            <label className="input-label">Tipo de movimiento *</label>
            <AppSelect
              value={movForm.tipo_movimiento}
              disabled={!movFieldsEnabled}
              onChange={(v) =>
                setMovForm({
                  ...movForm,
                  tipo_movimiento: v as InventarioMovimiento['tipo_movimiento'],
                  cantidad: '',
                })
              }
              options={movimientoOptions}
            />
          </div>
          <div>
            <label className="input-label">
              {movForm.tipo_movimiento === 'ajuste' ? 'Nuevo stock *' : 'Cantidad *'}
            </label>
            <input
              type="number"
              step="0.001"
              min={movForm.tipo_movimiento === 'ajuste' ? '0' : '0.001'}
              value={movForm.cantidad}
              disabled={!movFieldsEnabled}
              onChange={(e) => setMovForm({ ...movForm, cantidad: e.target.value })}
              className="input-field tabular-nums disabled:cursor-not-allowed disabled:opacity-45"
              placeholder={
                movForm.tipo_movimiento === 'ajuste'
                  ? `Stock actual: ${selectedMovItem?.stock_actual ?? 0}`
                  : movForm.tipo_movimiento === 'salida'
                    ? `Máx. ${selectedMovItem?.stock_actual ?? 0}`
                    : 'Unidades a ingresar'
              }
            />
          </div>
          <div>
            <label className="input-label">Costo unitario (mov.)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={movForm.costo_unitario}
              disabled={!movFieldsEnabled}
              onChange={(e) => setMovForm({ ...movForm, costo_unitario: e.target.value })}
              className="input-field tabular-nums disabled:cursor-not-allowed disabled:opacity-45"
              placeholder="Referencia del item"
            />
          </div>
          <div>
            <label className="input-label">Ubicación del movimiento</label>
            <AppSelect
              value={movForm.destino_area}
              disabled={!movFieldsEnabled}
              onChange={(v) => setMovForm({ ...movForm, destino_area: v })}
              options={destinoSelectOptions}
            />
          </div>
          <div className="md:col-span-2">
            <label className="input-label">Referencia</label>
            <input
              value={movForm.referencia}
              disabled={!movFieldsEnabled}
              onChange={(e) => setMovForm({ ...movForm, referencia: e.target.value })}
              className="input-field disabled:cursor-not-allowed disabled:opacity-45"
              placeholder="Factura, orden, disparo..."
            />
          </div>
        </div>

        <PageFormModalFooter className="!mt-4 !pt-3">
          <button type="button" onClick={closeMovModal} className="btn-secondary !py-1.5 !text-xs">
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSaveMov}
            disabled={saving || !movFieldsEnabled || !movForm.cantidad.trim()}
            className="app-btn-primary min-w-[7.5rem] justify-center !py-1.5 !text-xs disabled:cursor-not-allowed disabled:opacity-45"
          >
            {saving ? 'Guardando...' : 'Registrar'}
          </button>
        </PageFormModalFooter>
      </PageFormModal>
    </div>
  );
}

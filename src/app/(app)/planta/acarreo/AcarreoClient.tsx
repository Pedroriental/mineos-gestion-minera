'use client';

import { useState, useTransition, useMemo, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useCanEdit } from '@/lib/use-can-edit';
import { createAcarreoForm, updateAcarreoForm, deleteAcarreo } from '@/lib/actions/acarreo';
import type { ReporteAcarreo } from '@/lib/types';
import {
  Loader2, Plus, X, ChevronLeft, ChevronRight, AlertCircle, Search, Truck,
} from 'lucide-react';
import { AppSelect, type AppSelectOption } from '@/components/ui/AppSelect';
import { useConfirm } from '@/components/ui/ConfirmDialogProvider';
import { useBiblioteca, useBibliotecaOptions, useTurnoOptions } from '@/contexts/biblioteca-context';
import { resolveBibliotecaLabel } from '@/lib/biblioteca-display';
import { PageFormModal, PageFormModalFooter } from '@/components/ui/PageFormModal';
import { SheetIconBadge } from '@/components/mobile';
import EmptyState from '@/components/EmptyState';
import { FadeIn } from '@/components/ui/motion';
import { GerencialRecordDetailModal } from '@/components/gerencial/GerencialRecordDetailModal';
import { AcarreoRecordDetail } from '@/components/gerencial/gerencial-record-details';
import {
  ReportPhotoField,
  reportPhotoDraftsFromUrls,
  revokeReportPhotoPreviews,
  type ReportPhotoDraft,
} from '@/components/reportes/ReportPhotoField';
import { gerencialTableRowClassName, handleRowDetailKeyDown } from '@/components/gerencial/gerencial-table-row';
import { fmtGerencialDate } from '@/lib/gerencial-format';
import {
  formatInformeAcarreoTitulo,
  formatLineaAcarreo,
  sumLineasAcarreo,
} from '@/lib/acarreo-format';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  SortingState,
} from '@tanstack/react-table';
import { columns } from './columns';
import { AppDatePicker } from '@/components/ui/AppDatePicker';
import {
  mineosBtnSubtleClass,
  mineosModalDivider,
  mineosModalHeading,
  mineosPanel,
} from '@/lib/mineos-visual';

const ACARREO_PAGE_MAX = 12;
const ACARREO_PAGE_BUTTONS_MAX = 5;
const ACARREO_ROW_PX = 56;
const ACARREO_HEAD_FALLBACK_PX = 40;
const ACARREO_LAYOUT_SAFETY_PX = 4;

const emptyLinea = () => ({ sacos: '', vertical: '', disparo: '' });

interface AcarreoClientProps {
  data: ReporteAcarreo[];
}

export default function AcarreoClient({ data: initialData }: AcarreoClientProps) {
  const { user } = useAuth();
  const canEdit = useCanEdit();
  const turnoOptions = useTurnoOptions();
  const biblioteca = useBiblioteca();
  const minaOptions = useBibliotecaOptions('minas');
  const molinoOptions = useBibliotecaOptions('molinos');
  const verticalOptions = useBibliotecaOptions('verticales_voladura', {
    prependEmpty: true,
    emptyLabel: '—',
  });

  const verticalOptionsForLine = useCallback(
    (current: string): readonly AppSelectOption[] => {
      const trimmed = current.trim();
      if (!trimmed || verticalOptions.some((o) => o.value === trimmed)) {
        return verticalOptions;
      }
      return [{ value: trimmed, label: trimmed }, ...verticalOptions];
    },
    [verticalOptions],
  );

  const [selectedDate, setSelectedDate] = useState('todos');
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: ACARREO_PAGE_MAX });
  const tableBodyRef = useRef<HTMLDivElement>(null);

  const [showModal, setShowModal] = useState(false);
  const [viewItem, setViewItem] = useState<ReporteAcarreo | null>(null);
  const [editItem, setEditItem] = useState<ReporteAcarreo | null>(null);
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const confirmDialog = useConfirm();

  const emptyForm = {
    fecha: new Date().toISOString().slice(0, 10),
    turno: 'dia' as ReporteAcarreo['turno'],
    mina: '',
    molino: '',
    sacos_libres: '',
    observaciones: '',
  };
  const [form, setForm] = useState(emptyForm);
  const [lineas, setLineas] = useState([emptyLinea()]);
  const [fotos, setFotos] = useState<ReportPhotoDraft[]>([]);
  const set = (field: string, value: unknown) => setForm((f) => ({ ...f, [field]: value }));

  const diasConRegistros = useMemo(() => {
    const dates = Array.from(new Set(initialData.map((d) => d.fecha))).sort((a, b) => b.localeCompare(a));
    return dates.map((fecha) => ({
      fecha,
      count: initialData.filter((r) => r.fecha === fecha).length,
    }));
  }, [initialData]);

  const filteredRegistros = useMemo(() => {
    if (selectedDate === 'todos') return initialData;
    return initialData.filter((r) => r.fecha === selectedDate);
  }, [initialData, selectedDate]);

  useEffect(() => {
    if (selectedDate !== 'todos' && diasConRegistros.length > 0 && !initialData.some((r) => r.fecha === selectedDate)) {
      setSelectedDate('todos');
    }
  }, [diasConRegistros, initialData, selectedDate]);

  const cargaTotal = useMemo(
    () => lineas.reduce((sum, linea) => sum + (parseInt(linea.sacos, 10) || 0), 0),
    [lineas],
  );

  const replaceFotos = useCallback((next: ReportPhotoDraft[]) => {
    setFotos((prev) => {
      revokeReportPhotoPreviews(prev);
      return next;
    });
  }, []);

  const clearFotos = useCallback(() => {
    replaceFotos([]);
  }, [replaceFotos]);

  const closeFormModal = () => {
    clearFotos();
    setShowModal(false);
    setFormError(null);
    setEditItem(null);
  };

  const openCreate = () => {
    setEditItem(null);
    setForm({
      ...emptyForm,
      fecha: selectedDate === 'todos' ? new Date().toISOString().slice(0, 10) : selectedDate,
    });
    setLineas([emptyLinea()]);
    replaceFotos([]);
    setFormError(null);
    setShowModal(true);
  };

  const openEdit = (item: ReporteAcarreo) => {
    setEditItem(item);
    setForm({
      fecha: item.fecha,
      turno: item.turno,
      mina: resolveBibliotecaLabel(biblioteca, 'minas', item.mina),
      molino: resolveBibliotecaLabel(biblioteca, 'molinos', item.molino),
      sacos_libres: String(item.sacos_libres),
      observaciones: item.observaciones || '',
    });
    setLineas(
      item.lineas.length > 0
        ? item.lineas.map((l) => ({
            sacos: String(l.sacos),
            vertical: l.vertical || '',
            disparo: l.disparo || '',
          }))
        : [emptyLinea()],
    );
    replaceFotos(reportPhotoDraftsFromUrls(item.fotos));
    setFormError(null);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!(await confirmDialog({
      title: 'Eliminar informe',
      message: '¿Eliminar este informe de acarreo?',
      variant: 'danger',
    }))) return;
    startTransition(async () => {
      await deleteAcarreo(id);
    });
  };

  const table = useReactTable({
    data: filteredRegistros,
    columns: columns(
      (item) => openEdit(item),
      (id) => handleDelete(id),
      canEdit,
    ),
    state: { sorting, globalFilter, pagination },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const syncTableLayout = useCallback(() => {
    const el = tableBodyRef.current;
    if (!el) return;
    const headH = el.querySelector('thead')?.getBoundingClientRect().height ?? ACARREO_HEAD_FALLBACK_PX;
    const bodyAvailable = el.clientHeight - headH;
    const sampleRow = el.querySelector('tbody tr:not(.produccion-table-row--pad):not(:has(td[colspan]))');
    const measuredHeight = sampleRow?.getBoundingClientRect().height ?? 0;
    const rowPx = Math.max(ACARREO_ROW_PX, measuredHeight > 8 ? measuredHeight : 0);
    let pageRows = Math.floor((bodyAvailable - ACARREO_LAYOUT_SAFETY_PX) / rowPx);
    pageRows = Math.max(1, Math.min(ACARREO_PAGE_MAX, pageRows));
    setPagination((prev) => (prev.pageSize === pageRows ? prev : { ...prev, pageSize: pageRows }));
  }, []);

  const filteredCount = table.getFilteredRowModel().rows.length;
  const pageCount = table.getPageCount();
  const displayPageCount = Math.max(1, pageCount);
  const pageIndex = Math.min(pagination.pageIndex, Math.max(0, displayPageCount - 1));
  const activePageIndex = filteredCount === 0 ? 0 : pageIndex;
  const pageWindowStart =
    Math.floor(activePageIndex / ACARREO_PAGE_BUTTONS_MAX) * ACARREO_PAGE_BUTTONS_MAX;
  const pageNumbers = useMemo(() => {
    const len = Math.min(ACARREO_PAGE_BUTTONS_MAX, Math.max(0, displayPageCount - pageWindowStart));
    if (len === 0) return [0];
    return Array.from({ length: len }, (_, i) => pageWindowStart + i);
  }, [displayPageCount, pageWindowStart]);

  const tableSummary = useMemo(() => {
    const rows = table.getFilteredRowModel().rows;
    return {
      carga: rows.reduce((s, r) => s + (Number(r.original.carga_total) || 0), 0),
      libres: rows.reduce((s, r) => s + (Number(r.original.sacos_libres) || 0), 0),
      count: rows.length,
    };
  }, [filteredCount, globalFilter, filteredRegistros, sorting, pagination.pageIndex]);

  const pageRows = table.getPaginationRowModel().rows;
  const emptyRowSlots = Math.max(0, pagination.pageSize - pageRows.length);
  const colCount = table.getAllLeafColumns().length;

  useEffect(() => {
    const el = tableBodyRef.current;
    if (!el) return;
    const run = () => syncTableLayout();
    run();
    const ro = new ResizeObserver(run);
    ro.observe(el);
    const mq = window.matchMedia('(min-width: 1024px)');
    mq.addEventListener('change', run);
    return () => {
      ro.disconnect();
      mq.removeEventListener('change', run);
    };
  }, [syncTableLayout, filteredRegistros.length]);

  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [selectedDate, globalFilter]);

  useEffect(() => {
    const maxIndex = Math.max(0, displayPageCount - 1);
    if (pagination.pageIndex > maxIndex) {
      setPagination((p) => ({ ...p, pageIndex: maxIndex }));
    }
  }, [displayPageCount, pagination.pageIndex]);

  const addLinea = () => setLineas((prev) => [...prev, emptyLinea()]);
  const removeLinea = (index: number) => setLineas((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  const updateLinea = (index: number, field: 'sacos' | 'vertical' | 'disparo', value: string) => {
    setLineas((prev) => prev.map((linea, i) => (i === index ? { ...linea, [field]: value } : linea)));
  };

  const handleSave = () => {
    setFormError(null);
    const parsedLineas = lineas.map((linea) => ({
      sacos: Math.max(0, parseInt(linea.sacos, 10) || 0),
      vertical: linea.vertical.trim() || undefined,
      disparo: linea.disparo.trim() || undefined,
    }));

    const payload = {
      fecha: form.fecha,
      turno: form.turno,
      mina: resolveBibliotecaLabel(biblioteca, 'minas', form.mina.trim()) || form.mina.trim() || undefined,
      molino: resolveBibliotecaLabel(biblioteca, 'molinos', form.molino.trim()) || form.molino.trim() || undefined,
      lineas: parsedLineas,
      carga_total: sumLineasAcarreo(parsedLineas),
      sacos_libres: parseInt(form.sacos_libres, 10) || 0,
      observaciones: form.observaciones.trim() || undefined,
      registrado_por: user?.id,
      ...(editItem ? { id: editItem.id } : {}),
    };

    const formData = new FormData();
    formData.set('payload', JSON.stringify(payload));
    formData.set(
      'fotos_keep',
      JSON.stringify(fotos.filter((photo) => photo.kind === 'existing').map((photo) => photo.url)),
    );
    fotos.filter((photo): photo is Extract<ReportPhotoDraft, { kind: 'new' }> => photo.kind === 'new')
      .forEach((photo) => formData.append('fotos_nuevas', photo.file));

    startTransition(async () => {
      const res = editItem
        ? await updateAcarreoForm(formData)
        : await createAcarreoForm(formData);
      if (!res.ok) {
        setFormError(res.message || 'No se pudo guardar el informe.');
        return;
      }
      closeFormModal();
      setSelectedDate(form.fecha);
    });
  };

  return (
    <div className="acarreo-page produccion-page flex min-h-0 flex-1 flex-col overflow-hidden">
      <FadeIn className="produccion-page__toolbar shrink-0">
        <div className="produccion-page__toolbar-grid grid grid-cols-1 gap-3 lg:grid-cols-12 lg:items-center lg:gap-4">
          <div className="produccion-page__toolbar-search min-w-0 lg:col-span-5">
            <div className="produccion-page__search produccion-surface produccion-surface--input flex h-9 w-full min-w-0 items-center rounded-lg px-3 py-2">
              <Search className="produccion-icon-muted mr-2 h-4 w-4 shrink-0" />
              <input
                type="text"
                placeholder="Buscar mina, molino, vertical, disparo..."
                value={globalFilter ?? ''}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="produccion-search-input w-full min-w-0 border-none bg-transparent text-sm outline-none"
              />
            </div>
          </div>
          <div className="produccion-page__toolbar-actions flex min-w-0 lg:col-span-7 lg:justify-end">
            {canEdit && (
              <button type="button" onClick={openCreate} className="produccion-page__toolbar-btn btn-primary w-full lg:w-auto">
                <Plus className="mr-2 h-4 w-4" /> Nuevo informe de acarreo
              </button>
            )}
          </div>
        </div>
      </FadeIn>

      <div className="gerencial-page__main produccion-page__main produccion-surface produccion-surface--panel mt-2 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl p-3 pt-2.5 lg:p-4 lg:pt-3.5">
        <div className="produccion-page__day-tabs mb-2 flex shrink-0 items-center gap-1.5 overflow-x-auto pb-2 pt-0.5 snap-x w-full lg:mb-4 lg:gap-2.5 lg:pb-3">
          {diasConRegistros.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedDate('todos')}
              className={`produccion-day-pill snap-center flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] transition-all lg:gap-2 lg:px-3.5 lg:py-2 lg:text-xs ${
                selectedDate === 'todos' ? 'produccion-day-pill--active bg-amber-500 border-amber-500 text-black font-bold' : ''
              }`}
            >
              <span>Todos los días</span>
              <span className={`produccion-day-pill__badge rounded-full px-1.5 py-0.5 text-[9px] font-black ${selectedDate === 'todos' ? 'bg-black/20 text-black' : ''}`}>
                {initialData.length}
              </span>
            </button>
          )}
          {diasConRegistros.map((dia) => {
            const d = new Date(dia.fecha + 'T12:00:00');
            const isSelected = selectedDate === dia.fecha;
            return (
              <button
                key={dia.fecha}
                type="button"
                onClick={() => setSelectedDate(dia.fecha)}
                className={`produccion-day-pill snap-center flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] transition-all lg:gap-2 lg:px-3.5 lg:py-2 lg:text-xs ${
                  isSelected ? 'produccion-day-pill--active bg-amber-500 border-amber-500 text-black font-bold' : ''
                }`}
              >
                <span>{d.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' })}</span>
                <span className={`produccion-day-pill__badge rounded-full px-1.5 py-0.5 text-[9px] font-black ${isSelected ? 'bg-black/20 text-black' : ''}`}>
                  {dia.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="produccion-page__table-stack min-h-0 flex-1">
          <div
            ref={tableBodyRef}
            className="produccion-page__table-body min-h-0 flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar"
          >
            <table className="w-full border-collapse text-left">
              <thead className="produccion-page__table-head sticky top-0 z-10 shadow-sm">
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id}>
                    {hg.headers.map((header) => (
                      <th
                        key={header.id}
                        onClick={header.column.getToggleSortingHandler()}
                        className={`produccion-table-th whitespace-nowrap px-4 text-[10px] font-bold uppercase tracking-wider ${header.column.getCanSort() ? 'cursor-pointer select-none' : ''}`}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={colCount} className="py-12">
                      <EmptyState
                        icon={<Truck className="h-6 w-6" />}
                        title="Sin informes de acarreo"
                        description="Registra el acarreo de material hacia los molinos."
                        action={canEdit ? { label: 'Nuevo informe', onClick: openCreate } : undefined}
                      />
                    </td>
                  </tr>
                ) : (
                  <>
                    {pageRows.map((row) => (
                      <tr
                        key={row.id}
                        className={gerencialTableRowClassName}
                        onClick={() => setViewItem(row.original)}
                        onKeyDown={(event) => handleRowDetailKeyDown(event, row.original, setViewItem)}
                        tabIndex={0}
                        aria-label={`Ver informe de acarreo del ${fmtGerencialDate(row.original.fecha)}`}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="produccion-table-td px-4 text-xs">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {Array.from({ length: emptyRowSlots }, (_, i) => (
                      <tr key={`pad-${i}`} className="produccion-table-row produccion-table-row--pad border-b" aria-hidden>
                        <td colSpan={colCount} className="px-4 py-2.5" />
                      </tr>
                    ))}
                  </>
                )}
              </tbody>
            </table>
          </div>

          <div className="produccion-page__table-footer gastos-footer-bar flex shrink-0 items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0">
              <span className="gastos-footer-label text-[8px] uppercase tracking-wider">Resumen</span>
              <span className="produccion-page__footer-amount text-[11px] font-bold tabular-nums">
                {tableSummary.carga} sacos cargados
              </span>
              <span className="gastos-footer-label text-[9px]">·</span>
              <span className="gastos-footer-label text-[9px] tabular-nums">{tableSummary.libres} libres</span>
              <span className="gastos-footer-label text-[9px]">· {tableSummary.count} reg.</span>
            </div>
            {filteredCount > 0 && (
              <div className="flex shrink-0 items-center gap-0.5">
                <button type="button" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="gastos-page-btn rounded p-1 transition-colors disabled:opacity-30" aria-label="Página anterior">
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                {pageNumbers.map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => table.setPageIndex(page)}
                    className={`gastos-page-btn min-w-[1.35rem] rounded px-1 py-0.5 text-[10px] font-semibold tabular-nums ${
                      page === activePageIndex ? 'bg-amber-500/15 text-amber-400' : ''
                    }`}
                  >
                    {page + 1}
                  </button>
                ))}
                <button type="button" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="gastos-page-btn rounded p-1 transition-colors disabled:opacity-30" aria-label="Página siguiente">
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <PageFormModal
        open={showModal}
        onClose={closeFormModal}
        sheetTitle={editItem ? 'Editar informe de acarreo' : 'Nuevo informe de acarreo'}
        sheetIcon={<SheetIconBadge icon={Truck} tone="accent" />}
        panelClassName="acarreo-page__modal sm:max-w-[72rem] sm:p-5"
      >
        <div className="mb-3 hidden items-center justify-between lg:flex">
          <div>
            <p className="gastos-detail-eyebrow text-[9px] font-bold uppercase tracking-wider">Acarreo hacia molinos</p>
            <h2 className="page-form-modal-title text-lg font-semibold">
              {editItem ? 'Editar informe de acarreo' : 'Nuevo informe de acarreo'}
            </h2>
          </div>
          <button type="button" onClick={closeFormModal} className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg p-2 text-[var(--dashboard-text-muted)] transition-colors hover:bg-black/[0.06]">
            <X className="h-5 w-5" />
          </button>
        </div>

        {formError && (
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            <span className="text-sm text-red-400">{formError}</span>
          </div>
        )}

        {form.molino.trim() ? (
          <p className="produccion-muted mb-4 text-sm italic">{formatInformeAcarreoTitulo(form.molino)}</p>
        ) : null}

        <div className="acarreo-page__modal-columns grid grid-cols-1 gap-5 lg:grid-cols-4 lg:gap-6">
          <section className="flex flex-col gap-2.5">
            <h3 className={mineosModalHeading('general')}>
              <span>Identificación</span>
              <span className={mineosModalDivider('general')} />
            </h3>
            <div>
              <label className="input-label">Fecha *</label>
              <AppDatePicker value={form.fecha} onChange={(val) => set('fecha', val)} />
            </div>
            <div>
              <label className="input-label">Servicio *</label>
              <AppSelect value={form.turno} onChange={(v) => set('turno', v)} options={turnoOptions} />
            </div>
            <div>
              <label className="input-label">Mina *</label>
              <AppSelect
                value={form.mina}
                onChange={(v) => set('mina', v)}
                options={minaOptions}
                placeholder="— Seleccionar mina —"
              />
            </div>
            <div>
              <label className="input-label">Molino destino *</label>
              <AppSelect
                value={form.molino}
                onChange={(v) => set('molino', v)}
                options={molinoOptions}
                placeholder='Ej: la "fe"'
              />
            </div>
          </section>

          <section className="flex min-w-0 flex-col gap-2.5 lg:col-span-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className={mineosModalHeading('general')}>
                <span>Detalle de carga</span>
                <span className={mineosModalDivider('general')} />
              </h3>
              <button type="button" onClick={addLinea} className={mineosBtnSubtleClass('general')}>
                <Plus className="h-3.5 w-3.5" /> Agregar línea
              </button>
            </div>
            <div className="space-y-2">
              {lineas.map((linea, index) => (
                <div
                  key={index}
                  className={`grid grid-cols-[minmax(0,4.25rem)_minmax(0,1fr)_minmax(0,3.75rem)_auto] items-end gap-1.5 !p-2 ${mineosPanel('neutral')}`}
                >
                  <div className="min-w-0">
                    <label className="input-label !text-[10px]">Sacos *</label>
                    <input
                      type="number"
                      min={1}
                      value={linea.sacos}
                      onChange={(e) => updateLinea(index, 'sacos', e.target.value)}
                      className="input-field !px-2 !py-1.5 font-bold tabular-nums"
                      placeholder="116"
                    />
                  </div>
                  <div className="min-w-0">
                    <label className="input-label !text-[10px]">Vertical</label>
                    <AppSelect
                      value={linea.vertical}
                      onChange={(v) => updateLinea(index, 'vertical', v)}
                      options={verticalOptionsForLine(linea.vertical)}
                      placeholder="—"
                      className="min-w-0 w-full [&_.app-select__trigger]:!px-2 [&_.app-select__trigger]:!py-1.5 [&_.app-select__value]:!text-sm"
                    />
                  </div>
                  <div className="min-w-0">
                    <label className="input-label !text-[10px]">Disparo</label>
                    <input
                      value={linea.disparo}
                      onChange={(e) => updateLinea(index, 'disparo', e.target.value)}
                      className="input-field !px-2 !py-1.5 text-center tabular-nums"
                      placeholder="29"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLinea(index)}
                    disabled={lineas.length <= 1}
                    className="mb-0.5 shrink-0 rounded-lg p-1.5 text-white/30 transition-colors hover:bg-red-500/15 hover:text-red-400 disabled:opacity-30"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  {(linea.sacos || linea.vertical || linea.disparo) && (
                    <p className="col-span-4 text-[11px] italic text-white/45">
                      {formatLineaAcarreo({
                        sacos: parseInt(linea.sacos, 10) || 0,
                        vertical: linea.vertical || undefined,
                        disparo: linea.disparo || undefined,
                      })}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-2.5">
            <h3 className={mineosModalHeading('general')}>
              <span>Totales</span>
              <span className={mineosModalDivider('general')} />
            </h3>
            <div className={`${mineosPanel('general')} rounded-xl p-3`}>
              <p className="input-label !text-[10px]">Carga total (auto)</p>
              <p className="text-2xl font-bold text-amber-400 tabular-nums">{cargaTotal} <span className="text-sm font-normal text-white/40">sacos</span></p>
            </div>
            <div>
              <label className="input-label">Sacos libres para el molino *</label>
              <input
                type="number"
                min={0}
                value={form.sacos_libres}
                onChange={(e) => set('sacos_libres', e.target.value)}
                className="input-field text-lg font-bold"
                placeholder="117"
              />
            </div>
            <div>
              <label className="input-label">Notas / observaciones</label>
              <textarea
                value={form.observaciones}
                onChange={(e) => set('observaciones', e.target.value)}
                className="input-field min-h-[7rem] resize-y"
                rows={4}
                placeholder='Ej: los 28 sacos del disparo 31 están con el moño hacia la parte delantera del camión'
              />
            </div>
            <div>
              <label className="input-label">Fotos del informe</label>
              <ReportPhotoField photos={fotos} onChange={setFotos} disabled={isPending} />
            </div>
          </section>
        </div>

        <PageFormModalFooter className="flex-col-reverse sm:flex-row">
          <button type="button" onClick={closeFormModal} className="btn-secondary min-h-[48px] sm:min-h-[40px]">
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="btn-primary min-h-[48px] sm:min-h-[40px]"
          >
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {editItem ? 'Actualizar informe' : 'Registrar acarreo'}
          </button>
        </PageFormModalFooter>
      </PageFormModal>

      <GerencialRecordDetailModal
        open={!!viewItem}
        onClose={() => setViewItem(null)}
        title={viewItem ? `Acarreo · ${fmtGerencialDate(viewItem.fecha)}` : 'Detalle de acarreo'}
        eyebrow="Informe de acarreo"
        sheetIcon={<SheetIconBadge icon={Truck} tone="accent" />}
        panelClassName="acarreo-page__modal sm:max-w-[72rem] sm:p-5"
      >
        {viewItem ? <AcarreoRecordDetail record={viewItem} /> : null}
      </GerencialRecordDetailModal>
    </div>
  );
}

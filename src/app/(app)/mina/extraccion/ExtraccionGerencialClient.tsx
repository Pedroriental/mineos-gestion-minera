'use client';

import { useState, useTransition, useMemo, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useCanEdit } from '@/lib/use-can-edit';
import { createExtraccion, updateExtraccion, deleteExtraccion } from '@/lib/actions/extraccion';
import type { ReporteExtraccion, EventoExtraccion } from '@/lib/types';
import {
  Loader2, Pickaxe, Plus, X, Download, AlertCircle, Search, Package, Zap, Clock, BarChart3, ChevronLeft, ChevronRight
} from 'lucide-react';
import { AppSelect } from '@/components/ui/AppSelect';
import { useConfirm } from '@/components/ui/ConfirmDialogProvider';
import { useBiblioteca, useBibliotecaOptions, useTurnoOptions } from '@/contexts/biblioteca-context';
import { resolveBibliotecaLabel } from '@/lib/biblioteca-display';
import { PageFormModal, PageFormModalFooter } from '@/components/ui/PageFormModal';
import { SheetIconBadge } from '@/components/mobile';
import { GerencialMobileChartFold, GerencialMobileKpiStrip } from '@/components/gerencial/GerencialMobileChrome';
import { GerencialRecordDetailModal } from '@/components/gerencial/GerencialRecordDetailModal';
import { ExtraccionRecordDetail } from '@/components/gerencial/gerencial-record-details';
import { gerencialTableRowClassName, handleRowDetailKeyDown } from '@/components/gerencial/gerencial-table-row';
import { fmtGerencialDate } from '@/lib/gerencial-format';
import EmptyState from '@/components/EmptyState';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  SortingState,
} from '@tanstack/react-table';
import { columns, bitacoraColumns, type BitacoraEntry } from './columns';
import { FadeIn } from '@/components/ui/motion';
import { AppDatePicker } from '@/components/ui/AppDatePicker';
import { AppTimePicker } from '@/components/ui/AppTimePicker';
import { formatTime12h } from '@/lib/format-time';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer
} from 'recharts';
import {
  mineosModalHeadingBetween,
  mineosModalDivider,
  mineosBtnSubtleClass,
  mineosPanel,
  mineosLabelAccent,
  MINEOS_BTN_GERENCIAL_NEW,
} from '@/lib/mineos-visual';

const fmtNum = (n: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n);

const EXTRACCION_PAGE_MAX = 12;
const EXTRACCION_PAGE_BUTTONS_MAX = 5;
const EXTRACCION_ROW_MIN_PX = 40;
const EXTRACCION_HEAD_FALLBACK_PX = 40;
const CHART_DAYS_MAX = 14;

// ═══════════════════════════════════════════════════════════
// CUSTOM TOOLTIP FOR RECHARTS
// ═══════════════════════════════════════════════════════════
function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="app-chart-tooltip p-2 rounded-lg shadow-xl backdrop-blur-md">
        <p className="text-white/60 text-[10px] font-mono mb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 mb-0.5">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-white/80 text-[10px]">{entry.name}:</span>
            <span className="text-white font-bold text-xs">{entry.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════
export interface ExtraccionGerencialData {
  kpis: {
    totalSacos: number;
    totalDisparos: number;
    totalEventos: number;
  };
  diaria: {
    fecha: string;
    sacos: number;
    disparos: number;
    eventos: number;
  }[];
  registros: ReporteExtraccion[];
}

export default function ExtraccionGerencialClient({ data, selectedDateStr }: { data: ExtraccionGerencialData, selectedDateStr: string }) {
  const { user } = useAuth();
  const canEdit = useCanEdit();
  const turnoOptions = useTurnoOptions();
  const verticalOptions = useBibliotecaOptions('verticales_voladura', {
    prependEmpty: true,
    emptyLabel: '— Sin especificar —',
  });
  const biblioteca = useBiblioteca();
  const minaOptions = useBibliotecaOptions('minas');
  const formatMina = useCallback(
    (raw?: string | null) => resolveBibliotecaLabel(biblioteca, 'minas', raw) || '—',
    [biblioteca],
  );

  const [selectedDate, setSelectedDate] = useState('todos');
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: EXTRACCION_PAGE_MAX });
  const tableBodyRef = useRef<HTMLDivElement>(null);

  const [showModal, setShowModal] = useState(false);
  const [showBitacoraModal, setShowBitacoraModal] = useState(false);
  const [viewItem, setViewItem] = useState<ReporteExtraccion | null>(null);
  const [bitacoraPagination, setBitacoraPagination] = useState({ pageIndex: 0, pageSize: EXTRACCION_PAGE_MAX });
  const bitacoraTableBodyRef = useRef<HTMLDivElement>(null);
  const [editItem, setEditItem] = useState<ReporteExtraccion | null>(null);
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const confirmDialog = useConfirm();

  const initialData = data.registros;

  const emptyForm = {
    fecha: selectedDate === 'todos' ? new Date().toISOString().slice(0, 10) : selectedDate,
    turno: 'noche' as ReporteExtraccion['turno'],
    vertical: '',
    mina: '',
    responsable: '',
    hora_inicio: '',
    hora_fin: '',
    sacos_extraidos: '',
    numero_disparo: '',
    observaciones: '',
  };
  const [form, setForm] = useState(emptyForm);
  const [eventos, setEventos] = useState<EventoExtraccion[]>([]);

  // 1. Días con registros (más reciente → más antiguo)
  const diasConRegistros = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of initialData) {
      counts.set(r.fecha, (counts.get(r.fecha) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([fecha, count]) => ({ fecha, count }))
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [initialData]);

  const diariaChart = useMemo(
    () => data.diaria.slice(-CHART_DAYS_MAX),
    [data.diaria],
  );

  useEffect(() => {
    if (selectedDate !== 'todos' && diasConRegistros.length > 0 && !initialData.some((r) => r.fecha === selectedDate)) {
      setSelectedDate('todos');
    }
  }, [diasConRegistros, initialData, selectedDate]);

  // 2. Filtrado para Vista Diaria (Tabla)
  const filteredRegistros = useMemo(() => {
    if (selectedDate === 'todos') {
      return initialData;
    }
    return initialData.filter(d => d.fecha === selectedDate);
  }, [initialData, selectedDate]);

  // 3. Cálculo de Mini KPIs Diarios
  const diaSacos = filteredRegistros.reduce((acc, curr) => acc + (Number(curr.sacos_extraidos) || 0), 0);
  const diaDisparos = filteredRegistros.filter(d => d.numero_disparo).length;

  const openEdit = useCallback((item: ReporteExtraccion) => {
    setEditItem(item);
    setEventos(item.eventos || []);
    setForm({
      fecha: item.fecha,
      turno: item.turno,
      vertical: item.vertical || '',
      mina: resolveBibliotecaLabel(biblioteca, 'minas', item.mina) || '',
      responsable: item.responsable || '',
      hora_inicio: item.hora_inicio || '',
      hora_fin: item.hora_fin || '',
      sacos_extraidos: String(item.sacos_extraidos ?? ''),
      numero_disparo: item.numero_disparo || '',
      observaciones: item.observaciones || '',
    });
    setFormError(null);
    setShowModal(true);
  }, [biblioteca]);

  const handleDelete = useCallback(async (id: string) => {
    if (!(await confirmDialog({
      title: 'Eliminar reporte',
      message: '¿Eliminar este reporte de extracción?',
      variant: 'danger',
    }))) return;
    startTransition(async () => {
      await deleteExtraccion(id);
    });
  }, [confirmDialog]);

  const tableColumns = useMemo(
    () => columns(openEdit, handleDelete, canEdit, formatMina),
    [openEdit, handleDelete, canEdit, formatMina],
  );

  const table = useReactTable({
    data: filteredRegistros,
    columns: tableColumns,
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
    const headH = el.querySelector('thead')?.getBoundingClientRect().height ?? EXTRACCION_HEAD_FALLBACK_PX;
    const bodyAvailable = el.clientHeight - headH;
    const pageRows = Math.min(
      EXTRACCION_PAGE_MAX,
      Math.max(1, Math.floor(bodyAvailable / EXTRACCION_ROW_MIN_PX)),
    );
    setPagination((prev) => (prev.pageSize === pageRows ? prev : { ...prev, pageSize: pageRows }));
  }, []);

  const filteredCount = table.getFilteredRowModel().rows.length;
  const pageCount = table.getPageCount();
  const displayPageCount = Math.max(1, pageCount);
  const pageIndex = Math.min(pagination.pageIndex, Math.max(0, displayPageCount - 1));
  const activePageIndex = filteredCount === 0 ? 0 : pageIndex;
  const pageWindowStart =
    Math.floor(activePageIndex / EXTRACCION_PAGE_BUTTONS_MAX) * EXTRACCION_PAGE_BUTTONS_MAX;
  const pageNumbers = useMemo(() => {
    const len = Math.min(EXTRACCION_PAGE_BUTTONS_MAX, Math.max(0, displayPageCount - pageWindowStart));
    if (len === 0) return [0];
    return Array.from({ length: len }, (_, i) => pageWindowStart + i);
  }, [displayPageCount, pageWindowStart]);

  const tableSummary = useMemo(() => {
    const rows = table.getFilteredRowModel().rows;
    return {
      sacos: rows.reduce((s, r) => s + (Number(r.original.sacos_extraidos) || 0), 0),
      disparos: rows.filter((r) => r.original.numero_disparo).length,
      eventos: rows.reduce((s, r) => s + (r.original.eventos?.length || 0), 0),
      count: rows.length,
    };
  }, [filteredCount, globalFilter, filteredRegistros, sorting, pagination.pageIndex]);

  const pageRows = table.getPaginationRowModel().rows;
  const colCount = table.getAllLeafColumns().length;

  const bitacoraEntries = useMemo(() => {
    if (!showBitacoraModal) return [];

    const turnoLabel = (t: string) =>
      t === 'dia' ? 'Día' : t === 'noche' ? 'Noche' : 'Completo';
    const entries: BitacoraEntry[] = [];

    for (const reporte of initialData) {
      for (const [idx, ev] of (reporte.eventos ?? []).entries()) {
        if (!ev.hora?.trim() && !ev.descripcion?.trim()) continue;
        entries.push({
          id: `${reporte.id}-${idx}`,
          reporteId: reporte.id,
          fecha: reporte.fecha,
          turno: turnoLabel(reporte.turno),
          vertical: reporte.vertical || '—',
          mina: formatMina(reporte.mina),
          hora: ev.hora || '—',
          descripcion: ev.descripcion?.trim() || '—',
        });
      }
    }

    return entries.sort((a, b) => {
      const byDate = b.fecha.localeCompare(a.fecha);
      if (byDate !== 0) return byDate;
      return b.hora.localeCompare(a.hora);
    });
  }, [initialData, showBitacoraModal, formatMina]);

  const bitacoraTable = useReactTable({
    data: bitacoraEntries,
    columns: bitacoraColumns,
    state: { pagination: bitacoraPagination },
    onPaginationChange: setBitacoraPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const syncBitacoraLayout = useCallback(() => {
    const el = bitacoraTableBodyRef.current;
    if (!el) return;
    const headH = el.querySelector('thead')?.getBoundingClientRect().height ?? EXTRACCION_HEAD_FALLBACK_PX;
    const bodyAvailable = el.clientHeight - headH;
    const pageRows = Math.min(
      EXTRACCION_PAGE_MAX,
      Math.max(1, Math.floor(bodyAvailable / EXTRACCION_ROW_MIN_PX)),
    );
    setBitacoraPagination((prev) => (prev.pageSize === pageRows ? prev : { ...prev, pageSize: pageRows }));
  }, []);

  const bitacoraCount = bitacoraEntries.length;
  const bitacoraPageCount = bitacoraTable.getPageCount();
  const bitacoraDisplayPageCount = Math.max(1, bitacoraPageCount);
  const bitacoraPageIndex = Math.min(bitacoraPagination.pageIndex, Math.max(0, bitacoraDisplayPageCount - 1));
  const bitacoraActivePageIndex = bitacoraCount === 0 ? 0 : bitacoraPageIndex;
  const bitacoraPageWindowStart =
    Math.floor(bitacoraActivePageIndex / EXTRACCION_PAGE_BUTTONS_MAX) * EXTRACCION_PAGE_BUTTONS_MAX;
  const bitacoraPageNumbers = useMemo(() => {
    const len = Math.min(EXTRACCION_PAGE_BUTTONS_MAX, Math.max(0, bitacoraDisplayPageCount - bitacoraPageWindowStart));
    if (len === 0) return [0];
    return Array.from({ length: len }, (_, i) => bitacoraPageWindowStart + i);
  }, [bitacoraDisplayPageCount, bitacoraPageWindowStart]);

  const bitacoraSummary = useMemo(() => {
    const fechas = new Set(bitacoraEntries.map((e) => e.fecha));
    return {
      total: bitacoraEntries.length,
      fechas: fechas.size,
      dia: bitacoraEntries.filter((e) => e.turno === 'Día').length,
      noche: bitacoraEntries.filter((e) => e.turno === 'Noche').length,
      reportes: new Set(bitacoraEntries.map((e) => e.reporteId)).size,
    };
  }, [bitacoraEntries]);

  const bitacoraPageRows = bitacoraTable.getPaginationRowModel().rows;

  useEffect(() => {
    const el = tableBodyRef.current;
    if (!el) return;
    const run = () => syncTableLayout();
    run();
    const ro = new ResizeObserver(run);
    ro.observe(el);
    return () => ro.disconnect();
  }, [syncTableLayout, filteredRegistros.length]);

  useEffect(() => {
    if (!showBitacoraModal) return;
    setBitacoraPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [showBitacoraModal]);

  useEffect(() => {
    if (!showBitacoraModal) return;
    const el = bitacoraTableBodyRef.current;
    if (!el) return;
    const run = () => syncBitacoraLayout();
    run();
    const ro = new ResizeObserver(run);
    ro.observe(el);
    return () => ro.disconnect();
  }, [showBitacoraModal, syncBitacoraLayout, bitacoraEntries.length]);

  useEffect(() => {
    const maxIndex = Math.max(0, bitacoraDisplayPageCount - 1);
    if (bitacoraPagination.pageIndex > maxIndex) {
      setBitacoraPagination((p) => ({ ...p, pageIndex: maxIndex }));
    }
  }, [bitacoraDisplayPageCount, bitacoraPagination.pageIndex]);

  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [selectedDate, globalFilter]);

  useEffect(() => {
    const maxIndex = Math.max(0, displayPageCount - 1);
    if (pagination.pageIndex > maxIndex) {
      setPagination((p) => ({ ...p, pageIndex: maxIndex }));
    }
  }, [displayPageCount, pagination.pageIndex]);

  // Manejo de Modal y Eventos
  const addEvento = () => setEventos(e => [...e, { hora: '', descripcion: '' }]);
  const removeEvento = (i: number) => setEventos(e => e.filter((_, idx) => idx !== i));
  const updateEvento = (i: number, key: keyof EventoExtraccion, val: string) =>
    setEventos(e => e.map((x, idx) => idx === i ? { ...x, [key]: val } : x));
  const setFormField = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }));

  const openNew = () => {
    setEditItem(null);
    setForm({ ...emptyForm, fecha: selectedDate === 'todos' ? new Date().toISOString().slice(0, 10) : selectedDate });
    setEventos([]);
    setFormError(null);
    setShowModal(true);
  };

  const handleSave = () => {
    const sacosRaw = form.sacos_extraidos.trim();
    const sacosNum = sacosRaw === '' ? 0 : parseInt(sacosRaw, 10);
    if (isNaN(sacosNum) || sacosNum < 0) {
      setFormError('Los sacos extraídos no pueden ser negativos.');
      return;
    }

    setFormError(null);
    startTransition(async () => {
      const payload = {
        ...form,
        sacos_extraidos: sacosNum,
        eventos: eventos.length > 0 ? eventos : undefined,
        vertical: form.vertical || undefined,
        mina: resolveBibliotecaLabel(biblioteca, 'minas', form.mina) || undefined,
        responsable: form.responsable || undefined,
        hora_inicio: form.hora_inicio || undefined,
        hora_fin: form.hora_fin || undefined,
        numero_disparo: form.numero_disparo || undefined,
        observaciones: form.observaciones || undefined,
        registrado_por: user?.id,
      };

      let res;
      if (editItem) {
        res = await updateExtraccion({ ...payload, id: editItem.id });
      } else {
        res = await createExtraccion(payload);
      }

      if (res?.ok === false) {
        setFormError(res.message);
      } else {
        setShowModal(false);
        setEditItem(null);
        setForm({ ...emptyForm, fecha: selectedDate === 'todos' ? new Date().toISOString().slice(0, 10) : selectedDate });
        setEventos([]);
        if (!editItem) {
          setSelectedDate(form.fecha);
        }
      }
    });
  };

  // Exportar PDF
  const handleExportPDF = async () => {
    try {
      setIsExporting(true);
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;

      const doc = new jsPDF('landscape');
      const pageWidth = doc.internal.pageSize.getWidth();

      const visibleRows = table.getFilteredRowModel().rows.map(row => row.original);
      if (visibleRows.length === 0) {
        setIsExporting(false);
        return;
      }

      const dates = visibleRows.map(r => new Date(r.fecha + 'T12:00:00').getTime());
      const minDate = new Date(Math.min(...dates));
      const maxDate = new Date(Math.max(...dates));
      const formatD = (d: Date) => d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
      const dateStr = minDate.getTime() === maxDate.getTime() ? formatD(minDate) : `${formatD(minDate)} - ${formatD(maxDate)}`;

      // 1. Encabezado
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(24, 24, 27);
      doc.text('MINEOS - LA FE', 14, 22);

      doc.setFontSize(14);
      doc.setFont('helvetica', 'normal');
      doc.text('Reporte Gerencial de Extracción Mina', 14, 30);
      
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Período: ${dateStr} | Registros: ${visibleRows.length}`, 14, 36);

      // 2. Bloque de KPIs (Resumen Ejecutivo)
      doc.setFillColor(244, 244, 245);
      doc.roundedRect(14, 42, pageWidth - 28, 24, 3, 3, 'F');
      
      doc.setFontSize(9);
      doc.setTextColor(113, 113, 122);
      doc.text('Sacos Totales', 20, 50);
      doc.text('Disparos Totales', 80, 50);
      doc.text('Eventos Registrados', 140, 50);

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(24, 24, 27);
      doc.text(`${data.kpis.totalSacos.toLocaleString()}`, 20, 58);
      doc.text(`${data.kpis.totalDisparos.toLocaleString()}`, 80, 58);
      doc.text(`${data.kpis.totalEventos.toLocaleString()}`, 140, 58);

      // 3. Tabla de Datos
      const tableData = visibleRows.map(row => {
        const d = new Date(row.fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
        const turno = row.turno === 'dia' ? 'Día' : row.turno === 'noche' ? 'Noche' : 'Completo';
        const horario = `${formatTime12h(row.hora_inicio)} -> ${formatTime12h(row.hora_fin)}`;
        const disp = row.numero_disparo ? `N°${row.numero_disparo}` : '—';
        return [
          d, turno, row.vertical || '-', row.mina || '-', horario, disp, String(row.sacos_extraidos)
        ];
      });

      autoTable(doc, {
        startY: 72,
        head: [['Fecha', 'Turno', 'Vertical', 'Mina', 'Horario', 'Disparo', 'Sacos Extraídos']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [24, 24, 27], textColor: [255, 255, 255], halign: 'center', fontStyle: 'bold' },
        bodyStyles: { halign: 'center' },
        alternateRowStyles: { fillColor: [250, 250, 250] },
        styles: { fontSize: 8, cellPadding: 3 }
      });

      // 4. Pie de Página
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Generado: ${new Date().toLocaleString('es-ES')}`, 14, doc.internal.pageSize.getHeight() - 10);
        doc.text(`Página ${i} de ${pageCount}`, pageWidth - 30, doc.internal.pageSize.getHeight() - 10);
      }

      doc.save(`Extraccion_Gerencial_MineOS_${Date.now()}.pdf`);
    } catch (error) {
      console.error('Error al generar PDF:', error);
      alert('Hubo un error al generar el PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="extraccion-page produccion-page flex min-h-0 w-full flex-1 flex-col overflow-hidden">

      <FadeIn className="produccion-page__toolbar shrink-0 space-y-2">
        <div className="produccion-page__toolbar-grid grid grid-cols-1 gap-2 lg:grid-cols-12 lg:items-center lg:gap-4">
          <div className="produccion-page__toolbar-search min-w-0 lg:col-span-5">
            <div className="produccion-page__search produccion-surface produccion-surface--input flex h-9 min-w-0 w-full items-center rounded-lg px-3 py-2">
              <Search className="produccion-icon-muted mr-2 h-4 w-4 shrink-0" />
              <input
                type="text"
                placeholder="Buscar"
                value={globalFilter ?? ''}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="produccion-search-input w-full min-w-0 border-none bg-transparent text-sm outline-none"
              />
            </div>
          </div>
          <GerencialMobileKpiStrip
            className="lg:hidden lg:col-span-12"
            items={[
              { label: 'Sacos', value: fmtNum(data.kpis.totalSacos), tone: 'general', icon: Package },
              { label: 'Disparos', value: fmtNum(data.kpis.totalDisparos), tone: 'general', icon: Zap },
              { label: 'Eventos', value: fmtNum(data.kpis.totalEventos), tone: 'benefit', icon: Clock },
              { label: 'Sacos día', value: fmtNum(diaSacos), tone: 'general', icon: Package },
              { label: 'Disp. día', value: String(diaDisparos), tone: 'general', icon: Zap },
              { label: 'Registros', value: String(filteredRegistros.length), tone: 'general' },
            ]}
          />
          <div className="produccion-page__toolbar-actions flex min-w-0 flex-wrap items-stretch gap-2 sm:flex-nowrap lg:col-span-7">
            <button
              type="button"
              onClick={handleExportPDF}
              disabled={filteredCount === 0 || isExporting}
              className="produccion-page__toolbar-btn btn-secondary flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 px-2 text-xs disabled:opacity-40 lg:h-9 lg:flex-initial"
              title="Exportar PDF"
            >
              {isExporting ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : <Download className="h-3.5 w-3.5 shrink-0" />}
              <span className="hidden truncate lg:inline">{isExporting ? 'Generando...' : 'Exportar PDF'}</span>
              <span className="truncate lg:hidden">{isExporting ? '…' : 'PDF'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowBitacoraModal(true)}
              className="produccion-page__toolbar-btn btn-secondary flex h-8 w-9 shrink-0 items-center justify-center lg:hidden"
              title="Ver bitácora"
            >
              <Clock className="h-4 w-4 shrink-0" />
            </button>
            {canEdit && (
              <button
                type="button"
                onClick={openNew}
                className={`${MINEOS_BTN_GERENCIAL_NEW} flex h-8 min-w-0 flex-[1.2] lg:h-9 lg:w-auto lg:flex-initial`}
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span className="truncate">Nuevo Registro</span>
              </button>
            )}
          </div>
        </div>
      </FadeIn>

      <div className="produccion-page__grid min-h-0 flex-1 grid grid-cols-1 gap-2 lg:grid-cols-12 lg:gap-4">

         <div className="produccion-page__aside hidden min-h-0 flex-col gap-3 overflow-y-auto lg:col-span-5 lg:flex lg:h-full lg:overflow-hidden">

            <div className="grid flex-shrink-0 grid-cols-2 gap-3.5">
               <div className="produccion-surface gerencial-kpi-card rounded-xl p-4">
                  <div className="gerencial-kpi-glow gerencial-kpi-glow--amber" aria-hidden />
                  <div className="relative mb-2 flex items-center justify-between">
                     <span className="produccion-kpi-label text-[10px] font-bold uppercase tracking-wider">Sacos Totales</span>
                     <Package className="h-4 w-4 text-amber-500/50" />
                  </div>
                  <span className="gerencial-kpi-value gerencial-kpi-value--amber relative text-2xl font-black">{fmtNum(data.kpis.totalSacos)}</span>
               </div>
               <div className="produccion-surface gerencial-kpi-card rounded-xl p-4">
                  <div className="gerencial-kpi-glow gerencial-kpi-glow--amber" aria-hidden />
                  <div className="relative mb-2 flex items-center justify-between">
                     <span className="produccion-kpi-label text-[10px] font-bold uppercase tracking-wider">Disparos</span>
                     <Zap className="h-4 w-4 mineos-icon-general opacity-50" />
                  </div>
                  <span className="gerencial-kpi-value gerencial-kpi-value--amber relative text-2xl font-black">{fmtNum(data.kpis.totalDisparos)}</span>
               </div>
               <div className="produccion-surface gerencial-kpi-card col-span-2 flex flex-col gap-3 rounded-xl p-4">
                  <div className="gerencial-kpi-glow gerencial-kpi-glow--emerald" aria-hidden />
                  <div className="relative flex items-start justify-between gap-2">
                     <div>
                        <span className="produccion-kpi-label text-[10px] font-bold uppercase tracking-wider">Eventos en Bitácora</span>
                        <span className="gerencial-kpi-value gerencial-kpi-value--emerald mt-1 block text-2xl font-black">{fmtNum(data.kpis.totalEventos)}</span>
                     </div>
                     <Clock className="h-4 w-4 shrink-0 text-emerald-500/50" />
                  </div>
                  <button
                     type="button"
                     onClick={() => setShowBitacoraModal(true)}
                     className="btn-secondary h-8 w-full text-xs"
                  >
                     Ver Bitácora
                  </button>
               </div>
            </div>

            <div className="produccion-page__chart produccion-surface flex min-h-0 flex-1 flex-col rounded-xl p-4">
               <h2 className="produccion-section-title mb-4 flex items-center gap-2 text-sm font-bold">
                  <BarChart3 className="h-4 w-4 text-amber-500" /> Sacos Extraídos por Día
               </h2>
               <div className="relative w-full flex-1">
                  <ResponsiveContainer width="100%" height="100%" className="absolute inset-0">
                     <BarChart data={diariaChart} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="fecha" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} tickLine={false} axisLine={false}
                               tickFormatter={(val) => {
                                  const d = new Date(val + 'T12:00:00');
                                  return `${d.getDate()}`;
                               }} />
                        <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} tickLine={false} axisLine={false} />
                        <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                        <Bar dataKey="sacos" name="Sacos" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                     </BarChart>
                  </ResponsiveContainer>
               </div>
            </div>

         </div>

         <div className="gerencial-page__main produccion-page__main produccion-surface produccion-surface--panel flex min-h-0 flex-col overflow-hidden rounded-xl p-3 pt-2.5 lg:col-span-7 lg:h-full lg:p-4 lg:pt-3.5 lg:pl-5">

            <div className="produccion-page__day-tabs mb-2 flex shrink-0 items-center gap-1.5 overflow-x-auto pb-2 pt-0.5 snap-x w-full lg:mb-4 lg:gap-2.5 lg:pb-3">
               {diasConRegistros.length === 0 && (
                  <div className="produccion-muted text-xs italic">No hay registros en este período.</div>
               )}
               {diasConRegistros.length > 0 && (
                 <button
                   type="button"
                   onClick={() => setSelectedDate('todos')}
                   className={`produccion-day-pill snap-center flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-xs transition-all ${
                     selectedDate === 'todos' ? 'produccion-day-pill--active' : ''
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
                     className={`produccion-day-pill snap-center flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] transition-all lg:gap-2 lg:px-3.5 lg:py-2 lg:text-xs ${isSelected ? 'produccion-day-pill--active' : ''}`}
                   >
                     <span>{d.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' })}</span>
                     <span className={`produccion-day-pill__badge rounded-full px-1.5 py-0.5 text-[9px] font-black ${isSelected ? 'bg-black/20 text-black' : ''}`}>{dia.count}</span>
                   </button>
                 );
               })}
            </div>

            <div className="produccion-page__day-kpis mb-4 hidden shrink-0 grid-cols-3 gap-3 lg:grid">
              <div className="produccion-page__day-kpi produccion-surface produccion-surface--compact rounded-lg px-2 py-1.5">
                 <span className="produccion-kpi-label block text-[8px] font-bold uppercase leading-tight">
                   {selectedDate === 'todos' ? 'Sacos Totales' : 'Sacos Día'}
                 </span>
                 <span className="text-sm font-bold leading-tight text-amber-500">{fmtNum(diaSacos)}</span>
              </div>
              <div className="produccion-page__day-kpi produccion-surface produccion-surface--compact rounded-lg px-2 py-1.5">
                 <span className="produccion-kpi-label block text-[8px] font-bold uppercase leading-tight">
                   {selectedDate === 'todos' ? 'Disparos Totales' : 'Disparos Día'}
                 </span>
                 <span className="mineos-cell-general text-sm font-bold leading-tight">{diaDisparos}</span>
              </div>
              <div className="produccion-page__day-kpi produccion-surface produccion-surface--compact rounded-lg px-2 py-1.5">
                 <span className="produccion-kpi-label block text-[8px] font-bold uppercase leading-tight">Registros</span>
                 <span className="produccion-kpi-value text-sm font-bold leading-tight">{filteredRegistros.length}</span>
              </div>
            </div>

            <div className="produccion-page__table-stack min-h-0 flex-1">
              <div
                ref={tableBodyRef}
                className="produccion-page__table-body min-h-0 flex-1 overflow-x-auto overflow-y-auto custom-scrollbar"
              >
                <table className="w-full border-collapse text-left">
                  <thead className="produccion-page__table-head sticky top-0 z-10 shadow-sm">
                    {table.getHeaderGroups().map((hg) => (
                      <tr key={hg.id}>
                        {hg.headers.map((header) => (
                          <th
                            key={header.id}
                            onClick={header.column.getToggleSortingHandler()}
                            className={`produccion-table-th whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider ${header.column.getCanSort() ? 'cursor-pointer select-none' : ''}`}
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
                            icon={<Pickaxe className="h-6 w-6" />}
                            title="Día sin Extracción"
                            description="No hay reportes de extracción ingresados para este día."
                          />
                        </td>
                      </tr>
                    ) : (
                      pageRows.map((row) => (
                        <tr
                          key={row.id}
                          className={gerencialTableRowClassName}
                          onClick={() => setViewItem(row.original)}
                          onKeyDown={(event) => handleRowDetailKeyDown(event, row.original, setViewItem)}
                          tabIndex={0}
                          aria-label={`Ver detalle de extracción del ${fmtGerencialDate(row.original.fecha)}`}
                        >
                          {row.getVisibleCells().map((cell) => (
                            <td key={cell.id} className="produccion-table-td whitespace-nowrap px-4 py-2.5 text-xs">
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="produccion-page__table-footer gastos-footer-bar flex shrink-0 items-center justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0">
                  <span className="gastos-footer-label text-[8px] uppercase tracking-wider">Resumen</span>
                  <span className="produccion-page__footer-amount text-[11px] font-bold tabular-nums">
                    {fmtNum(tableSummary.sacos)} sacos
                  </span>
                  <span className="gastos-footer-label text-[9px]">·</span>
                  <span className="gastos-footer-label text-[9px] tabular-nums">{tableSummary.disparos} disparos</span>
                  <span className="gastos-footer-label text-[9px]">·</span>
                  <span className="gastos-footer-label text-[9px] tabular-nums">{tableSummary.eventos} eventos</span>
                  <span className="gastos-footer-label text-[9px]">· {tableSummary.count} reg.</span>
                </div>
                {filteredCount > 0 && (
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
                    <span className="gastos-footer-label ml-1 hidden text-[10px] tabular-nums sm:inline">
                      {activePageIndex + 1} / {displayPageCount}
                    </span>
                  </div>
                )}
              </div>
            </div>
         </div>

         <GerencialMobileChartFold title="Sacos extraídos por día" icon={BarChart3}>
           <div className="relative h-36 w-full">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={diariaChart} margin={{ top: 4, right: 0, left: -24, bottom: 0 }}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                 <XAxis
                   dataKey="fecha"
                   tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 8 }}
                   tickLine={false}
                   axisLine={false}
                   tickFormatter={(val) => {
                     const d = new Date(val + 'T12:00:00');
                     return `${d.getDate()}/${d.getMonth() + 1}`;
                   }}
                 />
                 <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 8 }} tickLine={false} axisLine={false} />
                 <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                 <Bar dataKey="sacos" name="Sacos" fill="#f59e0b" radius={[4, 4, 0, 0]} />
               </BarChart>
             </ResponsiveContainer>
           </div>
         </GerencialMobileChartFold>
      </div>

      <PageFormModal
        open={showBitacoraModal}
        onClose={() => setShowBitacoraModal(false)}
        sheetTitle="Bitácora de Eventos"
        sheetIcon={<SheetIconBadge icon={Clock} tone="info" />}
        panelClassName="sm:max-w-4xl"
      >
        <div className="mb-4 hidden items-center justify-between gap-3 lg:flex">
          <h2 className="page-form-modal-title text-lg font-semibold">Bitácora de Eventos</h2>
          <button
            type="button"
            onClick={() => setShowBitacoraModal(false)}
            className="rounded-lg p-2 text-[var(--dashboard-text-muted)] transition-colors hover:bg-black/[0.06]"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {bitacoraCount === 0 ? (
          <EmptyState
            icon={<Clock className="h-6 w-6" />}
            title="Sin eventos en bitácora"
            description="Los eventos se registran al crear o editar un reporte de extracción con Nuevo Registro."
          />
        ) : (
          <div
            className="produccion-page__table-stack mb-4 flex min-h-0 flex-col overflow-hidden"
            style={{ height: 'min(55vh, 26rem)' }}
          >
            <div
              ref={bitacoraTableBodyRef}
              className="produccion-page__table-body min-h-0 flex-1 overflow-x-auto overflow-y-auto custom-scrollbar"
            >
              <table className="w-full border-collapse text-left">
                <thead className="produccion-page__table-head sticky top-0 z-10 shadow-sm">
                  {bitacoraTable.getHeaderGroups().map((hg) => (
                    <tr key={hg.id}>
                      {hg.headers.map((header) => (
                        <th
                          key={header.id}
                          className="produccion-table-th whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {bitacoraPageRows.map((row) => (
                    <tr key={row.id} className="produccion-table-row border-b transition-colors">
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="produccion-table-td whitespace-nowrap px-4 py-2.5 text-xs">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="produccion-page__table-footer gastos-footer-bar flex shrink-0 items-center justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0">
                <span className="gastos-footer-label text-[8px] uppercase tracking-wider">Resumen</span>
                <span className="produccion-page__footer-amount text-[11px] font-bold tabular-nums">
                  {fmtNum(bitacoraSummary.total)} eventos
                </span>
                <span className="gastos-footer-label text-[9px]">·</span>
                <span className="gastos-footer-label text-[9px] tabular-nums">{bitacoraSummary.fechas} fechas</span>
                <span className="gastos-footer-label text-[9px]">·</span>
                <span className="gastos-footer-label text-[9px] tabular-nums">{bitacoraSummary.dia} día</span>
                <span className="gastos-footer-label text-[9px]">·</span>
                <span className="gastos-footer-label text-[9px] tabular-nums">{bitacoraSummary.noche} noche</span>
                <span className="gastos-footer-label text-[9px]">· {bitacoraSummary.reportes} reg.</span>
              </div>
              {bitacoraCount > 0 && (
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => bitacoraTable.previousPage()}
                    disabled={!bitacoraTable.getCanPreviousPage()}
                    className="gastos-page-btn rounded p-1 transition-colors disabled:opacity-30"
                    aria-label="Página anterior"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  {bitacoraPageNumbers.map((page) => (
                    <button
                      key={page}
                      type="button"
                      onClick={() => bitacoraTable.setPageIndex(page)}
                      aria-label={`Página ${page + 1}`}
                      aria-current={page === bitacoraActivePageIndex ? 'page' : undefined}
                      className={`gastos-page-btn min-w-[1.35rem] rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums transition-colors ${
                        page === bitacoraActivePageIndex ? 'gastos-page-btn--active' : ''
                      }`}
                    >
                      {page + 1}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => bitacoraTable.nextPage()}
                    disabled={!bitacoraTable.getCanNextPage()}
                    className="gastos-page-btn rounded p-1 transition-colors disabled:opacity-30"
                    aria-label="Página siguiente"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                  <span className="gastos-footer-label ml-1 hidden text-[10px] tabular-nums sm:inline">
                    {bitacoraActivePageIndex + 1} / {bitacoraDisplayPageCount}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        <PageFormModalFooter>
          <button type="button" onClick={() => setShowBitacoraModal(false)} className="btn-secondary">
            Cerrar
          </button>
        </PageFormModalFooter>
      </PageFormModal>

      <PageFormModal
        open={showModal}
        onClose={() => setShowModal(false)}
        sheetTitle={editItem ? 'Editar Reporte' : 'Nuevo Reporte de Extracción'}
        sheetIcon={<SheetIconBadge icon={Pickaxe} />}
        panelClassName="extraccion-page__modal sm:max-w-[72rem] sm:p-5"
      >
            <div className="mb-6 hidden items-center justify-between lg:flex">
              <h2 className="page-form-modal-title text-lg font-semibold">{editItem ? 'Editar Reporte' : 'Nuevo Reporte de Extracción'}</h2>
              <button type="button" onClick={() => setShowModal(false)} className="rounded-lg p-1.5 text-[var(--dashboard-text-muted)] transition-colors hover:bg-black/[0.06]"><X className="w-5 h-5" /></button>
            </div>

            {formError && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 mb-4 animate-in slide-in-from-top-2">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" /><span className="text-sm text-red-400">{formError}</span>
              </div>
            )}

            <div className="extraccion-page__modal-columns grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6">
              <section className="extraccion-page__modal-col flex flex-col gap-2.5">
                <h3 className="produccion-page__modal-col-title flex items-center gap-2 text-sm font-semibold text-amber-400">
                  <span>Identificación</span>
                  <span className="h-px flex-1 bg-amber-400/20" />
                </h3>
                <div><label className="input-label">Fecha *</label><AppDatePicker value={form.fecha} onChange={(val) => setFormField('fecha', val)} /></div>
                <div><label className="input-label">Turno *</label>
                  <AppSelect value={form.turno} onChange={(v) => setFormField('turno', v)} options={turnoOptions} />
                </div>
                <div><label className="input-label">Vertical</label>
                  <AppSelect value={form.vertical} onChange={(v) => setFormField('vertical', v)} options={verticalOptions} placeholder="— Sin especificar —" />
                </div>
                <div><label className="input-label">Mina</label>
                  <AppSelect value={form.mina} onChange={(v) => setFormField('mina', v)} options={minaOptions} placeholder="— Seleccionar mina —" />
                </div>
                <div><label className="input-label">Responsable</label><input value={form.responsable} onChange={e => setFormField('responsable', e.target.value)} className="input-field" /></div>
                <div><label className="input-label">Hora Inicio</label><AppTimePicker value={form.hora_inicio} onChange={(val) => setFormField('hora_inicio', val)} /></div>
                <div><label className="input-label">Hora Culmina</label><AppTimePicker value={form.hora_fin} onChange={(val) => setFormField('hora_fin', val)} /></div>
              </section>

              <section className="extraccion-page__modal-col flex flex-col gap-2.5">
                <div className="flex items-center gap-2">
                  <h3 className={mineosModalHeadingBetween('general')}>
                    <span>Eventos</span>
                    <span className={mineosModalDivider('general')} />
                  </h3>
                  <button type="button" onClick={addEvento} className={`${mineosBtnSubtleClass('general')} shrink-0`}>
                    <Plus className="h-3.5 w-3.5" /> Agregar
                  </button>
                </div>
                {eventos.length === 0 ? (
                  <p className="produccion-muted text-xs italic">Sin eventos. Agrega los hitos del turno.</p>
                ) : (
                  <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-0.5">
                    {eventos.map((ev, i) => (
                      <div key={i} className={`grid grid-cols-[minmax(0,7.25rem)_1fr_auto] gap-2 ${mineosPanel('neutral')}`}>
                        <div>
                          <label className={`${mineosLabelAccent('general')} !text-[10px] opacity-70`}>Hora</label>
                          <AppTimePicker value={ev.hora} onChange={(val) => updateEvento(i, 'hora', val)} className="!min-w-0" />
                        </div>
                        <div>
                          <label className={`${mineosLabelAccent('general')} !text-[10px] opacity-70`}>Descripción</label>
                          <input value={ev.descripcion} onChange={e => updateEvento(i, 'descripcion', e.target.value)}
                            placeholder="Ej: SE EMPIEZA SACAR MATERIAL A SACOS" className="input-field !py-1.5" />
                        </div>
                        <button type="button" onClick={() => removeEvento(i)} className="mt-5 rounded-lg p-1.5 text-[var(--dashboard-text-muted)] transition-colors hover:bg-red-500/15 hover:text-red-400">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="extraccion-page__modal-col flex flex-col gap-2.5">
                <h3 className="produccion-page__modal-col-title flex items-center gap-2 text-sm font-semibold text-emerald-400">
                  <span>Producción del Turno</span>
                  <span className="h-px flex-1 bg-emerald-400/20" />
                </h3>
                <div className="rounded-xl border border-amber-400/20 bg-amber-500/[0.07] p-3">
                  <label className="input-label !font-semibold !text-amber-400">Sacos Extraídos</label>
                  <input type="number" min={0} value={form.sacos_extraidos} onChange={e => setFormField('sacos_extraidos', e.target.value)} className="input-field text-lg font-bold" placeholder="0" />
                </div>
                <div><label className="input-label">N° Disparo</label><input value={form.numero_disparo} onChange={e => setFormField('numero_disparo', e.target.value)} placeholder="Ej: 27" className="input-field" /></div>
                <div className="flex min-h-0 flex-1 flex-col">
                  <label className="input-label">Observaciones del Turno</label>
                  <textarea value={form.observaciones} onChange={e => setFormField('observaciones', e.target.value)} className="input-field min-h-[7rem] flex-1 resize-y" rows={4}
                    placeholder="Ej: El turno nocturno inició 8:42 PM por la espera de camión..." />
                </div>
              </section>
            </div>

            <PageFormModalFooter className="flex-col-reverse sm:flex-row">
              <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
              <button type="button" onClick={handleSave} disabled={isPending} className="btn-primary disabled:opacity-40">
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {editItem ? 'Actualizar' : 'Registrar Turno'}
              </button>
            </PageFormModalFooter>
      </PageFormModal>

      <GerencialRecordDetailModal
        open={!!viewItem}
        onClose={() => setViewItem(null)}
        title={viewItem ? `Extracción · ${fmtGerencialDate(viewItem.fecha)}` : 'Detalle de extracción'}
        eyebrow="Detalle de extracción"
        sheetIcon={<SheetIconBadge icon={Pickaxe} />}
        panelClassName="extraccion-page__modal sm:max-w-[72rem] sm:p-5"
      >
        {viewItem ? <ExtraccionRecordDetail record={viewItem} /> : null}
      </GerencialRecordDetailModal>
    </div>
  );
}

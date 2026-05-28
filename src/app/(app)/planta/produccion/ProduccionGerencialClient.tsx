'use client';

import { useState, useTransition, useMemo, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useCanEdit } from '@/lib/use-can-edit';
import { createProduccion, updateProduccion, deleteProduccion } from '@/lib/actions/produccion';
import type { ReporteProduccion } from '@/lib/types';
import { downloadProduccionPDF, downloadBalanceRecuperacionPDF } from '@/lib/pdf-reports';
import {
  Loader2, Plus, X, Calculator, Download, AlertCircle, Search, TrendingUp, Factory,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { AppSelect } from '@/components/ui/AppSelect';
import { useBiblioteca, useBibliotecaOptions, useTurnoOptions } from '@/contexts/biblioteca-context';
import { mergeSuggestions } from '@/lib/biblioteca-catalog';
import { PageFormModal, PageFormModalFooter } from '@/components/ui/PageFormModal';
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
import { columns } from './columns';
import { FadeIn } from '@/components/ui/motion';
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer
} from 'recharts';

const PESO_SACO_KG = 50;
const fmtNum = (n: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 }).format(n);

const PRODUCCION_PAGE_MAX = 12;
const PRODUCCION_PAGE_BUTTONS_MAX = 5;
const PRODUCCION_ROW_MIN_PX = 40;
const PRODUCCION_HEAD_FALLBACK_PX = 40;

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
export interface ProduccionGerencialData {
  kpis: {
    oroRecuperado: number;
    toneladas: number;
    tenorPromedio: number;
    eficienciaMolino: number;
    cumplimientoOro: number;
    cumplimientoTon: number;
  };
  diaria: {
    fecha: string;
    oro: number;
    oroAcumulado: number;
    metaDiaria: number;
    metaAcumulada: number;
    tenor: number;
    toneladas: number;
  }[];
  eficienciaData: { name: string; value: number }[];
  registros: ReporteProduccion[];
}

export default function ProduccionGerencialClient({
  data,
  selectedDateStr,
  totalOroQuemado = 0,
  countQuemado = 0,
}: {
  data: ProduccionGerencialData;
  selectedDateStr: string;
  totalOroQuemado?: number;
  countQuemado?: number;
}) {
  const { user } = useAuth();
  const canEdit = useCanEdit();
  const turnoOptions = useTurnoOptions();
  const molinoSelectOptions = useBibliotecaOptions('planta_molinos');

  // For the Form
  const [selectedDate, setSelectedDate] = useState(selectedDateStr);
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: PRODUCCION_PAGE_MAX });
  const tableBodyRef = useRef<HTMLDivElement>(null);

  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<ReporteProduccion | null>(null);
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingBalance, setIsExportingBalance] = useState(false);

  const initialData = data.registros;

  const emptyForm = {
    fecha: selectedDate,
    turno: 'dia' as ReporteProduccion['turno'],
    molino: '',
    material: '',
    material_codigo: '',
    amalgama_1_g: '',
    amalgama_2_g: '',
    oro_recuperado_g: '',
    merma_1_pct: '',
    merma_2_pct: '',
    sacos: '',
    toneladas_procesadas: '',
    tenor_tonelada_gpt: '',
    tenor_saco_gps: '',
    responsable: '',
    observaciones: '',
  };
  const [form, setForm] = useState(emptyForm);

  const molinosSug = useMemo(() => Array.from(new Set(initialData.map(d => d.molino).filter(Boolean))), [initialData]);
  const materialesSug = useMemo(() => Array.from(new Set(initialData.map(d => d.material).filter(Boolean))), [initialData]);

  // 1. Selector Inteligente: Días con Registros
  const diasConRegistros = useMemo(() => {
     return data.diaria
       .filter((dia) => initialData.some((r) => r.fecha === dia.fecha))
       .sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [data.diaria, initialData]);

  // Si el día seleccionado no tiene registros, usar el más reciente
  useEffect(() => {
     if (diasConRegistros.length > 0 && !initialData.some((r) => r.fecha === selectedDate)) {
        setSelectedDate(diasConRegistros[0].fecha);
     }
  }, [diasConRegistros, initialData, selectedDate]);

  // 2. Filtrado para Vista Diaria (Tabla)
  const filteredRegistros = useMemo(() => initialData.filter(d => d.fecha === selectedDate), [initialData, selectedDate]);

  // 3. Cálculo de Mini KPIs para el Día Seleccionado
  const diaOro = filteredRegistros.reduce((acc, curr) => acc + (Number(curr.oro_recuperado_g) || 0), 0);
  const diaSacos = filteredRegistros.reduce((acc, curr) => acc + (Number(curr.sacos) || 0), 0);
  const diaToneladas = filteredRegistros.reduce((acc, curr) => acc + (Number(curr.toneladas_procesadas) || 0), 0);

  const updateCalcs = (updated: typeof form) => {
    const amalg1 = parseFloat(updated.amalgama_1_g) || 0;
    const amalg2 = parseFloat(updated.amalgama_2_g) || 0;
    const recup = parseFloat(updated.oro_recuperado_g) || 0;
    const sacos = parseFloat(updated.sacos) || 0;

    const autoTon = sacos > 0 ? (sacos * PESO_SACO_KG / 1000).toFixed(3) : '';
    const toneladas = updated.toneladas_procesadas || autoTon;
    const ton = parseFloat(toneladas) || 0;

    const merma1 = amalg1 > 0 && recup > 0 ? (((amalg1 - recup) / amalg1) * 100).toFixed(2) : '';
    const merma2 = amalg2 > 0 && recup > 0 ? (((amalg2 - recup) / amalg2) * 100).toFixed(2) : '';
    const tenorT = ton > 0 && recup > 0 ? (recup / ton).toFixed(4) : '';
    const tenorS = sacos > 0 && recup > 0 ? (recup / sacos).toFixed(4) : '';

    return { ...updated, toneladas_procesadas: toneladas, merma_1_pct: merma1, merma_2_pct: merma2, tenor_tonelada_gpt: tenorT, tenor_saco_gps: tenorS };
  };

  const handleFieldChange = (field: string, value: string) => {
    const updated = { ...form, [field]: value };
    if (['amalgama_1_g', 'amalgama_2_g', 'oro_recuperado_g', 'sacos', 'toneladas_procesadas'].includes(field)) {
      setForm(updateCalcs(updated));
    } else {
      setForm(updated);
    }
  };

  const handleSave = () => {
    const oroG = parseFloat(form.oro_recuperado_g);
    const sacosN = parseFloat(form.sacos);
    
    if (isNaN(oroG) || oroG < 0) { setFormError('El oro recuperado no puede ser negativo.'); return; }
    if (isNaN(sacosN) || sacosN < 0) { setFormError('Los sacos procesados no pueden ser negativos.'); return; }
    
    setFormError(null);
    startTransition(async () => {
      const payload = {
        ...form,
        amalgama_1_g: parseFloat(form.amalgama_1_g) || null,
        amalgama_2_g: parseFloat(form.amalgama_2_g) || null,
        oro_recuperado_g: parseFloat(form.oro_recuperado_g) || 0,
        merma_1_pct: parseFloat(form.merma_1_pct) || null,
        merma_2_pct: parseFloat(form.merma_2_pct) || null,
        sacos: parseFloat(form.sacos) || 0,
        toneladas_procesadas: parseFloat(form.toneladas_procesadas) || null,
        tenor_tonelada_gpt: parseFloat(form.tenor_tonelada_gpt) || null,
        tenor_saco_gps: parseFloat(form.tenor_saco_gps) || null,
        registrado_por: user?.id,
      };

      let res;
      if (editItem) {
        res = await updateProduccion({ ...payload, id: editItem.id });
      } else {
        res = await createProduccion(payload);
      }

      if (res?.ok === false) {
        setFormError(res.message);
      } else {
        setShowModal(false);
        setEditItem(null);
        setForm({ ...emptyForm, fecha: selectedDate });
      }
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm('¿Eliminar este registro de producción?')) return;
    startTransition(async () => {
      await deleteProduccion(id);
    });
  };

  const openEdit = (item: ReporteProduccion) => {
    setEditItem(item);
    setForm({
      fecha: item.fecha, turno: item.turno, molino: item.molino, material: item.material,
      material_codigo: item.material_codigo || '',
      amalgama_1_g: item.amalgama_1_g ? String(item.amalgama_1_g) : '',
      amalgama_2_g: item.amalgama_2_g ? String(item.amalgama_2_g) : '',
      oro_recuperado_g: String(item.oro_recuperado_g),
      merma_1_pct: item.merma_1_pct ? String(item.merma_1_pct) : '',
      merma_2_pct: item.merma_2_pct ? String(item.merma_2_pct) : '',
      sacos: String(item.sacos),
      toneladas_procesadas: item.toneladas_procesadas ? String(item.toneladas_procesadas) : '',
      tenor_tonelada_gpt: item.tenor_tonelada_gpt ? String(item.tenor_tonelada_gpt) : '',
      tenor_saco_gps: item.tenor_saco_gps ? String(item.tenor_saco_gps) : '',
      responsable: item.responsable || '', observaciones: item.observaciones || '',
    });
    setFormError(null);
    setShowModal(true);
  };

  const table = useReactTable({
    data: filteredRegistros,
    columns: columns((item) => openEdit(item), (id) => handleDelete(id)),
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
    const headH = el.querySelector('thead')?.getBoundingClientRect().height ?? PRODUCCION_HEAD_FALLBACK_PX;
    const bodyAvailable = el.clientHeight - headH;
    const pageRows = Math.min(
      PRODUCCION_PAGE_MAX,
      Math.max(1, Math.floor(bodyAvailable / PRODUCCION_ROW_MIN_PX)),
    );
    setPagination((prev) => (prev.pageSize === pageRows ? prev : { ...prev, pageSize: pageRows }));
  }, []);

  const filteredCount = table.getFilteredRowModel().rows.length;
  const pageCount = table.getPageCount();
  const displayPageCount = Math.max(1, pageCount);
  const pageIndex = Math.min(pagination.pageIndex, Math.max(0, displayPageCount - 1));
  const activePageIndex = filteredCount === 0 ? 0 : pageIndex;
  const pageWindowStart =
    Math.floor(activePageIndex / PRODUCCION_PAGE_BUTTONS_MAX) * PRODUCCION_PAGE_BUTTONS_MAX;
  const pageNumbers = useMemo(() => {
    const len = Math.min(PRODUCCION_PAGE_BUTTONS_MAX, Math.max(0, displayPageCount - pageWindowStart));
    if (len === 0) return [0];
    return Array.from({ length: len }, (_, i) => pageWindowStart + i);
  }, [displayPageCount, pageWindowStart]);

  const tableSummary = useMemo(() => {
    const rows = table.getFilteredRowModel().rows;
    return {
      oro: rows.reduce((s, r) => s + (Number(r.original.oro_recuperado_g) || 0), 0),
      sacos: rows.reduce((s, r) => s + (Number(r.original.sacos) || 0), 0),
      ton: rows.reduce((s, r) => s + (Number(r.original.toneladas_procesadas) || 0), 0),
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
    return () => ro.disconnect();
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

  const eficienciaNum = Number(data.kpis.eficienciaMolino) || 0;
  const strokeDasharray = 283; // 2 * Math.PI * 45
  const strokeDashoffset = strokeDasharray - (strokeDasharray * eficienciaNum) / 100;

  const handleExportPDF = async () => {
    try {
      setIsExporting(true);
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;

      const doc = new jsPDF('landscape');
      const pageWidth = doc.internal.pageSize.getWidth();

      // Datos visibles
      const visibleRows = table.getFilteredRowModel().rows.map(row => row.original);
      if (visibleRows.length === 0) {
        setIsExporting(false);
        return;
      }

      // Rango de fechas de los datos visibles
      const dates = visibleRows.map(r => new Date(r.fecha + 'T12:00:00').getTime());
      const minDate = new Date(Math.min(...dates));
      const maxDate = new Date(Math.max(...dates));
      const formatD = (d: Date) => d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
      const dateStr = minDate.getTime() === maxDate.getTime() ? formatD(minDate) : `${formatD(minDate)} - ${formatD(maxDate)}`;

      // 1. Encabezado
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(24, 24, 27); // Zinc-950
      doc.text('MINEOS - LA FE', 14, 22);

      doc.setFontSize(14);
      doc.setFont('helvetica', 'normal');
      doc.text('Reporte Gerencial de Producción Planta', 14, 30);
      
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Período: ${dateStr} | Registros: ${visibleRows.length}`, 14, 36);

      // 2. Bloque de KPIs (Resumen Ejecutivo)
      doc.setFillColor(244, 244, 245); // Zinc-100 bg
      doc.roundedRect(14, 42, pageWidth - 28, 24, 3, 3, 'F');
      
      doc.setFontSize(9);
      doc.setTextColor(113, 113, 122); // Zinc-500
      doc.text('Oro Total Recuperado', 20, 50);
      doc.text('Toneladas Totales', 80, 50);
      doc.text('Tenor Promedio', 140, 50);
      doc.text('Eficiencia Operativa', 200, 50);

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(24, 24, 27);
      doc.text(`${fmtNum(data.kpis.oroRecuperado)} g`, 20, 58);
      doc.text(`${fmtNum(data.kpis.toneladas)} T`, 80, 58);
      doc.text(`${fmtNum(data.kpis.tenorPromedio)} g/T`, 140, 58);
      doc.text(`${data.kpis.eficienciaMolino.toFixed(1)}%`, 200, 58);

      // 3. Tabla de Datos
      const tableData = visibleRows.map(row => [
        new Date(row.fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
        row.turno === 'dia' ? 'Día' : row.turno === 'noche' ? 'Noche' : 'Completo',
        row.molino || '-',
        row.material || '-',
        `${row.amalgama_1_g || 0} / ${row.amalgama_2_g || 0}`,
        Number(row.oro_recuperado_g).toFixed(2),
        `${row.merma_1_pct || 0}% / ${row.merma_2_pct || 0}%`
      ]);

      autoTable(doc, {
        startY: 72,
        head: [['Fecha', 'Turno', 'Molino', 'Material', 'Amalgamas (1 / 2)', 'Au Recup (g)', 'Mermas (1 / 2)']],
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

      doc.save(`Produccion_Gerencial_MineOS_${Date.now()}.pdf`);
    } catch (error) {
      console.error('Error al generar PDF:', error);
      alert('Hubo un error al generar el PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportBalance = async () => {
    try {
      setIsExportingBalance(true);
      // Usar TODOS los registros del período (no solo el día seleccionado)
      const todosLosRegistros = initialData;
      if (todosLosRegistros.length === 0) return;

      const dates = todosLosRegistros.map(r => new Date(r.fecha + 'T12:00:00').getTime());
      const minDate = new Date(Math.min(...dates));
      const maxDate = new Date(Math.max(...dates));
      const fmt = (d: Date) => d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
      const label = minDate.getTime() === maxDate.getTime()
        ? fmt(minDate)
        : `${fmt(minDate)} al ${fmt(maxDate)}`;

      downloadBalanceRecuperacionPDF(todosLosRegistros, label, totalOroQuemado, countQuemado);
    } catch (err) {
      console.error('Error al generar Balance PDF:', err);
      alert('Error al generar el Balance de Recuperación.');
    } finally {
      setIsExportingBalance(false);
    }
  };

  return (
    <div className="produccion-page flex min-h-0 w-full flex-1 flex-col overflow-hidden">

      <FadeIn className="produccion-page__toolbar shrink-0">
        <div className="produccion-page__toolbar-grid grid grid-cols-1 gap-3 lg:grid-cols-12 lg:items-center lg:gap-4">
          <div className="produccion-page__toolbar-search min-w-0 lg:col-span-5">
            <div className="produccion-page__search produccion-surface produccion-surface--input flex w-full min-w-0 items-center rounded-lg px-3 py-2">
              <Search className="produccion-icon-muted mr-2 h-4 w-4 shrink-0" />
              <input
                type="text"
                placeholder="Buscar reporte por molino o material..."
                value={globalFilter ?? ''}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="produccion-search-input w-full min-w-0 border-none bg-transparent text-sm outline-none"
              />
            </div>
          </div>
          <div className="produccion-page__toolbar-actions flex min-w-0 flex-wrap items-stretch gap-2 sm:flex-nowrap lg:col-span-7">
            <button
              onClick={handleExportPDF}
              disabled={table.getFilteredRowModel().rows.length === 0 || isExporting}
              className="produccion-page__toolbar-btn btn-secondary flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 px-2 text-xs disabled:opacity-40"
              title="Exportar PDF"
            >
              {isExporting ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : <Download className="h-3.5 w-3.5 shrink-0" />}
              <span className="truncate">{isExporting ? 'Generando...' : 'Exportar PDF'}</span>
            </button>
            <button
              onClick={handleExportBalance}
              disabled={initialData.length === 0 || isExportingBalance}
              title="Balance de recuperación por origen: Vertical 1/2/3, Mantenimiento, Repaso, Molino Continuo"
              className="produccion-page__toolbar-btn produccion-page__balance-btn flex h-9 min-w-0 flex-1 items-center justify-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2 text-xs font-semibold text-amber-400 transition-colors hover:bg-amber-500/20 disabled:opacity-40"
            >
              {isExportingBalance ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Calculator className="h-4 w-4 shrink-0" />}
              <span className="truncate">{isExportingBalance ? 'Calculando...' : 'Balance de recuperación'}</span>
            </button>
            {canEdit && (
              <button
                onClick={() => {
                  setEditItem(null);
                  setForm({ ...emptyForm, fecha: selectedDate });
                  setFormError(null);
                  setShowModal(true);
                }}
                className="produccion-page__toolbar-btn flex h-9 min-w-0 flex-1 items-center justify-center gap-2 rounded-lg bg-amber-600 px-3 font-bold text-black shadow-lg shadow-amber-900/20 transition-colors hover:bg-amber-500"
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span className="truncate">Nuevo Registro</span>
              </button>
            )}
          </div>
        </div>
      </FadeIn>

      {/* ── Split Screen Layout (Grid 12) ── */}
      <div className="produccion-page__grid min-h-0 flex-1 grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-4">
         
         {/* PANEL IZQUIERDO (BI y KPIs) */}
         <div className="produccion-page__aside flex min-h-0 flex-col gap-3 overflow-y-auto lg:col-span-5 lg:h-full lg:overflow-hidden">
            
            {/* KPI Grid 2x2 */}
            <div className="grid grid-cols-2 gap-3.5 flex-shrink-0">
               <div className="produccion-surface gerencial-kpi-card rounded-xl p-4">
                  <div className="gerencial-kpi-glow gerencial-kpi-glow--amber" aria-hidden />
                  <div className="relative mb-2 flex items-center gap-2">
                     <span className="produccion-kpi-label text-[10px] font-bold uppercase tracking-wider">Oro Total</span>
                  </div>
                  <div className="relative flex items-baseline gap-1">
                     <span className="gerencial-kpi-value gerencial-kpi-value--amber text-2xl font-black">{fmtNum(data.kpis.oroRecuperado)}</span>
                     <span className="produccion-kpi-unit text-[10px] font-mono text-amber-500/80">g</span>
                  </div>
                  <div className="relative mt-1 text-[10px] font-semibold text-amber-500/90">
                     {data.kpis.cumplimientoOro >= 0 ? '+' : ''}{data.kpis.cumplimientoOro.toFixed(1)}% vs Meta
                  </div>
               </div>

               <div className="produccion-surface gerencial-kpi-card rounded-xl p-4">
                  <div className="gerencial-kpi-glow gerencial-kpi-glow--blue" aria-hidden />
                  <div className="relative mb-2 flex items-center gap-2">
                     <span className="produccion-kpi-label text-[10px] font-bold uppercase tracking-wider">Ton. Molidas</span>
                  </div>
                  <div className="relative flex items-baseline gap-1">
                     <span className="gerencial-kpi-value gerencial-kpi-value--blue text-2xl font-black">{fmtNum(data.kpis.toneladas)}</span>
                     <span className="produccion-kpi-unit text-[10px] font-mono text-blue-400/80">T</span>
                  </div>
               </div>

               <div className="produccion-surface gerencial-kpi-card rounded-xl p-4">
                  <div className="gerencial-kpi-glow gerencial-kpi-glow--cyan" aria-hidden />
                  <div className="relative mb-2 flex items-center gap-2">
                     <span className="produccion-kpi-label text-[10px] font-bold uppercase tracking-wider">Tenor Prom.</span>
                  </div>
                  <div className="relative flex items-baseline gap-1">
                     <span className="gerencial-kpi-value gerencial-kpi-value--cyan text-2xl font-black">{fmtNum(data.kpis.tenorPromedio)}</span>
                     <span className="produccion-kpi-unit text-[10px] font-mono text-cyan-400/80">g/T</span>
                  </div>
               </div>

               <div className="produccion-surface gerencial-kpi-card relative flex items-center justify-between overflow-hidden rounded-xl p-4">
                  <div className="gerencial-kpi-glow gerencial-kpi-glow--amber" aria-hidden />
                  <div className="relative">
                     <span className="produccion-kpi-label mb-2 block text-[10px] font-bold uppercase tracking-wider">Eficiencia</span>
                     <span className="gerencial-kpi-value gerencial-kpi-value--amber text-2xl font-black">{data.kpis.eficienciaMolino.toFixed(1)}%</span>
                  </div>
                  <div
                    className="produccion-efficiency-ring relative h-16 w-16"
                    title={`Días con producción en el período: ${eficienciaNum.toFixed(1)}%`}
                    aria-label={`Eficiencia operativa ${eficienciaNum.toFixed(1)} por ciento`}
                  >
                     <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img">
                        <circle cx="50" cy="50" r="45" fill="none" className="produccion-efficiency-ring__track" strokeWidth="10" />
                        <circle
                          cx="50"
                          cy="50"
                          r="45"
                          fill="none"
                          className="produccion-efficiency-ring__progress transition-all duration-700 ease-out"
                          strokeWidth="10"
                          strokeLinecap="butt"
                          strokeDasharray={strokeDasharray}
                          strokeDashoffset={strokeDashoffset}
                        />
                     </svg>
                  </div>
               </div>
            </div>

            {/* Gráfico de Área Compacto */}
            <div className="produccion-page__chart produccion-surface flex min-h-0 flex-1 flex-col rounded-xl p-4">
               <h2 className="produccion-section-title font-bold text-sm mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-amber-500" /> Producción Real vs. Meta
               </h2>
               <div className="flex-1 w-full relative">
                  <ResponsiveContainer width="100%" height="100%" className="absolute inset-0">
                     <ComposedChart data={data.diaria} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
                        <defs>
                          <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#DAA520" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#DAA520" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="fecha" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} tickLine={false} axisLine={false} 
                               tickFormatter={(val) => {
                                  const d = new Date(val + 'T12:00:00');
                                  return `${d.getDate()}`;
                               }} />
                        <YAxis yAxisId="left" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} tickLine={false} axisLine={false} />
                        
                        <RechartsTooltip content={<CustomTooltip />} />
                        
                        <Area yAxisId="left" type="monotone" dataKey="oroAcumulado" name="Prod. Acumulada" fill="url(#goldGradient)" stroke="#DAA520" strokeWidth={2} />
                        <Line yAxisId="left" type="monotone" dataKey="metaDiaria" name="Meta Diaria" stroke="#DAA520" strokeWidth={1} dot={false} activeDot={false} />
                        <Line yAxisId="left" type="monotone" dataKey="metaAcumulada" name="Meta Acumulada" stroke="rgba(255,255,255,0.2)" strokeDasharray="4 4" strokeWidth={1.5} dot={false} />
                     </ComposedChart>
                  </ResponsiveContainer>
               </div>
            </div>

         </div>

         {/* PANEL DERECHO (Operativo / Tabla) */}
         <div className="produccion-page__main produccion-surface produccion-surface--panel flex min-h-0 flex-col overflow-hidden rounded-xl p-4 pt-3.5 lg:col-span-7 lg:h-full lg:pl-5">
            
            {/* 1. Selector de Días (más reciente → más antiguo) */}
            <div className="produccion-page__day-tabs mb-4 flex shrink-0 items-center gap-2.5 overflow-x-auto pb-3 pt-0.5 snap-x w-full">
               {diasConRegistros.length === 0 && (
                  <div className="produccion-muted text-xs italic">No hay registros en este período.</div>
               )}
               {diasConRegistros.map((dia) => {
                 const d = new Date(dia.fecha + 'T12:00:00');
                 const isSelected = selectedDate === dia.fecha;
                 const dRegs = initialData.filter(r => r.fecha === dia.fecha).length;
                 
                 return (
                   <button 
                     key={dia.fecha} 
                     onClick={() => setSelectedDate(dia.fecha)}
                     className={`produccion-day-pill snap-center flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-xs transition-all ${isSelected ? 'produccion-day-pill--active bg-amber-500 border-amber-500 text-black font-bold' : ''}`}
                   >
                     <span>{d.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' })}</span>
                     <span className={`produccion-day-pill__badge px-1.5 py-0.5 rounded-full text-[9px] font-black ${isSelected ? 'bg-black/20 text-black' : ''}`}>{dRegs}</span>
                   </button>
                 )
               })}
            </div>

            {/* 2. Mini KPIs del día */}
            <div className="produccion-page__day-kpis mb-4 grid shrink-0 grid-cols-4 gap-3">
              <div className="produccion-page__day-kpi produccion-surface produccion-surface--compact rounded-lg px-2 py-1.5">
                 <span className="produccion-kpi-label block text-[8px] font-bold uppercase leading-tight">Oro Día</span>
                 <span className="text-sm font-bold leading-tight text-amber-500">{fmtNum(diaOro)}</span>
              </div>
              <div className="produccion-page__day-kpi produccion-surface produccion-surface--compact rounded-lg px-2 py-1.5">
                 <span className="produccion-kpi-label block text-[8px] font-bold uppercase leading-tight">Sacos Día</span>
                 <span className="produccion-kpi-value text-sm font-bold leading-tight">{fmtNum(diaSacos)}</span>
              </div>
              <div className="produccion-page__day-kpi produccion-surface produccion-surface--compact rounded-lg px-2 py-1.5">
                 <span className="produccion-kpi-label block text-[8px] font-bold uppercase leading-tight">Ton. Día</span>
                 <span className="produccion-kpi-value text-sm font-bold leading-tight">{fmtNum(diaToneladas)}</span>
              </div>
              <div className="produccion-page__day-kpi produccion-surface produccion-surface--compact rounded-lg px-2 py-1.5">
                 <span className="produccion-kpi-label block text-[8px] font-bold uppercase leading-tight">Registros</span>
                 <span className="produccion-kpi-value text-sm font-bold leading-tight">{filteredRegistros.length}</span>
              </div>
            </div>

            {/* Tabla + resumen + paginación */}
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
                            icon={<Factory className="h-6 w-6" />}
                            title="Día sin Producción"
                            description="No hay reportes de amalgama ingresados para este día."
                          />
                        </td>
                      </tr>
                    ) : (
                      <>
                        {pageRows.map((row) => (
                          <tr key={row.id} className="produccion-table-row border-b transition-colors">
                            {row.getVisibleCells().map((cell) => (
                              <td key={cell.id} className="produccion-table-td whitespace-nowrap px-4 py-2.5 text-xs">
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
                  <span className="produccion-page__footer-amount--oro text-[11px] font-bold tabular-nums">
                    {fmtNum(tableSummary.oro)} g Au
                  </span>
                  <span className="gastos-footer-label text-[9px]">·</span>
                  <span className="gastos-footer-label text-[9px] tabular-nums">
                    {fmtNum(tableSummary.sacos)} sacos
                  </span>
                  <span className="gastos-footer-label text-[9px]">·</span>
                  <span className="gastos-footer-label text-[9px] tabular-nums">
                    {fmtNum(tableSummary.ton)} T
                  </span>
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
      </div>

      <PageFormModal
        open={showModal}
        onClose={() => { setShowModal(false); setFormError(null); }}
        panelClassName="produccion-page__modal sm:max-w-[72rem] sm:p-5"
      >
            <div className="mb-3 flex justify-center sm:hidden"><div className="h-1 w-8 rounded-full bg-[var(--dashboard-border)]" /></div>
            <div className="mb-3 flex items-center justify-between sm:mb-3">
              <h2 className="page-form-modal-title text-lg font-semibold">{editItem ? 'Editar Registro' : 'Nuevo Reporte de Producción'}</h2>
              <button type="button" onClick={() => { setShowModal(false); setFormError(null); }} className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg p-2 text-[var(--dashboard-text-muted)] transition-colors hover:bg-black/[0.06]"><X className="h-5 w-5" /></button>
            </div>

            {formError && (
              <div className="mb-3 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 animate-in slide-in-from-top-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-400" /><span className="text-sm text-red-400">{formError}</span>
              </div>
            )}

            <div className="produccion-page__modal-columns grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6">
              {/* Columna 1 — Datos del reporte */}
              <section className="produccion-page__modal-col produccion-page__modal-col--datos flex flex-col gap-2.5">
                <h3 className="produccion-page__modal-col-title produccion-modal-title text-sm font-semibold">Datos del reporte</h3>
                <div><label className="input-label">Fecha *</label><input type="date" value={form.fecha} onChange={e => handleFieldChange('fecha', e.target.value)} className="input-field" /></div>
                <div><label className="input-label">Turno *</label>
                  <AppSelect value={form.turno} onChange={(v) => handleFieldChange('turno', v)} options={turnoOptions} />
                </div>
                <div><label className="input-label">Molino *</label>
                  <AppSelect value={form.molino} onChange={(v) => handleFieldChange('molino', v)} options={molinoSelectOptions.length ? molinoSelectOptions : molinosSug.map((m) => ({ value: m, label: m }))} placeholder="— Seleccionar molino —" />
                </div>
                <div><label className="input-label">Material / Mina de Origen *</label><input list="materiales-list" value={form.material} onChange={e => handleFieldChange('material', e.target.value)} className="input-field" placeholder="Escribir material o mina..." /><datalist id="materiales-list">{materialesSug.map(m => <option key={m} value={m} />)}</datalist></div>
                <div><label className="input-label">Código Lote/Veta</label><input value={form.material_codigo} onChange={e => handleFieldChange('material_codigo', e.target.value)} className="input-field" placeholder="V-2D19" /></div>
              </section>

              {/* Columna 2 — Amalgamación */}
              <section className="produccion-page__modal-col produccion-page__modal-col--amalg flex flex-col gap-2.5">
                <h3 className="produccion-page__modal-col-title flex items-center gap-2 text-sm font-semibold text-amber-400">
                  <span>⚗️ Amalgamación</span>
                  <span className="h-px flex-1 bg-amber-400/20" />
                </h3>
                <div><label className="input-label">Amalgama 1 (g)</label><input type="number" step="0.01" value={form.amalgama_1_g} onChange={e => handleFieldChange('amalgama_1_g', e.target.value)} className="input-field" placeholder="23.00" /></div>
                <div><label className="input-label">Amalgama 2 (g)</label><input type="number" step="0.01" value={form.amalgama_2_g} onChange={e => handleFieldChange('amalgama_2_g', e.target.value)} className="input-field" placeholder="22.90" /></div>
                <div><label className="input-label">Oro Recuperado (g Au) *</label><input type="number" step="0.0001" value={form.oro_recuperado_g} onChange={e => handleFieldChange('oro_recuperado_g', e.target.value)} className="input-field" placeholder="10.90" required /></div>
              <div><label className="input-label flex items-center gap-1"><Calculator className="h-3.5 w-3.5" /> Merma 1 (%)</label><input type="text" value={form.merma_1_pct ? `${form.merma_1_pct}%` : '—'} readOnly className="input-field produccion-field-readonly cursor-not-allowed" /></div>
              <div><label className="input-label flex items-center gap-1"><Calculator className="h-3.5 w-3.5" /> Merma 2 (%)</label><input type="text" value={form.merma_2_pct ? `${form.merma_2_pct}%` : '—'} readOnly className="input-field produccion-field-readonly cursor-not-allowed" /></div>
              </section>

              {/* Columna 3 — Producción */}
              <section className="produccion-page__modal-col produccion-page__modal-col--prod flex flex-col gap-2.5">
                <h3 className="produccion-page__modal-col-title flex items-center gap-2 text-sm font-semibold text-blue-400">
                  <span>📦 Producción</span>
                  <span className="h-px flex-1 bg-blue-400/20" />
                </h3>
                <div>
                  <label className="input-label">Sacos * <span className="font-normal text-amber-400/70">(50 kg)</span></label>
                  <input type="number" inputMode="decimal" value={form.sacos} onChange={e => handleFieldChange('sacos', e.target.value)} className="input-field" placeholder="39" />
                  {parseFloat(form.sacos) > 0 && (
                    <p className="produccion-page__sacos-hint produccion-muted mt-0.5 text-[11px]">
                      {parseFloat(form.sacos)} sacos × 50 kg = <span className="font-semibold text-amber-400/60">{(parseFloat(form.sacos) * PESO_SACO_KG).toFixed(1)} kg</span>
                    </p>
                  )}
                </div>
                <div><label className="input-label">Ton. Procesadas <span className="produccion-muted font-normal">(auto)</span></label><input type="number" step="0.001" value={form.toneladas_procesadas} onChange={e => handleFieldChange('toneladas_procesadas', e.target.value)} className="input-field" placeholder="1.950" /></div>
                <div><label className="input-label">Responsable</label><input value={form.responsable} onChange={e => handleFieldChange('responsable', e.target.value)} className="input-field" /></div>
                <div><label className="input-label flex items-center gap-1"><Calculator className="h-3.5 w-3.5" /> Tenor (g/t)</label><input type="text" value={form.tenor_tonelada_gpt || '—'} readOnly className="input-field produccion-field-readonly produccion-field-readonly--tenor cursor-not-allowed font-semibold" /></div>
                <div><label className="input-label flex items-center gap-1"><Calculator className="h-3.5 w-3.5" /> Tenor (g/s)</label><input type="text" value={form.tenor_saco_gps || '—'} readOnly className="input-field produccion-field-readonly produccion-field-readonly--accent cursor-not-allowed font-semibold" /></div>
              </section>
            </div>

            <PageFormModalFooter className="produccion-page__modal-footer flex-col-reverse sm:flex-row">
              <button type="button" onClick={() => { setShowModal(false); setFormError(null); }} className="btn-secondary min-h-[48px] sm:min-h-[40px]">Cancelar</button>
              <button type="button" onClick={handleSave} disabled={isPending || !form.molino || !form.material || !form.oro_recuperado_g} className="btn-primary min-h-[48px] sm:min-h-[40px]">
                {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {editItem ? 'Actualizar' : 'Registrar Producción'}
              </button>
            </PageFormModalFooter>
      </PageFormModal>

    </div>
  );
}

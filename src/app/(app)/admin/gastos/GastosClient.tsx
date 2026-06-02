'use client';

import { useState, useTransition, useMemo, useEffect, useRef, useCallback } from 'react';
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
  Download, Tag, FileText, ChevronLeft, ChevronRight,
  Receipt, Wallet, BarChart3, FileDown, Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Gasto, CategoriaGasto } from '@/lib/types';
import EmptyState from '@/components/EmptyState';
import { useAuth } from '@/lib/auth-context';
import { useCanEdit } from '@/lib/use-can-edit';
import { createGasto, updateGasto, deleteGasto, getOrCreateCategoria, upsertGastoConcepto } from '@/lib/actions/gastos';
import { PageFormModal, PageFormModalFooter } from '@/components/ui/PageFormModal';
import { AppCombobox } from '@/components/ui/AppCombobox';
import { AppSelect } from '@/components/ui/AppSelect';
import { getGastoColumns, gastoGlobalFilter } from './columns';
import { GastoDetailCard } from './GastoDetailCard';

// ── Helpers ──────────────────────────────────────────────────
interface GastosClientProps {
  data:       Gasto[];
  categorias: CategoriaGasto[];
  registradoPorLabels: Record<string, string>;
  conceptos?: any[];
}

const EMPTY_FORM = {
  fecha:              new Date().toISOString().split('T')[0],
  categoria_nombre:   '',
  descripcion:        '',
  monto:              '',
  proveedor:          '',
  factura_referencia: '',
  notas:              '',
  guardar_en_catalogo: false,
};

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

const fmtShort = (n: number) => {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return fmt(n);
};

const GASTOS_PAGE_MAX = 15;
const GASTOS_ROW_MIN_PX = 32;
const GASTOS_HEAD_FALLBACK_PX = 32;

function filterPillClass(active: boolean, tone: 'month' | 'category') {
  const base =
    'gastos-filter-pill rounded-md border px-2 py-[3px] text-[9px] font-bold leading-tight transition-colors';
  if (!active) return `${base} gastos-filter-pill--idle`;
  return `${base} ${tone === 'month' ? 'gastos-filter-pill--month' : 'gastos-filter-pill--cat'}`;
}

// Colores por categoría para el gráfico
const CAT_COLORS = [
  '#DAA520', '#FB923C', '#34D399', '#60A5FA', '#A78BFA',
  '#F472B6', '#FBBF24', '#4ADE80', '#38BDF8', '#E879F9',
];

// Helper: hex a RGB para jsPDF
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? { r: parseInt(r[1], 16), g: parseInt(r[2], 16), b: parseInt(r[3], 16) } : null;
}

// ─────────────────────────────────────────────────────────────
export default function GastosClient({ data, categorias, registradoPorLabels, conceptos }: GastosClientProps) {
  const { user }  = useAuth();
  const canEdit   = useCanEdit();
  const [isPending, startTransition] = useTransition();

  const [showModal, setShowModal] = useState(false);
  const [editItem,  setEditItem]  = useState<Gasto | null>(null);
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [sorting,   setSorting]   = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(''); 
  const [selectedCategory, setSelectedCategory] = useState('');
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: GASTOS_PAGE_MAX });
  const [detailId, setDetailId] = useState<string | null>(null);
  const tableBodyRef = useRef<HTMLDivElement>(null);

  const toggleDetail = useCallback((id: string) => {
    setDetailId(prev => (prev === id ? null : id));
  }, []);

  // ── Meses disponibles (sobre TODOS los datos) ─────────────
  const meses = useMemo(() => {
    const set = new Set<string>();
    data.forEach(g => set.add(g.fecha.slice(0, 7)));
    return Array.from(set).sort().reverse();
  }, [data]);

  // ── Filtro 1: por mes ──────────────────────────────────
  const filteredData = useMemo(() =>
    selectedMonth ? data.filter(g => g.fecha.startsWith(selectedMonth)) : data,
  [data, selectedMonth]);

  // ── Categorías disponibles (sobre datos ya filtrados por mes) ─
  const categoriaOptions = useMemo(
    () => categorias.map((c) => ({ value: c.nombre, label: c.nombre })),
    [categorias],
  );

  const conceptOptions = useMemo(() => {
    return (conceptos || []).map((c) => ({ value: c.descripcion, label: c.descripcion }));
  }, [conceptos]);

  const categoriasDisponibles = useMemo(() => {
    const set = new Set<string>();
    filteredData.forEach(g => set.add(g.categorias_gasto?.nombre || 'Sin categoría'));
    return Array.from(set).sort();
  }, [filteredData]);

  // ── Filtro 2: por categoría ───────────────────────────
  const finalData = useMemo(() =>
    selectedCategory
      ? filteredData.filter(g => (g.categorias_gasto?.nombre || 'Sin categoría') === selectedCategory)
      : filteredData,
  [filteredData, selectedCategory]);

  const toggleFechaSort = useCallback(() => {
    setSorting(prev => {
      const fecha = prev.find(s => s.id === 'fecha');
      if (!fecha) return [{ id: 'fecha', desc: true }];
      if (fecha.desc) return [{ id: 'fecha', desc: false }];
      return [];
    });
  }, []);

  const fechaSortDirection = useMemo(() => {
    const fecha = sorting.find(s => s.id === 'fecha');
    if (!fecha) return false as const;
    return fecha.desc ? ('desc' as const) : ('asc' as const);
  }, [sorting]);

  const columns = useMemo(
    () => getGastoColumns({
      onEdit: openEdit,
      onDelete: handleDelete,
      canEdit,
      isPending,
      onToggleFechaSort: toggleFechaSort,
      fechaSortDirection,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canEdit, isPending, toggleFechaSort, fechaSortDirection],
  );

  const table = useReactTable({
    data: finalData,
    columns,
    state: { sorting, globalFilter, pagination },
    filterFns: { gastoFilter: gastoGlobalFilter },
    globalFilterFn: 'gastoFilter' as any,
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
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
    const headH = thead?.getBoundingClientRect().height ?? GASTOS_HEAD_FALLBACK_PX;
    const bodyAvailable = Math.max(0, el.clientHeight - headH);

    const pageRows = Math.min(
      GASTOS_PAGE_MAX,
      Math.max(1, Math.floor(bodyAvailable / GASTOS_ROW_MIN_PX)),
    );
    setPagination(prev => (prev.pageSize === pageRows ? prev : { ...prev, pageSize: pageRows }));
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
    setPagination(prev => ({ ...prev, pageIndex: 0 }));
    setDetailId(null);
  }, [selectedMonth, selectedCategory, globalFilter]);

  useEffect(() => {
    setDetailId(null);
  }, [pagination.pageIndex]);

  const detailGasto = useMemo(
    () => (detailId ? finalData.find(g => g.id === detailId) ?? null : null),
    [detailId, finalData],
  );

  useEffect(() => {
    if (!detailId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDetailId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [detailId]);

  // ── KPIs (sobre datos filtrados por mes + categoría) ────────
  const totalGastos  = finalData.reduce((s, g) => s + Number(g.monto), 0);
  const numRegistros = finalData.length;

  // Gasto más alto
  const maxGasto = finalData.reduce((max, g) => Number(g.monto) > Number(max.monto) ? g : max, finalData[0] ?? { monto: 0, descripcion: '-' });

  // Agrupación por categoría para el gráfico (sobre datos del mes, SIN filtro categoría para ver el contexto completo)
  const porCategoria = useMemo(() => {
    const map: Record<string, { nombre: string; total: number }> = {};
    filteredData.forEach(g => {
      const nombre = g.categorias_gasto?.nombre || 'Sin categoría';
      if (!map[nombre]) map[nombre] = { nombre, total: 0 };
      map[nombre].total += Number(g.monto);
    });
    return Object.values(map)
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [filteredData]);

  const maxCatTotal = porCategoria[0]?.total || 1;

  // ── Exportación CSV ───────────────────────────────────────
  function exportToCSV() {
    const rows    = table.getFilteredRowModel().rows;
    const headers = ['Fecha', 'Descripcion', 'Categoria', 'Proveedor', 'Ref. Factura', 'Monto USD'];
    const escape  = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
    const lines   = rows.map(row => {
      const g = row.original;
      return [
        g.fecha,
        escape(g.descripcion),
        g.categorias_gasto?.nombre || '',
        g.proveedor || '',
        g.factura_referencia || '',
        g.monto,
      ].join(',');
    });
    const csv  = [headers.join(','), ...lines].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href = url;
    a.download = `gastos_${new Date().toISOString().split('T')[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  // ── Exportación PDF (premium) ───────────────────────────────
  async function exportToPDF() {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'), import('jspdf-autotable'),
    ]);

    const doc   = new (jsPDF as any)({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const W     = 297;
    const rows  = table.getFilteredRowModel().rows;
    const gastos = rows.map(r => r.original);
    const now   = new Date();
    const dateStr = now.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

    // Período legible
    let periodoLabel = 'Todos los registros';
    if (selectedMonth) {
      const [y, m] = selectedMonth.split('-');
      const raw = new Date(Number(y), Number(m) - 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
      periodoLabel = raw.charAt(0).toUpperCase() + raw.slice(1);
    }
    const categoryLabel = selectedCategory || 'Todas las categorías';
    const fullPeriodo   = selectedCategory ? `${periodoLabel}  ·  ${categoryLabel}` : periodoLabel;

    // KPIs
    const totalAmount   = gastos.reduce((s, g) => s + Number(g.monto), 0);
    const maxItem       = gastos.length > 0 ? gastos.reduce((mx, g) => Number(g.monto) > Number(mx.monto) ? g : mx) : null;
    const avgAmount     = gastos.length > 0 ? totalAmount / gastos.length : 0;

    // Categorías para el gráfico
    const catMap: Record<string, number> = {};
    gastos.forEach(g => {
      const cat = g.categorias_gasto?.nombre || 'Sin categoria';
      catMap[cat] = (catMap[cat] || 0) + Number(g.monto);
    });
    const cats    = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 7);
    const maxCat  = cats[0]?.[1] || 1;

    // ── HEADER ─────────────────────────────────────────────
    doc.setFillColor(9, 9, 11);
    doc.rect(0, 0, W, 28, 'F');
    // Barra de acento dorada
    doc.setFillColor(218, 165, 32);
    doc.rect(0, 0, 4, 28, 'F');

    doc.setTextColor(218, 165, 32);
    doc.setFontSize(17);
    doc.setFont('helvetica', 'bold');
    doc.text('MineOS', 12, 12);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text('Reporte de Gastos Operativos', 12, 21);

    // Derecha: período y fecha
    doc.setTextColor(160, 160, 170);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Periodo: ${fullPeriodo}`, W - 10, 12, { align: 'right' });
    doc.text(`Generado: ${dateStr}  ${timeStr}`, W - 10, 20, { align: 'right' });

    // ── KPI BOXES ──────────────────────────────────────────
    const kpiY = 33;
    const kpiH = 20;
    const kpiW = (W - 20 - 9) / 4; // 4 cajas con 3 gaps de 3mm
    const kpis = [
      { label: 'TOTAL GASTADO',  value: fmt(totalAmount),                       accent: [220, 38, 38]   as [number, number, number] },
      { label: 'REGISTROS',      value: String(gastos.length),                   accent: [148, 163, 184] as [number, number, number] },
      { label: 'MAYOR GASTO',    value: fmt(Number(maxItem?.monto ?? 0)),        accent: [218, 165, 32]  as [number, number, number] },
      { label: 'PROMEDIO',       value: fmt(avgAmount),                          accent: [52, 211, 153]  as [number, number, number] },
    ];
    kpis.forEach((kpi, i) => {
      const x = 10 + i * (kpiW + 3);
      doc.setFillColor(18, 18, 22);
      doc.roundedRect(x, kpiY, kpiW, kpiH, 2, 2, 'F');
      // Borde izquierdo de acento
      doc.setFillColor(...kpi.accent);
      doc.rect(x, kpiY, 2.5, kpiH, 'F');
      // Label
      doc.setTextColor(100, 100, 115);
      doc.setFontSize(6);
      doc.setFont('helvetica', 'bold');
      doc.text(kpi.label, x + 5.5, kpiY + 7);
      // Value
      doc.setTextColor(...kpi.accent);
      doc.setFontSize(11);
      doc.text(kpi.value, x + 5.5, kpiY + 16);
    });

    let curY = kpiY + kpiH + 6; // ~59

    // ── GRAFICO DE CATEGORIAS ──────────────────────────────
    if (cats.length > 0) {
      // Titulo de sección
      doc.setFillColor(14, 14, 18);
      doc.rect(0, curY, W, 7, 'F');
      doc.setTextColor(100, 100, 115);
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'bold');
      doc.text('// DISTRIBUCION POR CATEGORIA', 10, curY + 4.5);
      curY += 9;

      const labelW = 58;
      const valueW = 26;
      const barAreaX = 10 + labelW + 2;
      const barW     = W - 20 - labelW - valueW - 4;
      const barH     = 4.5;
      const rowGap   = 7.5;

      cats.forEach(([catName, catTotal], i) => {
        const y   = curY + i * rowGap;
        const pct = catTotal / maxCat;
        const rgb = hexToRgb(CAT_COLORS[i % CAT_COLORS.length]);
        const truncated = catName.length > 24 ? catName.slice(0, 24) + '...' : catName;

        // Nombre categoría
        doc.setTextColor(170, 170, 185);
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'normal');
        doc.text(truncated, 10, y + barH - 0.5);

        // Fondo barra
        doc.setFillColor(28, 28, 34);
        doc.roundedRect(barAreaX, y, barW, barH, 1, 1, 'F');

        // Barra activa
        if (rgb) doc.setFillColor(rgb.r, rgb.g, rgb.b);
        const fillW = Math.max(2, barW * pct);
        doc.roundedRect(barAreaX, y, fillW, barH, 1, 1, 'F');

        // Valor + porcentaje
        const pctStr = `${((catTotal / totalAmount) * 100).toFixed(1)}%`;
        doc.setTextColor(190, 190, 205);
        doc.setFontSize(6);
        doc.text(`${fmt(catTotal)}  ${pctStr}`, barAreaX + barW + 2, y + barH - 0.5);
      });

      curY += cats.length * rowGap + 5;
    }

    // ── DETALLE DE TRANSACCIONES ────────────────────────────
    doc.setFillColor(14, 14, 18);
    doc.rect(0, curY, W, 7, 'F');
    doc.setTextColor(100, 100, 115);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.text('// DETALLE DE TRANSACCIONES', 10, curY + 4.5);
    curY += 9;

    autoTable(doc, {
      startY: curY,
      head: [['FECHA', 'DESCRIPCION', 'CATEGORIA', 'PROVEEDOR', 'REF. FACTURA', 'MONTO USD']],
      body: gastos.map(g => [
        g.fecha,
        g.descripcion,
        g.categorias_gasto?.nombre || '-',
        g.proveedor || '-',
        g.factura_referencia || '-',
        fmt(Number(g.monto)),
      ]),
      foot: [['', '', '', '', 'TOTAL PERIODO', fmt(totalAmount)]],
      styles:             { fontSize: 7.5, cellPadding: 2.5, textColor: [200, 200, 215] as [number,number,number] },
      headStyles:         { fillColor: [18, 18, 22] as [number,number,number], textColor: [218, 165, 32] as [number,number,number], fontStyle: 'bold' as const, fontSize: 7, cellPadding: 3 },
      footStyles:         { fillColor: [18, 18, 22] as [number,number,number], textColor: [218, 165, 32] as [number,number,number], fontStyle: 'bold' as const, fontSize: 8 },
      alternateRowStyles: { fillColor: [20, 20, 26] as [number,number,number] },
      bodyStyles:         { fillColor: [12, 12, 15] as [number,number,number] },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 38 },
        3: { cellWidth: 32 },
        4: { cellWidth: 32 },
        5: { cellWidth: 26, halign: 'right' as const },
      },
      didDrawPage: (d: any) => {
        const total = (doc as any).internal.getNumberOfPages();
        doc.setFillColor(9, 9, 11);
        doc.rect(0, 204, W, 6, 'F');
        doc.setTextColor(80, 80, 95);
        doc.setFontSize(6);
        doc.setFont('helvetica', 'normal');
        doc.text(`MineOS  |  Gastos Operativos  |  ${fullPeriodo}`, 10, 208);
        doc.text(`Pagina ${d.pageNumber} de ${total}`, W - 10, 208, { align: 'right' });
      },
    });

    const catSlug = selectedCategory ? `_${selectedCategory.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}` : '';
    const filename = selectedMonth
      ? `gastos_${selectedMonth}${catSlug}.pdf`
      : `gastos_completo${catSlug}_${now.toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
  }

  // ── Modal helpers ─────────────────────────────────────────
  function resetForm() { setForm(EMPTY_FORM); setEditItem(null); setFormError(null); }
  function openNew()   { resetForm(); setShowModal(true); }
  function openEdit(item: Gasto) {
    setEditItem(item);
    setForm({
      fecha:              item.fecha,
      categoria_nombre:   item.categorias_gasto?.nombre || '',
      descripcion:        item.descripcion,
      monto:              String(item.monto),
      proveedor:          item.proveedor          || '',
      factura_referencia: item.factura_referencia || '',
      notas:              item.notas              || '',
      guardar_en_catalogo: false,
    });
    setShowModal(true);
  }
  function closeModal() { setShowModal(false); resetForm(); }

  // ── Mutaciones ────────────────────────────────────────────
  function handleSave() {
    setFormError(null);
    const montoNum = parseFloat(form.monto);
    if (!form.categoria_nombre.trim())                       { setFormError('Escribe una categoría.'); return; }
    if (!form.descripcion.trim())                            { setFormError('La descripción es obligatoria.'); return; }
    if (!form.monto || isNaN(montoNum) || montoNum <= 0)     { setFormError('El monto debe ser mayor que cero.'); return; }

    startTransition(async () => {
      // Resolver (o crear) la categoría por nombre
      const catResult = await getOrCreateCategoria(form.categoria_nombre);
      if (!catResult.ok) { setFormError(catResult.message); return; }

      // Si se marcó "guardar en catálogo"
      if (form.guardar_en_catalogo) {
        await upsertGastoConcepto({
          descripcion: form.descripcion,
          categoria_default_id: catResult.id,
          proveedor_sugerido: form.proveedor || null,
          monto_sugerido: null,
        });
      }

      const payload = {
        fecha: form.fecha, categoria_id: catResult.id, descripcion: form.descripcion,
        monto: montoNum, proveedor: form.proveedor || null,
        factura_referencia: form.factura_referencia || null, notas: form.notas || null,
        registrado_por: user?.id || null,
        ...(editItem ? { id: editItem.id } : {}),
      };
      const result = editItem ? await updateGasto(payload) : await createGasto(payload);
      if (result.ok) { toast.success(result.message); closeModal(); }
      else           { setFormError(result.message); toast.error(result.message); }
    });
  }

  function handleDelete(id: string) {
    if (!confirm('¿Eliminar este gasto?')) return;
    startTransition(async () => {
      const result = await deleteGasto(id);
      if (result.ok) {
        if (detailId === id) setDetailId(null);
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    });
  }

  // ─────────────────────────────────────────────────────────
  return (
    <div className="gastos-page flex min-h-0 w-full flex-1 flex-col overflow-hidden">

      {/* KPIs izquierda alineados arriba; tabla + acciones a la derecha */}
      <div className="gastos-page__grid min-h-0 flex-1">

        {/* PANEL IZQUIERDO — KPIs + categorías */}
        <aside className="gastos-page__summary flex h-full min-h-0 flex-col gap-2">

          <div className="grid shrink-0 grid-cols-2 gap-2">
            <div className="app-surface-card gastos-kpi-card gastos-kpi-card--total relative col-span-2 overflow-hidden p-3">
              <div className="gastos-kpi-glow gastos-kpi-glow--total" aria-hidden />
              <p className="relative mb-0.5 text-[9px] font-bold uppercase tracking-widest text-[var(--dashboard-text-muted)]">Total Gastado</p>
              <p className="gastos-kpi-value gastos-kpi-value--total relative text-2xl font-black leading-none">{fmtShort(totalGastos)}</p>
              <p className="relative mt-0.5 text-[11px] text-[var(--dashboard-text-muted)]">{numRegistros} registros</p>
            </div>

            <div className="app-surface-card gastos-kpi-card gastos-kpi-card--accent relative overflow-hidden p-2.5">
              <div className="gastos-kpi-glow gastos-kpi-glow--accent" aria-hidden />
              <p className="relative mb-0.5 text-[9px] font-bold uppercase tracking-widest text-[var(--dashboard-text-muted)]">Mayor Gasto</p>
              <p className="gastos-kpi-value gastos-kpi-value--accent relative text-base font-black leading-none">{fmtShort(Number(maxGasto?.monto || 0))}</p>
              <p className="relative mt-0.5 truncate text-[10px] text-[var(--dashboard-text-muted)]">{maxGasto?.descripcion || '-'}</p>
            </div>

            <div className="app-surface-card gastos-kpi-card gastos-kpi-card--neutral relative overflow-hidden p-2.5">
              <div className="gastos-kpi-glow gastos-kpi-glow--neutral" aria-hidden />
              <p className="relative mb-0.5 text-[9px] font-bold uppercase tracking-widest text-[var(--dashboard-text-muted)]">Promedio</p>
              <p className="gastos-kpi-value gastos-kpi-value--neutral relative text-base font-black leading-none">
                {numRegistros > 0 ? fmtShort(totalGastos / numRegistros) : '$0'}
              </p>
              <p className="mt-0.5 text-[10px] text-[var(--dashboard-text-muted)]">por registro</p>
            </div>
          </div>

          <div className="gastos-page__summary-stack flex min-h-0 flex-1 flex-col gap-2">
          {/* Filtros — solo el alto del contenido */}
          <div className="gastos-page__filters app-surface-card shrink-0 flex flex-col p-3">
            <p className="mb-2.5 shrink-0 text-[9px] font-bold uppercase tracking-widest text-[var(--dashboard-text-muted)]">
              Filtros
            </p>
            <div className="flex flex-col gap-3">
            {meses.length > 0 && (
              <div
                className="gastos-page__filter-scroll gastos-page__filter-scroll--months"
                role="region"
                aria-label="Filtrar por mes"
                title="Desplaza horizontalmente para ver más meses"
              >
                <div className="gastos-page__filter-scroll-inner gastos-page__filter-scroll-inner--months">
                  <Calendar className="gastos-icon-muted h-3 w-3 shrink-0" aria-hidden />
                  <button
                    type="button"
                    onClick={() => { setSelectedMonth(''); setSelectedCategory(''); }}
                    className={`${filterPillClass(selectedMonth === '', 'month')} shrink-0`}
                  >
                    Todos
                  </button>
                  {meses.map(mes => {
                    const [year, month] = mes.split('-');
                    const label = new Date(Number(year), Number(month) - 1).toLocaleDateString('es-ES', {
                      month: 'short',
                      year: '2-digit',
                    });
                    return (
                      <button
                        key={mes}
                        type="button"
                        onClick={() => { setSelectedMonth(mes === selectedMonth ? '' : mes); setSelectedCategory(''); }}
                        className={`${filterPillClass(selectedMonth === mes, 'month')} shrink-0 capitalize`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {categoriasDisponibles.length > 1 && (
              <div
                className="gastos-page__filter-scroll gastos-page__filter-scroll--categories"
                role="region"
                aria-label="Filtrar por categoría de gasto"
                title="Desplaza para ver más categorías"
              >
                <div className="gastos-page__filter-scroll-inner gastos-page__filter-scroll-inner--categories">
                  <Tag className="gastos-icon-muted h-3 w-3 shrink-0" aria-hidden />
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('')}
                    className={filterPillClass(selectedCategory === '', 'category')}
                  >
                    Todas
                  </button>
                  {categoriasDisponibles.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat === selectedCategory ? '' : cat)}
                      className={`${filterPillClass(selectedCategory === cat, 'category')} max-w-[10.5rem] shrink-0 truncate text-left`}
                      title={cat}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            )}
            </div>
          </div>

          {/* Gasto por categoría — ocupa el espacio restante */}
          <div className="gastos-page__chart app-surface-card flex min-h-0 flex-1 flex-col p-3">
            <div className="mb-2.5 flex shrink-0 items-center gap-1.5">
              <BarChart3 className="h-3.5 w-3.5 text-[var(--dashboard-accent)]" aria-hidden />
              <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--dashboard-text-muted)]">
                Gasto por Categoría
              </span>
            </div>
            {porCategoria.length === 0 ? (
              <p className="py-2 text-center text-[10px] text-[var(--dashboard-text-muted)]">Sin datos</p>
            ) : (
              <div className="gastos-page__chart-scroll min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                {porCategoria.map((cat, i) => (
                  <div
                    key={cat.nombre}
                    role="button"
                    tabIndex={0}
                    title={cat.nombre}
                    onClick={() => setSelectedCategory(cat.nombre === selectedCategory ? '' : cat.nombre)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedCategory(cat.nombre === selectedCategory ? '' : cat.nombre);
                      }
                    }}
                    className={`cursor-pointer rounded-md px-1 py-1 transition-colors ${
                      selectedCategory === cat.nombre ? 'bg-red-500/10' : 'hover:bg-white/[0.03]'
                    }`}
                  >
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span
                        className={`gastos-chart-name min-w-0 flex-1 truncate text-[11px] leading-snug ${
                          selectedCategory === cat.nombre ? 'font-bold !text-[var(--dashboard-danger)]' : ''
                        }`}
                      >
                        {cat.nombre}
                      </span>
                      <span className="gastos-chart-value shrink-0 font-mono text-[11px] font-bold">{fmtShort(cat.total)}</span>
                    </div>
                    <div className="gastos-chart-track h-2 overflow-hidden rounded-full">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${(cat.total / maxCatTotal) * 100}%`,
                          backgroundColor:
                            selectedCategory === cat.nombre ? '#ef4444' : CAT_COLORS[i % CAT_COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
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
                placeholder="Buscar por descripción, categoría, proveedor o factura..."
                value={globalFilter ?? ''}
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
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={exportToCSV}
                className="btn-secondary flex h-8 items-center gap-1 px-2.5 text-[10px] whitespace-nowrap"
                title="Exportar CSV"
              >
                <FileDown className="h-3.5 w-3.5" /> CSV
              </button>
              <button
                type="button"
                onClick={exportToPDF}
                className="btn-secondary flex h-8 items-center gap-1 px-2.5 text-[10px] whitespace-nowrap"
                title="Exportar PDF"
              >
                <FileText className="h-3.5 w-3.5" /> PDF
              </button>
            </div>
            {canEdit && (
              <button
                type="button"
                onClick={openNew}
                disabled={isPending}
                className="app-btn-primary h-8 shrink-0 px-4 text-xs"
              >
                <Plus className="h-3.5 w-3.5" /> Registrar Gasto
              </button>
            )}
          </div>

          <div ref={tableBodyRef} className="gastos-page__table-body relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
            <table className="gastos-table w-full border-collapse">
              <colgroup>
                <col style={{ width: '5.75rem' }} />
                <col />
                <col style={{ width: '6.75rem' }} />
                <col style={{ width: '5.25rem' }} />
                <col style={{ width: '5.25rem' }} />
                <col style={{ width: '5.5rem' }} />
                <col style={{ width: '3.25rem' }} />
              </colgroup>
              <thead className="gastos-thead">
                {table.getHeaderGroups().map(hg => (
                  <tr key={hg.id}>
                    {hg.headers.map(header => {
                      const align =
                        (header.column.columnDef.meta as { align?: 'left' | 'right' | 'center' } | undefined)
                          ?.align ?? 'left';
                      return (
                        <th
                          key={header.id}
                          onClick={header.column.getToggleSortingHandler()}
                          className={`gastos-th max-w-0 overflow-hidden px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
                            align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
                          } ${header.column.getCanSort() ? 'cursor-pointer select-none' : ''} ${
                            header.column.id === 'actions' ? '!max-w-none' : ''
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
                        title="Sin gastos registrados"
                        description={
                          globalFilter
                            ? 'Ningún resultado para esa búsqueda.'
                            : 'Registra el primer gasto operativo.'
                        }
                        action={canEdit && !globalFilter ? { label: 'Registrar gasto', onClick: openNew } : undefined}
                      />
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map(row => {
                    const isOpen = detailId === row.original.id;
                    return (
                      <tr
                        key={row.id}
                        role="button"
                        tabIndex={0}
                        aria-expanded={isOpen}
                        onClick={() => toggleDetail(row.original.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleDetail(row.original.id);
                          }
                        }}
                        className={`gastos-table__row gastos-tr cursor-pointer ${
                          isOpen ? 'gastos-tr--active' : ''
                        }`}
                      >
                        {row.getVisibleCells().map(cell => {
                          const align =
                            (cell.column.columnDef.meta as { align?: 'left' | 'right' | 'center' } | undefined)
                              ?.align ?? 'left';
                          return (
                            <td
                              key={cell.id}
                              className={`gastos-table__cell gastos-td max-w-0 overflow-hidden px-2.5 text-[11px] ${
                                align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
                              } ${cell.column.id === 'actions' ? '!max-w-none overflow-visible' : ''}`}
                              onClick={cell.column.id === 'actions' ? (e) => e.stopPropagation() : undefined}
                            >
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            {detailGasto && (
              <div className="gastos-detail-overlay absolute inset-0 z-20 flex">
                <button
                  type="button"
                  className="gastos-overlay-backdrop absolute inset-0 backdrop-blur-[1px]"
                  onClick={() => setDetailId(null)}
                  aria-label="Cerrar detalle"
                />
                <div className="relative z-10 m-auto flex max-h-[calc(100%-1.5rem)] w-full max-w-2xl items-center justify-center p-3 pointer-events-none">
                  <div
                    className="gastos-detail-popover pointer-events-auto max-h-full w-full overflow-y-auto"
                    onClick={(e) => e.stopPropagation()}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Detalle del gasto"
                  >
                    <GastoDetailCard
                      gasto={detailGasto}
                      registradoPor={
                        registradoPorLabels[detailGasto.registrado_por] ?? 'Usuario desconocido'
                      }
                      onClose={() => setDetailId(null)}
                      onEdit={() => {
                        setDetailId(null);
                        openEdit(detailGasto);
                      }}
                      canEdit={canEdit}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="gastos-page__table-footer gastos-footer-bar flex shrink-0 items-center justify-between px-3 py-1.5">
            <div className="flex min-w-0 items-center gap-2">
              <span className="gastos-footer-label text-[9px] uppercase tracking-wider">Total visible</span>
              <span className="gastos-amount text-xs">
                {fmt(table.getFilteredRowModel().rows.reduce((s, r) => s + Number(r.original.monto), 0))}
              </span>
              <span className="gastos-footer-label text-[10px]">· {table.getFilteredRowModel().rows.length} reg.</span>
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
                {pageNumbers.map(page => (
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
        <div className="mb-4 flex justify-center sm:hidden">
          <div className="h-1 w-8 rounded-full bg-zinc-700" />
        </div>
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10">
              <Wallet className="h-4 w-4 text-red-400" />
            </div>
            <h2 className="text-lg font-semibold text-white/90">
              {editItem ? 'Editar Gasto' : 'Nuevo Gasto'}
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
            <label className="input-label">Descripción / Nombre *</label>
            <AppCombobox
              value={form.descripcion}
              onChange={(value) => {
                const matched = (conceptos || []).find((c) => c.descripcion === value);
                if (matched) {
                  const catName = matched.categorias_gasto?.nombre || '';
                  setForm({
                    ...form,
                    descripcion: value,
                    categoria_nombre: catName || form.categoria_nombre,
                    proveedor: matched.proveedor_sugerido || form.proveedor,
                    monto: matched.monto_sugerido ? String(matched.monto_sugerido) : form.monto,
                  });
                } else {
                  setForm({ ...form, descripcion: value });
                }
                setFormError(null);
              }}
              options={conceptOptions}
              placeholder="Escribe o selecciona un concepto..."
            />
          </div>
          {!editItem && (
            <div className="md:col-span-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="gasto-guardar-catalogo"
                checked={form.guardar_en_catalogo}
                onChange={(e) => setForm({ ...form, guardar_en_catalogo: e.target.checked })}
                className="h-4 w-4 rounded border-zinc-800 bg-zinc-950 text-amber-500 focus:ring-amber-500/50"
              />
              <label htmlFor="gasto-guardar-catalogo" className="text-xs text-white/70 select-none cursor-pointer">
                Guardar este concepto en el catálogo para futuros registros
              </label>
            </div>
          )}
          <div>
            <label className="input-label">Fecha *</label>
            <input
              type="date"
              value={form.fecha}
              onChange={e => setForm({ ...form, fecha: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="input-label">Categoría *</label>
            <AppSelect
              value={form.categoria_nombre}
              onChange={(val) => {
                setForm({ ...form, categoria_nombre: val });
                setFormError(null);
              }}
              options={[
                { value: '', label: 'Selecciona una categoría...' },
                ...categorias.map((c) => ({ value: c.nombre, label: c.nombre })),
              ]}
            />
          </div>
          <div>
            <label className="input-label">Monto (USD) *</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={form.monto}
              onChange={e => {
                setForm({ ...form, monto: e.target.value });
                setFormError(null);
              }}
              className="input-field"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="input-label">Proveedor</label>
            <input
              value={form.proveedor}
              onChange={e => setForm({ ...form, proveedor: e.target.value })}
              className="input-field"
              placeholder="Ej: Gasolinera El Faro"
            />
          </div>
          <div>
            <label className="input-label">Ref. Factura</label>
            <input
              value={form.factura_referencia}
              onChange={e => setForm({ ...form, factura_referencia: e.target.value })}
              className="input-field"
              placeholder="Ej: F-12345"
            />
          </div>
          <div className="md:col-span-2">
            <label className="input-label">Notas</label>
            <input
              value={form.notas}
              onChange={e => setForm({ ...form, notas: e.target.value })}
              className="input-field"
              placeholder="Notas aclaratorias sobre el gasto..."
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

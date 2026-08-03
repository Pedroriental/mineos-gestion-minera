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
  Receipt, Wallet, FileDown, Calendar, Trash2,
} from 'lucide-react';
import { useConfirm } from '@/components/ui/ConfirmDialogProvider';
import { toast } from 'sonner';
import { toastError } from '@/lib/app-toast';
import type { Gasto, CategoriaGasto, EmpresaInversora } from '@/lib/types';
import EmptyState from '@/components/EmptyState';
import { useAuth } from '@/lib/auth-context';
import { useCanEdit } from '@/lib/use-can-edit';
import { createGasto, updateGasto, deleteGasto, getOrCreateCategoria, upsertGastoConcepto, createGastosBulk, restaurarGastosJulio2026Action } from '@/lib/actions/gastos';
import { verifyGastosBeforeSave } from '@/lib/actions/gastos-audit';
import { getPrecioOroParaFecha } from '@/lib/actions/gastos-oro';
import { GastoEmpresaSelector } from '@/components/gastos/GastoEmpresaSelector';
import {
  convertGramosToUsd,
  isLegacyGastoOroNota,
  PRECIO_ORO_FALLBACK_USD,
  type PrecioOroGasto,
} from '@/lib/gastos-oro';
import { formatDuplicateMatches } from '@/lib/gastos-audit';
import { GastosAuditPanel } from '@/components/gastos/GastosAuditPanel';
import { PageFormModal, PageFormModalFooter } from '@/components/ui/PageFormModal';
import { AppCombobox } from '@/components/ui/AppCombobox';
import { AppSelect } from '@/components/ui/AppSelect';
import { AppMonthPicker } from '@/components/ui/AppMonthPicker';
import { AppDatePicker } from '@/components/ui/AppDatePicker';
import { getGastoColumns, gastoGlobalFilter, parseDescripcion } from './columns';
import { GastoDetailCard } from './GastoDetailCard';
import {
  MobileFilterTrigger,
  MobileFilterSheet,
  MobileToolbarMore,
  SheetIconBadge,
  useMobileFilterSheet,
} from '@/components/mobile';

// ── Helpers ──────────────────────────────────────────────────
interface GastosClientProps {
  data:       Gasto[];
  categorias: CategoriaGasto[];
  registradoPorLabels: Record<string, string>;
  conceptos?: any[];
  empresasInversoras?: EmpresaInversora[];
}

const EMPTY_BASE_INFO = {
  fecha:              new Date().toISOString().split('T')[0],
  proveedor:          '',
  factura_referencia: '',
  notas:              '',
};

const createEmptyItem = () => ({
  id:                 Date.now().toString() + Math.random().toString(),
  categoria_nombre:   '',
  descripcion:        '',
  cantidad:           '',
  monto:              '',
  pago_en_oro:        false,
  gramos_oro:         '',
  guardar_en_catalogo: false,
});

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

const fmtShort = (n: number) => {
  return fmt(n);
};

function formatEmpresasPago(gasto: Gasto): string {
  const asignaciones = gasto.gastos_empresas || [];
  if (asignaciones.length === 0) return 'Sin asignar';
  const activas = asignaciones.filter(a => Number(a.monto_pagado) > 0 || Number(a.porcentaje) > 0);
  if (activas.length === 0) return 'Sin asignar';
  if (activas.length === 1) {
    const a = activas[0];
    const nombre = a.empresas_inversoras?.nombre_corto || a.empresas_inversoras?.nombre || 'Empresa';
    return `${nombre} (100%)`;
  }
  return activas
    .map(a => {
      const nombre = a.empresas_inversoras?.nombre_corto || a.empresas_inversoras?.nombre || 'Empresa';
      return `${nombre} ${Math.round(Number(a.porcentaje))}%`;
    })
    .join(' / ');
}

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
export default function GastosClient({
  data,
  categorias,
  registradoPorLabels,
  conceptos,
  empresasInversoras = [],
}: GastosClientProps) {
  const { user }  = useAuth();
  const canEdit   = useCanEdit();
  const [isPending, startTransition] = useTransition();
  const confirmDialog = useConfirm();

  const [showModal, setShowModal] = useState(false);
  const [precioOroRef, setPrecioOroRef] = useState<PrecioOroGasto | null>(null);
  const [editItem,  setEditItem]  = useState<Gasto | null>(null);
  const [baseInfo,  setBaseInfo]  = useState(EMPTY_BASE_INFO);
  const [items,     setItems]     = useState([createEmptyItem()]);
  const [formError, setFormError] = useState<string | null>(null);
  const [empresasAsignadas, setEmpresasAsignadas] = useState<
    Array<{ empresa_id: string; monto_pagado: number; porcentaje: number }>
  >([]);
  const [isGlobalAmount, setIsGlobalAmount] = useState(false);
  const [globalAmount, setGlobalAmount] = useState('');
  const [sorting,   setSorting]   = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(''); 
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedEmpresa, setSelectedEmpresa] = useState(''); // '' = Todas, 'mixto' = Mixto, o empresa_id
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: GASTOS_PAGE_MAX });
  const [detailId, setDetailId] = useState<string | null>(null);
  const tableBodyRef = useRef<HTMLDivElement>(null);
  const { open: filtersOpen, setOpen: setFiltersOpen } = useMobileFilterSheet();
  const activeFilterCount = (selectedMonth ? 1 : 0) + (selectedCategory ? 1 : 0) + (selectedEmpresa ? 1 : 0);

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

  // ── Filtros combinados (Mes + Categoría + Empresa Inversora) ─────
  const finalData = useMemo(() => {
    return data.filter((g) => {
      // 1. Mes
      if (selectedMonth && !g.fecha.startsWith(selectedMonth)) return false;
      // 2. Categoría
      if (selectedCategory && (g.categorias_gasto?.nombre || 'Sin categoría') !== selectedCategory) return false;
      // 3. Empresa inversora / Financiador
      if (selectedEmpresa) {
        const asignaciones = g.gastos_empresas || [];
        if (selectedEmpresa === 'mixto') {
          const activas = asignaciones.filter(a => Number(a.monto_pagado) > 0 || Number(a.porcentaje) > 0);
          if (activas.length <= 1) return false;
        } else {
          const hasEmp = asignaciones.some(
            a => a.empresa_id === selectedEmpresa && (Number(a.monto_pagado) > 0 || Number(a.porcentaje) > 0)
          );
          if (!hasEmp) return false;
        }
      }
      return true;
    });
  }, [data, selectedMonth, selectedCategory, selectedEmpresa]);

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

  useEffect(() => {
    if (!showModal || !baseInfo.fecha) return;
    let cancelled = false;
    void getPrecioOroParaFecha(baseInfo.fecha).then((precio) => {
      if (!cancelled) setPrecioOroRef(precio);
    });
    return () => {
      cancelled = true;
    };
  }, [showModal, baseInfo.fecha]);

  // ── KPIs (sobre datos filtrados por mes + categoría) ────────
  const totalGastos  = finalData.reduce((s, g) => s + Number(g.monto), 0);
  const numRegistros = finalData.length;

  // ── Exportación CSV ───────────────────────────────────────
  function exportToCSV() {
    const rows    = table.getFilteredRowModel().rows;
    const headers = ['Fecha', 'Descripcion', 'Cantidad', 'Categoria', 'Proveedor', 'Ref. Factura', 'Monto USD'];
    const escape  = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
    const lines   = rows.map(row => {
      const g = row.original;
      const { cleanDesc, cantidad } = parseDescripcion(g.descripcion);
      return [
        g.fecha,
        escape(cleanDesc),
        escape(cantidad !== '—' ? cantidad : ''),
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

    // Labels
    let periodoLabel = 'Todos los registros';
    if (selectedMonth) {
      const [y, m] = selectedMonth.split('-');
      const raw = new Date(Number(y), Number(m) - 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
      periodoLabel = raw.charAt(0).toUpperCase() + raw.slice(1);
    }

    let empresaLabel = 'Todas las empresas';
    if (selectedEmpresa === 'mixto') {
      empresaLabel = 'Financiamiento Mixto';
    } else if (selectedEmpresa) {
      const foundEmp = empresasInversoras.find(e => e.id === selectedEmpresa);
      empresaLabel = foundEmp ? (foundEmp.nombre_corto || foundEmp.nombre) : 'Empresa seleccionada';
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

    // ── HEADER SLATE DARK BAR (0..28mm) ─────────────────────────
    doc.setFillColor(15, 23, 42); // Slate 900
    doc.rect(0, 0, W, 28, 'F');
    // Gold Accent Bar
    doc.setFillColor(218, 165, 32);
    doc.rect(0, 0, 4, 28, 'F');

    doc.setTextColor(218, 165, 32);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('MineOS', 12, 11);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text('Reporte de Gastos Operativos', 12, 20);

    // Metadata a la derecha
    doc.setTextColor(203, 213, 225); // Slate 300
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Periodo: ${periodoLabel}`, W - 10, 9, { align: 'right' });
    doc.text(`Empresa: ${empresaLabel}`, W - 10, 15, { align: 'right' });
    doc.text(`Categoría: ${categoryLabel}  ·  Generado: ${dateStr} ${timeStr}`, W - 10, 21, { align: 'right' });

    // ── KPI CARDS (LIGHT ELEGANT STYLE) ──────────────────────────
    const kpiY = 33;
    const kpiH = 19;
    const kpiW = (W - 20 - 9) / 4; // 4 cajas con 3 gaps de 3mm
    const kpis = [
      { label: 'TOTAL GASTADO',  value: fmt(totalAmount),                       accent: [220, 38, 38]   as [number, number, number] },
      { label: 'REGISTROS',      value: String(gastos.length),                   accent: [71, 85, 105]   as [number, number, number] },
      { label: 'MAYOR GASTO',    value: fmt(Number(maxItem?.monto ?? 0)),        accent: [218, 165, 32]  as [number, number, number] },
      { label: 'PROMEDIO',       value: fmt(avgAmount),                          accent: [16, 185, 129]  as [number, number, number] },
    ];
    kpis.forEach((kpi, i) => {
      const x = 10 + i * (kpiW + 3);
      // Fondo tarjeta blanco/slate-50
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(x, kpiY, kpiW, kpiH, 1.5, 1.5, 'F');
      // Borde tarjeta slate-200
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.roundedRect(x, kpiY, kpiW, kpiH, 1.5, 1.5, 'D');

      // Tira de acento izquierda
      doc.setFillColor(...kpi.accent);
      doc.rect(x, kpiY, 2, kpiH, 'F');

      // Label
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(6);
      doc.setFont('helvetica', 'bold');
      doc.text(kpi.label, x + 5, kpiY + 6.5);

      // Valor
      doc.setTextColor(...kpi.accent);
      doc.setFontSize(10.5);
      doc.text(kpi.value, x + 5, kpiY + 15);
    });

    let curY = kpiY + kpiH + 5; // ~57

    // ── GRAFICO DE CATEGORIAS ──────────────────────────────
    if (cats.length > 0) {
      doc.setFillColor(241, 245, 249);
      doc.rect(10, curY, W - 20, 6, 'F');
      doc.setTextColor(71, 85, 105);
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'bold');
      doc.text('DISTRIBUCION POR CATEGORIA', 13, curY + 4.2);
      curY += 8;

      const labelW = 58;
      const valueW = 30;
      const barAreaX = 10 + labelW + 2;
      const barW     = W - 20 - labelW - valueW - 4;
      const barH     = 4;
      const rowGap   = 6.5;

      cats.forEach(([catName, catTotal], i) => {
        const y   = curY + i * rowGap;
        const pct = catTotal / maxCat;
        const rgb = hexToRgb(CAT_COLORS[i % CAT_COLORS.length]);
        const truncated = catName.length > 28 ? catName.slice(0, 28) + '...' : catName;

        // Label
        doc.setTextColor(51, 65, 85);
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'normal');
        doc.text(truncated, 10, y + barH - 0.5);

        // Fondo barra
        doc.setFillColor(226, 232, 240);
        doc.roundedRect(barAreaX, y, barW, barH, 0.8, 0.8, 'F');

        // Barra activa
        if (rgb) doc.setFillColor(rgb.r, rgb.g, rgb.b);
        const fillW = Math.max(2, barW * pct);
        doc.roundedRect(barAreaX, y, fillW, barH, 0.8, 0.8, 'F');

        // Valor
        const pctStr = `${((catTotal / totalAmount) * 100).toFixed(1)}%`;
        doc.setTextColor(71, 85, 105);
        doc.setFontSize(6);
        doc.text(`${fmt(catTotal)} (${pctStr})`, barAreaX + barW + 2, y + barH - 0.5);
      });

      curY += cats.length * rowGap + 4;
    }

    // ── DETALLE DE TRANSACCIONES ────────────────────────────
    doc.setFillColor(241, 245, 249);
    doc.rect(10, curY, W - 20, 6, 'F');
    doc.setTextColor(71, 85, 105);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.text('DETALLE DE TRANSACCIONES', 13, curY + 4.2);
    curY += 8;

    autoTable(doc, {
      startY: curY,
      margin: { left: 10, right: 10 },
      head: [['FECHA', 'DESCRIPCION', 'CANTIDAD', 'CATEGORIA', 'EMPRESA / PAGADOR', 'PROVEEDOR', 'REF. FACTURA', 'MONTO USD']],
      body: gastos.map(g => {
        const { cleanDesc, cantidad } = parseDescripcion(g.descripcion);
        return [
          g.fecha,
          cleanDesc,
          cantidad !== '—' ? cantidad : '',
          g.categorias_gasto?.nombre || '-',
          formatEmpresasPago(g),
          g.proveedor || '-',
          g.factura_referencia || '-',
          fmt(Number(g.monto)),
        ];
      }),
      foot: [['', '', '', '', '', '', 'TOTAL PERIODO', fmt(totalAmount)]],
      styles:             { fontSize: 7, cellPadding: 2.2, textColor: [30, 41, 59] as [number,number,number], lineColor: [226, 232, 240], lineWidth: 0.1 },
      headStyles:         { fillColor: [15, 23, 42] as [number,number,number], textColor: [218, 165, 32] as [number,number,number], fontStyle: 'bold' as const, fontSize: 6.8, cellPadding: 2.5 },
      footStyles:         { fillColor: [15, 23, 42] as [number,number,number], textColor: [218, 165, 32] as [number,number,number], fontStyle: 'bold' as const, fontSize: 7.5, cellPadding: 2.5 },
      alternateRowStyles: { fillColor: [248, 250, 252] as [number,number,number] },
      bodyStyles:         { fillColor: [255, 255, 255] as [number,number,number] },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 18 },
        3: { cellWidth: 32 },
        4: { cellWidth: 38 },
        5: { cellWidth: 26 },
        6: { cellWidth: 24 },
        7: { cellWidth: 26, halign: 'right' as const },
      },
      didDrawPage: (d: any) => {
        const total = (doc as any).internal.getNumberOfPages();
        // Pie de página limpio
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.2);
        doc.line(10, 202, W - 10, 202);

        doc.setTextColor(100, 116, 139);
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'normal');
        doc.text(`MineOS  |  Gastos Operativos  |  ${fullPeriodo}  |  Empresa: ${empresaLabel}`, 10, 206);
        doc.text(`Página ${d.pageNumber} de ${total}`, W - 10, 206, { align: 'right' });
      },
    });

    const empSlug = selectedEmpresa ? `_${selectedEmpresa.toLowerCase()}` : '';
    const catSlug = selectedCategory ? `_${selectedCategory.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}` : '';
    const filename = selectedMonth
      ? `gastos_${selectedMonth}${empSlug}${catSlug}.pdf`
      : `gastos_completo${empSlug}${catSlug}_${now.toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
  }

  // ── Modal helpers ─────────────────────────────────────────
  function resetForm() {
    setBaseInfo(EMPTY_BASE_INFO);
    setItems([createEmptyItem()]);
    setEditItem(null);
    setFormError(null);
    setIsGlobalAmount(false);
    setGlobalAmount('');
    setEmpresasAsignadas([]);
  }
  function openNew()   { resetForm(); setShowModal(true); }
  function openEdit(item: Gasto) {
    setEditItem(item);
    const legacyOro = !item.monto_gramos_oro && isLegacyGastoOroNota(item.notas);
    const pagoEnOro = (item.monto_gramos_oro != null && Number(item.monto_gramos_oro) > 0) || legacyOro;
    setBaseInfo({
      fecha:              item.fecha,
      proveedor:          item.proveedor          || '',
      factura_referencia: item.factura_referencia || '',
      notas:              legacyOro ? '' : (item.notas || ''),
    });
    setItems([{
      id:                 item.id,
      categoria_nombre:   item.categorias_gasto?.nombre || '',
      descripcion:        item.descripcion,
      cantidad:           '',
      monto:              pagoEnOro ? '' : String(item.monto),
      pago_en_oro:        pagoEnOro,
      gramos_oro:         pagoEnOro
        ? String(item.monto_gramos_oro ?? (legacyOro ? item.monto : ''))
        : '',
      guardar_en_catalogo: false,
    }]);

    if (item.gastos_empresas && item.gastos_empresas.length > 0) {
      setEmpresasAsignadas(
        item.gastos_empresas.map((ge) => ({
          empresa_id: ge.empresa_id,
          monto_pagado: Number(ge.monto_pagado),
          porcentaje: Number(ge.porcentaje),
        }))
      );
    } else {
      setEmpresasAsignadas([]);
    }

    setShowModal(true);
  }
  function closeModal() { setShowModal(false); resetForm(); }

  // ── Mutaciones ────────────────────────────────────────────
  /** Devuelve el monto total del gasto en el formulario (para el selector de empresas). */
  function getCurrentMontoTotal(): number {
    if (isGlobalAmount) {
      const n = parseFloat(globalAmount);
      return Number.isFinite(n) && n > 0 ? n : 0;
    }
    return items.reduce((s, it) => {
      if (it.pago_en_oro) {
        // Oro se convierte a USD en el save; usamos un fallback razonable.
        return s + (parseFloat(it.monto) || 0);
      }
      return s + (parseFloat(it.monto) || 0);
    }, 0);
  }

  function handleSave() {
    setFormError(null);
    if (!baseInfo.fecha) { setFormError('La fecha es obligatoria.'); return; }
    if (items.length === 0) { setFormError('Debes agregar al menos un ítem.'); return; }

    if (isGlobalAmount) {
      const globalNum = parseFloat(globalAmount);
      if (!globalAmount || isNaN(globalNum) || globalNum <= 0) { setFormError('Monto global inválido.'); return; }
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (!it.categoria_nombre.trim()) { setFormError(`El ítem ${i + 1} necesita una categoría.`); return; }
        if (!it.descripcion.trim()) { setFormError(`La descripción es obligatoria en el ítem ${i + 1}.`); return; }
      }
    } else {
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (!it.categoria_nombre.trim()) { setFormError(`El ítem ${i + 1} necesita una categoría.`); return; }
        if (!it.descripcion.trim()) { setFormError(`La descripción es obligatoria en el ítem ${i + 1}.`); return; }
        if (it.pago_en_oro) {
          const gramosNum = parseFloat(it.gramos_oro);
          if (!it.gramos_oro || isNaN(gramosNum) || gramosNum <= 0) {
            setFormError(`Gramos de oro inválidos en el ítem ${i + 1}.`);
            return;
          }
        } else {
          const montoNum = parseFloat(it.monto);
          if (!it.monto || isNaN(montoNum) || montoNum <= 0) { setFormError(`Monto inválido en el ítem ${i + 1}.`); return; }
        }
      }
    }

    startTransition(async () => {
      // Create payloads
      const payloads = [];

      if (isGlobalAmount) {
        let globalDesc = items.map(it => {
          let d = it.descripcion;
          if (it.cantidad && it.cantidad.trim() !== '') {
            d += ` (Cant: ${it.cantidad})`;
          }
          return d;
        }).join(' + ');

        const catResult = await getOrCreateCategoria(items[0].categoria_nombre);
        if (!catResult.ok) { setFormError(catResult.message); return; }

        payloads.push({
          fecha: baseInfo.fecha,
          categoria_id: catResult.id,
          descripcion: globalDesc,
          monto: parseFloat(globalAmount),
          proveedor: baseInfo.proveedor || null,
          factura_referencia: baseInfo.factura_referencia || null,
          notas: baseInfo.notas || null,
          registrado_por: user?.id || null,
          empresas: empresasAsignadas.length > 0 ? empresasAsignadas : null,
          ...(editItem ? { id: editItem.id } : {}),
        });

      } else {
        // Resolver categorías: deduplicar nombres y resolver en paralelo
        const uniqueCats = [...new Set(items.map((it) => it.categoria_nombre))];
        const catResults = await Promise.all(
          uniqueCats.map((name) => getOrCreateCategoria(name)),
        );
        const catMap = new Map<string, string>();
        for (let i = 0; i < uniqueCats.length; i++) {
          const r = catResults[i];
          if (!r.ok) { setFormError(r.message); return; }
          catMap.set(uniqueCats[i], r.id);
        }

        for (const it of items) {
          const categoriaId = catMap.get(it.categoria_nombre)!;

          if (it.guardar_en_catalogo) {
            await upsertGastoConcepto({
              descripcion: it.descripcion,
              categoria_default_id: categoriaId,
              proveedor_sugerido: baseInfo.proveedor || null,
              monto_sugerido: null,
            });
          }

          let desc = it.descripcion;
          if (it.cantidad && it.cantidad.trim() !== '') {
            desc = `${it.descripcion} (Cant: ${it.cantidad})`;
          }

          const precioOro = precioOroRef?.usdPorGramo ?? PRECIO_ORO_FALLBACK_USD;
          const gramosOro = it.pago_en_oro ? parseFloat(it.gramos_oro) : null;
          const montoUsd = it.pago_en_oro
            ? convertGramosToUsd(gramosOro!, precioOro)
            : parseFloat(it.monto);

          payloads.push({
            fecha: baseInfo.fecha,
            categoria_id: categoriaId,
            descripcion: desc,
            monto: montoUsd,
            monto_gramos_oro: gramosOro,
            precio_oro_usd_gramo: it.pago_en_oro ? precioOro : null,
            proveedor: baseInfo.proveedor || null,
            factura_referencia: baseInfo.factura_referencia || null,
            notas: baseInfo.notas || null,
            registrado_por: user?.id || null,
            empresas: empresasAsignadas.length > 0 ? empresasAsignadas : null,
            ...(editItem ? { id: editItem.id } : {}),
          });
        }
      }

      const gastosForVerify = payloads.map(({ id: _id, ...gasto }) => gasto);
      const verify = await verifyGastosBeforeSave({
        gastos: gastosForVerify,
        excludeIds: editItem ? [editItem.id] : [],
      });
      if (!verify.ok) {
        setFormError(verify.message);
        toastError(verify.message);
        return;
      }

      let acknowledgeDuplicates = false;
      if (verify.duplicates.length > 0) {
        const proceed = await confirmDialog({
          title: 'Gasto posiblemente duplicado',
          message: `${formatDuplicateMatches(verify.duplicates)}\n\n¿Registrar de todas formas?`,
          confirmLabel: 'Registrar igualmente',
          cancelLabel: 'Revisar',
          variant: 'warning',
        });
        if (!proceed) {
          setFormError('Registro cancelado: revisa los posibles duplicados.');
          return;
        }
        acknowledgeDuplicates = true;
      } else if (verify.warnings.length > 0) {
        toast.message('Revisa los avisos del registro', {
          description: verify.warnings.map((w) => w.message).join(' · '),
        });
      }

      const saveOptions = { acknowledgeDuplicates };
      const result = editItem
        ? await updateGasto(payloads[0], saveOptions)
        : await createGastosBulk(gastosForVerify, saveOptions);
      if (result.ok) { toast.success(result.message); closeModal(); }
      else if (result.code === 'DUPLICATE' && result.duplicates?.length) {
        setFormError(result.message);
        toastError('Gasto duplicado detectado al guardar.');
      } else {
        setFormError(result.message);
        toastError(result.message);
      }
    });
  }

  async function handleDelete(id: string) {
    if (!(await confirmDialog({
      title: 'Eliminar gasto',
      message: '¿Eliminar este gasto? Esta acción no se puede deshacer.',
      variant: 'danger'
    }))) return;
    startTransition(async () => {
      const result = await deleteGasto(id);
      if (result.ok) {
        if (detailId === id) setDetailId(null);
        toast.success(result.message);
      } else {
        toastError(result.message);
      }
    });
  }

  // ─────────────────────────────────────────────────────────
  const gastosFiltersPanel = (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--dashboard-text-muted)] flex items-center gap-1.5">
          <Calendar className="h-3 w-3" aria-hidden /> Mes
        </label>
        <AppMonthPicker
          value={selectedMonth}
          onChange={(val) => {
            setSelectedMonth(val);
            setSelectedCategory('');
          }}
          placeholder="Filtrar por mes..."
        />
      </div>
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
            {categoriasDisponibles.map((cat) => (
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

      {/* Filtro por Empresa Inversora / Financiador */}
      <div className="flex flex-col gap-1.5 pt-1 border-t border-[var(--dashboard-border)]/50">
        <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--dashboard-text-muted)] flex items-center gap-1.5">
          <Wallet className="h-3 w-3" aria-hidden /> Financiador / Empresa
        </label>
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setSelectedEmpresa('')}
            className={filterPillClass(selectedEmpresa === '', 'month')}
          >
            Todas
          </button>
          {empresasInversoras.map((emp) => (
            <button
              key={emp.id}
              type="button"
              onClick={() => setSelectedEmpresa(selectedEmpresa === emp.id ? '' : emp.id)}
              className={filterPillClass(selectedEmpresa === emp.id, 'month')}
              style={selectedEmpresa === emp.id ? { borderColor: emp.color, color: emp.color } : {}}
            >
              {emp.nombre_corto || emp.nombre}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setSelectedEmpresa(selectedEmpresa === 'mixto' ? '' : 'mixto')}
            className={filterPillClass(selectedEmpresa === 'mixto', 'month')}
          >
            Mixto
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="gastos-page flex min-h-0 w-full flex-1 flex-col overflow-hidden">

      {/* KPIs izquierda alineados arriba; tabla + acciones a la derecha */}
      <div className="gastos-page__grid min-h-0 flex-1">

        {/* PANEL IZQUIERDO — KPI + filtros + auditoría */}
        <aside className="gastos-page__summary flex h-full min-h-0 flex-col gap-2">

          <div className="shrink-0">
            <div className="app-surface-card gastos-kpi-card gastos-kpi-card--total relative overflow-hidden p-3">
              <div className="gastos-kpi-glow gastos-kpi-glow--total" aria-hidden />
              <p className="relative mb-0.5 text-[9px] font-bold uppercase tracking-widest text-[var(--dashboard-text-muted)]">
                {selectedMonth ? `Total Gastado (${new Date(selectedMonth + '-02').toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })})` : 'Total Gastado (General)'}
              </p>
              <p className="gastos-kpi-value gastos-kpi-value--total relative text-2xl font-black leading-none">{fmtShort(totalGastos)}</p>
              <p className="relative mt-0.5 text-[11px] text-[var(--dashboard-text-muted)]">{numRegistros} registros</p>
            </div>
          </div>

          <div className="gastos-page__summary-stack flex min-h-0 flex-1 flex-col gap-2">
          {/* Filtros — panel desktop; sheet en móvil */}
          <div className="gastos-page__filters app-surface-card hidden shrink-0 flex-col p-3 lg:flex">
            <p className="mb-2.5 shrink-0 text-[9px] font-bold uppercase tracking-widest text-[var(--dashboard-text-muted)]">
              Filtros
            </p>
            {gastosFiltersPanel}
          </div>

          <GastosAuditPanel />
          </div>
        </aside>

        {/* PANEL DERECHO — Tabla */}
        <div className="gastos-page__table app-surface-card relative flex min-h-0 flex-col overflow-hidden">

          <div className="gastos-page__toolbar flex shrink-0 flex-col gap-2 px-3 py-1.5">
            <MobileFilterTrigger
              activeCount={activeFilterCount}
              onOpen={() => setFiltersOpen(true)}
              className="gastos-page__filter-trigger lg:hidden"
            />
            <div className="gastos-page__toolbar-row flex min-w-0 flex-wrap items-center gap-2">
              <div className="gastos-search-wrap flex h-9 min-w-0 flex-1 items-center gap-2.5 rounded-lg pl-3 pr-2">
                <Search className="gastos-icon-muted h-3.5 w-3.5 shrink-0" aria-hidden />
                <input
                  type="text"
                  placeholder="Buscar"
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
              <div className="mineos-export-actions hidden shrink-0 sm:grid">
                <button
                  type="button"
                  onClick={exportToCSV}
                  className="mineos-export-btn"
                  title="Exportar CSV"
                >
                  <FileDown className="h-4 w-4 shrink-0" /> CSV
                </button>
                <button
                  type="button"
                  onClick={exportToPDF}
                  className="mineos-export-btn"
                  title="Exportar PDF"
                >
                  <FileText className="h-4 w-4 shrink-0" /> PDF
                </button>
              </div>
              <MobileToolbarMore
                actions={[
                  { label: 'Exportar CSV', onClick: exportToCSV, icon: <FileDown className="h-4 w-4" /> },
                  { label: 'Exportar PDF', onClick: exportToPDF, icon: <FileText className="h-4 w-4" /> },
                ]}
              />
            </div>
            {canEdit && (
              <button
                type="button"
                onClick={openNew}
                disabled={isPending}
                className="gastos-page__register-btn app-btn-primary inline-flex h-9 w-full items-center justify-center gap-2 px-4 text-xs font-bold lg:w-auto lg:shrink-0"
              >
                <Plus className="h-4 w-4 shrink-0" /> Registrar Gasto
              </button>
            )}
          </div>

          <div ref={tableBodyRef} className="gastos-page__table-body relative min-h-0 flex-1 overflow-x-auto overflow-y-auto custom-scrollbar">
            <table className="gastos-table w-full min-w-[55rem] border-collapse">
              <colgroup>
                <col style={{ width: '5.75rem' }} />
                <col />
                <col style={{ width: '4.5rem' }} />
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
                            : 'Registra el primer gasto operativo o restaura los datos de Julio 2026.'
                        }
                        action={canEdit && !globalFilter ? { label: 'Registrar gasto', onClick: openNew } : undefined}
                      />
                      {canEdit && !globalFilter && (
                        <div className="mt-4 flex justify-center">
                          <button
                            type="button"
                            onClick={async () => {
                              toast.info('Restaurando gastos de Julio 2026...');
                              const res = await restaurarGastosJulio2026Action();
                              if (res.ok) {
                                toast.success(res.message);
                                window.location.reload();
                              } else {
                                toast.error(res.message);
                              }
                            }}
                            className="inline-flex items-center gap-2 rounded-lg bg-amber-600/20 px-4 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-600/30 border border-amber-500/30 transition-colors"
                          >
                            <Receipt className="h-4 w-4" />
                            Restaurar Gastos Julio 2026 ($97.600,33)
                          </button>
                        </div>
                      )}
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
          </div>

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

          <div className="gastos-page__table-footer gastos-footer-bar flex shrink-0 items-center justify-between px-3 py-1.5">
            <div className="flex min-w-0 items-center gap-2">
              <span className="gastos-footer-label text-[9px] uppercase tracking-wider">
                {selectedMonth ? `Total (${new Date(selectedMonth + '-02').toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })})` : 'Total visible'}
              </span>
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

      <PageFormModal
        open={showModal}
        onClose={closeModal}
        sheetTitle={editItem ? 'Editar Gasto' : 'Nuevo Gasto'}
        sheetIcon={<SheetIconBadge icon={Wallet} tone="danger" />}
        panelClassName="sm:max-w-5xl"
      >
        <div className="mb-6 hidden items-center justify-between border-b border-white/5 pb-4 lg:flex">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10">
              <Wallet className="h-4 w-4 text-red-400" />
            </div>
            <h2 className="page-form-modal-title text-lg font-semibold text-white/90">
              {editItem ? 'Editar Gasto' : 'Nuevo Gasto'}
            </h2>
          </div>
          <button
            type="button"
            onClick={closeModal}
            aria-label="Cerrar formulario"
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

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[16rem_1fr]">
          {/* Columna Izquierda: Datos Generales */}
          <div className="flex flex-col gap-4 rounded-xl border border-[var(--dashboard-border)] bg-black/20 p-4">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--dashboard-text-muted)]">
              Datos Generales
            </h3>
            {!editItem && (
              <div>
                <label className="flex items-center gap-2 mb-1 mt-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isGlobalAmount}
                    onChange={(e) => setIsGlobalAmount(e.target.checked)}
                    className="rounded border-[var(--dashboard-border)] bg-black/20 text-[var(--dashboard-accent)] focus:ring-[var(--dashboard-accent)] h-4 w-4"
                  />
                  <span className="text-[11px] font-medium text-white/80 leading-tight">Factura de monto global <br/><span className="text-[9px] text-white/40">(Ítems sin precio detallado)</span></span>
                </label>
              </div>
            )}
            {isGlobalAmount && !editItem && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                <label className="input-label text-[var(--dashboard-accent)]">Monto Total (USD) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={globalAmount}
                  onChange={e => setGlobalAmount(e.target.value)}
                  className="input-field border-[var(--dashboard-accent)]/50 focus:border-[var(--dashboard-accent)] bg-[var(--dashboard-accent)]/5"
                  placeholder="Total de la factura"
                  autoFocus
                />
              </div>
            )}
            <div>
              <label className="input-label">Fecha *</label>
              <AppDatePicker
                value={baseInfo.fecha}
                onChange={val => setBaseInfo({ ...baseInfo, fecha: val })}
              />
            </div>
            <div>
              <label className="input-label">Proveedor</label>
              <input
                value={baseInfo.proveedor}
                onChange={e => setBaseInfo({ ...baseInfo, proveedor: e.target.value })}
                className="input-field"
                placeholder="Ej: Gasolinera El Faro"
              />
            </div>
            <div>
              <label className="input-label">Ref. Factura</label>
              <input
                value={baseInfo.factura_referencia}
                onChange={e => setBaseInfo({ ...baseInfo, factura_referencia: e.target.value })}
                className="input-field"
                placeholder="Ej: F-12345"
              />
            </div>
            <div>
              <label className="input-label">Notas</label>
              <textarea
                value={baseInfo.notas}
                onChange={e => setBaseInfo({ ...baseInfo, notas: e.target.value })}
                className="input-field min-h-[4.5rem] resize-none"
                placeholder="Notas aclaratorias sobre el bloque de gastos..."
              />
            </div>

            {/* Selector de Empresas (Fase 8) */}
            <div className="rounded-lg border border-white/10 bg-zinc-900/30 p-3">
              <GastoEmpresaSelector
                montoTotal={getCurrentMontoTotal()}
                empresasAsignadas={empresasAsignadas}
                onChange={setEmpresasAsignadas}
              />
            </div>
          </div>

          {/* Columna Derecha: Ítems */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--dashboard-text-muted)]">
                Lista de Ítems
              </h3>
              {!editItem && (
                <button
                  type="button"
                  onClick={() => setItems([...items, createEmptyItem()])}
                  className="btn-secondary flex items-center gap-1 py-1 px-2.5 text-xs"
                >
                  <Plus className="h-3.5 w-3.5" /> Agregar Ítem
                </button>
              )}
            </div>

            <div className="space-y-4">
              {items.map((it, idx) => (
                <div key={it.id} className="relative rounded-xl border border-[var(--dashboard-border)] bg-[var(--dashboard-bg)] p-4 pr-12 shadow-sm transition-colors hover:border-white/10">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                    <div className="sm:col-span-12">
                      <label className="input-label">Descripción / Nombre *</label>
                      <AppCombobox
                        value={it.descripcion}
                        onChange={(value) => {
                          const matched = (conceptos || []).find((c) => c.descripcion === value);
                          const newItems = [...items];
                          if (matched) {
                            newItems[idx] = {
                              ...it,
                              descripcion: value,
                              categoria_nombre: matched.categorias_gasto?.nombre || it.categoria_nombre,
                              monto: matched.monto_sugerido ? String(matched.monto_sugerido) : it.monto,
                            };
                            if (!baseInfo.proveedor && matched.proveedor_sugerido) {
                              setBaseInfo({ ...baseInfo, proveedor: matched.proveedor_sugerido });
                            }
                          } else {
                            newItems[idx] = { ...it, descripcion: value };
                          }
                          setItems(newItems);
                          setFormError(null);
                        }}
                        options={conceptOptions}
                        placeholder="Escribe o selecciona un concepto..."
                      />
                    </div>
                    <div className="sm:col-span-5">
                      <label className="input-label">Categoría *</label>
                      <AppSelect
                        value={it.categoria_nombre}
                        onChange={(val) => {
                          const newItems = [...items];
                          newItems[idx].categoria_nombre = val;
                          setItems(newItems);
                          setFormError(null);
                        }}
                        options={[
                          { value: '', label: 'Selecciona una categoría...' },
                          ...categorias.map((c) => ({ value: c.nombre, label: c.nombre })),
                        ]}
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="input-label">Cantidad</label>
                      <input
                        type="text"
                        value={it.cantidad}
                        onChange={e => {
                          const newItems = [...items];
                          newItems[idx].cantidad = e.target.value;
                          setItems(newItems);
                        }}
                        className="input-field"
                        placeholder="Opcional"
                      />
                    </div>
                    {!isGlobalAmount && (
                      <div className="sm:col-span-4 space-y-2 animate-in fade-in duration-200">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={it.pago_en_oro}
                            onChange={(e) => {
                              const newItems = [...items];
                              newItems[idx] = {
                                ...it,
                                pago_en_oro: e.target.checked,
                                gramos_oro: e.target.checked ? it.gramos_oro : '',
                                monto: e.target.checked ? '' : it.monto,
                              };
                              setItems(newItems);
                              setFormError(null);
                            }}
                            className="h-3.5 w-3.5 rounded border-zinc-800 bg-zinc-950 text-amber-500 focus:ring-amber-500/50"
                          />
                          <span className="text-[10px] text-amber-400/90">Pago en oro (gramos)</span>
                        </label>

                        {it.pago_en_oro ? (
                          <div>
                            <label className="input-label text-amber-400/90">Gramos de oro *</label>
                            <input
                              type="number"
                              step="0.0001"
                              min="0.0001"
                              value={it.gramos_oro}
                              onChange={(e) => {
                                const newItems = [...items];
                                newItems[idx].gramos_oro = e.target.value;
                                setItems(newItems);
                                setFormError(null);
                              }}
                              className="input-field border-amber-500/30 bg-amber-500/5"
                              placeholder="Ej: 40"
                            />
                            {it.gramos_oro && precioOroRef ? (
                              <p className="mt-1 text-[10px] leading-snug text-white/45">
                                {parseFloat(it.gramos_oro) || 0} g × ${precioOroRef.usdPorGramo.toFixed(2)}/g
                                {' → '}
                                <span className="font-semibold text-amber-300">
                                  {fmtShort(convertGramosToUsd(parseFloat(it.gramos_oro) || 0, precioOroRef.usdPorGramo))}
                                </span>
                                {precioOroRef.fechaReferencia ? (
                                  <span className="text-white/30"> · ref. {precioOroRef.fechaReferencia}</span>
                                ) : null}
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <div>
                            <label className="input-label">Monto (USD) *</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              value={it.monto}
                              onChange={(e) => {
                                const newItems = [...items];
                                newItems[idx].monto = e.target.value;
                                setItems(newItems);
                                setFormError(null);
                              }}
                              className="input-field"
                              placeholder="Total ($)"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {!editItem && (
                    <div className="mt-3 flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`cat-${it.id}`}
                        checked={it.guardar_en_catalogo}
                        onChange={(e) => {
                          const newItems = [...items];
                          newItems[idx].guardar_en_catalogo = e.target.checked;
                          setItems(newItems);
                        }}
                        className="h-3.5 w-3.5 rounded border-zinc-800 bg-zinc-950 text-amber-500 focus:ring-amber-500/50"
                      />
                      <label htmlFor={`cat-${it.id}`} className="text-[10px] text-white/50 select-none cursor-pointer">
                        Guardar concepto en catálogo
                      </label>
                    </div>
                  )}

                  {!editItem && items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const newItems = items.filter((_, i) => i !== idx);
                        setItems(newItems);
                      }}
                      className="absolute right-3 top-4 rounded-md p-1.5 text-red-500/50 hover:bg-red-500/10 hover:text-red-400"
                      title="Eliminar ítem"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {items.length > 0 && !editItem && (
              <div className="mt-2 text-right">
                <span className="text-[11px] font-bold text-[var(--dashboard-text-muted)]">
                  Total de Factura:{' '}
                  <span className="text-white text-sm">
                    {fmtShort(
                      items.reduce((acc, it) => {
                        if (it.pago_en_oro) {
                          const gramos = parseFloat(it.gramos_oro) || 0;
                          const precio = precioOroRef?.usdPorGramo ?? PRECIO_ORO_FALLBACK_USD;
                          return acc + convertGramosToUsd(gramos, precio);
                        }
                        return acc + (parseFloat(it.monto) || 0);
                      }, 0),
                    )}
                  </span>
                </span>
              </div>
            )}
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

      <MobileFilterSheet open={filtersOpen} onClose={() => setFiltersOpen(false)}>
        {gastosFiltersPanel}
      </MobileFilterSheet>
    </div>
  );
}

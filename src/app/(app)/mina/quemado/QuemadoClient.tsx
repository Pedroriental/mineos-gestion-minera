'use client';

import { useState, useTransition, useMemo, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useCanEdit } from '@/lib/use-can-edit';
import { createQuemado, updateQuemado, deleteQuemado } from '@/lib/actions/quemado';
import type { ReporteQuemado } from '@/lib/types';
import {
  Loader2, Flame, Plus, X, Calculator,
  ChevronLeft, ChevronRight, AlertCircle, Gem, Search, LineChart, Scale, Layers,
} from 'lucide-react';
import { AppSelect } from '@/components/ui/AppSelect';
import { useConfirm } from '@/components/ui/ConfirmDialogProvider';
import { useTurnoOptions } from '@/contexts/biblioteca-context';
import { PageFormModal, PageFormModalFooter } from '@/components/ui/PageFormModal';
import { SheetIconBadge } from '@/components/mobile';
import EmptyState from '@/components/EmptyState';
import { FadeIn } from '@/components/ui/motion';
import { GerencialMobileChartFold, GerencialMobileKpiStrip } from '@/components/gerencial/GerencialMobileChrome';
import { GerencialRecordDetailModal } from '@/components/gerencial/GerencialRecordDetailModal';
import { QuemadoRecordDetail } from '@/components/gerencial/gerencial-record-details';
import { gerencialTableRowClassName, handleRowDetailKeyDown } from '@/components/gerencial/gerencial-table-row';
import { fmtGerencialDate } from '@/lib/gerencial-format';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
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
  mineosIcon,
  mineosIconRing,
  mineosKpiGlow,
  mineosKpiValue,
  mineosModalDivider,
  mineosModalHeading,
  mineosPanel,
  mineosLabelAccent,
  mineosBtnSubtleClass,
  type MineosTone,
} from '@/lib/mineos-visual';

const QUEMADO_PAGE_MAX = 12;
const QUEMADO_PAGE_BUTTONS_MAX = 5;
const QUEMADO_ROW_MIN_PX = 40;
const QUEMADO_HEAD_FALLBACK_PX = 40;
const CHART_DAYS_MAX = 14;

const fmtN = (n: number) =>
  new Intl.NumberFormat('es-VE', { maximumFractionDigits: 4, minimumFractionDigits: 2 }).format(n);

const emptyPlancha = (): { amalgama_g: string; oro_recuperado_g: string } => ({ amalgama_g: '', oro_recuperado_g: '' });

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const d = label ? new Date(label + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : '';
  return (
    <div className="app-chart-tooltip rounded-lg p-2 shadow-xl backdrop-blur-md">
      <p className="mb-1 font-mono text-[10px] text-white/60">{d}</p>
      {payload.map((entry, i) => (
        <div key={i} className="mb-0.5 flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-[10px] text-white/80">{entry.name}:</span>
          <span className="text-xs font-bold text-white">{fmtN(Number(entry.value))} g</span>
        </div>
      ))}
    </div>
  );
}

interface QuemadoClientProps {
  data: ReporteQuemado[];
}

export default function QuemadoClient({ data: initialData }: QuemadoClientProps) {
  const { user } = useAuth();
  const canEdit = useCanEdit();
  const turnoOptions = useTurnoOptions();

  const defaultDate = useMemo(() => {
    const dates = Array.from(new Set(initialData.map((d) => d.fecha))).sort((a, b) => b.localeCompare(a));
    return dates[0] ?? new Date().toISOString().split('T')[0];
  }, [initialData]);

  const [selectedDate, setSelectedDate] = useState('todos');
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: QUEMADO_PAGE_MAX });
  const tableBodyRef = useRef<HTMLDivElement>(null);

  const [showModal, setShowModal] = useState(false);
  const [viewItem, setViewItem] = useState<ReporteQuemado | null>(null);
  const [editItem, setEditItem] = useState<ReporteQuemado | null>(null);
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const confirmDialog = useConfirm();

  const emptyForm = {
    fecha: selectedDate === 'todos' ? new Date().toISOString().slice(0, 10) : selectedDate,
    turno: 'dia' as ReporteQuemado['turno'],
    numero_quemada: '',
    manto_amalgama_g: '',
    manto_oro_g: '',
    retorta_oro_g: '',
    responsable: '',
    observaciones: '',
  };
  const [form, setForm] = useState(emptyForm);
  const [planchas, setPlanchas] = useState([emptyPlancha()]);
  const set = (field: string, value: unknown) => setForm((f) => ({ ...f, [field]: value }));

  const diasConRegistros = useMemo(() => {
    const dates = Array.from(new Set(initialData.map((d) => d.fecha))).sort((a, b) => b.localeCompare(a));
    return dates.map((fecha) => ({
      fecha,
      count: initialData.filter((r) => r.fecha === fecha).length,
    }));
  }, [initialData]);

  useEffect(() => {
    if (selectedDate !== 'todos' && diasConRegistros.length > 0 && !initialData.some((r) => r.fecha === selectedDate)) {
      setSelectedDate('todos');
    }
  }, [diasConRegistros, initialData, selectedDate]);

  const dataForSelectedDate = useMemo(() => {
    if (selectedDate === 'todos') {
      return initialData;
    }
    return initialData.filter((d) => d.fecha === selectedDate);
  }, [initialData, selectedDate]);

  const openEdit = (item: ReporteQuemado) => {
    setEditItem(item);
    setPlanchas(item.planchas.map((p) => ({ amalgama_g: String(p.amalgama_g), oro_recuperado_g: String(p.oro_recuperado_g) })));
    setForm({
      fecha: item.fecha,
      turno: item.turno,
      numero_quemada: item.numero_quemada || '',
      manto_amalgama_g: item.manto_amalgama_g ? String(item.manto_amalgama_g) : '',
      manto_oro_g: item.manto_oro_g ? String(item.manto_oro_g) : '',
      retorta_oro_g: item.retorta_oro_g ? String(item.retorta_oro_g) : '',
      responsable: item.responsable || '',
      observaciones: item.observaciones || '',
    });
    setFormError(null);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!(await confirmDialog({
      title: 'Eliminar reporte',
      message: '¿Eliminar este reporte de quemado?',
      variant: 'danger'
    }))) return;
    startTransition(async () => {
      await deleteQuemado(id);
    });
  };

  const table = useReactTable({
    data: dataForSelectedDate,
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
    const headH = el.querySelector('thead')?.getBoundingClientRect().height ?? QUEMADO_HEAD_FALLBACK_PX;
    const bodyAvailable = el.clientHeight - headH;
    const pageRows = Math.min(
      QUEMADO_PAGE_MAX,
      Math.max(1, Math.floor(bodyAvailable / QUEMADO_ROW_MIN_PX)),
    );
    setPagination((prev) => (prev.pageSize === pageRows ? prev : { ...prev, pageSize: pageRows }));
  }, []);

  const filteredCount = table.getFilteredRowModel().rows.length;
  const pageCount = table.getPageCount();
  const displayPageCount = Math.max(1, pageCount);
  const pageIndex = Math.min(pagination.pageIndex, Math.max(0, displayPageCount - 1));
  const activePageIndex = filteredCount === 0 ? 0 : pageIndex;
  const pageWindowStart =
    Math.floor(activePageIndex / QUEMADO_PAGE_BUTTONS_MAX) * QUEMADO_PAGE_BUTTONS_MAX;
  const pageNumbers = useMemo(() => {
    const len = Math.min(QUEMADO_PAGE_BUTTONS_MAX, Math.max(0, displayPageCount - pageWindowStart));
    if (len === 0) return [0];
    return Array.from({ length: len }, (_, i) => pageWindowStart + i);
  }, [displayPageCount, pageWindowStart]);

  const tableSummary = useMemo(() => {
    const rows = table.getFilteredRowModel().rows;
    const amalgama = rows.reduce((s, r) => s + (Number(r.original.total_amalgama_g) || 0), 0);
    const oro = rows.reduce((s, r) => s + (Number(r.original.total_oro_g) || 0), 0);
    const planchas = rows.reduce((s, r) => s + (r.original.planchas?.length || 0), 0);
    const merma = amalgama > 0 ? ((amalgama - oro) / amalgama) * 100 : 0;
    const recup = amalgama > 0 ? (oro / amalgama) * 100 : 0;
    return { amalgama, oro, planchas, merma, recup, count: rows.length };
  }, [filteredCount, globalFilter, dataForSelectedDate, sorting, pagination.pageIndex]);

  const pageRows = table.getPaginationRowModel().rows;
  const colCount = table.getAllLeafColumns().length;

  const kpiRows = useMemo(() => {
    const mermaTone: MineosTone =
      tableSummary.merma > 0 && tableSummary.merma < 55
        ? 'benefit'
        : tableSummary.merma < 70
          ? 'neutral'
          : 'expense';
    return [
      { label: 'Oro Recuperado', value: `${fmtN(tableSummary.oro)} g`, tone: 'benefit' as MineosTone, Icon: Gem },
      { label: 'Total Amalgama', value: `${fmtN(tableSummary.amalgama)} g`, tone: 'general' as MineosTone, Icon: Flame },
      { label: 'Planchas', value: String(tableSummary.planchas), tone: 'general' as MineosTone, Icon: Layers },
      {
        label: 'Merma Prom.',
        value: tableSummary.merma > 0 ? `${tableSummary.merma.toFixed(1)}%` : '—',
        tone: mermaTone,
        Icon: Calculator,
      },
    ] as const;
  }, [tableSummary]);

  const diariaChart = useMemo(() => {
    const byDate = new Map<string, { fecha: string; oro: number }>();
    for (const r of initialData) {
      const cur = byDate.get(r.fecha) ?? { fecha: r.fecha, oro: 0 };
      cur.oro += Number(r.total_oro_g) || 0;
      byDate.set(r.fecha, cur);
    }
    return Array.from(byDate.values())
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .slice(-CHART_DAYS_MAX);
  }, [initialData]);

  const formAmalgama = planchas.reduce((s, p) => s + (parseFloat(p.amalgama_g) || 0), 0) + (parseFloat(form.manto_amalgama_g) || 0);
  const formOro =
    planchas.reduce((s, p) => s + (parseFloat(p.oro_recuperado_g) || 0), 0) +
    (parseFloat(form.manto_oro_g) || 0) +
    (parseFloat(form.retorta_oro_g) || 0);

  const addPlancha = () => setPlanchas((p) => [...p, emptyPlancha()]);
  const removePlancha = (i: number) => setPlanchas((p) => p.filter((_, idx) => idx !== i));
  const updatePlancha = (i: number, key: keyof ReturnType<typeof emptyPlancha>, val: string) =>
    setPlanchas((p) => p.map((x, idx) => (idx === i ? { ...x, [key]: val } : x)));

  const openNew = () => {
    setEditItem(null);
    setForm({ ...emptyForm, fecha: selectedDate === 'todos' ? new Date().toISOString().slice(0, 10) : selectedDate });
    setPlanchas([emptyPlancha()]);
    setFormError(null);
    setShowModal(true);
  };

  const handleSave = () => {
    setFormError(null);
    startTransition(async () => {
      const planchasPayload = planchas.map((p) => ({
        amalgama_g: parseFloat(p.amalgama_g) || 0,
        oro_recuperado_g: parseFloat(p.oro_recuperado_g) || 0,
      }));

      const payload = {
        ...form,
        manto_amalgama_g: parseFloat(form.manto_amalgama_g) || null,
        manto_oro_g: parseFloat(form.manto_oro_g) || null,
        retorta_oro_g: parseFloat(form.retorta_oro_g) || null,
        planchas: planchasPayload,
        total_amalgama_g: formAmalgama,
        total_oro_g: formOro,
        registrado_por: user?.id,
      };

      const res = editItem
        ? await updateQuemado({ ...payload, id: editItem.id })
        : await createQuemado(payload);

      if (res?.ok === false) {
        setFormError(res.message);
      } else {
        setShowModal(false);
        setEditItem(null);
        setForm({ ...emptyForm, fecha: selectedDate === 'todos' ? new Date().toISOString().slice(0, 10) : selectedDate });
        setPlanchas([emptyPlancha()]);
      }
    });
  };

  useEffect(() => {
    const el = tableBodyRef.current;
    if (!el) return;
    const run = () => syncTableLayout();
    run();
    const ro = new ResizeObserver(run);
    ro.observe(el);
    return () => ro.disconnect();
  }, [syncTableLayout, dataForSelectedDate.length]);

  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [selectedDate, globalFilter]);

  useEffect(() => {
    const maxIndex = Math.max(0, displayPageCount - 1);
    if (pagination.pageIndex > maxIndex) {
      setPagination((p) => ({ ...p, pageIndex: maxIndex }));
    }
  }, [displayPageCount, pagination.pageIndex]);

  return (
    <div className="quemado-page produccion-page flex min-h-0 w-full flex-1 flex-col overflow-hidden">

      <FadeIn className="produccion-page__toolbar shrink-0 space-y-2">
        <div className="quemado-page__toolbar-grid produccion-page__toolbar-grid grid grid-cols-1 gap-2 lg:grid-cols-12 lg:items-center lg:gap-4">
          <div className="quemado-page__toolbar-search min-w-0 lg:col-span-4">
            <div className="produccion-page__search produccion-surface produccion-surface--input flex h-9 w-full min-w-0 items-center rounded-lg px-3 py-2">
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
            items={kpiRows.map((k) => ({
              label: k.label,
              value: k.value,
              tone: k.tone,
              icon: k.Icon,
            }))}
            footer={
              tableSummary.count > 0 ? (
                <p className="truncate text-[9px] text-white/45">
                  Recup.{' '}
                  <span className="font-semibold text-amber-400">
                    {tableSummary.recup > 0 ? `${tableSummary.recup.toFixed(1)}%` : '—'}
                  </span>
                  {' · '}
                  Merma{' '}
                  <span className="font-semibold text-emerald-400/90">
                    {tableSummary.merma > 0 ? `${tableSummary.merma.toFixed(1)}%` : '—'}
                  </span>
                </p>
              ) : null
            }
          />
          <div className="quemado-page__toolbar-actions flex min-w-0 w-full flex-wrap items-center gap-2 sm:flex-nowrap lg:col-span-8 lg:justify-end">
            <div className="quemado-page__toolbar-balance produccion-surface hidden min-h-9 min-w-0 flex-1 items-center gap-2.5 rounded-lg px-3 py-1.5 sm:flex-initial lg:flex lg:max-w-none">
              <Scale className="h-3.5 w-3.5 shrink-0 text-amber-500/80" aria-hidden />
              <span className="produccion-section-title shrink-0 text-[9px] font-bold uppercase tracking-wider">
                Balance del día
              </span>
              {tableSummary.count === 0 ? (
                <span className="produccion-muted truncate text-[10px] italic">Sin registros</span>
              ) : (
                <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-0 text-[10px] tabular-nums">
                  <span>
                    <span className="produccion-muted">Recup. </span>
                    <strong className="text-amber-400">
                      {tableSummary.recup > 0 ? `${tableSummary.recup.toFixed(1)}%` : '—'}
                    </strong>
                  </span>
                  <span className="text-white/20">·</span>
                  <span>
                    <span className="produccion-muted">Merma </span>
                    <strong className="mineos-cell-benefit">
                      {tableSummary.merma > 0 ? `${tableSummary.merma.toFixed(1)}%` : '—'}
                    </strong>
                  </span>
                  <span className="text-white/20">·</span>
                  <span>
                    <span className="produccion-muted">Quem. </span>
                    <strong className="text-white/80">{tableSummary.count}</strong>
                  </span>
                  <span className="text-white/20">·</span>
                  <span>
                    <span className="produccion-muted">Planch. </span>
                    <strong className="text-white/80">{tableSummary.planchas}</strong>
                  </span>
                </div>
              )}
            </div>
            {canEdit && (
              <button
                type="button"
                onClick={openNew}
                className="gerencial-page__new-btn quemado-page__toolbar-btn produccion-page__toolbar-btn flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg bg-amber-600 px-3 text-xs font-bold text-black shadow-lg shadow-amber-900/20 transition-colors hover:bg-amber-500 lg:h-9 lg:w-auto lg:flex-initial"
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span className="truncate">Nuevo Reporte</span>
              </button>
            )}
          </div>
        </div>
      </FadeIn>

      <div className="quemado-page__grid produccion-page__grid min-h-0 flex-1 grid grid-cols-1 gap-2 lg:grid-cols-12 lg:gap-4">

        <div className="produccion-page__aside hidden min-h-0 flex-col gap-2 overflow-y-auto lg:col-span-4 lg:flex lg:h-full lg:overflow-hidden">
          {kpiRows.map((k) => {
            const KIcon = k.Icon;
            return (
            <div
              key={k.label}
              className="produccion-surface gerencial-kpi-card flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5"
            >
              <div className={mineosKpiGlow(k.tone)} aria-hidden />
              <div className={mineosIconRing(k.tone)}>
                <KIcon className={`h-5 w-5 ${mineosIcon(k.tone)}`} />
              </div>
              <div className="relative min-w-0 flex-1">
                <span className="produccion-kpi-label block text-[8px] font-bold uppercase leading-tight tracking-wider">
                  {k.label}
                </span>
                <span className={`${mineosKpiValue(k.tone)} text-lg font-bold leading-tight tabular-nums`}>
                  {k.value}
                </span>
              </div>
            </div>
          );})}

          <div className="quemado-page__chart produccion-page__chart produccion-surface flex min-h-[11rem] flex-1 flex-col rounded-xl p-3 lg:min-h-0">
            <h2 className="produccion-section-title mb-2 flex shrink-0 items-center gap-2 text-xs font-bold">
              <LineChart className="h-4 w-4 text-amber-400" />
              Oro recuperado (g)
            </h2>
            <div className="quemado-page__chart-area relative min-h-0 w-full flex-1">
              {diariaChart.length === 0 ? (
                <p className="produccion-muted flex h-full items-center justify-center text-center text-xs italic">
                  Sin datos para graficar
                </p>
              ) : (
                <ResponsiveContainer width="100%" height="100%" className="absolute inset-0">
                  <AreaChart data={diariaChart} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="quemadoOroGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.5} />
                        <stop offset="55%" stopColor="#d97706" stopOpacity={0.15} />
                        <stop offset="100%" stopColor="#b45309" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                    <XAxis
                      dataKey="fecha"
                      tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 9 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => {
                        const d = new Date(val + 'T12:00:00');
                        return `${d.getDate()}/${d.getMonth() + 1}`;
                      }}
                    />
                    <YAxis
                      tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 9 }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals
                    />
                    <RechartsTooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(245,158,11,0.45)', strokeWidth: 1 }} />
                    {diariaChart.some((d) => d.fecha === selectedDate) && (
                      <ReferenceLine
                        x={selectedDate}
                        stroke="#f59e0b"
                        strokeDasharray="4 4"
                        strokeWidth={1.5}
                        label={{ value: 'Día', position: 'top', fill: '#f59e0b', fontSize: 9 }}
                      />
                    )}
                    <Area
                      type="monotone"
                      dataKey="oro"
                      name="Oro (g)"
                      stroke="#fbbf24"
                      strokeWidth={2.5}
                      fill="url(#quemadoOroGradient)"
                      dot={(props) => {
                        const { cx, cy, payload } = props;
                        if (cx == null || cy == null) return null;
                        const active = payload?.fecha === selectedDate;
                        return (
                          <circle
                            cx={cx}
                            cy={cy}
                            r={active ? 5 : 3.5}
                            fill={active ? '#fcd34d' : '#d97706'}
                            stroke={active ? '#fff' : 'transparent'}
                            strokeWidth={active ? 1.5 : 0}
                          />
                        );
                      }}
                      activeDot={{ r: 6, fill: '#f59e0b', stroke: '#fffbeb', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <p className="quemado-page__hint produccion-muted shrink-0 rounded-lg border border-amber-400/15 bg-amber-500/[0.06] px-3 py-2 text-[10px] leading-snug">
            <Gem className="mb-0.5 inline h-3 w-3 text-amber-400" />{' '}
            El <strong className="text-amber-400/90">Au recuperado</strong> alimenta el balance y la rentabilidad en Resumen Ejecutivo.
          </p>
        </div>

        <div className="gerencial-page__main produccion-page__main produccion-surface produccion-surface--panel flex min-h-0 flex-col overflow-hidden rounded-xl p-3 pt-2.5 lg:col-span-8 lg:h-full lg:p-4 lg:pt-3.5">

          <div className="produccion-page__day-tabs mb-2 flex shrink-0 items-center gap-1.5 overflow-x-auto pb-2 pt-0.5 snap-x w-full lg:mb-4 lg:gap-2.5 lg:pb-3">
            {diasConRegistros.length === 0 && (
              <div className="produccion-muted text-xs italic">No hay registros en este período.</div>
            )}
            {diasConRegistros.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedDate('todos')}
                className={`produccion-day-pill snap-center flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-xs transition-all ${
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
                  className={`produccion-day-pill snap-center flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] transition-all lg:gap-2 lg:px-3.5 lg:py-2 lg:text-xs ${isSelected ? 'produccion-day-pill--active bg-amber-500 border-amber-500 text-black font-bold' : ''}`}
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
                          icon={<Flame className="h-6 w-6" />}
                          title="Día sin quemados"
                          description="No hay reportes de quemado ingresados para este día."
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
                        aria-label={`Ver detalle de quemado del ${fmtGerencialDate(row.original.fecha)}`}
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
                <span className="produccion-page__footer-amount produccion-page__footer-amount--oro text-[11px] font-bold tabular-nums">
                  {fmtN(tableSummary.oro)} g Au
                </span>
                <span className="gastos-footer-label text-[9px]">·</span>
                <span className="gastos-footer-label text-[9px] tabular-nums">{fmtN(tableSummary.amalgama)} g amalgama</span>
                <span className="gastos-footer-label text-[9px]">·</span>
                <span className="gastos-footer-label text-[9px] tabular-nums">{tableSummary.planchas} planchas</span>
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

        <GerencialMobileChartFold title="Oro recuperado (g)" icon={LineChart}>
          <div className="relative h-36 w-full">
            {diariaChart.length === 0 ? (
              <p className="produccion-muted flex h-full items-center justify-center text-center text-xs italic">
                Sin datos para graficar
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={diariaChart} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <defs>
                    <linearGradient id="quemadoOroGradientMobile" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#b45309" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                  <XAxis
                    dataKey="fecha"
                    tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 8 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => {
                      const d = new Date(val + 'T12:00:00');
                      return `${d.getDate()}/${d.getMonth() + 1}`;
                    }}
                  />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 8 }} tickLine={false} axisLine={false} allowDecimals />
                  <RechartsTooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(245,158,11,0.45)', strokeWidth: 1 }} />
                  <Area
                    type="monotone"
                    dataKey="oro"
                    name="Oro (g)"
                    stroke="#fbbf24"
                    strokeWidth={2}
                    fill="url(#quemadoOroGradientMobile)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </GerencialMobileChartFold>
      </div>

      <PageFormModal
        open={showModal}
        onClose={() => { setShowModal(false); setFormError(null); }}
        sheetTitle={editItem ? 'Editar Quemado' : 'Nuevo Quemado'}
        sheetIcon={<SheetIconBadge icon={Flame} tone="warn" />}
        panelClassName="quemado-page__modal sm:max-w-[72rem] sm:p-5"
      >
        <div className="mb-6 hidden items-center justify-between lg:flex">
          <h2 className="page-form-modal-title flex items-center gap-2 text-lg font-semibold">
            <Flame className="h-5 w-5 mineos-icon-general" /> {editItem ? 'Editar Quemado' : 'Nuevo Quemado'}
          </h2>
          <button
            type="button"
            onClick={() => { setShowModal(false); setFormError(null); }}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-2 text-[var(--dashboard-text-muted)] transition-colors hover:bg-black/[0.06]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {formError && (
          <div className="mb-4 flex animate-in slide-in-from-top-2 items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            <span className="text-sm text-red-400">{formError}</span>
          </div>
        )}

        <div className="voladuras-page__modal-columns grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6">
          <section className="voladuras-page__modal-col flex flex-col gap-4">
            <div className="flex flex-col gap-2.5">
              <h3 className={mineosModalHeading('general')}>
                <span>📍 Identificación</span>
                <span className={mineosModalDivider('general')} />
              </h3>
              <div>
                <label className="input-label">Fecha *</label>
                <AppDatePicker value={form.fecha} onChange={(val) => set('fecha', val)} />
              </div>
              <div>
                <label className="input-label">Turno *</label>
                <AppSelect value={form.turno} onChange={(v) => set('turno', v)} options={turnoOptions} />
              </div>
              <div>
                <label className="input-label">N° Quemada</label>
                <input value={form.numero_quemada} onChange={(e) => set('numero_quemada', e.target.value)} className="input-field" placeholder="001" />
              </div>
              <div>
                <label className="input-label">Responsable</label>
                <input value={form.responsable} onChange={(e) => set('responsable', e.target.value)} className="input-field" />
              </div>
              <div>
                <label className="input-label">Observaciones</label>
                <textarea value={form.observaciones} onChange={(e) => set('observaciones', e.target.value)} className="input-field" rows={2} />
              </div>
            </div>
          </section>

          <section className="voladuras-page__modal-col flex flex-col gap-4">
            <div className="flex flex-col gap-2.5">
              <h3 className={`${mineosModalHeading('general')} justify-between`}>
                <div className="flex items-center gap-2">
                  <span>🥞 Planchas</span>
                  <span className={`${mineosModalDivider('general')} !flex-none w-8`} />
                </div>
                <button
                  type="button"
                  onClick={addPlancha}
                  className={mineosBtnSubtleClass('general')}
                >
                  <Plus className="h-3.5 w-3.5" /> Agregar
                </button>
              </h3>
              <div className="space-y-3">
                {planchas.map((p, i) => (
                  <div key={i} className="app-detail-panel rounded-xl p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold text-white/70">Plancha {i + 1}</span>
                      {planchas.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removePlancha(i)}
                          className="rounded-lg p-1.5 text-white/30 hover:bg-red-500/10 hover:text-red-400"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="input-label text-[10px]">Amalgama (g)</label>
                        <input type="number" step="0.01" value={p.amalgama_g} onChange={(e) => updatePlancha(i, 'amalgama_g', e.target.value)} className="input-field min-h-[36px]" placeholder="60.81" />
                      </div>
                      <div>
                        <label className={mineosLabelAccent('benefit')}>Oro Recup.</label>
                        <input type="number" step="0.01" value={p.oro_recuperado_g} onChange={(e) => updatePlancha(i, 'oro_recuperado_g', e.target.value)} className="input-field min-h-[36px]" placeholder="24.62" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="voladuras-page__modal-col flex flex-col gap-4">
            <div className="flex flex-col gap-2.5">
              <h3 className={mineosModalHeading('general')}>
                <span>🔧 Manto y ⚗️ Retorta</span>
                <span className={mineosModalDivider('general')} />
              </h3>
              <div className="app-detail-panel grid grid-cols-2 gap-3 rounded-xl p-3">
                <div className="col-span-2">
                  <span className="mineos-icon-general text-xs font-semibold">Manto. Área Raspado</span>
                </div>
                <div>
                  <label className="input-label text-[10px]">Amalgama (g)</label>
                  <input type="number" step="0.01" value={form.manto_amalgama_g} onChange={(e) => set('manto_amalgama_g', e.target.value)} className="input-field min-h-[36px]" placeholder="1.19" />
                </div>
                <div>
                  <label className="input-label text-[10px] text-amber-400">Oro Recup.</label>
                  <input type="number" step="0.01" value={form.manto_oro_g} onChange={(e) => set('manto_oro_g', e.target.value)} className="input-field min-h-[36px]" placeholder="0.43" />
                </div>
              </div>

              <div className="app-detail-panel rounded-xl p-3">
                 <span className="mineos-icon-general mb-2 block text-xs font-semibold">Retorta</span>
                 <label className={mineosLabelAccent('benefit')}>Oro Recuperado (g Au)</label>
                 <input type="number" step="0.01" value={form.retorta_oro_g} onChange={(e) => set('retorta_oro_g', e.target.value)} className="input-field min-h-[36px]" placeholder="0.33" />
              </div>
            </div>

            <div className={`mt-2 ${mineosPanel('general')}`}>
              <div className="mb-2 flex items-center gap-2">
                <Calculator className="h-3.5 w-3.5 mineos-icon-general" />
                <span className="mineos-icon-general text-xs font-semibold">Totales (calculados)</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center">
                  <p className="mb-0.5 text-[9px] uppercase tracking-wider text-white/40">Total Amalgama</p>
                  <p className="text-base font-bold text-white/80">
                    {fmtN(formAmalgama)} <span className="text-[10px] text-white/40">g</span>
                  </p>
                </div>
                <div className="border-x border-amber-400/10 text-center">
                  <p className="mb-0.5 text-[9px] uppercase tracking-wider text-white/40">Total Au</p>
                  <p className="mineos-cell-benefit text-base font-bold">
                    {fmtN(formOro)} <span className="text-[10px]">g</span>
                  </p>
                </div>
                <div className="text-center">
                  <p className="mb-0.5 text-[9px] uppercase tracking-wider text-white/40">Merma</p>
                  <p className="mineos-cell-expense text-base font-bold">
                    {formAmalgama > 0 ? `${(((formAmalgama - formOro) / formAmalgama) * 100).toFixed(1)}%` : '—'}
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>

        <PageFormModalFooter className="flex-col-reverse sm:flex-row">
          <button type="button" onClick={() => { setShowModal(false); setFormError(null); }} className="btn-secondary min-h-[48px] sm:min-h-[40px]">
            Cancelar
          </button>
          <button type="button" onClick={handleSave} disabled={isPending} className="btn-primary min-h-[48px] sm:min-h-[40px]">
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {editItem ? 'Actualizar' : 'Registrar Quemado'}
          </button>
        </PageFormModalFooter>
      </PageFormModal>

      <GerencialRecordDetailModal
        open={!!viewItem}
        onClose={() => setViewItem(null)}
        title={viewItem ? `Quemado · ${fmtGerencialDate(viewItem.fecha)}` : 'Detalle de quemado'}
        eyebrow="Detalle de quemado"
        sheetIcon={<SheetIconBadge icon={Flame} tone="warn" />}
        panelClassName="quemado-page__modal sm:max-w-[72rem] sm:p-5"
      >
        {viewItem ? <QuemadoRecordDetail record={viewItem} /> : null}
      </GerencialRecordDetailModal>
    </div>
  );
}

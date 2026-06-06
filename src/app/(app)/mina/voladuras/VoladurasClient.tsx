'use client';

import { useState, useTransition, useMemo, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useCanEdit } from '@/lib/use-can-edit';
import { createVoladura, updateVoladura, deleteVoladura } from '@/lib/actions/voladuras';
import type { ReporteVoladura, PausaBarrenado } from '@/lib/types';
import { downloadVoladurasPDF } from '@/lib/pdf-reports';
import { toast } from 'sonner';
import {
  Loader2, Plus, X, ChevronLeft, ChevronRight, Flame, Target, Package, AlertTriangle, Download, Search, Zap, LineChart, Scale,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { AppSelect } from '@/components/ui/AppSelect';
import { useConfirm } from '@/components/ui/ConfirmDialogProvider';
import { useBibliotecaOptions, useTurnoOptions } from '@/contexts/biblioteca-context';
import { PageFormModal, PageFormModalFooter } from '@/components/ui/PageFormModal';
import EmptyState from '@/components/EmptyState';
import { FadeIn } from '@/components/ui/motion';
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

const VOLADURAS_PAGE_MAX = 12;
const VOLADURAS_PAGE_BUTTONS_MAX = 5;
const VOLADURAS_ROW_MIN_PX = 40;
const VOLADURAS_HEAD_FALLBACK_PX = 40;

const fmtNum = (n: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n);

const CHART_DAYS_MAX = 14;

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
          <span className="text-xs font-bold text-white">
            {entry.name.includes('kg')
              ? `${Number(entry.value).toFixed(1)} kg`
              : entry.name.includes('Disparo')
                ? Number(entry.value).toFixed(1)
                : fmtNum(Number(entry.value))}
          </span>
        </div>
      ))}
    </div>
  );
}

interface VoladurasClientProps {
  data: ReporteVoladura[];
}

export default function VoladurasClient({ data: initialData }: VoladurasClientProps) {
  const { user } = useAuth();
  const canEdit = useCanEdit();
  const turnoOptions = useTurnoOptions();
  const verticalOptions = useBibliotecaOptions('verticales_voladura', {
    prependEmpty: true,
    emptyLabel: '— Sin especificar —',
  });
  const minaOptions = useBibliotecaOptions('minas');

  const defaultDate = useMemo(() => {
    const dates = Array.from(new Set(initialData.map((d) => d.fecha))).sort((a, b) => b.localeCompare(a));
    return dates[0] ?? new Date().toISOString().split('T')[0];
  }, [initialData]);

  const [selectedDate, setSelectedDate] = useState('todos');
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: VOLADURAS_PAGE_MAX });
  const tableBodyRef = useRef<HTMLDivElement>(null);

  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<ReporteVoladura | null>(null);
  const [pausas, setPausas] = useState<PausaBarrenado[]>([]);
  const [isPending, startTransition] = useTransition();
  const confirmDialog = useConfirm();

  const emptyForm = {
    fecha: selectedDate === 'todos' ? new Date().toISOString().slice(0, 10) : selectedDate,
    turno: 'noche' as ReporteVoladura['turno'],
    mina: '', responsable: '',
    hora_inicio_barrenado: '', hora_fin_barrenado: '',
    numero_disparo: '', hora_disparo: '', vertical_disparo: '', sin_novedad: true,
    huecos_cantidad: '', huecos_pies: '',
    chupis_cantidad: '', chupis_pies: '',
    fosforos_lp: '', espaguetis: '', vitamina_e: '', trenza_metros: '', arroz_kg: '',
    observaciones_disparo: '', observaciones: '',
  };
  const [form, setForm] = useState(emptyForm);
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
    const headH = el.querySelector('thead')?.getBoundingClientRect().height ?? VOLADURAS_HEAD_FALLBACK_PX;
    const bodyAvailable = el.clientHeight - headH;
    const pageRows = Math.min(
      VOLADURAS_PAGE_MAX,
      Math.max(1, Math.floor(bodyAvailable / VOLADURAS_ROW_MIN_PX)),
    );
    setPagination((prev) => (prev.pageSize === pageRows ? prev : { ...prev, pageSize: pageRows }));
  }, []);

  const filteredCount = table.getFilteredRowModel().rows.length;
  const pageCount = table.getPageCount();
  const displayPageCount = Math.max(1, pageCount);
  const pageIndex = Math.min(pagination.pageIndex, Math.max(0, displayPageCount - 1));
  const activePageIndex = filteredCount === 0 ? 0 : pageIndex;
  const pageWindowStart =
    Math.floor(activePageIndex / VOLADURAS_PAGE_BUTTONS_MAX) * VOLADURAS_PAGE_BUTTONS_MAX;
  const pageNumbers = useMemo(() => {
    const len = Math.min(VOLADURAS_PAGE_BUTTONS_MAX, Math.max(0, displayPageCount - pageWindowStart));
    if (len === 0) return [0];
    return Array.from({ length: len }, (_, i) => pageWindowStart + i);
  }, [displayPageCount, pageWindowStart]);

  const tableSummary = useMemo(() => {
    const rows = table.getFilteredRowModel().rows;
    return {
      huecos: rows.reduce((s, r) => s + (Number(r.original.huecos_cantidad) || 0), 0),
      chupis: rows.reduce((s, r) => s + (Number(r.original.chupis_cantidad) || 0), 0),
      arroz: rows.reduce((s, r) => s + (Number(r.original.arroz_kg) || 0), 0),
      fosforos: rows.reduce((s, r) => s + (Number(r.original.fosforos_lp) || 0), 0),
      disparos: rows.filter((r) => r.original.numero_disparo).length,
      count: rows.length,
    };
  }, [filteredCount, globalFilter, dataForSelectedDate, sorting, pagination.pageIndex]);

  const pageRows = table.getPaginationRowModel().rows;
  const colCount = table.getAllLeafColumns().length;

  const kpiRows = useMemo(() => [
    { label: 'Huecos', value: fmtNum(tableSummary.huecos), glow: 'blue' as const, icon: <Target className="h-5 w-5 text-blue-400" />, bg: 'bg-blue-500/10' },
    { label: 'Chupis', value: fmtNum(tableSummary.chupis), glow: 'amber' as const, icon: <Flame className="h-5 w-5 text-amber-400" />, bg: 'bg-amber-500/10' },
    { label: 'Arroz (ANFO)', value: `${tableSummary.arroz.toFixed(1)} kg`, glow: 'red' as const, icon: <Package className="h-5 w-5 text-red-400" />, bg: 'bg-red-500/10' },
    { label: 'Fósforos LP', value: fmtNum(tableSummary.fosforos), glow: 'purple' as const, icon: <Zap className="h-5 w-5 text-purple-400" />, bg: 'bg-purple-500/10' },
    { label: 'Disparos', value: fmtNum(tableSummary.disparos), glow: 'emerald' as const, icon: <AlertTriangle className="h-5 w-5 text-emerald-400" />, bg: 'bg-emerald-500/10' },
  ], [tableSummary]);

  const diariaChart = useMemo(() => {
    const byDate = new Map<string, { fecha: string; huecos: number; disparos: number; registros: number }>();
    for (const r of initialData) {
      const cur = byDate.get(r.fecha) ?? { fecha: r.fecha, huecos: 0, disparos: 0, registros: 0 };
      cur.huecos += Number(r.huecos_cantidad) || 0;
      cur.registros += 1;
      if (r.numero_disparo) cur.disparos += 1;
      byDate.set(r.fecha, cur);
    }
    return Array.from(byDate.values())
      .map((d) => {
        const divisor = d.disparos > 0 ? d.disparos : d.registros;
        return {
          fecha: d.fecha,
          huecos: d.huecos,
          disparos: d.disparos,
          huecosPorDisparo: divisor > 0 ? d.huecos / divisor : 0,
        };
      })
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .slice(-CHART_DAYS_MAX);
  }, [initialData]);

  const dayBalance = useMemo(() => {
    const { huecos, chupis, arroz, count } = tableSummary;
    const sinNovedad = dataForSelectedDate.filter((r) => r.sin_novedad).length;
    const conNovedad = count - sinNovedad;
    const ratioHC = chupis > 0 ? huecos / chupis : null;
    const kgPorHueco = huecos > 0 ? arroz / huecos : null;
    const piesHueco =
      huecos > 0
        ? dataForSelectedDate.reduce((s, r) => s + (Number(r.huecos_pies) || 0) * (Number(r.huecos_cantidad) || 0), 0) / huecos
        : null;
    const balanceLabel =
      ratioHC == null
        ? '—'
        : Math.abs(ratioHC - 1) <= 0.1
          ? 'Equilibrado'
          : ratioHC > 1
            ? 'Más huecos'
            : 'Más chupis';

    return { huecos, chupis, arroz, count, sinNovedad, conNovedad, ratioHC, kgPorHueco, piesHueco, balanceLabel };
  }, [tableSummary, dataForSelectedDate]);

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

  const addPausa = () => setPausas((p) => [...p, { hora_inicio: '', hora_fin: '', motivo: '' }]);
  const removePausa = (i: number) => setPausas((p) => p.filter((_, idx) => idx !== i));
  const updatePausa = (i: number, key: keyof PausaBarrenado, val: string) =>
    setPausas((p) => p.map((x, idx) => (idx === i ? { ...x, [key]: val } : x)));

  const openNew = () => {
    setEditItem(null);
    setForm({ ...emptyForm, fecha: selectedDate === 'todos' ? new Date().toISOString().slice(0, 10) : selectedDate });
    setPausas([]);
    setShowModal(true);
  };

  const openEdit = (item: ReporteVoladura) => {
    setEditItem(item);
    setPausas(item.pausas_barrenado || []);
    setForm({
      fecha: item.fecha, turno: item.turno,
      mina: item.mina || '', responsable: item.responsable || '',
      hora_inicio_barrenado: item.hora_inicio_barrenado || '',
      hora_fin_barrenado: item.hora_fin_barrenado || '',
      numero_disparo: item.numero_disparo || '',
      hora_disparo: item.hora_disparo || '',
      vertical_disparo: item.vertical_disparo || '',
      sin_novedad: item.sin_novedad,
      huecos_cantidad: String(item.huecos_cantidad),
      huecos_pies: String(item.huecos_pies),
      chupis_cantidad: String(item.chupis_cantidad),
      chupis_pies: String(item.chupis_pies),
      fosforos_lp: String(item.fosforos_lp),
      espaguetis: String(item.espaguetis),
      vitamina_e: String(item.vitamina_e),
      trenza_metros: String(item.trenza_metros),
      arroz_kg: String(item.arroz_kg),
      observaciones_disparo: item.observaciones_disparo || '',
      observaciones: item.observaciones || '',
    });
    setShowModal(true);
  };

  const handleSave = () => {
    startTransition(async () => {
      const payload = {
        ...form,
        pausas_barrenado: pausas.length > 0 ? pausas : null,
        registrado_por: user?.id,
      };

      const res = editItem
        ? await updateVoladura({ ...payload, id: editItem.id })
        : await createVoladura(payload);

      if (res.ok) {
        toast.success(res.message);
        setShowModal(false);
        setEditItem(null);
        setForm({ ...emptyForm, fecha: selectedDate === 'todos' ? new Date().toISOString().slice(0, 10) : selectedDate });
        setPausas([]);
      } else {
        toast.error(res.message || 'Error al guardar el reporte');
      }
    });
  };

  const handleDelete = async (id: string) => {
    if (!(await confirmDialog({
      title: 'Eliminar reporte',
      message: '¿Eliminar este reporte de voladura?',
      variant: 'danger'
    }))) return;
    startTransition(async () => {
      const res = await deleteVoladura(id);
      if (res.ok) {
        toast.success(res.message);
      } else {
        toast.error(res.message || 'Error al eliminar el reporte');
      }
    });
  };

  return (
    <div className="voladuras-page produccion-page flex min-h-0 w-full flex-1 flex-col overflow-hidden">

      <FadeIn className="produccion-page__toolbar shrink-0">
        <div className="voladuras-page__toolbar-grid produccion-page__toolbar-grid grid grid-cols-1 gap-3 lg:grid-cols-12 lg:items-center lg:gap-4">
          <div className="voladuras-page__toolbar-search min-w-0 lg:col-span-4">
            <div className="produccion-page__search produccion-surface produccion-surface--input flex h-9 w-full min-w-0 items-center rounded-lg px-3 py-2">
              <Search className="produccion-icon-muted mr-2 h-4 w-4 shrink-0" />
              <input
                type="text"
                placeholder="Buscar por mina, frente o disparo..."
                value={globalFilter ?? ''}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="produccion-search-input w-full min-w-0 border-none bg-transparent text-sm outline-none"
              />
            </div>
          </div>
          <div className="voladuras-page__toolbar-actions flex min-w-0 w-full flex-wrap items-center gap-2 sm:flex-nowrap lg:col-span-8 lg:justify-between">
            <button
              type="button"
              onClick={() => downloadVoladurasPDF(dataForSelectedDate, selectedDate)}
              disabled={dataForSelectedDate.length === 0}
              className="voladuras-page__toolbar-btn produccion-page__toolbar-btn btn-secondary flex h-9 shrink-0 items-center justify-center gap-1.5 px-3 text-xs disabled:opacity-40"
              title="Exportar PDF del día"
            >
              <Download className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Exportar PDF</span>
            </button>
            {canEdit && (
              <button
                type="button"
                onClick={openNew}
                className="voladuras-page__toolbar-btn produccion-page__toolbar-btn flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 font-bold text-black shadow-lg shadow-amber-900/20 transition-colors hover:bg-amber-500"
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span className="truncate">Nuevo Reporte</span>
              </button>
            )}
          </div>
        </div>
      </FadeIn>

      <div className="voladuras-page__grid produccion-page__grid min-h-0 flex-1 grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-4">

        <div className="produccion-page__aside flex min-h-0 flex-col gap-2 overflow-y-auto lg:col-span-4 lg:h-full lg:overflow-hidden">
          {kpiRows.map((k) => (
            <div
              key={k.label}
              className="produccion-surface gerencial-kpi-card flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5"
            >
              <div className={`gerencial-kpi-glow gerencial-kpi-glow--${k.glow}`} aria-hidden />
              <div className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${k.bg}`}>
                {k.icon}
              </div>
              <div className="relative min-w-0 flex-1">
                <span className="produccion-kpi-label block text-[8px] font-bold uppercase leading-tight tracking-wider">
                  {k.label}
                </span>
                <span className={`gerencial-kpi-value gerencial-kpi-value--${k.glow} text-lg font-bold leading-tight tabular-nums`}>
                  {k.value}
                </span>
              </div>
            </div>
          ))}

          <div className="produccion-page__chart produccion-surface flex min-h-[11rem] flex-1 flex-col rounded-xl p-3 lg:min-h-0">
            <h2 className="produccion-section-title mb-2 flex shrink-0 items-center gap-2 text-xs font-bold">
              <LineChart className="h-4 w-4 text-amber-400" />
              Huecos por Disparo
            </h2>
            <div className="relative min-h-[7rem] w-full flex-1">
              {diariaChart.length === 0 ? (
                <p className="produccion-muted flex h-full items-center justify-center text-center text-xs italic">
                  Sin datos para graficar
                </p>
              ) : (
                <ResponsiveContainer width="100%" height="100%" className="absolute inset-0">
                  <AreaChart data={diariaChart} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="voladurasHuecosGradient" x1="0" y1="0" x2="0" y2="1">
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
                      domain={['auto', 'auto']}
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
                      dataKey="huecosPorDisparo"
                      name="Huecos / Disparo"
                      stroke="#fbbf24"
                      strokeWidth={2.5}
                      fill="url(#voladurasHuecosGradient)"
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

            <div className="mt-3 shrink-0 border-t border-[var(--prod-border)] pt-3">
              <h3 className="produccion-section-title mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
                <Scale className="h-3.5 w-3.5 text-amber-500/80" />
                Balance del día
              </h3>
              {dayBalance.count === 0 ? (
                <p className="produccion-muted text-xs italic">Selecciona un día con registros</p>
              ) : (
                <dl className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[10px]">
                  <dt className="produccion-muted">Huecos / Chupis</dt>
                  <dd className="text-right font-semibold tabular-nums text-blue-300">
                    {dayBalance.huecos} : {dayBalance.chupis}
                    <span className="ml-1 text-[9px] font-normal text-amber-400/90">({dayBalance.balanceLabel})</span>
                  </dd>
                  <dt className="produccion-muted">kg ANFO / hueco</dt>
                  <dd className="text-right font-semibold tabular-nums text-red-400">
                    {dayBalance.kgPorHueco != null ? `${dayBalance.kgPorHueco.toFixed(2)} kg` : '—'}
                  </dd>
                  <dt className="produccion-muted">Prom. pies / hueco</dt>
                  <dd className="text-right font-semibold tabular-nums text-white/75">
                    {dayBalance.piesHueco != null ? dayBalance.piesHueco.toFixed(1) : '—'}
                  </dd>
                  <dt className="produccion-muted">Sin novedad</dt>
                  <dd className="text-right font-semibold tabular-nums text-emerald-400">
                    {dayBalance.sinNovedad} / {dayBalance.count}
                  </dd>
                </dl>
              )}
            </div>
          </div>
        </div>

        <div className="produccion-page__main produccion-surface produccion-surface--panel flex min-h-0 flex-col overflow-hidden rounded-xl p-4 pt-3.5 lg:col-span-8 lg:h-full">

          <div className="produccion-page__day-tabs mb-4 flex shrink-0 items-center gap-2.5 overflow-x-auto pb-3 pt-0.5 snap-x w-full">
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
                  className={`produccion-day-pill snap-center flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-xs transition-all ${isSelected ? 'produccion-day-pill--active bg-amber-500 border-amber-500 text-black font-bold' : ''}`}
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
                          icon={<Zap className="h-6 w-6" />}
                          title="Día sin voladuras"
                          description="No hay reportes de voladura ingresados para este día."
                        />
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((row) => (
                      <tr key={row.id} className="produccion-table-row border-b transition-colors">
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
                  {fmtNum(tableSummary.huecos)} huecos
                </span>
                <span className="gastos-footer-label text-[9px]">·</span>
                <span className="gastos-footer-label text-[9px] tabular-nums">{tableSummary.chupis} chupis</span>
                <span className="gastos-footer-label text-[9px]">·</span>
                <span className="gastos-footer-label text-[9px] tabular-nums">{tableSummary.arroz.toFixed(1)} kg arroz</span>
                <span className="gastos-footer-label text-[9px]">·</span>
                <span className="gastos-footer-label text-[9px] tabular-nums">{tableSummary.disparos} disparos</span>
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

      <PageFormModal open={showModal} onClose={() => setShowModal(false)} panelClassName="voladuras-page__modal sm:max-w-[72rem] sm:p-5">
        <div className="flex items-center justify-between mb-6">
          <h2 className="page-form-modal-title text-lg font-semibold">
            {editItem ? 'Editar Reporte' : 'Nuevo Reporte de Voladura'}
          </h2>
          <button
            type="button"
            onClick={() => setShowModal(false)}
            className="rounded-lg p-1.5 text-[var(--dashboard-text-muted)] transition-colors hover:bg-black/[0.06]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="voladuras-page__modal-columns grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6">
          <section className="voladuras-page__modal-col flex flex-col gap-4">
            <div className="flex flex-col gap-2.5">
              <h3 className="produccion-page__modal-col-title flex items-center gap-2 text-sm font-semibold text-amber-400">
                <span>📍 Identificación</span>
                <span className="h-px flex-1 bg-amber-400/20" />
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
                <label className="input-label">Mina</label>
                <AppSelect
                  value={form.mina}
                  onChange={(v) => set('mina', v)}
                  options={minaOptions}
                  placeholder="— Seleccionar mina —"
                />
              </div>
              <div>
                <label className="input-label">Responsable</label>
                <input value={form.responsable} onChange={(e) => set('responsable', e.target.value)} className="input-field" />
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <h3 className="produccion-page__modal-col-title flex items-center gap-2 text-sm font-semibold text-blue-400">
                <span>⛏ Proceso de Barrenado</span>
                <span className="h-px flex-1 bg-blue-400/20" />
              </h3>
              <div>
                <label className="input-label">Hora Inicio</label>
                <input type="time" value={form.hora_inicio_barrenado} onChange={(e) => set('hora_inicio_barrenado', e.target.value)} className="input-field" />
              </div>
              <div>
                <label className="input-label">Hora Culmina</label>
                <input type="time" value={form.hora_fin_barrenado} onChange={(e) => set('hora_fin_barrenado', e.target.value)} className="input-field" />
              </div>
              <div className="mt-1">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-orange-400/80">⏸ Pausas</span>
                  <button type="button" onClick={addPausa} className="btn-secondary !py-1 !px-2.5 !text-xs">
                    <Plus className="mr-1 h-3.5 w-3.5" /> Agregar
                  </button>
                </div>
                <div className="space-y-2">
                  {pausas.map((p, i) => (
                    <div key={i} className="grid grid-cols-[1fr_1fr_2fr_auto] items-start gap-2 rounded-xl border border-orange-400/15 bg-orange-500/[0.06] p-3">
                      <input type="time" value={p.hora_inicio} onChange={(e) => updatePausa(i, 'hora_inicio', e.target.value)} className="input-field" />
                      <input type="time" value={p.hora_fin} onChange={(e) => updatePausa(i, 'hora_fin', e.target.value)} className="input-field" />
                      <input value={p.motivo} onChange={(e) => updatePausa(i, 'motivo', e.target.value)} placeholder="Motivo" className="input-field" />
                      <button type="button" onClick={() => removePausa(i)} className="rounded-lg p-2 text-white/30 transition-colors hover:bg-red-500/15 hover:text-red-400">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="voladuras-page__modal-col flex flex-col gap-4">
            <div className="flex flex-col gap-2.5">
              <h3 className="produccion-page__modal-col-title flex items-center gap-2 text-sm font-semibold text-orange-400">
                <span>🧪 Condimentos</span>
                <span className="h-px flex-1 bg-orange-400/20" />
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="input-label">Fósforos LP</label>
                  <input type="number" value={form.fosforos_lp} onChange={(e) => set('fosforos_lp', e.target.value)} className="input-field" />
                </div>
                <div>
                  <label className="input-label">Espaguetis</label>
                  <input type="number" value={form.espaguetis} onChange={(e) => set('espaguetis', e.target.value)} className="input-field" />
                </div>
                <div>
                  <label className="input-label">Vitamina E</label>
                  <input type="number" value={form.vitamina_e} onChange={(e) => set('vitamina_e', e.target.value)} className="input-field" />
                </div>
                <div>
                  <label className="input-label">Trenza (m)</label>
                  <input type="number" step="0.5" value={form.trenza_metros} onChange={(e) => set('trenza_metros', e.target.value)} className="input-field" />
                </div>
                <div className="col-span-2 rounded-xl border border-red-400/20 bg-red-500/[0.07] p-3">
                  <label className="input-label !font-semibold !text-red-400">Arroz (kg)</label>
                  <input type="number" step="0.5" value={form.arroz_kg} onChange={(e) => set('arroz_kg', e.target.value)} className="input-field font-bold" />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <h3 className="produccion-page__modal-col-title flex items-center gap-2 text-sm font-semibold text-purple-400">
                <span>🕳 Huecos & Chupis</span>
                <span className="h-px flex-1 bg-purple-400/20" />
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-blue-400/20 bg-blue-500/[0.07] p-3">
                  <label className="input-label !text-blue-400">Huecos cantidad</label>
                  <input type="number" value={form.huecos_cantidad} onChange={(e) => set('huecos_cantidad', e.target.value)} className="input-field font-bold text-lg" />
                </div>
                <div className="rounded-xl border border-blue-400/20 bg-blue-500/[0.07] p-3">
                  <label className="input-label !text-blue-400">Pies / Hueco</label>
                  <input type="number" value={form.huecos_pies} onChange={(e) => set('huecos_pies', e.target.value)} className="input-field" />
                </div>
                <div className="rounded-xl border border-amber-400/20 bg-amber-500/[0.07] p-3">
                  <label className="input-label !text-amber-400">Chupis cantidad</label>
                  <input type="number" value={form.chupis_cantidad} onChange={(e) => set('chupis_cantidad', e.target.value)} className="input-field font-bold text-lg" />
                </div>
                <div className="rounded-xl border border-amber-400/20 bg-amber-500/[0.07] p-3">
                  <label className="input-label !text-amber-400">Pies / Chupi</label>
                  <input type="number" value={form.chupis_pies} onChange={(e) => set('chupis_pies', e.target.value)} className="input-field" />
                </div>
              </div>
            </div>
          </section>

          <section className="voladuras-page__modal-col flex flex-col gap-2.5">
            <h3 className="produccion-page__modal-col-title flex items-center gap-2 text-sm font-semibold text-red-400">
              <span>💥 Disparo</span>
              <span className="h-px flex-1 bg-red-400/20" />
            </h3>
            <div>
              <label className="input-label">N° Disparo</label>
              <input value={form.numero_disparo} onChange={(e) => set('numero_disparo', e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="input-label">Hora</label>
              <input type="time" value={form.hora_disparo} onChange={(e) => set('hora_disparo', e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="input-label">Vertical</label>
              <AppSelect value={form.vertical_disparo} onChange={(v) => set('vertical_disparo', v)} options={verticalOptions} placeholder="— Sin especificar —" />
            </div>
            <label className="flex cursor-pointer items-center gap-3" onClick={() => set('sin_novedad', !form.sin_novedad)}>
              <div className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${form.sin_novedad ? 'bg-emerald-500' : 'bg-red-500/70'}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${form.sin_novedad ? 'left-5' : 'left-0.5'}`} />
              </div>
              <span className={`text-sm font-semibold ${form.sin_novedad ? 'text-emerald-400' : 'text-red-400'}`}>
                {form.sin_novedad ? '✓ Sin novedad' : '⚠ Novedad'}
              </span>
            </label>

            <div>
              <label className="input-label">Observaciones Disparo</label>
              <textarea value={form.observaciones_disparo} onChange={(e) => set('observaciones_disparo', e.target.value)} className="input-field" rows={2} />
            </div>
            <div>
              <label className="input-label">Observaciones Turno</label>
              <textarea value={form.observaciones} onChange={(e) => set('observaciones', e.target.value)} className="input-field" rows={2} />
            </div>
          </section>
        </div>

        <PageFormModalFooter className="flex-col-reverse sm:flex-row">
          <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending || !form.huecos_cantidad}
            className="btn-primary"
          >
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {editItem ? 'Actualizar' : 'Registrar Voladura'}
          </button>
        </PageFormModalFooter>
      </PageFormModal>
    </div>
  );
}

'use client';

import { useState, useTransition, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useCanEdit } from '@/lib/use-can-edit';
import { createQuemado, updateQuemado, deleteQuemado } from '@/lib/actions/quemado';
import type { ReporteQuemado, PlanchaItem } from '@/lib/types';
import {
  Loader2, Flame, Plus, X, Edit2, Trash2, Calculator,
  ChevronLeft, ChevronRight, CalendarDays, AlertCircle, Gem, Search
} from 'lucide-react';
import MetricCard from '@/components/MetricCard';
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

interface QuemadoClientProps {
  data: ReporteQuemado[];
}

const fmtN = (n: number) =>
  new Intl.NumberFormat('es-VE', { maximumFractionDigits: 4, minimumFractionDigits: 2 }).format(n);

const emptyPlancha = (): { amalgama_g: string; oro_recuperado_g: string } => ({ amalgama_g: '', oro_recuperado_g: '' });

export default function QuemadoClient({ data: initialData }: QuemadoClientProps) {
  const { user } = useAuth();
  const canEdit = useCanEdit();

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);
  
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<ReporteQuemado | null>(null);
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const emptyForm = {
    fecha: selectedDate,
    turno: 'dia' as ReporteQuemado['turno'],
    numero_quemada: '',
    manto_amalgama_g: '',
    manto_oro_g: '',
    retorta_oro_g: '',
    responsable: '',
    observaciones: '',
  };
  const [form, setForm] = useState(emptyForm);
  const [planchas, setPausas] = useState([emptyPlancha()]); // Pausas here means planchas state
  const set = (field: string, value: unknown) => setForm(f => ({ ...f, [field]: value }));

  const dataForSelectedDate = useMemo(
    () => initialData.filter(d => d.fecha === selectedDate),
    [initialData, selectedDate]
  );
  
  const availableDates = useMemo(() => Array.from(new Set(initialData.map(d => d.fecha))).sort(), [initialData]);

  const navigateDay = (dir: 'prev' | 'next') => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + (dir === 'next' ? 1 : -1));
    setSelectedDate(d.toISOString().split('T')[0]);
  };
  const isToday = selectedDate === new Date().toISOString().split('T')[0];

  const table = useReactTable({
    data: dataForSelectedDate,
    columns: columns(
      (item) => openEdit(item),
      (id) => handleDelete(id)
    ),
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 15 } },
  });

  // Derived Totals
  const totalAmalgamaDay = dataForSelectedDate.reduce((s, d) => s + Number(d.total_amalgama_g || 0), 0);
  const totalOroDay      = dataForSelectedDate.reduce((s, d) => s + Number(d.total_oro_g || 0), 0);
  const mermaDay         = totalAmalgamaDay > 0 ? ((totalAmalgamaDay - totalOroDay) / totalAmalgamaDay) * 100 : 0;
  const totalPlanchasDay = dataForSelectedDate.reduce((s, d) => s + (d.planchas?.length || 0), 0);

  // Form Live Totals
  const formAmalgama = planchas.reduce((s, p) => s + (parseFloat(p.amalgama_g) || 0), 0) + (parseFloat(form.manto_amalgama_g) || 0);
  const formOro = planchas.reduce((s, p) => s + (parseFloat(p.oro_recuperado_g) || 0), 0) + (parseFloat(form.manto_oro_g) || 0) + (parseFloat(form.retorta_oro_g) || 0);

  // Plancha helpers
  const addPlancha    = () => setPausas(p => [...p, emptyPlancha()]);
  const removePlancha = (i: number) => setPausas(p => p.filter((_, idx) => idx !== i));
  const updatePlancha = (i: number, key: keyof ReturnType<typeof emptyPlancha>, val: string) =>
    setPausas(p => p.map((x, idx) => idx === i ? { ...x, [key]: val } : x));

  const handleSave = () => {
    if (planchas.length === 0) { setFormError('Agrega al menos 1 plancha.'); return; }
    if (formOro <= 0) { setFormError('El total de oro recuperado debe ser mayor que 0.'); return; }
    
    setFormError(null);
    startTransition(async () => {
      const planchasPayload = planchas.map(p => ({
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

      let res;
      if (editItem) {
        res = await updateQuemado({ ...payload, id: editItem.id });
      } else {
        res = await createQuemado(payload);
      }

      if (res?.ok === false) {
        setFormError(res.message);
      } else {
        setShowModal(false);
        setEditItem(null);
        setForm({ ...emptyForm, fecha: selectedDate });
        setPausas([emptyPlancha()]);
      }
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm('¿Eliminar este reporte de quemado?')) return;
    startTransition(async () => {
      await deleteQuemado(id);
    });
  };

  const openEdit = (item: ReporteQuemado) => {
    setEditItem(item);
    setPausas(item.planchas.map(p => ({ amalgama_g: String(p.amalgama_g), oro_recuperado_g: String(p.oro_recuperado_g) })));
    setForm({
      fecha: item.fecha, turno: item.turno,
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

  const fmtDateDisplay = (s: string) =>
    new Date(s + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const turnoLabel: Record<string, string> = { dia: '☀ Día', noche: '🌙 Noche', completo: '🔄 Completo' };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white/90 font-bold tracking-tight text-2xl flex items-center gap-3">
            <Flame className="w-6 h-6 text-orange-400" /> Quemado de Planchas
          </h1>
          <p className="text-white/40 text-sm mt-1">
            <span className="text-amber-400 font-semibold">{fmtN(totalOroDay)} g Au</span> recuperados
            {' '}— {dataForSelectedDate.length} quemadas
            {mermaDay > 0 && <span className="text-white/25"> — Merma: {mermaDay.toFixed(1)}%</span>}
          </p>
        </div>
        <button onClick={() => { setEditItem(null); setForm({ ...emptyForm, fecha: selectedDate }); setPausas([emptyPlancha()]); setFormError(null); setShowModal(true); }}
          disabled={!canEdit} className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed">
          <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Nuevo Reporte</span>
        </button>
      </div>

      <div className="card-glass p-4 flex items-start gap-3 border border-amber-400/20">
        <Gem className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-white/50">
          El campo <strong className="text-amber-400">Au Total Recuperado</strong> alimenta directamente el Balance Diario
          para calcular la <strong className="text-white/70">rentabilidad real</strong> de la operación.
        </p>
      </div>

      {/* Day Selector */}
      <div className="card-glass p-4">
        <div className="flex items-center justify-between">
          <button onClick={() => navigateDay('prev')} className="p-2 rounded-xl hover:bg-white/[0.06] text-white/40 hover:text-white/75 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-orange-400" />
              <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                className="input-field !py-1.5 !px-3 !text-base font-semibold !w-auto !border-orange-400/30" />
            </div>
            <div className="text-sm text-white/40 capitalize hidden sm:block">{fmtDateDisplay(selectedDate)}</div>
            {isToday && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-400/25">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Hoy
              </span>
            )}
          </div>
          <button onClick={() => navigateDay('next')} className="p-2 rounded-xl hover:bg-white/[0.06] text-white/40 hover:text-white/75 transition-colors">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        {availableDates.length > 0 && (
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
            {[...availableDates].reverse().map(date => {
              const d = new Date(date + 'T12:00:00');
              const isSel = date === selectedDate;
              return (
                <button key={date} onClick={() => setSelectedDate(date)}
                  className={`flex-shrink-0 flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    isSel ? 'bg-orange-500/15 text-orange-300 border border-orange-400/30'
                    : 'bg-white/[0.04] text-white/40 border border-transparent hover:bg-white/[0.08] hover:text-white/65'
                  }`}>
                  <span className="uppercase">{d.toLocaleDateString('es-ES', { weekday: 'short' })}</span>
                  <span className="text-sm font-bold">{d.getDate()}</span>
                  <span className={`text-[10px] ${isSel ? 'text-orange-400' : 'text-white/30'}`}>{initialData.filter(x => x.fecha === date).length} reg</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Oro Recuperado" value={totalOroDay} unit="g" variant="gold" icon={<span className="text-base">🔥</span>} />
        <MetricCard label="Total Amalgama" value={totalAmalgamaDay} unit="g" variant="neutral" icon={<span className="text-base">⚗️</span>} />
        <MetricCard label="Planchas" value={totalPlanchasDay} variant="neutral" icon={<span className="text-base">🟫</span>} />
        <MetricCard label="Merma Prom." value={mermaDay > 0 ? mermaDay.toFixed(1) : '—'} unit={mermaDay > 0 ? '%' : undefined}
          variant={mermaDay > 0 ? (mermaDay < 55 ? 'positive' : mermaDay < 70 ? 'neutral' : 'negative') : 'neutral'} icon={<Calculator className="w-4 h-4" />} />
      </div>

      <div className="flex items-center bg-zinc-900/50 border border-white/5 rounded-xl px-3 py-2 w-full max-w-sm">
        <Search className="w-4 h-4 text-white/40 mr-2" />
        <input type="text" placeholder="Buscar quemado..." value={globalFilter ?? ''} onChange={(e) => setGlobalFilter(e.target.value)}
          className="bg-transparent border-none outline-none text-sm text-white/90 placeholder:text-white/30 w-full" />
      </div>

      {/* Mobile Cards */}
      <div className="grid grid-cols-1 space-y-3 md:hidden">
        {table.getRowModel().rows.map(row => {
          const d = row.original;
          return (
            <div key={d.id} className="card-glass p-4 border-l-4 border-l-orange-500 relative">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/45 bg-white/[0.07] px-2 py-0.5 rounded-sm">
                    {turnoLabel[d.turno]}
                  </span>
                  {d.numero_quemada && <p className="text-white/60 text-xs mt-1.5 font-medium">Quemada #{d.numero_quemada}</p>}
                </div>
                <div className="text-right bg-amber-500/10 px-3 py-2 rounded-xl border border-amber-500/20 shadow-inner">
                  <span className="font-black text-amber-400 text-xl block leading-none">{fmtN(d.total_oro_g)} <span className="text-sm">g</span></span>
                  <span className="text-[10px] text-amber-400/60 uppercase tracking-widest mt-1 block font-bold">Au Recup.</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-3 text-sm bg-white/[0.05] p-3 rounded-xl border border-white/[0.07]">
                <div><span className="text-xs text-white/35 block mb-0.5 font-semibold">Planchas</span><span className="text-white/70 font-semibold">{d.planchas?.length || 0}</span></div>
                <div><span className="text-xs text-white/35 block mb-0.5 font-semibold">Amalgama</span><span className="text-white/70 font-semibold">{fmtN(d.total_amalgama_g)} g</span></div>
                <div><span className="text-xs text-white/35 block mb-0.5 font-semibold">Merma</span>
                  <span className="text-orange-400 font-bold">{d.total_amalgama_g > 0 ? `${(((d.total_amalgama_g - d.total_oro_g) / d.total_amalgama_g) * 100).toFixed(1)}%` : '—'}</span></div>
              </div>

              {d.planchas?.length > 0 && (
                <div className="space-y-1 mb-4 bg-black/20 p-2 rounded-lg border border-white/5">
                  {d.planchas.map((p, i) => (
                    <div key={i} className="flex justify-between text-xs text-white/50 px-1 py-0.5">
                      <span>Plancha {i + 1}</span>
                      <span>{fmtN(p.amalgama_g)}g → <span className="text-amber-400/90 font-medium">{fmtN(p.oro_recuperado_g)}g</span></span>
                    </div>
                  ))}
                  {d.manto_oro_g != null && (
                    <div className="flex justify-between text-xs text-white/40 px-1 pt-1.5 mt-1 border-t border-white/[0.06]">
                      <span>Manto Raspado</span>
                      <span>{fmtN(d.manto_amalgama_g || 0)}g → <span className="text-amber-400/80">{fmtN(d.manto_oro_g)}g</span></span>
                    </div>
                  )}
                  {d.retorta_oro_g != null && (
                    <div className="flex justify-between text-xs text-white/40 px-1">
                      <span>Retorta</span>
                      <span className="text-amber-400/80">{fmtN(d.retorta_oro_g)}g</span>
                    </div>
                  )}
                </div>
              )}

              {canEdit && (
                <div className="flex gap-2 justify-end pt-3 border-t border-white/[0.07]">
                  <button onClick={() => openEdit(d)} className="btn-secondary flex-1 min-h-[48px] !text-sm"><Edit2 className="w-4 h-4 mr-2" /> Editar</button>
                  <button onClick={() => handleDelete(d.id)} className="btn-danger flex-1 min-h-[48px] !text-sm"><Trash2 className="w-4 h-4 mr-2" /> Borrar</button>
                </div>
              )}
            </div>
          );
        })}
        {table.getRowModel().rows.length === 0 && (
          <EmptyState icon={<Flame className="w-8 h-8" />} title="Sin reportes" description={`No hay quemados registrados para el ${fmtDateDisplay(selectedDate)}.`} />
        )}
      </div>

      {/* Desktop Table */}
      <div className="table-container hidden md:block">
        <table className="data-table">
          <thead>
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(header => (
                  <th key={header.id} onClick={header.column.getToggleSortingHandler()} className={header.column.getCanSort() ? 'cursor-pointer select-none' : ''}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map(row => (
              <tr key={row.id}>
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                ))}
              </tr>
            ))}
            {table.getRowModel().rows.length === 0 && (
              <tr><td colSpan={10} className="py-8"><EmptyState icon={<Flame className="w-8 h-8" />} title="Sin reportes" description={`No hay quemados para el ${fmtDateDisplay(selectedDate)}.`} /></td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Bottom-Sheet/Centered */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/70 backdrop-blur-sm" onClick={() => { setShowModal(false); setFormError(null); }}>
          <div className="relative w-full sm:max-w-2xl bg-zinc-950 border border-zinc-800 sm:rounded-2xl rounded-t-2xl shadow-2xl p-6 sm:p-8 max-h-[92dvh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sm:hidden flex justify-center mb-4 -mt-1"><div className="w-8 h-1 rounded-full bg-zinc-700" /></div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white/90 flex items-center gap-2"><Flame className="w-5 h-5 text-orange-400" /> {editItem ? 'Editar Quemado' : 'Nuevo Quemado'}</h2>
              <button onClick={() => { setShowModal(false); setFormError(null); }} className="p-2 rounded-lg hover:bg-white/[0.06] text-white/40 min-h-[44px] min-w-[44px] flex items-center justify-center"><X className="w-5 h-5" /></button>
            </div>

            {formError && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 mb-4 animate-in slide-in-from-top-2">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" /><span className="text-sm text-red-400">{formError}</span>
              </div>
            )}

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><label className="input-label">Fecha *</label><input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} className="input-field min-h-[44px]" /></div>
                <div><label className="input-label">Turno *</label>
                  <select value={form.turno} onChange={e => set('turno', e.target.value)} className="input-field min-h-[44px]">
                    <option value="dia">☀ Día</option><option value="noche">🌙 Noche</option><option value="completo">🔄 Completo</option>
                  </select></div>
                <div><label className="input-label">N° Quemada</label><input value={form.numero_quemada} onChange={e => set('numero_quemada', e.target.value)} className="input-field min-h-[44px]" placeholder="001" /></div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2"><span className="text-sm font-semibold text-orange-400">🟫 Planchas</span><div className="flex-1 h-px bg-orange-400/20 w-24 hidden sm:block" /></div>
                  <button type="button" onClick={addPlancha} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 text-xs font-medium transition-colors border border-orange-400/20 min-h-[36px]">
                    <Plus className="w-3.5 h-3.5" /> Agregar
                  </button>
                </div>
                <div className="space-y-3">
                  {planchas.map((p, i) => (
                    <div key={i} className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-semibold text-white/70">Plancha {i + 1}</span>
                        {planchas.length > 1 && <button onClick={() => removePlancha(i)} className="p-2 rounded-lg hover:bg-red-500/10 text-white/30 hover:text-red-400 min-h-[44px] min-w-[44px] flex justify-center items-center"><X className="w-4 h-4" /></button>}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className="input-label">Amalgama (g)</label><input type="number" step="0.01" value={p.amalgama_g} onChange={e => updatePlancha(i, 'amalgama_g', e.target.value)} className="input-field min-h-[44px]" placeholder="60.81" /></div>
                        <div><label className="input-label text-amber-400">Oro Recup. (g Au)</label><input type="number" step="0.01" value={p.oro_recuperado_g} onChange={e => updatePlancha(i, 'oro_recuperado_g', e.target.value)} className="input-field min-h-[44px]" placeholder="24.62" /></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3"><span className="text-sm font-semibold text-blue-400">🔧 Manto. Área Raspado</span><div className="flex-1 h-px bg-blue-400/20" /></div>
                <div className="grid grid-cols-2 gap-3 bg-white/[0.04] border border-white/[0.08] rounded-xl p-4">
                  <div><label className="input-label">Amalgama (g)</label><input type="number" step="0.01" value={form.manto_amalgama_g} onChange={e => set('manto_amalgama_g', e.target.value)} className="input-field min-h-[44px]" placeholder="1.19" /></div>
                  <div><label className="input-label text-amber-400">Oro Recup. (g Au)</label><input type="number" step="0.01" value={form.manto_oro_g} onChange={e => set('manto_oro_g', e.target.value)} className="input-field min-h-[44px]" placeholder="0.43" /></div>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3"><span className="text-sm font-semibold text-purple-400">⚗️ Retorta</span><div className="flex-1 h-px bg-purple-400/20" /></div>
                <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-4 max-w-xs">
                  <label className="input-label text-amber-400">Oro Recuperado (g Au)</label><input type="number" step="0.01" value={form.retorta_oro_g} onChange={e => set('retorta_oro_g', e.target.value)} className="input-field min-h-[44px]" placeholder="0.33" />
                </div>
              </div>

              <div className="bg-amber-500/[0.07] border border-amber-400/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3"><Calculator className="w-4 h-4 text-amber-400" /><span className="text-sm font-semibold text-amber-400">Totales (calculados)</span></div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center"><p className="text-white/40 text-[10px] uppercase tracking-wider mb-1">Total Amalgama</p><p className="font-bold text-white/80 text-lg">{fmtN(formAmalgama)} <span className="text-xs text-white/40">g</span></p></div>
                  <div className="text-center border-x border-amber-400/10"><p className="text-white/40 text-[10px] uppercase tracking-wider mb-1">Total Au Recup.</p><p className="font-bold text-amber-400 text-lg">{fmtN(formOro)} <span className="text-xs">g Au</span></p></div>
                  <div className="text-center"><p className="text-white/40 text-[10px] uppercase tracking-wider mb-1">Merma</p><p className="font-bold text-orange-400 text-lg">{formAmalgama > 0 ? `${(((formAmalgama - formOro) / formAmalgama) * 100).toFixed(1)}%` : '—'}</p></div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="input-label">Responsable</label><input value={form.responsable} onChange={e => set('responsable', e.target.value)} className="input-field min-h-[44px]" /></div>
                <div><label className="input-label">Observaciones</label><input value={form.observaciones} onChange={e => set('observaciones', e.target.value)} className="input-field min-h-[44px]" /></div>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 mt-6 pt-4 border-t border-zinc-800">
              <button onClick={() => { setShowModal(false); setFormError(null); }} className="btn-secondary min-h-[48px] sm:min-h-[40px]">Cancelar</button>
              <button onClick={handleSave} disabled={isPending} className="btn-primary min-h-[48px] sm:min-h-[40px]">
                {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {editItem ? 'Actualizar' : 'Registrar Quemado'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

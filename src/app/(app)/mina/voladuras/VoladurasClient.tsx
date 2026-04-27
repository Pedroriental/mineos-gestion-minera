'use client';

import { useState, useTransition, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useCanEdit } from '@/lib/use-can-edit';
import { createVoladura, updateVoladura, deleteVoladura } from '@/lib/actions/voladuras';
import type { ReporteVoladura, PausaBarrenado } from '@/lib/types';
import { downloadVoladurasPDF } from '@/lib/pdf-reports';
import { Loader2, Zap, Plus, X, Edit2, Trash2, ChevronLeft, ChevronRight, CalendarDays, Flame, Target, Package, AlertTriangle, Download, Search } from 'lucide-react';
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

interface VoladurasClientProps {
  data: ReporteVoladura[];
}

export default function VoladurasClient({ data: initialData }: VoladurasClientProps) {
  const { user } = useAuth();
  const canEdit = useCanEdit();
  
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);
  
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<ReporteVoladura | null>(null);
  const [pausas, setPausas] = useState<PausaBarrenado[]>([]);
  const [isPending, startTransition] = useTransition();

  const emptyForm = {
    fecha: selectedDate,
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
  const set = (field: string, value: unknown) => setForm(f => ({ ...f, [field]: value }));

  // Filtrar data por el día seleccionado antes de pasarla a la tabla
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

  const addPausa    = () => setPausas(p => [...p, { hora_inicio: '', hora_fin: '', motivo: '' }]);
  const removePausa  = (i: number) => setPausas(p => p.filter((_, idx) => idx !== i));
  const updatePausa  = (i: number, key: keyof PausaBarrenado, val: string) =>
    setPausas(p => p.map((x, idx) => idx === i ? { ...x, [key]: val } : x));

  const handleSave = () => {
    startTransition(async () => {
      const payload = {
        ...form,
        pausas_barrenado: pausas.length > 0 ? pausas : null,
        registrado_por: user?.id,
      };

      if (editItem) {
        await updateVoladura({ ...payload, id: editItem.id });
      } else {
        await createVoladura(payload);
      }
      setShowModal(false);
      setEditItem(null);
      setForm({ ...emptyForm, fecha: selectedDate });
      setPausas([]);
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm('¿Eliminar este reporte de voladura?')) return;
    startTransition(async () => {
      await deleteVoladura(id);
    });
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

  const fmtTime = (t?: string | null) => t ? t.slice(0, 5) : null;
  const fmtDate = (s: string) => new Date(s + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const getCount = (d: string) => initialData.filter(x => x.fecha === d).length;

  const totalHuecos = dataForSelectedDate.reduce((s, d) => s + d.huecos_cantidad, 0);
  const totalChupis = dataForSelectedDate.reduce((s, d) => s + d.chupis_cantidad, 0);
  const totalArroz = dataForSelectedDate.reduce((s, d) => s + Number(d.arroz_kg), 0);
  const totalFosforos = dataForSelectedDate.reduce((s, d) => s + d.fosforos_lp, 0);
  const disparosCount = dataForSelectedDate.filter(d => d.numero_disparo).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white/90 font-bold tracking-tight text-2xl flex items-center gap-3">
            <Zap className="w-6 h-6 text-amber-400" /> Reportes de Voladura
          </h1>
          <p className="text-white/40 text-sm mt-1">
            <span className="text-blue-400 font-semibold">{totalHuecos} huecos</span>
            {' '}— <span className="text-amber-400 font-semibold">{totalChupis} chupis</span>
            {' '}— <span className="text-red-400 font-semibold">{totalArroz.toFixed(1)} kg arroz</span>
            {' '}en el día seleccionado
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => downloadVoladurasPDF(dataForSelectedDate, selectedDate)}
            disabled={dataForSelectedDate.length === 0}
            className="btn-secondary disabled:opacity-40 flex items-center gap-1.5">
            <Download className="w-4 h-4" /> <span className="hidden sm:inline">PDF {selectedDate}</span>
          </button>
          <button onClick={() => { setEditItem(null); setForm({ ...emptyForm, fecha: selectedDate }); setShowModal(true); }}
            disabled={!canEdit} className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed">
            <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Nuevo Reporte</span>
          </button>
        </div>
      </div>

      {/* Day Selector */}
      <div className="card-glass p-4">
        <div className="flex items-center justify-between">
          <button onClick={() => navigateDay('prev')} className="p-2 rounded-xl hover:bg-white/[0.06] text-white/40 hover:text-white/75 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-amber-400" />
              <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                className="input-field !py-1.5 !px-3 !text-base font-semibold !w-auto !border-amber-400/30" />
            </div>
            <div className="text-sm text-white/40 capitalize hidden sm:block">{fmtDate(selectedDate)}</div>
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
                    isSel ? 'bg-amber-500/15 text-amber-300 border border-amber-400/30'
                    : 'bg-white/[0.04] text-white/40 border border-transparent hover:bg-white/[0.08] hover:text-white/65'
                  }`}>
                  <span className="uppercase">{d.toLocaleDateString('es-ES', { weekday: 'short' })}</span>
                  <span className="text-sm font-bold">{d.getDate()}</span>
                  <span className={`text-[10px] ${isSel ? 'text-amber-400' : 'text-white/30'}`}>{getCount(date)} reg</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { label: 'Huecos', value: totalHuecos, color: '#2563EB', text: 'text-blue-400', icon: <Target className="w-5 h-5 text-blue-400" />, bg: 'bg-blue-500/10' },
          { label: 'Chupis', value: totalChupis, color: '#D97706', text: 'text-amber-400', icon: <Flame className="w-5 h-5 text-amber-400" />, bg: 'bg-amber-500/10' },
          { label: 'Arroz (ANFO)', value: `${totalArroz.toFixed(1)} kg`, color: '#DC2626', text: 'text-red-400', icon: <Package className="w-5 h-5 text-red-400" />, bg: 'bg-red-500/10' },
          { label: 'Fósforos LP', value: totalFosforos, color: '#7C3AED', text: 'text-purple-400', icon: <Zap className="w-5 h-5 text-purple-400" />, bg: 'bg-purple-500/10' },
          { label: 'Disparos', value: disparosCount, color: '#059669', text: 'text-emerald-400', icon: <AlertTriangle className="w-5 h-5 text-emerald-400" />, bg: 'bg-emerald-500/10' },
        ].map((k, i) => (
          <div key={i} className="card-glass p-4 flex items-center gap-3" style={{ borderTop: `3px solid ${k.color}` }}>
            <div className={`w-9 h-9 rounded-lg ${k.bg} flex items-center justify-center flex-shrink-0`}>{k.icon}</div>
            <div>
              <p className="text-xs text-white/40">{k.label}</p>
              <p className={`text-xl font-bold ${k.text}`}>{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center bg-zinc-900/50 border border-white/5 rounded-xl px-3 py-2 w-full max-w-sm">
        <Search className="w-4 h-4 text-white/40 mr-2" />
        <input
          type="text"
          placeholder="Buscar voladura..."
          value={globalFilter ?? ''}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="bg-transparent border-none outline-none text-sm text-white/90 placeholder:text-white/30 w-full"
        />
      </div>

      {/* Mobile Cards (Renderizado dinámico de TanStack Table) */}
      <div className="grid grid-cols-1 space-y-3 md:hidden">
        {table.getRowModel().rows.map(row => {
          const d = row.original;
          return (
            <div key={d.id} className="card-glass p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/45 bg-white/[0.07] px-2 py-0.5 rounded-sm">
                      {d.turno === 'dia' ? '☀ Día' : d.turno === 'noche' ? '🌙 Noche' : '🔄 Comp.'}
                    </span>
                    {d.frente && <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-sm">{d.frente}</span>}
                  </div>
                  <h3 className="font-bold text-white/85 mt-2 text-base">{d.mina || 'Sin mina'}</h3>
                  {d.numero_disparo && (
                    <p className="text-sm text-white/40 mt-0.5">
                      Disparo N°{d.numero_disparo}{fmtTime(d.hora_disparo) ? ` — ${fmtTime(d.hora_disparo)}` : ''}
                      {d.vertical_disparo && <span className="ml-1 text-purple-400/70 font-semibold">[{d.vertical_disparo}]</span>}
                    </p>
                  )}
                  {d.pausas_barrenado && d.pausas_barrenado.length > 0 && (
                    <div className="mt-1.5 space-y-0.5">
                      {d.pausas_barrenado.map((p, i) => (
                        <p key={i} className="text-[11px] text-orange-400/70">
                          ⏸ {p.hora_inicio}–{p.hora_fin} <span className="text-white/35">{p.motivo}</span>
                        </p>
                      ))}
                    </div>
                  )}
                </div>
                <span className={`text-xs font-bold px-2 py-1 rounded-full border flex-shrink-0 ${d.sin_novedad ? 'text-emerald-400 bg-emerald-500/10 border-emerald-400/20' : 'text-red-400 bg-red-500/10 border-red-400/20'}`}>
                  {d.sin_novedad ? '✓ Sin novedad' : '⚠ Novedad'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 p-3 bg-white/[0.05] rounded-lg border border-white/[0.07] mb-3">
                <div><span className="text-white/35 text-[10px] uppercase font-bold block mb-1">Huecos</span>
                  <span className="font-bold text-blue-400">{d.huecos_cantidad} × {d.huecos_pies} pies</span></div>
                <div><span className="text-white/35 text-[10px] uppercase font-bold block mb-1">Chupis</span>
                  <span className="font-bold text-amber-400">{d.chupis_cantidad} × {d.chupis_pies} pies</span></div>
                <div><span className="text-white/35 text-[10px] uppercase font-bold block mb-1">Arroz (ANFO)</span>
                  <span className="font-bold text-red-400">{d.arroz_kg} kg</span></div>
                <div><span className="text-white/35 text-[10px] uppercase font-bold block mb-1">Fósforos LP</span>
                  <span className="font-bold text-purple-400">{d.fosforos_lp}</span></div>
              </div>
              {d.observaciones_disparo && (
                <p className="text-xs text-white/35 italic mb-3 leading-relaxed border-l-2 border-white/10 pl-2">{d.observaciones_disparo}</p>
              )}
              <div className="flex gap-2 justify-end pt-3 border-t border-white/[0.07]">
                <button onClick={() => openEdit(d)} className="btn-secondary flex-1 min-h-[48px] !text-sm"><Edit2 className="w-4 h-4 mr-2" /> Editar</button>
                <button onClick={() => handleDelete(d.id)} className="btn-danger flex-1 min-h-[48px] !text-sm"><Trash2 className="w-4 h-4 mr-2" /> Borrar</button>
              </div>
            </div>
          );
        })}
        {table.getRowModel().rows.length === 0 && <div className="text-center py-12 text-white/40 card-glass">Sin reportes para {fmtDate(selectedDate)}</div>}
      </div>

      {/* Desktop Table (TanStack) */}
      <div className="table-container hidden md:block">
        <table className="data-table">
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
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
              <tr><td colSpan={12} className="text-center py-12 text-white/40">Sin reportes encontrados</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between mt-4">
          <div className="text-xs text-white/40">
            Mostrando {table.getRowModel().rows.length} de {table.getFilteredRowModel().rows.length}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}
              className="p-2 rounded-lg bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/10 min-w-[44px] min-h-[44px] flex items-center justify-center">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm font-medium text-white/60">
              Página {table.getState().pagination.pageIndex + 1} de {table.getPageCount()}
            </span>
            <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}
              className="p-2 rounded-lg bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/10 min-w-[44px] min-h-[44px] flex items-center justify-center">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Modal Bottom-Sheet/Centered */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/70 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="relative w-full sm:max-w-4xl bg-zinc-950 border border-zinc-800 sm:rounded-2xl rounded-t-2xl shadow-2xl p-6 sm:p-8 max-h-[92dvh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Drag handle */}
            <div className="sm:hidden flex justify-center mb-4 -mt-1">
              <div className="w-8 h-1 rounded-full bg-zinc-700" />
            </div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white/90">{editItem ? 'Editar Reporte' : 'Nuevo Reporte de Voladura'}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-lg hover:bg-white/[0.06] text-white/40 min-h-[44px] min-w-[44px] flex items-center justify-center"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-6">
              {/* Identificación */}
              <div>
                <div className="flex items-center gap-2 mb-3"><span className="text-sm font-semibold text-amber-400">📍 Identificación</span><div className="flex-1 h-px bg-amber-400/20" /></div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div><label className="input-label">Fecha *</label><input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} className="input-field min-h-[44px]" /></div>
                  <div><label className="input-label">Turno *</label>
                    <select value={form.turno} onChange={e => set('turno', e.target.value)} className="input-field min-h-[44px]">
                      <option value="dia">☀ Día</option><option value="noche">🌙 Noche</option><option value="completo">🔄 Completo</option>
                    </select></div>
                  <div><label className="input-label">Mina</label><input value={form.mina} onChange={e => set('mina', e.target.value)} placeholder="Ej: Belén 2" className="input-field min-h-[44px]" /></div>
                  <div><label className="input-label">Responsable</label><input value={form.responsable} onChange={e => set('responsable', e.target.value)} className="input-field min-h-[44px]" /></div>
                </div>
              </div>

              {/* Barrenado */}
              <div>
                <div className="flex items-center gap-2 mb-3"><span className="text-sm font-semibold text-blue-400">⛏ Proceso de Barrenado</span><div className="flex-1 h-px bg-blue-400/20" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="input-label">Hora Inicio</label><input type="time" value={form.hora_inicio_barrenado} onChange={e => set('hora_inicio_barrenado', e.target.value)} className="input-field min-h-[44px]" /></div>
                  <div><label className="input-label">Hora Culmina</label><input type="time" value={form.hora_fin_barrenado} onChange={e => set('hora_fin_barrenado', e.target.value)} className="input-field min-h-[44px]" /></div>
                </div>
                {/* Pausas */}
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-orange-400/80 uppercase tracking-wider">⏸ Pausas</span>
                    <button type="button" onClick={addPausa} className="btn-secondary !py-1 !px-2.5 !text-xs min-h-[36px]"><Plus className="w-3.5 h-3.5 mr-1" /> Agregar</button>
                  </div>
                  <div className="space-y-2">
                    {pausas.map((p, i) => (
                      <div key={i} className="grid grid-cols-[1fr_1fr_2fr_auto] gap-2 items-start p-3 bg-orange-500/[0.06] rounded-xl border border-orange-400/15">
                        <div><input type="time" value={p.hora_inicio} onChange={e => updatePausa(i, 'hora_inicio', e.target.value)} className="input-field min-h-[44px]" /></div>
                        <div><input type="time" value={p.hora_fin} onChange={e => updatePausa(i, 'hora_fin', e.target.value)} className="input-field min-h-[44px]" /></div>
                        <div><input value={p.motivo} onChange={e => updatePausa(i, 'motivo', e.target.value)} placeholder="Motivo" className="input-field min-h-[44px]" /></div>
                        <button type="button" onClick={() => removePausa(i)} className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-red-500/15 text-white/30 hover:text-red-400"><X className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Disparo */}
              <div>
                <div className="flex items-center gap-2 mb-3"><span className="text-sm font-semibold text-red-400">💥 Disparo</span><div className="flex-1 h-px bg-red-400/20" /></div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
                  <div><label className="input-label">N° Disparo</label><input value={form.numero_disparo} onChange={e => set('numero_disparo', e.target.value)} className="input-field min-h-[44px]" /></div>
                  <div><label className="input-label">Hora</label><input type="time" value={form.hora_disparo} onChange={e => set('hora_disparo', e.target.value)} className="input-field min-h-[44px]" /></div>
                  <div><label className="input-label">Vertical</label>
                    <select value={form.vertical_disparo} onChange={e => set('vertical_disparo', e.target.value)} className="input-field min-h-[44px]">
                      <option value="">— Sin especificar —</option>
                      <option value="Vertical 1">Vertical 1</option><option value="Vertical 2">Vertical 2</option><option value="Vertical 3">Vertical 3</option>
                    </select></div>
                  <div className="flex items-end pb-1">
                    <label className="flex items-center gap-3 cursor-pointer min-h-[44px]" onClick={() => set('sin_novedad', !form.sin_novedad)}>
                      <div className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${form.sin_novedad ? 'bg-emerald-500' : 'bg-red-500/70'}`}>
                        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all shadow ${form.sin_novedad ? 'left-5' : 'left-0.5'}`} />
                      </div>
                      <span className={`text-sm font-semibold ${form.sin_novedad ? 'text-emerald-400' : 'text-red-400'}`}>
                        {form.sin_novedad ? '✓ Sin novedad' : '⚠ Novedad'}
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Huecos & Chupis */}
              <div>
                <div className="flex items-center gap-2 mb-3"><span className="text-sm font-semibold text-purple-400">🕳 Huecos & Chupis</span><div className="flex-1 h-px bg-purple-400/20" /></div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-blue-500/[0.07] rounded-xl p-3 border border-blue-400/20">
                    <label className="input-label !text-blue-400">Huecos cantidad</label>
                    <input type="number" value={form.huecos_cantidad} onChange={e => set('huecos_cantidad', e.target.value)} className="input-field font-bold text-lg min-h-[44px]" />
                  </div>
                  <div className="bg-blue-500/[0.07] rounded-xl p-3 border border-blue-400/20">
                    <label className="input-label !text-blue-400">Pies / Hueco</label>
                    <input type="number" value={form.huecos_pies} onChange={e => set('huecos_pies', e.target.value)} className="input-field min-h-[44px]" />
                  </div>
                  <div className="bg-amber-500/[0.07] rounded-xl p-3 border border-amber-400/20">
                    <label className="input-label !text-amber-400">Chupis cantidad</label>
                    <input type="number" value={form.chupis_cantidad} onChange={e => set('chupis_cantidad', e.target.value)} className="input-field font-bold text-lg min-h-[44px]" />
                  </div>
                  <div className="bg-amber-500/[0.07] rounded-xl p-3 border border-amber-400/20">
                    <label className="input-label !text-amber-400">Pies / Chupi</label>
                    <input type="number" value={form.chupis_pies} onChange={e => set('chupis_pies', e.target.value)} className="input-field min-h-[44px]" />
                  </div>
                </div>
              </div>

              {/* Condimentos */}
              <div>
                <div className="flex items-center gap-2 mb-3"><span className="text-sm font-semibold text-orange-400">🧪 Condimentos</span><div className="flex-1 h-px bg-orange-400/20" /></div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div><label className="input-label">Fósforos LP</label><input type="number" value={form.fosforos_lp} onChange={e => set('fosforos_lp', e.target.value)} className="input-field min-h-[44px]" /></div>
                  <div><label className="input-label">Espaguetis</label><input type="number" value={form.espaguetis} onChange={e => set('espaguetis', e.target.value)} className="input-field min-h-[44px]" /></div>
                  <div><label className="input-label">Vitamina E</label><input type="number" value={form.vitamina_e} onChange={e => set('vitamina_e', e.target.value)} className="input-field min-h-[44px]" /></div>
                  <div><label className="input-label">Trenza (m)</label><input type="number" step="0.5" value={form.trenza_metros} onChange={e => set('trenza_metros', e.target.value)} className="input-field min-h-[44px]" /></div>
                  <div className="bg-red-500/[0.07] rounded-xl p-3 border border-red-400/20">
                    <label className="input-label !text-red-400 !font-semibold">Arroz (kg)</label>
                    <input type="number" step="0.5" value={form.arroz_kg} onChange={e => set('arroz_kg', e.target.value)} className="input-field font-bold min-h-[44px]" />
                  </div>
                </div>
              </div>

              {/* Observaciones */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="input-label">Observaciones Disparo</label><textarea value={form.observaciones_disparo} onChange={e => set('observaciones_disparo', e.target.value)} className="input-field" rows={2} /></div>
                <div><label className="input-label">Observaciones Turno</label><textarea value={form.observaciones} onChange={e => set('observaciones', e.target.value)} className="input-field" rows={2} /></div>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 mt-6 pt-4 border-t border-white/[0.07]">
              <button onClick={() => setShowModal(false)} className="btn-secondary min-h-[48px] sm:min-h-[40px]">Cancelar</button>
              <button onClick={handleSave} disabled={isPending || !form.huecos_cantidad} className="btn-primary min-h-[48px] sm:min-h-[40px]">
                {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {editItem ? 'Actualizar' : 'Registrar Voladura'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

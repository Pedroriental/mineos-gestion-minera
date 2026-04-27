'use client';

import { useState, useTransition, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useCanEdit } from '@/lib/use-can-edit';
import { createProduccion, updateProduccion, deleteProduccion } from '@/lib/actions/produccion';
import type { ReporteProduccion } from '@/lib/types';
import { downloadProduccionPDF } from '@/lib/pdf-reports';
import { Loader2, Factory, Plus, X, Edit2, Trash2, Calculator, AlertTriangle, Download, AlertCircle, Search, Pickaxe, TrendingUp } from 'lucide-react';
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
import { StaggerGrid, StaggerItem, FadeIn, FadeInSection } from '@/components/ui/motion';
import { DonutChart } from '@tremor/react';
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend
} from 'recharts';

const PESO_SACO_KG = 50;
const fmtNum = (n: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 }).format(n);

const getMermaBadge = (pct: number) => {
  if (pct <= 0) return 'badge-neutral';
  if (pct < 50) return 'badge-success';
  if (pct < 65) return 'badge-warning';
  return 'badge-danger';
};

// ═══════════════════════════════════════════════════════════
// CUSTOM TOOLTIP FOR RECHARTS
// ═══════════════════════════════════════════════════════════
function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-zinc-950/95 border border-zinc-800 p-3 rounded-lg shadow-xl backdrop-blur-md">
        <p className="text-white/60 text-xs font-mono mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-white/80 text-xs">{entry.name}:</span>
            <span className="text-white font-bold text-sm">{entry.value.toLocaleString()}</span>
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
    metaDiaria: number;
    metaAcumulada: number;
    tenor: number;
  }[];
  eficienciaData: { name: string; value: number }[];
  registros: ReporteProduccion[];
}

export default function ProduccionGerencialClient({ data, selectedDateStr }: { data: ProduccionGerencialData, selectedDateStr: string }) {
  const { user } = useAuth();
  const canEdit = useCanEdit();

  // For the Form
  const [selectedDate, setSelectedDate] = useState(selectedDateStr);
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);
  
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<ReporteProduccion | null>(null);
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

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

  const table = useReactTable({
    data: initialData,
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
    
    if (isNaN(oroG) || oroG <= 0) { setFormError('El oro recuperado debe ser mayor que 0.'); return; }
    if (isNaN(sacosN) || sacosN <= 0) { setFormError('Los sacos procesados deben ser mayores que 0.'); return; }
    
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

  return (
    <div className="w-full max-w-[1500px] mx-auto min-h-screen p-4 md:p-8 space-y-6">
      {/* ── Header ── */}
      <FadeIn className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-white/90 font-bold tracking-tight text-2xl flex items-center gap-3">
            <Factory className="w-6 h-6 text-amber-500" /> Producción Gerencial (BI)
          </h1>
          <p className="text-white/40 text-sm mt-1">
            Vista ejecutiva de recuperación aurífera e indicadores de molienda.
          </p>
        </div>
        <div className="flex items-center gap-3">
           {/* DatePicker UI placeholder as discussed, filtering handles via URL by Server for now, but we can have local controls or forms */}
        </div>
      </FadeIn>

      {/* ── KPI Summary Bar ── */}
      <StaggerGrid className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Oro Recuperado */}
        <StaggerItem>
          <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-5 relative overflow-hidden h-full">
            <div className="absolute -right-4 -top-4 opacity-5">
               <TrendingUp className="w-32 h-32 text-amber-500" />
            </div>
            <div className="flex items-center gap-2 mb-3">
               <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <span className="text-amber-500 text-lg">⚗️</span>
               </div>
               <span className="text-xs font-bold text-white/50 uppercase tracking-wider">Oro Recuperado</span>
            </div>
            <div className="flex items-baseline gap-2">
               <span className="text-3xl font-black text-white">{fmtNum(data.kpis.oroRecuperado)}</span>
               <span className="text-sm text-white/40 font-mono">g Au</span>
            </div>
            <div className="mt-3 text-xs font-semibold">
               <span className={data.kpis.cumplimientoOro >= 0 ? "text-emerald-400" : "text-red-400"}>
                 {data.kpis.cumplimientoOro >= 0 ? '+' : ''}{data.kpis.cumplimientoOro.toFixed(1)}% vs. Meta
               </span>
            </div>
          </div>
        </StaggerItem>

        {/* Card 2: Toneladas Molidas */}
        <StaggerItem>
          <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-5 relative overflow-hidden h-full">
            <div className="absolute -right-4 -top-4 opacity-5">
               <Factory className="w-32 h-32 text-blue-500" />
            </div>
            <div className="flex items-center gap-2 mb-3">
               <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Factory className="w-4 h-4 text-blue-500" />
               </div>
               <span className="text-xs font-bold text-white/50 uppercase tracking-wider">Toneladas Molidas</span>
            </div>
            <div className="flex items-baseline gap-2">
               <span className="text-3xl font-black text-white">{fmtNum(data.kpis.toneladas)}</span>
               <span className="text-sm text-white/40 font-mono">T</span>
            </div>
            <div className="mt-3 text-xs font-semibold text-blue-400">
               {data.kpis.cumplimientoTon.toFixed(1)}% Cumplimiento Est.
            </div>
          </div>
        </StaggerItem>

        {/* Card 3: Tenor Promedio */}
        <StaggerItem>
          <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-5 relative overflow-hidden h-full">
            <div className="absolute -right-4 -top-4 opacity-5">
               <Pickaxe className="w-32 h-32 text-purple-500" />
            </div>
            <div className="flex items-center gap-2 mb-3">
               <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Pickaxe className="w-4 h-4 text-purple-500" />
               </div>
               <span className="text-xs font-bold text-white/50 uppercase tracking-wider">Tenor Promedio</span>
            </div>
            <div className="flex items-baseline gap-2">
               <span className="text-3xl font-black text-white">{fmtNum(data.kpis.tenorPromedio)}</span>
               <span className="text-sm text-white/40 font-mono">g/T</span>
            </div>
            <div className="mt-3 text-xs font-semibold text-white/40">
               vs Budget Histórico: 0.20 g/T
            </div>
          </div>
        </StaggerItem>

        {/* Card 4: Eficiencia Molino (Tremor Donut) */}
        <StaggerItem>
          <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-5 flex items-center justify-between h-full">
            <div>
               <span className="text-xs font-bold text-white/50 uppercase tracking-wider block mb-2">Eficiencia Operativa</span>
               <span className="text-3xl font-black text-white">{data.kpis.eficienciaMolino.toFixed(1)}%</span>
            </div>
            <div className="w-24 h-24">
               <DonutChart
                  data={data.eficienciaData}
                  category="value"
                  index="name"
                  colors={['emerald', 'red']}
                  showAnimation={true}
                  variant="pie"
                  className="w-full h-full"
               />
            </div>
          </div>
        </StaggerItem>
      </StaggerGrid>

      {/* ── Main Correlation Chart ── */}
      <FadeInSection delay={0.4}>
        <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-5 md:p-6">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
             <h2 className="text-white/80 font-bold text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-amber-500" /> Producción Real vs. Meta Mensual (Au g)
             </h2>
             <div className="flex items-center gap-4 text-xs font-bold text-white/60">
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-amber-500/20 border border-amber-500"></div> Producción Diaria</div>
                <div className="flex items-center gap-1.5"><div className="w-4 h-[2px] bg-amber-500"></div> Meta Diaria</div>
                <div className="flex items-center gap-1.5"><div className="w-4 h-[2px] bg-white/40 border-dashed border-b-2"></div> Meta Acumulada</div>
             </div>
          </div>

          <div className="w-full h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
               <ComposedChart data={data.diaria} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#DAA520" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#DAA520" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="fecha" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} 
                         tickFormatter={(val) => {
                            const d = new Date(val + 'T12:00:00');
                            return `${d.getDate()} ${d.toLocaleDateString('es-ES', {month: 'short'})}`;
                         }} />
                  <YAxis yAxisId="left" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} tickLine={false} axisLine={false} />
                  
                  <RechartsTooltip content={<CustomTooltip />} />
                  
                  <Area yAxisId="left" type="monotone" dataKey="oro" name="Producción Real" fill="url(#goldGradient)" stroke="#DAA520" strokeWidth={2} />
                  <Line yAxisId="left" type="monotone" dataKey="metaDiaria" name="Meta Diaria" stroke="#DAA520" strokeWidth={1.5} dot={false} activeDot={false} />
                  <Line yAxisId="left" type="monotone" dataKey="metaAcumulada" name="Meta Acumulada" stroke="rgba(255,255,255,0.4)" strokeDasharray="5 5" strokeWidth={2} dot={false} />
               </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </FadeInSection>

      {/* ── Consolidation Table ── */}
      <FadeInSection delay={0.5}>
         <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl overflow-hidden">
            <div className="p-4 md:p-6 border-b border-zinc-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
               <h3 className="text-white/80 font-bold text-lg">Detalle de Producción</h3>
               <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 w-full sm:w-64">
                    <Search className="w-4 h-4 text-white/40 mr-2" />
                    <input type="text" placeholder="Buscar molino o material..." value={globalFilter ?? ''} onChange={(e) => setGlobalFilter(e.target.value)}
                      className="bg-transparent border-none outline-none text-sm text-white/90 placeholder:text-white/30 w-full" />
                  </div>
                  <button onClick={() => downloadProduccionPDF(initialData, selectedDateStr)} disabled={initialData.length === 0}
                    className="btn-secondary h-10 px-4 disabled:opacity-40 flex items-center gap-2 whitespace-nowrap">
                    <Download className="w-4 h-4" /> <span className="hidden sm:inline">Exportar PDF</span>
                  </button>
                  {canEdit && (
                     <button onClick={() => { setEditItem(null); setForm({ ...emptyForm, fecha: selectedDate }); setFormError(null); setShowModal(true); }} className="btn-primary h-10 px-4 whitespace-nowrap">
                        <Plus className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Nuevo Registro</span>
                     </button>
                  )}
               </div>
            </div>

            <div className="overflow-x-auto">
               <table className="w-full text-left border-collapse">
                  <thead>
                     {table.getHeaderGroups().map(hg => (
                        <tr key={hg.id} className="border-b border-zinc-800/50 bg-zinc-950/30">
                           {hg.headers.map(header => (
                              <th key={header.id} onClick={header.column.getToggleSortingHandler()} className={`px-4 py-3 text-xs font-bold text-white/40 uppercase tracking-wider ${header.column.getCanSort() ? 'cursor-pointer select-none hover:text-white/60' : ''}`}>
                                 {flexRender(header.column.columnDef.header, header.getContext())}
                              </th>
                           ))}
                        </tr>
                     ))}
                  </thead>
                  <tbody>
                     {table.getRowModel().rows.map(row => (
                        <tr key={row.id} className="border-b border-zinc-800/30 hover:bg-zinc-800/20 transition-colors">
                           {row.getVisibleCells().map(cell => (
                              <td key={cell.id} className="px-4 py-3 text-sm text-white/80 whitespace-nowrap">
                                 {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </td>
                           ))}
                        </tr>
                     ))}
                     {table.getRowModel().rows.length === 0 && (
                        <tr>
                           <td colSpan={12} className="py-12">
                              <EmptyState icon={<Factory className="w-8 h-8" />} title="Sin registros" description="No hay reportes de producción en el período seleccionado." />
                           </td>
                        </tr>
                     )}
                  </tbody>
               </table>
            </div>
         </div>
      </FadeInSection>

      {/* CRUD Modal Preserved */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/70 backdrop-blur-sm" onClick={() => { setShowModal(false); setFormError(null); }}>
          <div className="relative w-full sm:max-w-3xl bg-zinc-950 border border-zinc-800 sm:rounded-2xl rounded-t-2xl shadow-2xl p-6 sm:p-8 max-h-[85vh] overflow-y-auto overflow-x-hidden" onClick={e => e.stopPropagation()}>
            <div className="sm:hidden flex justify-center mb-4 -mt-1"><div className="w-8 h-1 rounded-full bg-zinc-700" /></div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white/90">{editItem ? 'Editar Registro' : 'Nuevo Reporte de Producción'}</h2>
              <button onClick={() => { setShowModal(false); setFormError(null); }} className="p-2 rounded-lg hover:bg-white/[0.06] text-white/40 min-h-[44px] min-w-[44px] flex items-center justify-center"><X className="w-5 h-5" /></button>
            </div>

            {formError && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 mb-4 animate-in slide-in-from-top-2">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" /><span className="text-sm text-red-400">{formError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><label className="input-label">Fecha *</label><input type="date" value={form.fecha} onChange={e => handleFieldChange('fecha', e.target.value)} className="input-field min-h-[44px]" /></div>
              <div><label className="input-label">Turno *</label>
                <select value={form.turno} onChange={e => handleFieldChange('turno', e.target.value)} className="input-field min-h-[44px]">
                  <option value="dia">☀ Día</option><option value="noche">🌙 Noche</option><option value="completo">🔄 Completo</option>
                </select>
              </div>
              <div><label className="input-label">Molino *</label><input list="molinos-list" value={form.molino} onChange={e => handleFieldChange('molino', e.target.value)} className="input-field min-h-[44px]" placeholder="Escribir molino..." /><datalist id="molinos-list">{molinosSug.map(m => <option key={m} value={m} />)}</datalist></div>

              <div className="md:col-span-2"><label className="input-label">Material / Mina de Origen *</label><input list="materiales-list" value={form.material} onChange={e => handleFieldChange('material', e.target.value)} className="input-field min-h-[44px]" placeholder="Escribir material o mina..." /><datalist id="materiales-list">{materialesSug.map(m => <option key={m} value={m} />)}</datalist></div>
              <div><label className="input-label">Código Lote/Veta</label><input value={form.material_codigo} onChange={e => handleFieldChange('material_codigo', e.target.value)} className="input-field min-h-[44px]" placeholder="V-2D19" /></div>

              <div className="md:col-span-3 mt-2"><div className="flex items-center gap-2 mb-1"><span className="text-sm font-semibold text-amber-400">⚗️ Amalgamación</span><div className="flex-1 h-px bg-amber-400/20" /></div></div>

              <div><label className="input-label">Amalgama 1 (g)</label><input type="number" step="0.01" value={form.amalgama_1_g} onChange={e => handleFieldChange('amalgama_1_g', e.target.value)} className="input-field min-h-[44px]" placeholder="23.00" /></div>
              <div><label className="input-label">Amalgama 2 (g)</label><input type="number" step="0.01" value={form.amalgama_2_g} onChange={e => handleFieldChange('amalgama_2_g', e.target.value)} className="input-field min-h-[44px]" placeholder="22.90" /></div>
              <div className="bg-amber-500/[0.07] rounded-xl p-3 border border-amber-400/20"><label className="input-label !text-amber-400 !font-semibold flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Oro Recuperado (g Au) *</label><input type="number" step="0.0001" value={form.oro_recuperado_g} onChange={e => handleFieldChange('oro_recuperado_g', e.target.value)} className="input-field text-lg font-bold min-h-[44px]" style={{ borderColor: 'rgba(217, 119, 6, 0.4)' }} placeholder="10.90" required /></div>

              <div><label className="input-label flex items-center gap-1"><Calculator className="w-3.5 h-3.5" /> Merma 1 (%)</label><input type="text" value={form.merma_1_pct ? `${form.merma_1_pct}%` : '—'} readOnly className="input-field bg-slate-50 text-slate-500 cursor-not-allowed min-h-[44px]" /></div>
              <div><label className="input-label flex items-center gap-1"><Calculator className="w-3.5 h-3.5" /> Merma 2 (%)</label><input type="text" value={form.merma_2_pct ? `${form.merma_2_pct}%` : '—'} readOnly className="input-field bg-slate-50 text-slate-500 cursor-not-allowed min-h-[44px]" /></div>
              <div />

              <div className="md:col-span-3 mt-2"><div className="flex items-center gap-2 mb-1"><span className="text-sm font-semibold text-blue-400">📦 Producción</span><div className="flex-1 h-px bg-blue-400/20" /></div></div>

              <div><label className="input-label">Sacos * <span className="text-amber-400/70 font-normal">(unidad = 50 kg)</span></label><input type="number" inputMode="decimal" value={form.sacos} onChange={e => handleFieldChange('sacos', e.target.value)} className="input-field min-h-[44px]" placeholder="39" />{parseFloat(form.sacos) > 0 && <p className="text-xs text-white/35 mt-1">{parseFloat(form.sacos)} sacos × 50 kg = <span className="text-amber-400/60 font-semibold">{(parseFloat(form.sacos) * PESO_SACO_KG).toFixed(1)} kg</span></p>}</div>
              <div><label className="input-label">Ton. Procesadas <span className="text-white/30 font-normal">(auto)</span></label><input type="number" step="0.001" value={form.toneladas_procesadas} onChange={e => handleFieldChange('toneladas_procesadas', e.target.value)} className="input-field min-h-[44px]" placeholder="1.950" /></div>
              <div><label className="input-label">Responsable</label><input value={form.responsable} onChange={e => handleFieldChange('responsable', e.target.value)} className="input-field min-h-[44px]" /></div>

              <div><label className="input-label flex items-center gap-1"><Calculator className="w-3.5 h-3.5" /> Tenor (g/t)</label><input type="text" value={form.tenor_tonelada_gpt || '—'} readOnly className="input-field bg-blue-500/10 border-blue-500/20 text-blue-400 font-semibold cursor-not-allowed min-h-[44px]" /></div>
              <div><label className="input-label flex items-center gap-1"><Calculator className="w-3.5 h-3.5" /> Tenor (g/s)</label><input type="text" value={form.tenor_saco_gps || '—'} readOnly className="input-field bg-slate-50 text-blue-700 font-semibold cursor-not-allowed min-h-[44px]" /></div>
              <div />

              <div className="md:col-span-3"><label className="input-label">Observaciones</label><textarea value={form.observaciones} onChange={e => handleFieldChange('observaciones', e.target.value)} className="input-field min-h-[44px]" rows={2} /></div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 mt-6 pt-4 border-t border-zinc-800">
              <button onClick={() => { setShowModal(false); setFormError(null); }} className="btn-secondary min-h-[48px] sm:min-h-[40px]">Cancelar</button>
              <button onClick={handleSave} disabled={isPending || !form.molino || !form.material || !form.oro_recuperado_g} className="btn-primary min-h-[48px] sm:min-h-[40px]">
                {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {editItem ? 'Actualizar' : 'Registrar Producción'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

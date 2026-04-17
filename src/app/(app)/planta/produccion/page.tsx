'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useCanEdit } from '@/lib/use-can-edit';
import { Factory, Plus, X, Loader2, Edit2, Trash2, Calculator, AlertTriangle, ChevronLeft, ChevronRight, CalendarDays, Download, AlertCircle } from 'lucide-react';
import { downloadProduccionPDF } from '@/lib/pdf-reports';
import type { ReporteProduccion } from '@/lib/types';
import MetricCard from '@/components/MetricCard';
import EmptyState from '@/components/EmptyState';


const PESO_SACO_KG = 50; // 1 saco estándar = 50 kg

export default function ProduccionPage() {
  const { user } = useAuth();
  const canEdit = useCanEdit();
  const [allData, setAllData] = useState<ReporteProduccion[]>([]);
  const [molinosSug, setMolinosSug] = useState<string[]>([]);
  const [materialesSug, setMaterialesSug] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<ReporteProduccion | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // ── Day selector ──
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

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

  const loadData = useCallback(async () => {
    const [reportesRes] = await Promise.all([
      supabase.from('reportes_produccion').select('*').order('fecha', { ascending: false }).limit(500),
    ]);
    const data = reportesRes.data || [];
    setAllData(data);

    // Auto-extract unique suggestions
    setMolinosSug(Array.from(new Set(data.map(d => d.molino).filter(Boolean))));
    setMaterialesSug(Array.from(new Set(data.map(d => d.material).filter(Boolean))));
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Filter data by selected date ──
  const data = useMemo(() => allData.filter(d => d.fecha === selectedDate), [allData, selectedDate]);

  // ── Available dates (for navigation) ──
  const availableDates = useMemo(() => {
    const dates = new Set(allData.map(d => d.fecha));
    return Array.from(dates).sort();
  }, [allData]);

  // ── Day navigation ──
  const navigateDay = (direction: 'prev' | 'next') => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + (direction === 'next' ? 1 : -1));
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const isToday = selectedDate === new Date().toISOString().split('T')[0];

  // ── Auto-calculate merma, tenors, and toneladas when inputs change ──
  const updateCalcs = (updated: typeof form) => {
    const amalg1 = parseFloat(updated.amalgama_1_g) || 0;
    const amalg2 = parseFloat(updated.amalgama_2_g) || 0;
    const recup = parseFloat(updated.oro_recuperado_g) || 0;
    const sacos = parseFloat(updated.sacos) || 0;

    // Auto-calculate toneladas from sacos (1 saco = 50 kg) if field is empty
    const autoTon = sacos > 0 ? (sacos * PESO_SACO_KG / 1000).toFixed(3) : '';
    const toneladas = updated.toneladas_procesadas || autoTon;
    const ton = parseFloat(toneladas) || 0;

    const merma1 = amalg1 > 0 && recup > 0 ? (((amalg1 - recup) / amalg1) * 100).toFixed(2) : '';
    const merma2 = amalg2 > 0 && recup > 0 ? (((amalg2 - recup) / amalg2) * 100).toFixed(2) : '';
    const tenorT = ton > 0 && recup > 0 ? (recup / ton).toFixed(4) : '';
    const tenorS = sacos > 0 && recup > 0 ? (recup / sacos).toFixed(4) : '';

    return {
      ...updated,
      toneladas_procesadas: toneladas,
      merma_1_pct: merma1,
      merma_2_pct: merma2,
      tenor_tonelada_gpt: tenorT,
      tenor_saco_gps: tenorS,
    };
  };

  const handleFieldChange = (field: string, value: string) => {
    const updated = { ...form, [field]: value };
    if (['amalgama_1_g', 'amalgama_2_g', 'oro_recuperado_g', 'sacos', 'toneladas_procesadas'].includes(field)) {
      setForm(updateCalcs(updated));
    } else {
      setForm(updated);
    }
  };

  const handleSave = async () => {
    // ── Validation: no negative values allowed ──
    const oroG = parseFloat(form.oro_recuperado_g);
    const sacosN = parseFloat(form.sacos);
    if (!form.oro_recuperado_g || isNaN(oroG) || oroG < 0) {
      setFormError('Oro Recuperado es obligatorio y no puede ser negativo.');
      return;
    }
    if (form.amalgama_1_g && parseFloat(form.amalgama_1_g) < 0) {
      setFormError('Amalgama 1 no puede ser negativa.');
      return;
    }
    if (form.amalgama_2_g && parseFloat(form.amalgama_2_g) < 0) {
      setFormError('Amalgama 2 no puede ser negativa.');
      return;
    }
    if (!isNaN(sacosN) && sacosN < 0) {
      setFormError('Sacos no puede ser negativo.');
      return;
    }
    setFormError(null);
    setSaving(true);
    const payload = {
      fecha: form.fecha,
      turno: form.turno,
      molino: form.molino,
      material: form.material,
      material_codigo: form.material_codigo || null,
      amalgama_1_g: parseFloat(form.amalgama_1_g) || null,
      amalgama_2_g: parseFloat(form.amalgama_2_g) || null,
      oro_recuperado_g: parseFloat(form.oro_recuperado_g) || 0,
      merma_1_pct: parseFloat(form.merma_1_pct) || null,
      merma_2_pct: parseFloat(form.merma_2_pct) || null,
      sacos: parseFloat(form.sacos) || 0,
      toneladas_procesadas: parseFloat(form.toneladas_procesadas) || null,
      tenor_tonelada_gpt: parseFloat(form.tenor_tonelada_gpt) || null,
      tenor_saco_gps: parseFloat(form.tenor_saco_gps) || null,
      responsable: form.responsable || null,
      observaciones: form.observaciones || null,
      registrado_por: user?.id,
    };
    if (editItem) {
      const { registrado_por, ...up } = payload;
      await supabase.from('reportes_produccion').update(up).eq('id', editItem.id);
    } else {
      await supabase.from('reportes_produccion').insert(payload);
    }
    setSaving(false); setShowModal(false); setEditItem(null); setForm({ ...emptyForm, fecha: selectedDate }); loadData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este registro de producción?')) return;
    await supabase.from('reportes_produccion').delete().eq('id', id);
    loadData();
  };

  const openEdit = (item: ReporteProduccion) => {
    setEditItem(item);
    setForm({
      fecha: item.fecha,
      turno: item.turno,
      molino: item.molino,
      material: item.material,
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
      responsable: item.responsable || '',
      observaciones: item.observaciones || '',
    });
    setShowModal(true);
  };

  const openNew = () => {
    setEditItem(null);
    setForm({ ...emptyForm, fecha: selectedDate });
    setShowModal(true);
  };

  const fmtNum = (n: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 }).format(n);

  // ── Day-scoped summaries ──
  const totalOroDay = data.reduce((s, d) => s + Number(d.oro_recuperado_g), 0);
  const totalSacosDay = data.reduce((s, d) => s + d.sacos, 0);
  const avgMerma = data.filter(d => d.merma_1_pct).length > 0
    ? data.filter(d => d.merma_1_pct).reduce((s, d) => s + Number(d.merma_1_pct), 0) / data.filter(d => d.merma_1_pct).length
    : 0;
  const totalTonDay = data.reduce((s, d) => s + Number(d.toneladas_procesadas || 0), 0);

  const getMermaColor = (pct: number) => {
    if (pct <= 0) return 'text-slate-400';
    if (pct < 50) return 'text-emerald-600';
    if (pct < 65) return 'text-amber-600';
    return 'text-red-600';
  };

  const getMermaBadge = (pct: number) => {
    if (pct <= 0) return 'badge-neutral';
    if (pct < 50) return 'badge-success';
    if (pct < 65) return 'badge-warning';
    return 'badge-danger';
  };

  const fmtDateDisplay = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  // Count records for nearby days
  const getRecordCount = (dateStr: string) => allData.filter(d => d.fecha === dateStr).length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white/90 font-bold tracking-tight text-2xl flex items-center gap-3">
            <Factory className="w-6 h-6 text-amber-400" /> Reportes de Producción
          </h1>
          <p className="text-white/40 text-sm mt-1">
            <span className="text-amber-400 font-semibold">{fmtNum(totalOroDay)} g Au</span> recuperados — {totalSacosDay} sacos <span className="text-white/25">(≈ {totalSacosDay * PESO_SACO_KG} kg)</span> —
            Merma prom: <span className={getMermaColor(avgMerma)}>{avgMerma > 0 ? `${avgMerma.toFixed(1)}%` : '—'}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => downloadProduccionPDF(data, selectedDate)}
            disabled={data.length === 0}
            className="btn-secondary disabled:opacity-40 flex items-center gap-1.5">
            <Download className="w-4 h-4" /> PDF {selectedDate}
          </button>
          <button onClick={openNew} disabled={!canEdit} className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed" title={!canEdit ? 'Modo observador: solo lectura' : undefined}>
            <Plus className="w-4 h-4" /> Nuevo Registro
          </button>
        </div>
      </div>

      {/* ═══ Day Selector ═══ */}
      <div className="card-glass p-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigateDay('prev')}
            className="p-2 rounded-xl hover:bg-white/[0.06] text-white/40 hover:text-white/75 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-amber-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="input-field !py-1.5 !px-3 !text-base font-semibold !w-auto !border-amber-400/30"
              />
            </div>
            <div className="text-sm text-white/40 capitalize hidden sm:block">
              {fmtDateDisplay(selectedDate)}
            </div>
            {isToday && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-400/25">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Hoy
              </span>
            )}
          </div>

          <button
            onClick={() => navigateDay('next')}
            className="p-2 rounded-xl hover:bg-white/[0.06] text-white/40 hover:text-white/75 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Quick date chips */}
        {availableDates.length > 0 && (
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
            {[...availableDates].reverse().map(date => {
              const d = new Date(date + 'T12:00:00');
              const isSelected = date === selectedDate;
              const count = getRecordCount(date);
              return (
                <button
                  key={date}
                  onClick={() => setSelectedDate(date)}
                  className={`flex-shrink-0 flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    isSelected
                      ? 'bg-amber-500/15 text-amber-300 border border-amber-400/30'
                      : 'bg-white/[0.04] text-white/40 border border-transparent hover:bg-white/[0.08] hover:text-white/65'
                  }`}
                >
                  <span className="uppercase">{d.toLocaleDateString('es-ES', { weekday: 'short' })}</span>
                  <span className="text-sm font-bold">{d.getDate()}</span>
                  <span className={`text-[10px] ${isSelected ? 'text-amber-400' : 'text-white/30'}`}>{count} reg</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Summary Cards — refactored with MetricCard */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MetricCard label="Oro Recuperado" value={totalOroDay} unit="g" variant="gold" icon={<span className="text-base">⚗️</span>} />
        <MetricCard label="Sacos (×50 kg)" value={totalSacosDay} unit="s" subValue={totalSacosDay > 0 ? `≈ ${totalSacosDay * PESO_SACO_KG} kg` : undefined} variant="neutral" icon={<span className="text-base">📦</span>} />
        <MetricCard label="Registros" value={data.length} variant="neutral" icon={<span className="text-base">📊</span>} />
        <MetricCard label="Toneladas" value={totalTonDay > 0 ? totalTonDay : '—'} unit={totalTonDay > 0 ? 't' : undefined} variant="neutral" icon={<span className="text-base">⚖️</span>} />
        <MetricCard
          label="Merma Promedio"
          value={avgMerma > 0 ? avgMerma.toFixed(1) : '—'}
          unit={avgMerma > 0 ? '%' : undefined}
          variant={avgMerma <= 0 ? 'neutral' : avgMerma < 50 ? 'positive' : avgMerma < 65 ? 'gold' : 'negative'}
          icon={avgMerma > 65 ? <AlertTriangle className="w-4 h-4" /> : <Calculator className="w-4 h-4" />}
        />
      </div>


      {/* Table & Cards — Day scoped */}
      {loading ? <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-amber-400 animate-spin" /></div> : (
        <>
          {/* VISTA MÓVIL (Tarjetas) */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {data.map(d => (
              <div key={d.id} className="card-glass p-4 relative">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/45 bg-white/[0.07] px-2 py-0.5 rounded-sm">
                      {d.turno === 'dia' ? '☀ Día' : d.turno === 'noche' ? '🌙 Noche' : '🔄 Comp.'}
                    </span>
                    <h3 className="font-bold text-white/85 mt-2 text-base">{d.molino || 'Sin molino'}</h3>
                    <p className="text-sm text-white/55">{d.material || 'Local'} {d.material_codigo ? <span className="text-xs text-white/35">({d.material_codigo})</span> : ''}</p>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-amber-400 text-lg block leading-none">{fmtNum(d.oro_recuperado_g)}g</span>
                    <span className="text-[10px] text-white/35 uppercase tracking-wide">Recuperado</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-4 mt-3 text-sm bg-white/[0.05] p-2.5 rounded-lg border border-white/[0.07]">
                  <div>
                    <span className="text-xs text-white/35 block mb-0.5">Amalgama 1</span>
                    <span className="text-white/70 font-medium">{d.amalgama_1_g ? `${fmtNum(d.amalgama_1_g)}g` : '—'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-white/35 block mb-0.5">Merma 1</span>
                    {d.merma_1_pct ? <span className={`badge ${getMermaBadge(d.merma_1_pct)} scale-90 origin-left`}>{d.merma_1_pct}%</span> : <span className="text-white/30">—</span>}
                  </div>
                  <div>
                    <span className="text-xs text-white/35 block mb-0.5">Sacos (×50 kg)</span>
                    <span className="text-white/70 font-medium">{d.sacos} s <span className="text-white/35 text-xs">(= {d.sacos * PESO_SACO_KG} kg)</span></span>
                  </div>
                  <div>
                    <span className="text-xs text-white/35 block mb-0.5">Tenor (g/t)</span>
                    <span className="text-blue-400 font-bold">{d.tenor_tonelada_gpt ? `${fmtNum(d.tenor_tonelada_gpt)}` : '—'}</span>
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-3 border-t border-white/[0.07]">
                  <button onClick={() => openEdit(d)} className="btn-secondary !py-1.5 !px-3 !text-xs"><Edit2 className="w-3.5 h-3.5" /> Editar</button>
                  <button onClick={() => handleDelete(d.id)} className="btn-danger !py-1.5 !px-3 !text-xs"><Trash2 className="w-3.5 h-3.5" /> Borrar</button>
                </div>
              </div>
            ))}
            {data.length === 0 && (
              <EmptyState
                icon={<Factory className="w-8 h-8" />}
                title="Sin registros para este día"
                description={`No hay reportes de producción para el ${fmtDateDisplay(selectedDate)}.`}
                action={canEdit ? { label: 'Registrar turno', onClick: openNew } : undefined}
              />
            )}
          </div>

          {/* VISTA ESCRITORIO (Tabla) */}
          <div className="table-container hidden md:block">
            <table className="data-table">
              <thead>
              <tr>
                <th>Turno</th>
                <th>Molino</th>
                <th>Material</th>
                <th className="text-right">Amalg 1</th>
                <th className="text-right">Amalg 2</th>
                <th className="text-right">Au Recup.</th>
                <th>Merma 1</th>
                <th>Merma 2</th>
                <th>Sacos (×50 kg)</th>
                <th>Ton</th>
                <th>Tenor g/t</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {data.map(d => (
                <tr key={d.id}>
                  <td className="whitespace-nowrap">
                    <span className="text-xs">
                      {d.turno === 'dia' ? '☀ Día' : d.turno === 'noche' ? '🌙 Noche' : '🔄 Comp.'}
                    </span>
                  </td>
                  <td className="text-white/80 font-medium">{d.molino || '—'}</td>
                  <td>
                    <span className="font-medium text-white/75 block leading-snug">{d.material || '—'}</span>
                    {d.material_codigo && <span className="text-xs text-white/35 mt-0.5 block">{d.material_codigo}</span>}
                  </td>
                  <td className="text-right text-white/55">{d.amalgama_1_g ? `${fmtNum(d.amalgama_1_g)} g` : '—'}</td>
                  <td className="text-right text-white/55">{d.amalgama_2_g ? `${fmtNum(d.amalgama_2_g)} g` : '—'}</td>
                  <td className="text-right">
                    <span className="font-bold text-amber-400 text-base">{fmtNum(d.oro_recuperado_g)} g</span>
                  </td>
                  <td>
                    {d.merma_1_pct ? (
                      <span className={`badge ${getMermaBadge(d.merma_1_pct)}`}>{d.merma_1_pct}%</span>
                    ) : '—'}
                  </td>
                  <td>
                    {d.merma_2_pct ? (
                      <span className={`badge ${getMermaBadge(d.merma_2_pct)}`}>{d.merma_2_pct}%</span>
                    ) : '—'}
                  </td>
                  <td className="text-center text-white/65">
                    <span className="font-semibold">{d.sacos}</span>
                    <span className="text-white/30 text-xs ml-1">(= {d.sacos * PESO_SACO_KG} kg)</span>
                  </td>
                  <td className="text-white/40">{d.toneladas_procesadas || '—'}</td>
                  <td className="text-blue-400 font-medium">{d.tenor_tonelada_gpt ? `${fmtNum(d.tenor_tonelada_gpt)}` : '—'}</td>
                  <td>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(d)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-amber-400 transition-colors"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(d.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={12} className="py-0">
                    <EmptyState
                      icon={<Factory className="w-8 h-8" />}
                      title="Sin registros para este día"
                      description={`No hay reportes para el ${fmtDateDisplay(selectedDate)}.`}
                      action={canEdit ? { label: 'Registrar turno', onClick: openNew } : undefined}
                    />
                  </td>
                </tr>
              )}
            </tbody>
            </table>
          </div>
        </>
      )}

      {/* ═══ Modal ═══ */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => { setShowModal(false); setFormError(null); }}>
          <div className="relative w-full max-w-3xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-8 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white/90">{editItem ? 'Editar Registro' : 'Nuevo Reporte de Producción'}</h2>
              <button title="Cerrar modal" onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/40"><X className="w-5 h-5" /></button>
            </div>

            {formError && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 mb-4">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span className="text-sm text-red-400">{formError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Row 1: Date, Shift, Molino */}
              <div><label className="input-label">Fecha *</label><input type="date" value={form.fecha} onChange={e => handleFieldChange('fecha', e.target.value)} className="input-field" /></div>
              <div><label className="input-label">Turno *</label>
                <select value={form.turno} onChange={e => handleFieldChange('turno', e.target.value)} className="input-field">
                  <option value="dia">☀ Día</option><option value="noche">🌙 Noche</option><option value="completo">🔄 Completo</option>
                </select>
              </div>
              <div>
                <label className="input-label">Molino *</label>
                <input list="molinos-list" value={form.molino} onChange={e => handleFieldChange('molino', e.target.value)} className="input-field" placeholder="Escribir molino..." />
                <datalist id="molinos-list">
                  {molinosSug.map(m => <option key={m} value={m} />)}
                </datalist>
              </div>

              {/* Row 2: Material, Código */}
              <div className="md:col-span-2">
                <label className="input-label">Material / Mina de Origen *</label>
                <input list="materiales-list" value={form.material} onChange={e => handleFieldChange('material', e.target.value)} className="input-field" placeholder="Escribir material o mina..." />
                <datalist id="materiales-list">
                  {materialesSug.map(m => <option key={m} value={m} />)}
                </datalist>
              </div>
              <div><label className="input-label">Código Lote/Veta</label><input value={form.material_codigo} onChange={e => handleFieldChange('material_codigo', e.target.value)} className="input-field" placeholder="V-2D19" /></div>

              {/* Divider: Amalgamación */}
              <div className="md:col-span-3 mt-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-amber-400">⚗️ Amalgamación</span>
                  <div className="flex-1 h-px bg-amber-400/20" />
                </div>
              </div>

              {/* Row 3: Amalgamas + Oro */}
              <div>
                <label className="input-label">Amalgama 1 (g)</label>
                <input type="number" step="0.01" value={form.amalgama_1_g} onChange={e => handleFieldChange('amalgama_1_g', e.target.value)} className="input-field" placeholder="23.00" />
              </div>
              <div>
                <label className="input-label">Amalgama 2 (g)</label>
                <input type="number" step="0.01" value={form.amalgama_2_g} onChange={e => handleFieldChange('amalgama_2_g', e.target.value)} className="input-field" placeholder="22.90" />
              </div>
              <div className="bg-amber-500/[0.07] rounded-xl p-3 border border-amber-400/20">
                <label className="input-label !text-amber-400 !font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Oro Recuperado (g Au) *
                </label>
                <input type="number" step="0.0001" value={form.oro_recuperado_g} onChange={e => handleFieldChange('oro_recuperado_g', e.target.value)} className="input-field text-lg font-bold" style={{ borderColor: 'rgba(217, 119, 6, 0.4)' }} placeholder="10.90" required />
              </div>

              {/* Row 4: Merma (auto-calculated) */}
              <div>
                <label className="input-label flex items-center gap-1"><Calculator className="w-3.5 h-3.5" /> Merma 1 (%)</label>
                <input type="text" value={form.merma_1_pct ? `${form.merma_1_pct}%` : '—'} readOnly className="input-field bg-slate-50 text-slate-500 cursor-not-allowed" />
              </div>
              <div>
                <label className="input-label flex items-center gap-1"><Calculator className="w-3.5 h-3.5" /> Merma 2 (%)</label>
                <input type="text" value={form.merma_2_pct ? `${form.merma_2_pct}%` : '—'} readOnly className="input-field bg-slate-50 text-slate-500 cursor-not-allowed" />
              </div>
              <div />

              {/* Divider: Producción */}
              <div className="md:col-span-3 mt-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-blue-400">📦 Producción</span>
                  <div className="flex-1 h-px bg-blue-400/20" />
                </div>
              </div>

              {/* Row 5: Sacos, Toneladas, Tenores */}
              <div>
                <label className="input-label">Sacos * <span className="text-amber-400/70 font-normal">(unidad = 50 kg)</span></label>
                <input type="text" inputMode="decimal" value={form.sacos} onChange={e => handleFieldChange('sacos', e.target.value)} className="input-field" placeholder="39" />
                {parseFloat(form.sacos) > 0 && (
                  <p className="text-xs text-white/35 mt-1">{parseFloat(form.sacos)} sacos × 50 kg = <span className="text-amber-400/60 font-semibold">{(parseFloat(form.sacos) * PESO_SACO_KG).toFixed(1)} kg</span></p>
                )}
              </div>
              <div>
                <label className="input-label">Ton. Procesadas <span className="text-white/30 font-normal">(auto desde sacos)</span></label>
                <input type="number" step="0.001" value={form.toneladas_procesadas} onChange={e => handleFieldChange('toneladas_procesadas', e.target.value)} className="input-field" placeholder="1.950" />
              </div>
              <div><label className="input-label">Responsable</label><input value={form.responsable} onChange={e => handleFieldChange('responsable', e.target.value)} className="input-field" /></div>

              {/* Row 6: Tenores (auto-calculated) */}
              <div>
                <label className="input-label flex items-center gap-1"><Calculator className="w-3.5 h-3.5" /> Tenor (g/t)</label>
                <input type="text" value={form.tenor_tonelada_gpt || '—'} readOnly className="input-field bg-slate-50 text-blue-700 font-semibold cursor-not-allowed" />
              </div>
              <div>
                <label className="input-label flex items-center gap-1"><Calculator className="w-3.5 h-3.5" /> Tenor (g/s)</label>
                <input type="text" value={form.tenor_saco_gps || '—'} readOnly className="input-field bg-slate-50 text-blue-700 font-semibold cursor-not-allowed" />
              </div>
              <div />

              <div className="md:col-span-3"><label className="input-label">Observaciones</label><textarea value={form.observaciones} onChange={e => handleFieldChange('observaciones', e.target.value)} className="input-field" rows={2} /></div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-zinc-800">
              <button onClick={() => { setShowModal(false); setFormError(null); }} className="btn-secondary">Cancelar</button>
              <button onClick={handleSave} disabled={saving || !form.molino || !form.material || !form.oro_recuperado_g} className="btn-primary">
                {saving ? 'Guardando...' : editItem ? 'Actualizar' : 'Registrar Producción'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useCanEdit } from '@/lib/use-can-edit';
import { Loader2, Zap, Plus, X, Edit2, Trash2, ChevronLeft, ChevronRight, CalendarDays, Flame, Target, Package, AlertTriangle, Download } from 'lucide-react';
import { downloadVoladurasPDF } from '@/lib/pdf-reports';
import type { ReporteVoladura, PausaBarrenado } from '@/lib/types';

export default function VoladurasPage() {
  const { user } = useAuth();
  const canEdit = useCanEdit();
  const [allData, setAllData] = useState<ReporteVoladura[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<ReporteVoladura | null>(null);
  const [saving, setSaving] = useState(false);
  const [pausas, setPausas] = useState<PausaBarrenado[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

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

  const loadData = useCallback(async () => {
    const { data } = await supabase
      .from('reportes_voladuras')
      .select('*')
      .order('fecha', { ascending: false })
      .limit(500);
    setAllData(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const data = useMemo(() => allData.filter(d => d.fecha === selectedDate), [allData, selectedDate]);
  const availableDates = useMemo(() => Array.from(new Set(allData.map(d => d.fecha))).sort(), [allData]);

  const navigateDay = (dir: 'prev' | 'next') => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + (dir === 'next' ? 1 : -1));
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const isToday = selectedDate === new Date().toISOString().split('T')[0];

  const addPausa    = () => setPausas(p => [...p, { hora_inicio: '', hora_fin: '', motivo: '' }]);
  const removePausa  = (i: number) => setPausas(p => p.filter((_, idx) => idx !== i));
  const updatePausa  = (i: number, key: keyof PausaBarrenado, val: string) =>
    setPausas(p => p.map((x, idx) => idx === i ? { ...x, [key]: val } : x));

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      fecha: form.fecha, turno: form.turno,
      mina: form.mina || null, frente: 'Vertical',
      orientacion: 'vertical', numero_frente: null,
      hora_inicio_barrenado: form.hora_inicio_barrenado || null,
      hora_fin_barrenado: form.hora_fin_barrenado || null,
      numero_disparo: form.numero_disparo || null,
      hora_disparo: form.hora_disparo || null,
      vertical_disparo: form.vertical_disparo || null,
      sin_novedad: form.sin_novedad,
      huecos_cantidad: parseInt(form.huecos_cantidad as string) || 0,
      huecos_pies: parseInt(form.huecos_pies as string) || 0,
      chupis_cantidad: parseInt(form.chupis_cantidad as string) || 0,
      chupis_pies: parseInt(form.chupis_pies as string) || 0,
      fosforos_lp: parseInt(form.fosforos_lp as string) || 0,
      espaguetis: parseInt(form.espaguetis as string) || 0,
      vitamina_e: parseInt(form.vitamina_e as string) || 0,
      trenza_metros: parseFloat(form.trenza_metros as string) || 0,
      arroz_kg: parseFloat(form.arroz_kg as string) || 0,
      pausas_barrenado: pausas.length > 0 ? pausas : null,
      observaciones_disparo: form.observaciones_disparo || null,
      observaciones: form.observaciones || null,
      responsable: form.responsable || null,
      registrado_por: user?.id,
    };
    if (editItem) {
      const { registrado_por, ...up } = payload;
      await supabase.from('reportes_voladuras').update(up).eq('id', editItem.id);
    } else {
      await supabase.from('reportes_voladuras').insert(payload);
    }
    setSaving(false); setShowModal(false); setEditItem(null);
    setForm({ ...emptyForm, fecha: selectedDate }); setPausas([]); loadData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este reporte de voladura?')) return;
    await supabase.from('reportes_voladuras').delete().eq('id', id);
    loadData();
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
  const getCount = (d: string) => allData.filter(x => x.fecha === d).length;

  const totalHuecos = data.reduce((s, d) => s + d.huecos_cantidad, 0);
  const totalChupis = data.reduce((s, d) => s + d.chupis_cantidad, 0);
  const totalArroz = data.reduce((s, d) => s + Number(d.arroz_kg), 0);
  const totalFosforos = data.reduce((s, d) => s + d.fosforos_lp, 0);
  const disparosCount = data.filter(d => d.numero_disparo).length;

  const set = (field: string, value: unknown) => setForm(f => ({ ...f, [field]: value }));

  return (
    <div className="space-y-6">
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
          <button onClick={() => downloadVoladurasPDF(data, selectedDate)}
            disabled={data.length === 0}
            className="btn-secondary disabled:opacity-40 flex items-center gap-1.5">
            <Download className="w-4 h-4" /> PDF {selectedDate}
          </button>
          <button onClick={() => { setEditItem(null); setForm({ ...emptyForm, fecha: selectedDate }); setShowModal(true); }}
            disabled={!canEdit} className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed">
            <Plus className="w-4 h-4" /> Nuevo Reporte
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
            {availableDates.slice(-7).reverse().map(date => {
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

      {/* Table & Cards */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-amber-400 animate-spin" /></div>
      ) : (
        <>
          {/* Mobile Cards */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {data.map(d => (
              <div key={d.id} className="card-glass p-5">
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
                  <button onClick={() => openEdit(d)} className="btn-secondary !py-1.5 !px-3 !text-xs"><Edit2 className="w-3.5 h-3.5" /> Editar</button>
                  <button onClick={() => handleDelete(d.id)} className="btn-danger !py-1.5 !px-3 !text-xs"><Trash2 className="w-3.5 h-3.5" /> Borrar</button>
                </div>
              </div>
            ))}
            {data.length === 0 && <div className="text-center py-12 text-white/40 card-glass">Sin reportes para {fmtDate(selectedDate)}</div>}
          </div>

          {/* Desktop Table */}
          <div className="table-container hidden md:block">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Turno</th><th>Frente</th><th>Mina</th><th>Disparo</th>
                  <th className="text-center">Huecos</th><th className="text-center">Chupis</th>
                  <th className="text-center">Fósforos</th><th className="text-center">Espag.</th>
                  <th className="text-center">Vit. E</th><th className="text-right">Arroz (kg)</th>
                  <th>Estado</th><th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.map(d => (
                  <tr key={d.id}>
                    <td className="text-xs whitespace-nowrap">{d.turno === 'dia' ? '☀ Día' : d.turno === 'noche' ? '🌙 Noche' : '🔄 Comp.'}</td>
                    <td className="text-amber-400 font-bold whitespace-nowrap">{d.frente || '—'}</td>
                    <td className="text-white/80 font-medium">{d.mina || '—'}</td>
                    <td className="text-white/55 whitespace-nowrap">
                      {d.numero_disparo ? `N°${d.numero_disparo}` : '—'}
                      {fmtTime(d.hora_disparo) && <span className="text-white/30 text-xs ml-1">— {fmtTime(d.hora_disparo)}</span>}
                      {d.vertical_disparo && <span className="block text-[10px] text-purple-400/70 mt-0.5">{d.vertical_disparo}</span>}
                    </td>
                    <td className="text-center font-semibold text-blue-400">
                      {d.huecos_cantidad} <span className="text-white/30 text-xs">×{d.huecos_pies}p</span>
                    </td>
                    <td className="text-center font-semibold text-amber-400">
                      {d.chupis_cantidad} <span className="text-white/30 text-xs">×{d.chupis_pies}p</span>
                    </td>
                    <td className="text-center text-purple-400">{d.fosforos_lp}</td>
                    <td className="text-center text-white/60">{d.espaguetis}</td>
                    <td className="text-center text-cyan-400">{d.vitamina_e}</td>
                    <td className="text-right font-semibold text-red-400">{d.arroz_kg} kg</td>
                    <td>
                      <span className={`badge ${d.sin_novedad ? 'badge-success' : 'badge-danger'}`}>
                        {d.sin_novedad ? 'Sin novedad' : 'Novedad'}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(d)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-amber-400 transition-colors"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(d.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {data.length === 0 && <tr><td colSpan={12} className="text-center py-12 text-white/40">Sin reportes para {fmtDate(selectedDate)}</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowModal(false)}>
          <div className="relative w-full max-w-3xl bg-[#091820]/98 border border-white/[0.10] rounded-2xl shadow-2xl p-8 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white/90">{editItem ? 'Editar Reporte' : 'Nuevo Reporte de Voladura'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/40"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-6">
              {/* ── Identificación ── */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-semibold text-amber-400">📍 Identificación</span>
                  <div className="flex-1 h-px bg-amber-400/20" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div><label className="input-label">Fecha *</label>
                    <input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} className="input-field" /></div>
                  <div><label className="input-label">Turno *</label>
                    <select value={form.turno} onChange={e => set('turno', e.target.value)} className="input-field">
                      <option value="dia">☀ Día</option>
                      <option value="noche">🌙 Noche</option>
                      <option value="completo">🔄 Completo</option>
                    </select></div>
                  <div><label className="input-label">Mina</label>
                    <input value={form.mina} onChange={e => set('mina', e.target.value)} placeholder="Ej: Belén 2" className="input-field" /></div>
                  <div><label className="input-label">Responsable</label>
                    <input value={form.responsable} onChange={e => set('responsable', e.target.value)} className="input-field" /></div>
                </div>
              </div>

              {/* ── Barrenado ── */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-semibold text-blue-400">⛏ Proceso de Barrenado</span>
                  <div className="flex-1 h-px bg-blue-400/20" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="input-label">Hora Inicio (Inicia)</label>
                    <input type="time" value={form.hora_inicio_barrenado} onChange={e => set('hora_inicio_barrenado', e.target.value)} className="input-field" /></div>
                  <div><label className="input-label">Hora Culmina (Termina)</label>
                    <input type="time" value={form.hora_fin_barrenado} onChange={e => set('hora_fin_barrenado', e.target.value)} className="input-field" /></div>
                </div>

                {/* ── Pausas ── */}
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-orange-400/80 uppercase tracking-wider">⏸ Pausas del barrenado</span>
                    <button type="button" onClick={addPausa}
                      className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 transition-colors border border-orange-400/20">
                      <Plus className="w-3.5 h-3.5" /> Agregar pausa
                    </button>
                  </div>
                  {pausas.length === 0 && (
                    <p className="text-xs text-white/25 italic">Sin pausas registradas para este turno.</p>
                  )}
                  <div className="space-y-2">
                    {pausas.map((p, i) => (
                      <div key={i} className="grid grid-cols-[1fr_1fr_2fr_auto] gap-2 items-start p-3 bg-orange-500/[0.06] rounded-xl border border-orange-400/15">
                        <div>
                          <label className="input-label !text-orange-400/70 !text-[10px]">Parada (hora)</label>
                          <input type="time" value={p.hora_inicio} onChange={e => updatePausa(i, 'hora_inicio', e.target.value)} className="input-field !py-1.5" />
                        </div>
                        <div>
                          <label className="input-label !text-orange-400/70 !text-[10px]">Reinicio (hora)</label>
                          <input type="time" value={p.hora_fin} onChange={e => updatePausa(i, 'hora_fin', e.target.value)} className="input-field !py-1.5" />
                        </div>
                        <div>
                          <label className="input-label !text-orange-400/70 !text-[10px]">Motivo</label>
                          <input value={p.motivo} onChange={e => updatePausa(i, 'motivo', e.target.value)}
                            placeholder="Ej: Compresor con problemas técnicos"
                            className="input-field !py-1.5" />
                        </div>
                        <button type="button" onClick={() => removePausa(i)}
                          className="mt-5 p-1.5 rounded-lg hover:bg-red-500/15 text-white/30 hover:text-red-400 transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── Disparo ── */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-semibold text-red-400">💥 Disparo</span>
                  <div className="flex-1 h-px bg-red-400/20" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
                  <div><label className="input-label">N° Disparo</label>
                    <input value={form.numero_disparo} onChange={e => set('numero_disparo', e.target.value)} placeholder="Ej: 21" className="input-field" /></div>
                  <div><label className="input-label">Hora del Disparo</label>
                    <input type="time" value={form.hora_disparo} onChange={e => set('hora_disparo', e.target.value)} className="input-field" /></div>
                  <div><label className="input-label">Vertical</label>
                    <select value={form.vertical_disparo} onChange={e => set('vertical_disparo', e.target.value)} className="input-field">
                      <option value="">— Sin especificar —</option>
                      <option value="Vertical 1">Vertical 1</option>
                      <option value="Vertical 2">Vertical 2</option>
                      <option value="Vertical 3">Vertical 3</option>
                    </select></div>
                  <div className="flex items-end pb-1">
                    <label className="flex items-center gap-3 cursor-pointer" onClick={() => set('sin_novedad', !form.sin_novedad)}>
                      <div className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${form.sin_novedad ? 'bg-emerald-500' : 'bg-red-500/70'}`}>
                        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all shadow ${form.sin_novedad ? 'left-5' : 'left-0.5'}`} />
                      </div>
                      <span className={`text-sm font-semibold ${form.sin_novedad ? 'text-emerald-400' : 'text-red-400'}`}>
                        {form.sin_novedad ? '✓ Sin novedad' : '⚠ Con novedad'}
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* ── Huecos & Chupis ── */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-semibold text-purple-400">🕳 Huecos & Chupis</span>
                  <div className="flex-1 h-px bg-purple-400/20" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-blue-500/[0.07] rounded-xl p-3 border border-blue-400/20">
                    <label className="input-label !text-blue-400 !font-semibold">Huecos realizados</label>
                    <input type="number" value={form.huecos_cantidad} onChange={e => set('huecos_cantidad', e.target.value)} className="input-field font-bold text-lg" placeholder="31" />
                  </div>
                  <div className="bg-blue-500/[0.07] rounded-xl p-3 border border-blue-400/20">
                    <label className="input-label !text-blue-400">Pies / Hueco</label>
                    <input type="number" value={form.huecos_pies} onChange={e => set('huecos_pies', e.target.value)} className="input-field" placeholder="6" />
                  </div>
                  <div className="bg-amber-500/[0.07] rounded-xl p-3 border border-amber-400/20">
                    <label className="input-label !text-amber-400 !font-semibold">Chupis realizados</label>
                    <input type="number" value={form.chupis_cantidad} onChange={e => set('chupis_cantidad', e.target.value)} className="input-field font-bold text-lg" placeholder="25" />
                  </div>
                  <div className="bg-amber-500/[0.07] rounded-xl p-3 border border-amber-400/20">
                    <label className="input-label !text-amber-400">Pies / Chupi</label>
                    <input type="number" value={form.chupis_pies} onChange={e => set('chupis_pies', e.target.value)} className="input-field" placeholder="6" />
                  </div>
                </div>
              </div>

              {/* ── Condimentos ── */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-semibold text-orange-400">🧪 Condimentos utilizados</span>
                  <div className="flex-1 h-px bg-orange-400/20" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div>
                    <label className="input-label">Fósforos LP</label>
                    <input type="number" value={form.fosforos_lp} onChange={e => set('fosforos_lp', e.target.value)} className="input-field" placeholder="29" />
                    <p className="text-[10px] text-white/25 mt-1">Det. no eléctrico</p>
                  </div>
                  <div>
                    <label className="input-label">Espaguetis</label>
                    <input type="number" value={form.espaguetis} onChange={e => set('espaguetis', e.target.value)} className="input-field" placeholder="49" />
                    <p className="text-[10px] text-white/25 mt-1">Tubos explosivos</p>
                  </div>
                  <div>
                    <label className="input-label">Vitamina E</label>
                    <input type="number" value={form.vitamina_e} onChange={e => set('vitamina_e', e.target.value)} className="input-field" placeholder="1" />
                    <p className="text-[10px] text-white/25 mt-1">Det. eléctrico</p>
                  </div>
                  <div>
                    <label className="input-label">Trenza (m)</label>
                    <input type="number" step="0.5" value={form.trenza_metros} onChange={e => set('trenza_metros', e.target.value)} className="input-field" placeholder="1" />
                    <p className="text-[10px] text-white/25 mt-1">Cordón detonante</p>
                  </div>
                  <div className="bg-red-500/[0.07] rounded-xl p-3 border border-red-400/20">
                    <label className="input-label !text-red-400 !font-semibold">Arroz (kg)</label>
                    <input type="number" step="0.5" value={form.arroz_kg} onChange={e => set('arroz_kg', e.target.value)} className="input-field font-bold" placeholder="23" />
                    <p className="text-[10px] text-red-400/40 mt-1">ANFO</p>
                  </div>
                </div>
              </div>

              {/* ── Observaciones ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Observaciones del Disparo</label>
                  <textarea value={form.observaciones_disparo} onChange={e => set('observaciones_disparo', e.target.value)} className="input-field" rows={3}
                    placeholder="Ej: Se realizará detonación en 29 huecos y 2 de salida..." />
                </div>
                <div>
                  <label className="input-label">Observaciones del Turno</label>
                  <textarea value={form.observaciones} onChange={e => set('observaciones', e.target.value)} className="input-field" rows={3}
                    placeholder="Ej: El turno diurno continuará operaciones..." />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/[0.07]">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
              <button onClick={handleSave} disabled={saving || !form.huecos_cantidad} className="btn-primary">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {editItem ? 'Actualizar' : 'Registrar Voladura'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useCanEdit } from '@/lib/use-can-edit';
import {
  Pickaxe, Plus, X, Loader2, Edit2, Trash2,
  ChevronLeft, ChevronRight, CalendarDays, Clock, Package, Zap,
} from 'lucide-react';
import type { ReporteExtraccion, EventoExtraccion } from '@/lib/types';

const fmtDate = (s: string) =>
  new Date(s + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
const fmtTime = (t?: string | null) => (t ? t.slice(0, 5) : '—');

export default function ExtraccionPage() {
  const { user } = useAuth();
  const canEdit = useCanEdit();

  const [allData, setAllData] = useState<ReporteExtraccion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<ReporteExtraccion | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const emptyForm = {
    fecha: selectedDate,
    turno: 'noche' as ReporteExtraccion['turno'],
    vertical: '',
    mina: '',
    responsable: '',
    hora_inicio: '',
    hora_fin: '',
    sacos_extraidos: '',
    numero_disparo: '',
    observaciones: '',
  };
  const [form, setForm] = useState(emptyForm);
  const [eventos, setEventos] = useState<EventoExtraccion[]>([]);

  const loadData = useCallback(async () => {
    const { data } = await supabase
      .from('reportes_extraccion')
      .select('*')
      .order('fecha', { ascending: false })
      .limit(500);
    setAllData(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const data = useMemo(() => allData.filter(d => d.fecha === selectedDate), [allData, selectedDate]);
  const availableDates = useMemo(() => Array.from(new Set(allData.map(d => d.fecha))).sort(), [allData]);
  const isToday = selectedDate === new Date().toISOString().split('T')[0];

  const navigateDay = (dir: 'prev' | 'next') => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + (dir === 'next' ? 1 : -1));
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const addEvento = () => setEventos(e => [...e, { hora: '', descripcion: '' }]);
  const removeEvento = (i: number) => setEventos(e => e.filter((_, idx) => idx !== i));
  const updateEvento = (i: number, key: keyof EventoExtraccion, val: string) =>
    setEventos(e => e.map((x, idx) => idx === i ? { ...x, [key]: val } : x));

  const set = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }));

  const openNew = () => {
    setEditItem(null);
    setForm({ ...emptyForm, fecha: selectedDate });
    setEventos([]);
    setShowModal(true);
  };

  const openEdit = (item: ReporteExtraccion) => {
    setEditItem(item);
    setEventos(item.eventos || []);
    setForm({
      fecha: item.fecha,
      turno: item.turno,
      vertical: item.vertical || '',
      mina: item.mina || '',
      responsable: item.responsable || '',
      hora_inicio: item.hora_inicio || '',
      hora_fin: item.hora_fin || '',
      sacos_extraidos: String(item.sacos_extraidos ?? ''),
      numero_disparo: item.numero_disparo || '',
      observaciones: item.observaciones || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      fecha: form.fecha,
      turno: form.turno,
      vertical: form.vertical || null,
      mina: form.mina || null,
      responsable: form.responsable || null,
      hora_inicio: form.hora_inicio || null,
      hora_fin: form.hora_fin || null,
      eventos: eventos.length > 0 ? eventos : null,
      sacos_extraidos: parseInt(form.sacos_extraidos) || 0,
      numero_disparo: form.numero_disparo || null,
      observaciones: form.observaciones || null,
      registrado_por: user?.id,
    };
    if (editItem) {
      const { registrado_por, ...up } = payload;
      await supabase.from('reportes_extraccion').update(up).eq('id', editItem.id);
    } else {
      await supabase.from('reportes_extraccion').insert(payload);
    }
    setSaving(false);
    setShowModal(false);
    setEditItem(null);
    setEventos([]);
    setForm({ ...emptyForm, fecha: selectedDate });
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este reporte de extracción?')) return;
    await supabase.from('reportes_extraccion').delete().eq('id', id);
    loadData();
  };

  const totalSacos = data.reduce((s, d) => s + (d.sacos_extraidos || 0), 0);
  const disparosCount = data.filter(d => d.numero_disparo).length;
  const totalEventos = data.reduce((s, d) => s + (d.eventos?.length || 0), 0);

  const turnoLabel = (t: string) =>
    t === 'dia' ? '☀ Día' : t === 'noche' ? '🌙 Noche' : '🔄 Completo';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-white/90 font-bold tracking-tight text-2xl flex items-center gap-3">
            <Pickaxe className="w-6 h-6 text-amber-400" /> Reportes de Extracción
          </h1>
          <p className="text-white/40 text-sm mt-1">
            <span className="text-amber-400 font-semibold">{totalSacos} sacos</span> extraídos
            {' '}— <span className="text-blue-400 font-semibold">{disparosCount} disparos</span>
            {' '}— {totalEventos} eventos registrados
          </p>
        </div>
        <button onClick={openNew} disabled={!canEdit} className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed">
          <Plus className="w-4 h-4" /> Nuevo Reporte
        </button>
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
              const count = allData.filter(x => x.fecha === date).length;
              return (
                <button key={date} onClick={() => setSelectedDate(date)}
                  className={`flex-shrink-0 flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    isSel ? 'bg-amber-500/15 text-amber-300 border border-amber-400/30'
                    : 'bg-white/[0.04] text-white/40 border border-transparent hover:bg-white/[0.08]'
                  }`}>
                  <span className="uppercase">{d.toLocaleDateString('es-ES', { weekday: 'short' })}</span>
                  <span className="text-sm font-bold">{d.getDate()}</span>
                  <span className={`text-[10px] ${isSel ? 'text-amber-400' : 'text-white/30'}`}>{count} reg</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { label: 'Sacos Extraídos', value: totalSacos, color: '#D97706', text: 'text-amber-400', bg: 'bg-amber-500/10', icon: <Package className="w-5 h-5 text-amber-400" /> },
          { label: 'Disparos', value: disparosCount, color: '#2563EB', text: 'text-blue-400', bg: 'bg-blue-500/10', icon: <Zap className="w-5 h-5 text-blue-400" /> },
          { label: 'Eventos del Turno', value: totalEventos, color: '#059669', text: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: <Clock className="w-5 h-5 text-emerald-400" /> },
        ].map((k, i) => (
          <div key={i} className="card-glass p-4 flex items-center gap-3" style={{ borderTop: `3px solid ${k.color}` }}>
            <div className={`w-9 h-9 rounded-lg ${k.bg} flex items-center justify-center flex-shrink-0`}>{k.icon}</div>
            <div>
              <p className="text-xs text-white/40">{k.label}</p>
              <p className={`text-2xl font-bold ${k.text}`}>{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Records */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-amber-400 animate-spin" /></div>
      ) : (
        <>
          {/* Mobile */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {data.map(d => (
              <div key={d.id} className="card-glass p-5">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-white/45 bg-white/[0.07] px-2 py-0.5 rounded-sm">
                        {turnoLabel(d.turno)}
                      </span>
                      {d.vertical && <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-sm">{d.vertical}</span>}
                    </div>
                    <h3 className="font-bold text-white/85 text-base">{d.mina || 'Sin mina'}</h3>
                    {d.numero_disparo && <p className="text-sm text-white/40 mt-0.5">Disparo N°{d.numero_disparo}</p>}
                    <p className="text-xs text-white/30 mt-0.5">{fmtTime(d.hora_inicio)} → {fmtTime(d.hora_fin)}</p>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-amber-400 text-2xl block leading-none">{d.sacos_extraidos}</span>
                    <span className="text-[10px] text-white/35 uppercase tracking-wide">sacos</span>
                  </div>
                </div>
                {d.eventos && d.eventos.length > 0 && (
                  <div className="mb-3 space-y-1 bg-white/[0.04] rounded-lg p-3 border border-white/[0.07]">
                    {d.eventos.map((ev, i) => (
                      <p key={i} className="text-xs text-white/55 leading-relaxed">
                        <span className="text-amber-400/70 font-bold mr-1">{ev.hora}</span>{ev.descripcion}
                      </p>
                    ))}
                  </div>
                )}
                {d.observaciones && <p className="text-xs text-white/35 italic mb-3 border-l-2 border-white/10 pl-2">{d.observaciones}</p>}
                {canEdit && (
                  <div className="flex gap-2 justify-end pt-3 border-t border-white/[0.07]">
                    <button onClick={() => openEdit(d)} className="btn-secondary !py-1.5 !px-3 !text-xs"><Edit2 className="w-3.5 h-3.5" /> Editar</button>
                    <button onClick={() => handleDelete(d.id)} className="btn-danger !py-1.5 !px-3 !text-xs"><Trash2 className="w-3.5 h-3.5" /> Borrar</button>
                  </div>
                )}
              </div>
            ))}
            {data.length === 0 && (
              <div className="card-glass flex flex-col items-center justify-center py-16 text-center">
                <Pickaxe className="w-10 h-10 text-white/15 mb-3" />
                <p className="text-white/40 font-medium">Sin reportes para este día</p>
                <p className="text-white/25 text-sm mt-1">{fmtDate(selectedDate)}</p>
                {canEdit && <button onClick={openNew} className="btn-primary mt-4 !text-sm"><Plus className="w-4 h-4" /> Registrar turno</button>}
              </div>
            )}
          </div>

          {/* Desktop table */}
          <div className="table-container hidden md:block">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Turno</th>
                  <th>Vertical</th>
                  <th>Mina</th>
                  <th>Disparo</th>
                  <th>Horario</th>
                  <th className="text-center">Sacos</th>
                  <th>Eventos</th>
                  <th>Observaciones</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.map(d => (
                  <tr key={d.id}>
                    <td className="text-xs whitespace-nowrap">{turnoLabel(d.turno)}</td>
                    <td className="text-amber-400 font-bold whitespace-nowrap">{d.vertical || '—'}</td>
                    <td className="text-white/80 font-medium">{d.mina || '—'}</td>
                    <td className="text-white/55">{d.numero_disparo ? `N°${d.numero_disparo}` : '—'}</td>
                    <td className="text-white/40 whitespace-nowrap text-xs">
                      {fmtTime(d.hora_inicio)} → {fmtTime(d.hora_fin)}
                    </td>
                    <td className="text-center">
                      <span className="font-bold text-amber-400 text-lg">{d.sacos_extraidos}</span>
                    </td>
                    <td className="max-w-[260px]">
                      {d.eventos && d.eventos.length > 0 ? (
                        <div className="space-y-0.5">
                          {d.eventos.map((ev, i) => (
                            <p key={i} className="text-xs text-white/50 truncate">
                              <span className="text-amber-400/60 font-semibold">{ev.hora}</span> {ev.descripcion}
                            </p>
                          ))}
                        </div>
                      ) : '—'}
                    </td>
                    <td className="text-white/35 text-xs max-w-[200px] truncate">{d.observaciones || '—'}</td>
                    <td>
                      {canEdit && (
                        <div className="flex gap-1">
                          <button onClick={() => openEdit(d)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-amber-400 transition-colors"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => handleDelete(d.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {data.length === 0 && (
                  <tr><td colSpan={9} className="text-center py-12 text-white/40">Sin reportes para {fmtDate(selectedDate)}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setShowModal(false)}>
          <div className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-8 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white/90">{editItem ? 'Editar Reporte' : 'Nuevo Reporte de Extracción'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/40"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-6">
              {/* Identificación */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-semibold text-amber-400">📍 Identificación</span>
                  <div className="flex-1 h-px bg-amber-400/20" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div><label className="input-label">Fecha *</label><input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} className="input-field" /></div>
                  <div><label className="input-label">Turno *</label>
                    <select value={form.turno} onChange={e => set('turno', e.target.value)} className="input-field">
                      <option value="dia">☀ Día</option>
                      <option value="noche">🌙 Noche</option>
                      <option value="completo">🔄 Completo</option>
                    </select>
                  </div>
                  <div><label className="input-label">Vertical</label>
                    <select value={form.vertical} onChange={e => set('vertical', e.target.value)} className="input-field">
                      <option value="">— Sin especificar —</option>
                      <option value="Vertical 1">Vertical 1</option>
                      <option value="Vertical 2">Vertical 2</option>
                      <option value="Vertical 3">Vertical 3</option>
                    </select>
                  </div>
                  <div><label className="input-label">Mina</label><input value={form.mina} onChange={e => set('mina', e.target.value)} placeholder="Ej: Belén 2" className="input-field" /></div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                  <div><label className="input-label">Responsable</label><input value={form.responsable} onChange={e => set('responsable', e.target.value)} className="input-field" /></div>
                  <div><label className="input-label">Hora Inicio</label><input type="time" value={form.hora_inicio} onChange={e => set('hora_inicio', e.target.value)} className="input-field" /></div>
                  <div><label className="input-label">Hora Culmina</label><input type="time" value={form.hora_fin} onChange={e => set('hora_fin', e.target.value)} className="input-field" /></div>
                </div>
              </div>

              {/* Eventos */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-semibold text-blue-400">📋 Bitácora de Eventos</span>
                  <div className="flex-1 h-px bg-blue-400/20" />
                  <button type="button" onClick={addEvento} className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors border border-blue-400/20">
                    <Plus className="w-3.5 h-3.5" /> Agregar evento
                  </button>
                </div>
                {eventos.length === 0 && <p className="text-xs text-white/25 italic">Sin eventos. Agrega los hitos del turno.</p>}
                <div className="space-y-2">
                  {eventos.map((ev, i) => (
                    <div key={i} className="grid grid-cols-[120px_1fr_auto] gap-2 items-start p-3 bg-blue-500/[0.05] rounded-xl border border-blue-400/15">
                      <div>
                        <label className="input-label !text-blue-400/70 !text-[10px]">Hora</label>
                        <input type="time" value={ev.hora} onChange={e => updateEvento(i, 'hora', e.target.value)} className="input-field !py-1.5" />
                      </div>
                      <div>
                        <label className="input-label !text-blue-400/70 !text-[10px]">Descripción</label>
                        <input value={ev.descripcion} onChange={e => updateEvento(i, 'descripcion', e.target.value)}
                          placeholder="Ej: SE EMPIEZA SACAR MATERIAL A SACOS" className="input-field !py-1.5" />
                      </div>
                      <button type="button" onClick={() => removeEvento(i)} className="mt-5 p-1.5 rounded-lg hover:bg-red-500/15 text-white/30 hover:text-red-400 transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Producción */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-semibold text-emerald-400">📦 Producción del Turno</span>
                  <div className="flex-1 h-px bg-emerald-400/20" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-amber-500/[0.07] rounded-xl p-3 border border-amber-400/20">
                    <label className="input-label !text-amber-400 !font-semibold">Sacos Extraídos *</label>
                    <input type="number" value={form.sacos_extraidos} onChange={e => set('sacos_extraidos', e.target.value)} className="input-field font-bold text-lg" placeholder="133" />
                  </div>
                  <div>
                    <label className="input-label">N° Disparo</label>
                    <input value={form.numero_disparo} onChange={e => set('numero_disparo', e.target.value)} placeholder="Ej: 27" className="input-field" />
                  </div>
                </div>
              </div>

              {/* Observaciones */}
              <div>
                <label className="input-label">Observaciones del Turno</label>
                <textarea value={form.observaciones} onChange={e => set('observaciones', e.target.value)} className="input-field" rows={3}
                  placeholder="Ej: El turno nocturno inició 8:42 PM por la espera de camión..." />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-zinc-800">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
              <button onClick={handleSave} disabled={saving || !form.sacos_extraidos} className="btn-primary disabled:opacity-40">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {editItem ? 'Actualizar' : 'Registrar Turno'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

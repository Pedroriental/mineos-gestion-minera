'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useCanEdit } from '@/lib/use-can-edit';
import { ClipboardList, Plus, X, Loader2, Sun, Moon, AlertTriangle, Users, Wrench, Clock, CloudSun, ChevronLeft, ChevronRight } from 'lucide-react';
import type { LibroGuardia } from '@/lib/types';

export default function LibroGuardiaPage() {
  const { user } = useAuth();
  const canEdit = useCanEdit();
  const [data, setData] = useState<LibroGuardia[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const emptyForm = {
    fecha: selectedDate,
    turno: 'dia' as 'dia' | 'noche',
    hora_entrega: '',
    jefe_saliente: '',
    jefe_entrante: '',
    personal_mina: '',
    personal_planta: '',
    personal_otros: '',
    estado_equipos: '',
    novedades_operativas: '',
    condiciones_seguridad: '',
    incidentes: '',
    pendientes: '',
    observaciones: '',
    clima: 'despejado',
  };
  const [form, setForm] = useState(emptyForm);

  const loadData = useCallback(async () => {
    const { data } = await supabase
      .from('libro_guardia')
      .select('*')
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(200);
    setData(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSave = async () => {
    if (!form.jefe_saliente || !form.jefe_entrante || !form.novedades_operativas) return;
    setSaving(true);
    const payload = {
      fecha: form.fecha,
      turno: form.turno,
      hora_entrega: form.hora_entrega || null,
      jefe_saliente: form.jefe_saliente,
      jefe_entrante: form.jefe_entrante,
      personal_mina: parseInt(form.personal_mina) || 0,
      personal_planta: parseInt(form.personal_planta) || 0,
      personal_otros: parseInt(form.personal_otros) || 0,
      estado_equipos: form.estado_equipos || null,
      novedades_operativas: form.novedades_operativas,
      condiciones_seguridad: form.condiciones_seguridad || null,
      incidentes: form.incidentes || null,
      pendientes: form.pendientes || null,
      observaciones: form.observaciones || null,
      clima: form.clima || null,
      registrado_por: user?.id,
    };
    await supabase.from('libro_guardia').insert(payload);
    setSaving(false);
    setShowModal(false);
    setForm({ ...emptyForm, fecha: selectedDate });
    loadData();
  };

  const navigateDay = (dir: 'prev' | 'next') => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + (dir === 'next' ? 1 : -1));
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const filtered = data.filter(d => d.fecha === selectedDate);
  const isToday = selectedDate === new Date().toISOString().split('T')[0];
  const totalPersonal = (e: LibroGuardia) => e.personal_mina + e.personal_planta + e.personal_otros;

  const climaIcon: Record<string, string> = {
    despejado: '☀️', nublado: '⛅', lluvia: '🌧️', tormenta: '⛈️', neblina: '🌫️',
  };

  const fmtTime = (t?: string) => t ? t.substring(0, 5) : '';
  const fmtDateDisplay = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white/90 font-bold tracking-tight text-2xl flex items-center gap-3">
            <ClipboardList className="w-6 h-6 text-purple-400" /> Libro de Guardia
          </h1>
          <p className="text-white/40 text-sm mt-1.5">
            Registro de entrega de turno — {filtered.length} {filtered.length === 1 ? 'entrada' : 'entradas'} para este día
          </p>
        </div>
        <button onClick={() => { setForm({ ...emptyForm, fecha: selectedDate }); setShowModal(true); }} disabled={!canEdit} className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed" title={!canEdit ? 'Modo observador: solo lectura' : undefined}>
          <Plus className="w-4 h-4" /> Nueva Entrada
        </button>
      </div>

      {/* Day Selector */}
      <div className="card-glass p-4">
        <div className="flex items-center justify-between">
          <button onClick={() => navigateDay('prev')} className="p-2 rounded-xl hover:bg-white/[0.06] text-white/40 hover:text-white/75 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-4">
            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
              className="input-field !py-1.5 !px-3 !text-base font-semibold !w-auto !border-purple-400/30" />
            <span className="text-sm text-white/40 capitalize hidden sm:block">{fmtDateDisplay(selectedDate)}</span>
            {isToday && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-400/25">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" /> Hoy
              </span>
            )}
          </div>
          <button onClick={() => navigateDay('next')} className="p-2 rounded-xl hover:bg-white/[0.06] text-white/40 hover:text-white/75 transition-colors">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-purple-400 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="card-glass p-12 text-center">
          <ClipboardList className="w-12 h-12 text-white/20 mx-auto mb-3" />
          <p className="text-white/35 text-sm">Sin entradas para {fmtDateDisplay(selectedDate)}</p>
          <button onClick={() => { setForm({ ...emptyForm, fecha: selectedDate }); setShowModal(true); }}
            className="mt-4 text-purple-400 text-sm font-medium hover:text-purple-300 transition-colors">
            + Registrar entrega de turno
          </button>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-white/[0.08]" style={{ zIndex: 0 }} />

          <div className="space-y-8">
            {filtered.map((entry, i) => {
              const hasIncidents = !!entry.incidentes;
              const hasPendientes = !!entry.pendientes;
              return (
                <div key={entry.id} className="relative pl-14 animate-fade-in-up" style={{ animationDelay: `${i * 0.05}s` }}>
                  {/* Timeline dot */}
                  <div className={`absolute left-4 top-6 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    entry.turno === 'dia'
                      ? 'bg-amber-500/15 border-amber-400/50'
                      : 'bg-indigo-500/15 border-indigo-400/50'
                  }`}>
                    {entry.turno === 'dia'
                      ? <Sun className="w-3 h-3 text-amber-400" />
                      : <Moon className="w-3 h-3 text-indigo-400" />
                    }
                  </div>

                  <div className={`card-glass p-6 ${hasIncidents ? 'border-l-4 border-l-red-400' : ''}`}>
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <span className={`badge ${entry.turno === 'dia' ? 'badge-warning' : 'badge-info'}`}>
                          {entry.turno === 'dia' ? '☀ Turno Día' : '🌙 Turno Noche'}
                        </span>
                        {entry.hora_entrega && (
                          <span className="text-xs text-white/35 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {fmtTime(entry.hora_entrega)}
                          </span>
                        )}
                        {entry.clima && (
                          <span className="text-xs text-white/35 flex items-center gap-1">
                            {climaIcon[entry.clima] || '🌤️'} {entry.clima}
                          </span>
                        )}
                        {hasIncidents && (
                          <span className="badge badge-danger flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Incidente
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-white/30">{new Date(entry.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>

                    {/* Shift handover */}
                    <div className="grid grid-cols-2 gap-6 mb-5 p-4 bg-white/[0.05] rounded-xl border border-white/[0.07]">
                      <div>
                        <span className="text-[10px] text-white/35 uppercase tracking-wider font-semibold">Entrega</span>
                        <p className="text-sm font-semibold text-white/75 mt-1">{entry.jefe_saliente}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-white/35 uppercase tracking-wider font-semibold">Recibe</span>
                        <p className="text-sm font-semibold text-white/75 mt-1">{entry.jefe_entrante}</p>
                      </div>
                    </div>

                    {/* Personal counts */}
                    <div className="flex items-center gap-5 mb-5">
                      <div className="flex items-center gap-2 text-xs text-white/40">
                        <Users className="w-3.5 h-3.5" />
                        <span className="font-semibold text-white/70">{totalPersonal(entry)}</span> total
                      </div>
                      <span className="text-xs text-white/20">|</span>
                      <span className="text-xs text-white/35">Mina: {entry.personal_mina}</span>
                      <span className="text-xs text-white/35">Planta: {entry.personal_planta}</span>
                      <span className="text-xs text-white/35">Otros: {entry.personal_otros}</span>
                    </div>

                    {/* Content sections */}
                    <div className="space-y-4">
                      <div>
                        <span className="text-xs font-semibold text-white/35 uppercase tracking-wider">Novedades Operativas</span>
                        <p className="text-sm text-white/75 mt-1 whitespace-pre-line">{entry.novedades_operativas}</p>
                      </div>

                      {entry.estado_equipos && (
                        <div>
                          <span className="text-xs font-semibold text-white/35 uppercase tracking-wider flex items-center gap-1">
                            <Wrench className="w-3 h-3" /> Estado de Equipos
                          </span>
                          <p className="text-sm text-white/60 mt-1 whitespace-pre-line">{entry.estado_equipos}</p>
                        </div>
                      )}

                      {entry.condiciones_seguridad && (
                        <div>
                          <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Condiciones de Seguridad</span>
                          <p className="text-sm text-white/60 mt-1 whitespace-pre-line">{entry.condiciones_seguridad}</p>
                        </div>
                      )}

                      {hasIncidents && (
                        <div className="p-4 bg-red-500/[0.07] rounded-xl border border-red-400/20">
                          <span className="text-xs font-semibold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5" /> Incidentes Reportados
                          </span>
                          <p className="text-sm text-red-300/80 mt-2 whitespace-pre-line leading-relaxed">{entry.incidentes}</p>
                        </div>
                      )}

                      {hasPendientes && (
                        <div className="p-4 bg-amber-500/[0.07] rounded-xl border border-amber-400/20">
                          <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">⚠ Pendientes para siguiente turno</span>
                          <p className="text-sm text-amber-300/80 mt-2 whitespace-pre-line leading-relaxed">{entry.pendientes}</p>
                        </div>
                      )}

                      {entry.observaciones && (
                        <div>
                          <span className="text-xs font-semibold text-white/25 uppercase tracking-wider">Observaciones</span>
                          <p className="text-sm text-white/45 mt-1 whitespace-pre-line">{entry.observaciones}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowModal(false)}>
          <div className="relative w-full max-w-3xl bg-[#091820]/98 border border-white/[0.10] rounded-2xl shadow-2xl p-6 md:p-8 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold tracking-tight text-white/90">Nueva Entrada — Libro de Guardia</h2>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-xl hover:bg-white/[0.06] text-white/40 transition-colors"><X className="w-5 h-5" /></button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              {/* Row 1 */}
              <div><label className="input-label">Fecha *</label><input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} className="input-field" /></div>
              <div>
                <label className="input-label">Turno *</label>
                <select value={form.turno} onChange={e => setForm({ ...form, turno: e.target.value as 'dia' | 'noche' })} className="input-field">
                  <option value="dia">☀ Día</option><option value="noche">🌙 Noche</option>
                </select>
              </div>
              <div><label className="input-label">Hora de Entrega</label><input type="time" value={form.hora_entrega} onChange={e => setForm({ ...form, hora_entrega: e.target.value })} className="input-field" /></div>

              {/* Divider: Personal */}
              <div className="col-span-1 md:col-span-3 mt-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-purple-400">👥 Personal y Entrega</span>
                  <div className="flex-1 h-px bg-purple-400/20" />
                </div>
              </div>

              <div className="col-span-1 md:col-span-1"><label className="input-label">Jefe Saliente (Entrega) *</label><input value={form.jefe_saliente} onChange={e => setForm({ ...form, jefe_saliente: e.target.value })} className="input-field" placeholder="Nombre completo" /></div>
              <div className="col-span-1 md:col-span-1"><label className="input-label">Jefe Entrante (Recibe) *</label><input value={form.jefe_entrante} onChange={e => setForm({ ...form, jefe_entrante: e.target.value })} className="input-field" placeholder="Nombre completo" /></div>
              <div>
                <label className="input-label">Clima</label>
                <select value={form.clima} onChange={e => setForm({ ...form, clima: e.target.value })} className="input-field">
                  <option value="despejado">☀️ Despejado</option>
                  <option value="nublado">⛅ Nublado</option>
                  <option value="lluvia">🌧️ Lluvia</option>
                  <option value="tormenta">⛈️ Tormenta</option>
                  <option value="neblina">🌫️ Neblina</option>
                </select>
              </div>

              <div className="grid grid-cols-3 col-span-1 md:col-span-3 gap-4 p-4 bg-white/[0.05] rounded-xl border border-white/[0.07]">
                <div><label className="input-label">Mina</label><input type="number" value={form.personal_mina} onChange={e => setForm({ ...form, personal_mina: e.target.value })} className="input-field text-center font-semibold" placeholder="0" /></div>
                <div><label className="input-label">Planta</label><input type="number" value={form.personal_planta} onChange={e => setForm({ ...form, personal_planta: e.target.value })} className="input-field text-center font-semibold" placeholder="0" /></div>
                <div><label className="input-label">Otros</label><input type="number" value={form.personal_otros} onChange={e => setForm({ ...form, personal_otros: e.target.value })} className="input-field text-center font-semibold" placeholder="0" /></div>
              </div>

              {/* Divider: Operaciones */}
              <div className="col-span-1 md:col-span-3 mt-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-blue-400">📋 Reporte Operativo</span>
                  <div className="flex-1 h-px bg-blue-400/20" />
                </div>
              </div>

              <div className="col-span-1 md:col-span-3">
                <label className="input-label">Novedades Operativas * (producción, avances, problemas)</label>
                <textarea value={form.novedades_operativas} onChange={e => setForm({ ...form, novedades_operativas: e.target.value })} className="input-field" rows={3} placeholder="Descripción detallada de lo ocurrido durante el turno..." />
              </div>

              <div className="col-span-1 md:col-span-3">
                <label className="input-label flex items-center gap-1"><Wrench className="w-3.5 h-3.5" /> Estado de Equipos</label>
                <textarea value={form.estado_equipos} onChange={e => setForm({ ...form, estado_equipos: e.target.value })} className="input-field" rows={2} placeholder="Compresores, perforadoras, generadores, bombas..." />
              </div>

              <div className="col-span-1 md:col-span-3">
                <label className="input-label text-emerald-400">Condiciones de Seguridad</label>
                <textarea value={form.condiciones_seguridad} onChange={e => setForm({ ...form, condiciones_seguridad: e.target.value })} className="input-field" rows={2} placeholder="Ventilación, estabilidad del terreno, agua, EPP..." />
              </div>

              {/* Divider: Alertas */}
              <div className="col-span-1 md:col-span-3 mt-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-red-400">⚠ Alertas</span>
                  <div className="flex-1 h-px bg-red-400/20" />
                </div>
              </div>

              <div className="col-span-1 md:col-span-3">
                <label className="input-label text-red-600 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Incidentes (accidentes, casi-accidentes, derrumbes)</label>
                <textarea value={form.incidentes} onChange={e => setForm({ ...form, incidentes: e.target.value })} className="input-field" rows={2} placeholder="Dejar vacío si no hubo incidentes" style={{ borderColor: form.incidentes ? 'rgb(239, 68, 68)' : undefined }} />
              </div>

              <div className="col-span-1 md:col-span-3">
                <label className="input-label text-amber-400">Pendientes para el siguiente turno</label>
                <textarea value={form.pendientes} onChange={e => setForm({ ...form, pendientes: e.target.value })} className="input-field" rows={2} placeholder="Tareas inconclusas que el siguiente turno debe atender..." />
              </div>

              <div className="col-span-1 md:col-span-3">
                <label className="input-label">Observaciones Generales</label>
                <textarea value={form.observaciones} onChange={e => setForm({ ...form, observaciones: e.target.value })} className="input-field" rows={2} placeholder="Visitantes, paradas, notas adicionales..." />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-white/[0.07]">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
              <button onClick={handleSave} disabled={saving || !form.jefe_saliente || !form.jefe_entrante || !form.novedades_operativas} className="btn-primary">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Registrar Entrega de Turno
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

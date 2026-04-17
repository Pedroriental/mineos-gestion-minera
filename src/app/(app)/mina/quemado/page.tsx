'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useCanEdit } from '@/lib/use-can-edit';
import {
  Flame, Plus, X, Loader2, Edit2, Trash2, Calculator,
  ChevronLeft, ChevronRight, CalendarDays, AlertCircle,
} from 'lucide-react';
import type { ReporteQuemado, PlanchaItem } from '@/lib/types';
import MetricCard from '@/components/MetricCard';
import EmptyState from '@/components/EmptyState';

// ── Types ──────────────────────────────────────────────────────────────────
interface PlanchaForm { amalgama_g: string; oro_recuperado_g: string; }

interface FormState {
  fecha: string;
  turno: 'dia' | 'noche' | 'completo';
  numero_quemada: string;
  planchas: PlanchaForm[];
  manto_amalgama_g: string;
  manto_oro_g: string;
  retorta_oro_g: string;
  responsable: string;
  observaciones: string;
}

const emptyPlancha = (): PlanchaForm => ({ amalgama_g: '', oro_recuperado_g: '' });

const makeEmptyForm = (date: string): FormState => ({
  fecha: date,
  turno: 'dia',
  numero_quemada: '',
  planchas: [emptyPlancha()],
  manto_amalgama_g: '',
  manto_oro_g: '',
  retorta_oro_g: '',
  responsable: '',
  observaciones: '',
});

// ── Helpers ────────────────────────────────────────────────────────────────
const fmtN = (n: number) =>
  new Intl.NumberFormat('es-VE', { maximumFractionDigits: 4, minimumFractionDigits: 2 }).format(n);

function calcTotals(f: FormState) {
  const planchaAmalgama = f.planchas.reduce((s, p) => s + (parseFloat(p.amalgama_g) || 0), 0);
  const planchaOro      = f.planchas.reduce((s, p) => s + (parseFloat(p.oro_recuperado_g) || 0), 0);
  const mantoAmalgama   = parseFloat(f.manto_amalgama_g) || 0;
  const mantoOro        = parseFloat(f.manto_oro_g) || 0;
  const retortaOro      = parseFloat(f.retorta_oro_g) || 0;
  const totalAmalgama   = planchaAmalgama + mantoAmalgama;
  const totalOro        = planchaOro + mantoOro + retortaOro;
  return { totalAmalgama, totalOro };
}

// ══════════════════════════════════════════════════════════════════════════
export default function QuemadoPage() {
  const { user } = useAuth();
  const canEdit  = useCanEdit();

  const [allData,    setAllData]    = useState<ReporteQuemado[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showModal,  setShowModal]  = useState(false);
  const [editItem,   setEditItem]   = useState<ReporteQuemado | null>(null);
  const [saving,     setSaving]     = useState(false);
  const [formError,  setFormError]  = useState<string | null>(null);

  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [form, setForm] = useState<FormState>(makeEmptyForm(today));

  // ── Load data ──────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    const { data } = await supabase
      .from('reportes_quemado')
      .select('*')
      .order('fecha', { ascending: false })
      .limit(500);
    setAllData((data as ReporteQuemado[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Filter by date ─────────────────────────────────────────────────────
  const data = useMemo(() => allData.filter(d => d.fecha === selectedDate), [allData, selectedDate]);
  const availableDates = useMemo(() => Array.from(new Set(allData.map(d => d.fecha))).sort(), [allData]);

  const navigateDay = (dir: 'prev' | 'next') => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + (dir === 'next' ? 1 : -1));
    setSelectedDate(d.toISOString().split('T')[0]);
  };
  const isToday = selectedDate === today;

  const fmtDateDisplay = (s: string) =>
    new Date(s + 'T12:00:00').toLocaleDateString('es-ES', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

  // ── Day-scoped summaries ───────────────────────────────────────────────
  const totalAmalgamaDay = data.reduce((s, d) => s + Number(d.total_amalgama_g || 0), 0);
  const totalOroDay      = data.reduce((s, d) => s + Number(d.total_oro_g || 0), 0);
  const mermaDay         = totalAmalgamaDay > 0 ? ((totalAmalgamaDay - totalOroDay) / totalAmalgamaDay) * 100 : 0;
  const totalPlanchasDay = data.reduce((s, d) => s + (d.planchas?.length || 0), 0);

  // Form live totals
  const { totalAmalgama: formAmalgama, totalOro: formOro } = calcTotals(form);

  // ── Plancha helpers ────────────────────────────────────────────────────
  const addPlancha    = () => setForm(f => ({ ...f, planchas: [...f.planchas, emptyPlancha()] }));
  const removePlancha = (i: number) =>
    setForm(f => ({ ...f, planchas: f.planchas.filter((_, idx) => idx !== i) }));
  const updatePlancha = (i: number, field: keyof PlanchaForm, val: string) =>
    setForm(f => {
      const updated = [...f.planchas];
      updated[i] = { ...updated[i], [field]: val };
      return { ...f, planchas: updated };
    });

  // ── CRUD ───────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (form.planchas.length === 0) {
      setFormError('Agrega al menos 1 plancha.');
      return;
    }
    const { totalAmalgama, totalOro } = calcTotals(form);
    if (totalOro <= 0) {
      setFormError('El total de oro recuperado debe ser mayor que 0.');
      return;
    }
    setFormError(null);
    setSaving(true);

    const planchasPayload: PlanchaItem[] = form.planchas.map(p => ({
      amalgama_g:       parseFloat(p.amalgama_g)       || 0,
      oro_recuperado_g: parseFloat(p.oro_recuperado_g) || 0,
    }));

    const payload = {
      fecha:            form.fecha,
      turno:            form.turno,
      numero_quemada:   form.numero_quemada || null,
      planchas:         planchasPayload,
      manto_amalgama_g: parseFloat(form.manto_amalgama_g) || null,
      manto_oro_g:      parseFloat(form.manto_oro_g)      || null,
      retorta_oro_g:    parseFloat(form.retorta_oro_g)    || null,
      total_amalgama_g: totalAmalgama,
      total_oro_g:      totalOro,
      responsable:      form.responsable || null,
      observaciones:    form.observaciones || null,
      registrado_por:   user?.id,
    };

    if (editItem) {
      const { registrado_por, ...up } = payload;
      await supabase.from('reportes_quemado').update(up).eq('id', editItem.id);
    } else {
      await supabase.from('reportes_quemado').insert(payload);
    }
    setSaving(false);
    setShowModal(false);
    setEditItem(null);
    setForm(makeEmptyForm(selectedDate));
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este reporte de quemado?')) return;
    await supabase.from('reportes_quemado').delete().eq('id', id);
    loadData();
  };

  const openEdit = (item: ReporteQuemado) => {
    setEditItem(item);
    setForm({
      fecha:            item.fecha,
      turno:            item.turno,
      numero_quemada:   item.numero_quemada || '',
      planchas:         item.planchas.map(p => ({
        amalgama_g:       String(p.amalgama_g),
        oro_recuperado_g: String(p.oro_recuperado_g),
      })),
      manto_amalgama_g: item.manto_amalgama_g ? String(item.manto_amalgama_g) : '',
      manto_oro_g:      item.manto_oro_g      ? String(item.manto_oro_g)      : '',
      retorta_oro_g:    item.retorta_oro_g    ? String(item.retorta_oro_g)    : '',
      responsable:      item.responsable      || '',
      observaciones:    item.observaciones    || '',
    });
    setShowModal(true);
  };

  const openNew = () => {
    setEditItem(null);
    setForm(makeEmptyForm(selectedDate));
    setFormError(null);
    setShowModal(true);
  };

  const turnoLabel: Record<string, string> = { dia: '☀ Día', noche: '🌙 Noche', completo: '🔄 Completo' };

  // ══════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white/90 font-bold tracking-tight text-2xl flex items-center gap-3">
            <Flame className="w-6 h-6 text-orange-400" /> Quemado de Planchas
          </h1>
          <p className="text-white/40 text-sm mt-1">
            <span className="text-amber-400 font-semibold">{fmtN(totalOroDay)} g Au</span> recuperados
            {' '}— {data.length} quemadas
            {mermaDay > 0 && (
              <span className="text-white/25"> — Merma: {mermaDay.toFixed(1)}%</span>
            )}
          </p>
        </div>
        <button
          onClick={openNew}
          disabled={!canEdit}
          title={!canEdit ? 'Modo observador: solo lectura' : undefined}
          className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" /> Nuevo Reporte
        </button>
      </div>

      {/* ── Day Selector ── */}
      <div className="card-glass p-4">
        <div className="flex items-center justify-between">
          <button onClick={() => navigateDay('prev')} className="p-2 rounded-xl hover:bg-white/[0.06] text-white/40 hover:text-white/75 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-orange-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="input-field !py-1.5 !px-3 !text-base font-semibold !w-auto !border-orange-400/30"
              />
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
              const isSelected = date === selectedDate;
              return (
                <button
                  key={date}
                  onClick={() => setSelectedDate(date)}
                  className={`flex-shrink-0 flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${isSelected
                    ? 'bg-orange-500/15 text-orange-300 border border-orange-400/30'
                    : 'bg-white/[0.04] text-white/40 border border-transparent hover:bg-white/[0.08]'}`}
                >
                  <span className="uppercase">{d.toLocaleDateString('es-ES', { weekday: 'short' })}</span>
                  <span className="text-sm font-bold">{d.getDate()}</span>
                  <span className={`text-[10px] ${isSelected ? 'text-orange-400' : 'text-white/30'}`}>
                    {allData.filter(r => r.fecha === date).length} reg
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Oro Recuperado" value={totalOroDay} unit="g" variant="gold" icon={<span className="text-base">🔥</span>} />
        <MetricCard label="Total Amalgama" value={totalAmalgamaDay} unit="g" variant="neutral" icon={<span className="text-base">⚗️</span>} />
        <MetricCard label="Planchas" value={totalPlanchasDay} variant="neutral" icon={<span className="text-base">🟫</span>} />
        <MetricCard
          label="Merma Prom."
          value={mermaDay > 0 ? mermaDay.toFixed(1) : '—'}
          unit={mermaDay > 0 ? '%' : undefined}
          variant={mermaDay > 0 ? (mermaDay < 55 ? 'positive' : mermaDay < 70 ? 'neutral' : 'negative') : 'neutral'}
          icon={<Calculator className="w-4 h-4" />}
        />
      </div>

      {/* ── Table + Cards ── */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-orange-400 animate-spin" /></div>
      ) : (
        <>
          {/* Mobile Cards */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {data.map(d => (
              <div key={d.id} className="card-glass p-4 relative border-l-4 border-l-orange-500">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/45 bg-white/[0.07] px-2 py-0.5 rounded-sm">
                      {turnoLabel[d.turno]}
                    </span>
                    {d.numero_quemada && (
                      <p className="text-white/60 text-xs mt-1">Quemada #{d.numero_quemada}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="font-black text-amber-400 text-lg block leading-none">{fmtN(d.total_oro_g)} g</span>
                    <span className="text-[10px] text-white/35 uppercase tracking-wide">Au Recuperado</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-3 text-sm bg-white/[0.05] p-2.5 rounded-lg border border-white/[0.07]">
                  <div>
                    <span className="text-xs text-white/35 block mb-0.5">Planchas</span>
                    <span className="text-white/70 font-semibold">{d.planchas?.length || 0}</span>
                  </div>
                  <div>
                    <span className="text-xs text-white/35 block mb-0.5">Amalgama</span>
                    <span className="text-white/70 font-semibold">{fmtN(d.total_amalgama_g)} g</span>
                  </div>
                  <div>
                    <span className="text-xs text-white/35 block mb-0.5">Merma</span>
                    <span className="text-orange-400 font-bold">
                      {d.total_amalgama_g > 0 ? `${(((d.total_amalgama_g - d.total_oro_g) / d.total_amalgama_g) * 100).toFixed(1)}%` : '—'}
                    </span>
                  </div>
                </div>

                {/* Individual planchas */}
                {d.planchas?.length > 0 && (
                  <div className="space-y-1 mb-3">
                    {d.planchas.map((p, i) => (
                      <div key={i} className="flex justify-between text-xs text-white/50 px-2">
                        <span>Plancha {i + 1}</span>
                        <span>Amalg. {fmtN(p.amalgama_g)} g → <span className="text-amber-400">{fmtN(p.oro_recuperado_g)} g Au</span></span>
                      </div>
                    ))}
                    {d.manto_oro_g != null && (
                      <div className="flex justify-between text-xs text-white/40 px-2 border-t border-white/[0.06] pt-1">
                        <span>Manto. Área Raspado</span>
                        <span>Amalg. {fmtN(d.manto_amalgama_g || 0)} g → <span className="text-amber-400/80">{fmtN(d.manto_oro_g)} g Au</span></span>
                      </div>
                    )}
                    {d.retorta_oro_g != null && (
                      <div className="flex justify-between text-xs text-white/40 px-2">
                        <span>Retorta</span>
                        <span className="text-amber-400/80">{fmtN(d.retorta_oro_g)} g Au</span>
                      </div>
                    )}
                  </div>
                )}

                {canEdit && (
                  <div className="flex gap-2 justify-end pt-3 border-t border-white/[0.07]">
                    <button onClick={() => openEdit(d)} className="btn-secondary !py-1.5 !px-3 !text-xs"><Edit2 className="w-3.5 h-3.5" /> Editar</button>
                    <button onClick={() => handleDelete(d.id)} className="btn-danger !py-1.5 !px-3 !text-xs"><Trash2 className="w-3.5 h-3.5" /> Borrar</button>
                  </div>
                )}
              </div>
            ))}
            {data.length === 0 && (
              <EmptyState
                icon={<Flame className="w-8 h-8" />}
                title="Sin reportes para este día"
                description={`No hay quemados registrados para el ${fmtDateDisplay(selectedDate)}.`}
                action={canEdit ? { label: 'Registrar quemado', onClick: openNew } : undefined}
              />
            )}
          </div>

          {/* Desktop Table */}
          <div className="table-container hidden md:block">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Turno</th>
                  <th>N° Quemada</th>
                  <th>Planchas</th>
                  <th className="text-right">Total Amalgama (g)</th>
                  <th className="text-right">Total Au (g)</th>
                  <th>Merma</th>
                  <th>Retorta (g)</th>
                  <th>Responsable</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.map(d => (
                  <tr key={d.id}>
                    <td className="whitespace-nowrap text-xs">{turnoLabel[d.turno]}</td>
                    <td className="text-white/60 font-medium">{d.numero_quemada || '—'}</td>
                    <td className="text-center text-white/65">{d.planchas?.length || 0}</td>
                    <td className="text-right text-white/65">{fmtN(d.total_amalgama_g)} g</td>
                    <td className="text-right">
                      <span className="font-bold text-amber-400">{fmtN(d.total_oro_g)} g</span>
                    </td>
                    <td>
                      {d.total_amalgama_g > 0 ? (
                        <span className="badge badge-danger">
                          {(((d.total_amalgama_g - d.total_oro_g) / d.total_amalgama_g) * 100).toFixed(1)}%
                        </span>
                      ) : '—'}
                    </td>
                    <td className="text-white/40">{d.retorta_oro_g ? `${fmtN(d.retorta_oro_g)} g` : '—'}</td>
                    <td className="text-white/40">{d.responsable || '—'}</td>
                    <td>
                      {canEdit && (
                        <div className="flex gap-1">
                          <button onClick={() => openEdit(d)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-orange-400 transition-colors"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => handleDelete(d.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {data.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-0">
                      <EmptyState
                        icon={<Flame className="w-8 h-8" />}
                        title="Sin reportes para este día"
                        description={`No hay quemados para el ${fmtDateDisplay(selectedDate)}.`}
                        action={canEdit ? { label: 'Registrar quemado', onClick: openNew } : undefined}
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ══ MODAL ══════════════════════════════════════════════════════════ */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => { setShowModal(false); setFormError(null); }}
        >
          <div
            className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-6 md:p-8 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white/90 flex items-center gap-2">
                <Flame className="w-5 h-5 text-orange-400" />
                {editItem ? 'Editar Quemado de Planchas' : 'Nuevo Quemado de Planchas'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/40"><X className="w-5 h-5" /></button>
            </div>

            {formError && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 mb-4">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span className="text-sm text-red-400">{formError}</span>
              </div>
            )}

            <div className="space-y-6">
              {/* ── Basic info ── */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="input-label">Fecha *</label>
                  <input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} className="input-field" />
                </div>
                <div>
                  <label className="input-label">Turno *</label>
                  <select value={form.turno} onChange={e => setForm(f => ({ ...f, turno: e.target.value as FormState['turno'] }))} className="input-field">
                    <option value="dia">☀ Día</option>
                    <option value="noche">🌙 Noche</option>
                    <option value="completo">🔄 Completo</option>
                  </select>
                </div>
                <div>
                  <label className="input-label">N° Quemada</label>
                  <input value={form.numero_quemada} onChange={e => setForm(f => ({ ...f, numero_quemada: e.target.value }))} className="input-field" placeholder="001" />
                </div>
              </div>

              {/* ── Planchas section ── */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-orange-400">🟫 Planchas</span>
                    <div className="flex-1 h-px bg-orange-400/20 w-24 hidden sm:block" />
                  </div>
                  <button
                    type="button"
                    onClick={addPlancha}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 text-xs font-medium transition-colors border border-orange-400/20"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar plancha
                  </button>
                </div>

                <div className="space-y-3">
                  {form.planchas.map((p, i) => (
                    <div key={i} className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-semibold text-white/70">Plancha {i + 1}</span>
                        {form.planchas.length > 1 && (
                          <button onClick={() => removePlancha(i)} className="p-1 rounded-lg hover:bg-red-500/10 text-white/30 hover:text-red-400 transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="input-label">Amalgama (g)</label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={p.amalgama_g}
                            onChange={e => updatePlancha(i, 'amalgama_g', e.target.value)}
                            className="input-field"
                            placeholder="60.81"
                          />
                        </div>
                        <div>
                          <label className="input-label text-amber-400">Oro Recuperado (g Au)</label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={p.oro_recuperado_g}
                            onChange={e => updatePlancha(i, 'oro_recuperado_g', e.target.value)}
                            className="input-field"
                            placeholder="24.62"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Mantenimiento Área Raspado ── */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-semibold text-blue-400">🔧 Manto. Área Raspado</span>
                  <div className="flex-1 h-px bg-blue-400/20" />
                </div>
                <div className="grid grid-cols-2 gap-3 bg-white/[0.04] border border-white/[0.08] rounded-xl p-4">
                  <div>
                    <label className="input-label">Amalgama (g)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={form.manto_amalgama_g}
                      onChange={e => setForm(f => ({ ...f, manto_amalgama_g: e.target.value }))}
                      className="input-field"
                      placeholder="1.19"
                    />
                  </div>
                  <div>
                    <label className="input-label text-amber-400">Oro Recuperado (g Au)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={form.manto_oro_g}
                      onChange={e => setForm(f => ({ ...f, manto_oro_g: e.target.value }))}
                      className="input-field"
                      placeholder="0.43"
                    />
                  </div>
                </div>
              </div>

              {/* ── Retorta ── */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-semibold text-purple-400">⚗️ Retorta</span>
                  <div className="flex-1 h-px bg-purple-400/20" />
                </div>
                <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-4 max-w-xs">
                  <label className="input-label text-amber-400">Oro Recuperado (g Au)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={form.retorta_oro_g}
                    onChange={e => setForm(f => ({ ...f, retorta_oro_g: e.target.value }))}
                    className="input-field"
                    placeholder="0.33"
                  />
                </div>
              </div>

              {/* ── Live Totals ── */}
              <div className="bg-amber-500/[0.07] border border-amber-400/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Calculator className="w-4 h-4 text-amber-400" />
                  <span className="text-sm font-semibold text-amber-400">Totales (calculados)</span>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1">Total Amalgama</p>
                    <p className="font-bold text-white/80 text-lg">{fmtN(formAmalgama)} <span className="text-xs text-white/40">g</span></p>
                  </div>
                  <div className="text-center border-x border-amber-400/10">
                    <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1">Total Au Recup.</p>
                    <p className="font-bold text-amber-400 text-lg">{fmtN(formOro)} <span className="text-xs">g Au</span></p>
                  </div>
                  <div className="text-center">
                    <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1">Merma</p>
                    <p className="font-bold text-orange-400 text-lg">
                      {formAmalgama > 0 ? `${(((formAmalgama - formOro) / formAmalgama) * 100).toFixed(1)}%` : '—'}
                    </p>
                  </div>
                </div>
              </div>

              {/* ── Extra fields ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Responsable</label>
                  <input value={form.responsable} onChange={e => setForm(f => ({ ...f, responsable: e.target.value }))} className="input-field" placeholder="Nombre del operador" />
                </div>
                <div>
                  <label className="input-label">Observaciones</label>
                  <input value={form.observaciones} onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))} className="input-field" placeholder="Notas adicionales" />
                </div>
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-zinc-800">
              <button onClick={() => { setShowModal(false); setFormError(null); }} className="btn-secondary">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary">
                {saving ? 'Guardando...' : editItem ? 'Actualizar Quemado' : 'Registrar Quemado'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

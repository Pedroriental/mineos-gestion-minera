'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Flame, Plus, X, Loader2, Edit2, Gem, AlertCircle, Trash2 } from 'lucide-react';
import type { QuemadaPlancha } from '@/lib/types';

export default function QuemadaPage() {
  const { user } = useAuth();
  const [data, setData] = useState<QuemadaPlancha[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<QuemadaPlancha | null>(null);
  const [saving, setSaving] = useState(false);

  const emptyForm = {
    fecha: new Date().toISOString().split('T')[0], numero_quemada: '',
    gramos_oro_puro_recuperado: '', // resultado final
    gramos_oro_bruto: '',           // mineral recuperado
    temperatura_quemada: '',        // amalgamado (g) — columna reutilizada
    responsable: '', testigos: '', observaciones: '',
  };
  const [form, setForm] = useState(emptyForm);

  const loadData = useCallback(async () => {
    const { data } = await supabase.from('quemada_plancha').select('*').order('fecha', { ascending: false }).limit(100);
    setData(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSave = async () => {
    if (!form.gramos_oro_puro_recuperado || parseFloat(form.gramos_oro_puro_recuperado) < 0) {
      alert('El campo "Gramos de Oro Puro Recuperado" es OBLIGATORIO.');
      return;
    }
    setSaving(true);
    const mineralRecuperado = parseFloat(form.gramos_oro_bruto) || null;
    const resultadoFinal = parseFloat(form.gramos_oro_puro_recuperado);
    const payload = {
      fecha: form.fecha, numero_quemada: form.numero_quemada,
      gramos_oro_puro_recuperado: resultadoFinal,
      gramos_oro_bruto: mineralRecuperado,
      porcentaje_pureza: (mineralRecuperado && mineralRecuperado > 0) ? parseFloat(((resultadoFinal / mineralRecuperado) * 100).toFixed(4)) : null,
      temperatura_quemada: parseFloat(form.temperatura_quemada) || null,
      duracion_horas: null,
      responsable: form.responsable, testigos: form.testigos || null,
      observaciones: form.observaciones || null, registrado_por: user?.id,
    };
    if (editItem) { const { registrado_por, ...up } = payload; await supabase.from('quemada_plancha').update(up).eq('id', editItem.id); }
    else { await supabase.from('quemada_plancha').insert(payload); }
    setSaving(false); setShowModal(false); setEditItem(null); setForm(emptyForm); loadData();
  };

  const handleDelete = async (item: QuemadaPlancha) => {
    if (!confirm(`¿Eliminar quemada ${item.numero_quemada} (${fmtNum(item.gramos_oro_puro_recuperado)} g)?\nEsta acción no se puede deshacer.`)) return;
    await supabase.from('quemada_plancha').delete().eq('id', item.id);
    loadData();
  };

  const openEdit = (item: QuemadaPlancha) => {
    setEditItem(item);
    setForm({
      fecha: item.fecha, numero_quemada: item.numero_quemada,
      gramos_oro_puro_recuperado: String(item.gramos_oro_puro_recuperado),
      gramos_oro_bruto: item.gramos_oro_bruto ? String(item.gramos_oro_bruto) : '',
      temperatura_quemada: item.temperatura_quemada ? String(item.temperatura_quemada) : '',
      responsable: item.responsable, testigos: item.testigos || '', observaciones: item.observaciones || '',
    });
    setShowModal(true);
  };

  const fmtNum = (n: number, d = 4) => new Intl.NumberFormat('en-US', { maximumFractionDigits: d }).format(n);
  const totalGramos = data.reduce((s, q) => s + Number(q.gramos_oro_puro_recuperado), 0);
  const pctRecuperacion = (q: QuemadaPlancha) => {
    const mineral = Number(q.gramos_oro_bruto || 0);
    const resultado = Number(q.gramos_oro_puro_recuperado || 0);
    if (mineral <= 0) return null;
    return (resultado / mineral) * 100;
  };
  const liveRecovery = (() => {
    const mineral = parseFloat(form.gramos_oro_bruto);
    const resultado = parseFloat(form.gramos_oro_puro_recuperado);
    if (!mineral || mineral <= 0 || !resultado) return null;
    return (resultado / mineral) * 100;
  })();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white/90 font-bold tracking-tight text-2xl flex items-center gap-3">
            <Flame className="w-6 h-6 text-orange-400" /> Quemada de Plancha
          </h1>
          <p className="text-white/40 text-sm mt-1">
            <span className="text-amber-400 font-semibold">{fmtNum(totalGramos)} g</span> oro puro recuperado — {data.length} quemadas
          </p>
        </div>
        <button onClick={() => { setEditItem(null); setForm(emptyForm); setShowModal(true); }} className="btn-primary">
          <Plus className="w-4 h-4" /> Nueva Quemada
        </button>
      </div>

      {/* Highlight Card */}
      <div className="card-glass p-4 flex items-center gap-3" style={{ borderColor: 'rgba(234, 179, 8, 0.25)' }}>
        <Gem className="w-5 h-5 text-amber-400 flex-shrink-0" />
        <p className="text-sm text-white/50">
          Esta es la tabla más crítica del sistema. El campo <strong className="text-amber-400">gramos_oro_puro_recuperado</strong> es obligatorio y alimenta directamente el Balance Diario para calcular la rentabilidad real.
        </p>
      </div>

      {/* Table & Cards */}
      {loading ? <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-amber-400 animate-spin" /></div> : (
        <>
          {/* Mobile Cards View */}
          <div className="block md:hidden space-y-4 mt-4">
            {data.map(q => (
              <div key={q.id} className="card-glass p-5 relative border-l-4 border-l-amber-500">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-white/85 font-bold text-base">{q.numero_quemada}</h3>
                    <p className="text-white/40 text-xs mt-0.5">{q.fecha}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-amber-400 block mb-1">Oro Puro</span>
                    <span className="font-black text-amber-400 text-xl">{fmtNum(q.gramos_oro_puro_recuperado)} <span className="text-sm font-semibold opacity-70">g</span></span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 p-3 bg-white/[0.05] rounded-lg border border-white/[0.07]">
                  <div>
                    <span className="text-white/35 text-[10px] uppercase font-bold tracking-wider block mb-1">Mineral Recuperado</span>
                    <span className="font-semibold text-white/70">{q.gramos_oro_bruto ? `${fmtNum(q.gramos_oro_bruto, 2)} g` : '—'}</span>
                  </div>
                  <div>
                    <span className="text-white/35 text-[10px] uppercase font-bold tracking-wider block mb-1">Amalgamado</span>
                    <span className="font-semibold text-white/70">{q.temperatura_quemada ? `${fmtNum(q.temperatura_quemada, 2)} g` : '—'}</span>
                  </div>
                  <div>
                    <span className="text-white/35 text-[10px] uppercase font-bold tracking-wider block mb-1">% Recuperación</span>
                    {pctRecuperacion(q) !== null
                      ? <span className={`font-bold text-sm ${(pctRecuperacion(q) ?? 0) >= 80 ? 'text-emerald-400' : (pctRecuperacion(q) ?? 0) >= 60 ? 'text-amber-400' : 'text-red-400'}`}>{fmtNum(pctRecuperacion(q)!, 2)}%</span>
                      : <span className="text-white/30 text-sm">—</span>
                    }
                  </div>
                  <div>
                    <span className="text-white/35 text-[10px] uppercase font-bold tracking-wider block mb-1">Responsable</span>
                    <span className="font-semibold text-white/70 truncate block">{q.responsable}</span>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-white/[0.07]">
                  <button onClick={() => handleDelete(q)} className="p-2 rounded-lg bg-red-500/[0.08] hover:bg-red-500/[0.15] text-red-400/70 hover:text-red-400 transition-colors font-medium text-xs flex items-center gap-1"><Trash2 className="w-4 h-4" /> Borrar</button>
                  <button onClick={() => openEdit(q)} className="p-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.09] text-white/50 transition-colors font-medium text-xs flex items-center gap-1"><Edit2 className="w-4 h-4" /> Editar</button>
                </div>
              </div>
            ))}
            {data.length === 0 && <div className="text-center py-12 text-white/40 card-glass">Sin quemadas registradas</div>}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block table-container mt-4">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>N° Quemada</th>
                  <th className="text-right">Mineral Rec. (g)</th>
                  <th className="text-right">Amalgamado (g)</th>
                  <th className="text-right">Resultado Final (g)</th>
                  <th className="text-right">% Recuperación</th>
                  <th>Responsable</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.map(q => (
                  <tr key={q.id}>
                    <td className="whitespace-nowrap">{q.fecha}</td>
                    <td className="text-white/80 font-medium">{q.numero_quemada}</td>
                    <td className="text-right text-white/60">{q.gramos_oro_bruto ? `${fmtNum(q.gramos_oro_bruto, 2)} g` : '—'}</td>
                    <td className="text-right text-white/60">{q.temperatura_quemada ? `${fmtNum(q.temperatura_quemada, 2)} g` : '—'}</td>
                    <td className="text-right">
                      <span className="font-bold text-amber-400 text-lg">{fmtNum(q.gramos_oro_puro_recuperado, 4)} g</span>
                    </td>
                    <td className="text-right">
                      {pctRecuperacion(q) !== null
                        ? <span className={`badge ${(pctRecuperacion(q) ?? 0) >= 80 ? 'badge-success' : (pctRecuperacion(q) ?? 0) >= 60 ? 'badge-warning' : 'badge-danger'}`}>{fmtNum(pctRecuperacion(q)!, 2)}%</span>
                        : <span className="text-white/25">—</span>
                      }
                    </td>
                    <td className="text-white/40">{q.responsable}</td>
                    <td>
                      <button onClick={() => openEdit(q)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-amber-400 transition-colors"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(q)} className="p-1.5 rounded-lg hover:bg-red-500/[0.10] text-white/30 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
                {data.length === 0 && <tr><td colSpan={8} className="text-center py-12 text-white/40">Sin quemadas registradas</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowModal(false)}>
          <div className="relative w-full max-w-2xl bg-[#091820]/98 border border-white/[0.10] rounded-2xl shadow-2xl p-6 md:p-8 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold tracking-tight text-white/90">{editItem ? 'Editar Quemada' : 'Nueva Quemada de Plancha'}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-xl hover:bg-white/[0.06] text-white/40 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div><label className="input-label">Fecha *</label><input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} className="input-field" /></div>
              <div><label className="input-label">N° Quemada *</label><input value={form.numero_quemada} onChange={e => setForm({ ...form, numero_quemada: e.target.value })} className="input-field" placeholder="Q-001" /></div>

              {/* CAMPO OBLIGATORIO */}
              <div><label className="input-label">Mineral Recuperado (g)</label><input type="number" step="0.0001" value={form.gramos_oro_bruto} onChange={e => setForm({ ...form, gramos_oro_bruto: e.target.value })} className="input-field" placeholder="Gramos totales de mineral procesado" /></div>
              <div><label className="input-label">Amalgamado (g)</label><input type="number" step="0.0001" value={form.temperatura_quemada} onChange={e => setForm({ ...form, temperatura_quemada: e.target.value })} className="input-field" placeholder="Gramos de amalgama" /></div>

              {/* CAMPO OBLIGATORIO */}
              <div className="col-span-1 md:col-span-2 bg-amber-500/[0.07] rounded-xl p-5 border border-amber-400/25 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
                <label className="input-label flex items-center gap-2 !text-amber-700 !font-semibold mb-3">
                  <AlertCircle className="w-4 h-4" />
                  Resultado Final — Oro Puro Recuperado (g) *
                </label>
                <input
                  type="number" step="0.0001" value={form.gramos_oro_puro_recuperado}
                  onChange={e => setForm({ ...form, gramos_oro_puro_recuperado: e.target.value })}
                  className="input-field text-xl font-bold bg-white" style={{ borderColor: 'rgba(234, 179, 8, 0.4)' }}
                  placeholder="0.0000" required
                />
                {liveRecovery !== null && (
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-xs text-white/50">% Recuperación:</span>
                    <span className={`text-sm font-bold ${liveRecovery >= 80 ? 'text-emerald-400' : liveRecovery >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                      {liveRecovery.toFixed(2)}%
                    </span>
                    <span className="text-xs text-white/30">(resultado ÷ mineral recuperado)</span>
                  </div>
                )}
              </div>
              <div className="col-span-1 md:col-span-2"><label className="input-label">Responsable *</label><input value={form.responsable} onChange={e => setForm({ ...form, responsable: e.target.value })} className="input-field" /></div>
              <div className="col-span-1 md:col-span-2"><label className="input-label">Testigos</label><input value={form.testigos} onChange={e => setForm({ ...form, testigos: e.target.value })} className="input-field" placeholder="Nombres separados por coma" /></div>
              <div className="col-span-1 md:col-span-2"><label className="input-label">Observaciones</label><textarea value={form.observaciones} onChange={e => setForm({ ...form, observaciones: e.target.value })} className="input-field" rows={2} /></div>
            </div>
            <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-white/[0.07]">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
              <button onClick={handleSave} disabled={saving || !form.numero_quemada || !form.gramos_oro_puro_recuperado || !form.responsable} className="btn-primary">{saving ? 'Guardando...' : editItem ? 'Actualizar' : 'Registrar Quemada'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Waves, Plus, X, Loader2, Trash2, Droplets, FlaskConical, Cog, AlertCircle } from 'lucide-react';
import type { VentaArenas } from '@/lib/types';
import EmptyState from '@/components/EmptyState';


const emptyForm = {
  fecha: new Date().toISOString().split('T')[0],
  comprador: '',
  negociacion: '',
  cantidad_ton: '',
  precio_por_ton: '',
  humedad_pct: '',
  pct_recuperacion_planta: '',
  pct_molino: '',
  observaciones: '',
};

export default function ArenasPage() {
  const { user } = useAuth();
  const [data, setData] = useState<VentaArenas[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const f = (k: keyof typeof emptyForm, v: string) => setForm(p => ({ ...p, [k]: v }));

  const loadData = useCallback(async () => {
    const { data } = await supabase.from('venta_arenas').select('*').order('fecha', { ascending: false }).limit(100);
    setData(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSave = async () => {
    const ton = parseFloat(form.cantidad_ton);
    const precio = parseFloat(form.precio_por_ton);
    if (!form.comprador.trim()) { setFormError('El comprador es obligatorio.'); return; }
    if (isNaN(ton) || ton <= 0) { setFormError('La cantidad en toneladas debe ser mayor que cero.'); return; }
    if (isNaN(precio) || precio <= 0) { setFormError('El precio por tonelada debe ser mayor que cero.'); return; }
    if (form.humedad_pct && (parseFloat(form.humedad_pct) < 0 || parseFloat(form.humedad_pct) > 100)) {
      setFormError('Humedad debe estar entre 0 y 100.');
      return;
    }
    setFormError(null);
    setSaving(true);
    await supabase.from('venta_arenas').insert({
      fecha: form.fecha,
      comprador: form.comprador,
      cantidad_kg: ton,                          // columna existente, ahora guarda toneladas
      precio_por_kg: precio,                     // columna existente, ahora guarda precio/ton
      total_venta: ton * precio,
      factura_referencia: form.negociacion || null,
      negociacion: form.negociacion || null,
      humedad_pct: parseFloat(form.humedad_pct) || null,
      pct_recuperacion_planta: parseFloat(form.pct_recuperacion_planta) || null,
      pct_molino: parseFloat(form.pct_molino) || null,
      observaciones: form.observaciones || null,
      registrado_por: user?.id,
    });
    setSaving(false); setShowModal(false); setForm(emptyForm); loadData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta venta?')) return;
    await supabase.from('venta_arenas').delete().eq('id', id);
    loadData();
  };

  const fmt    = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
  const fmtNum = (n: number, d = 2) => new Intl.NumberFormat('en-US', { maximumFractionDigits: d }).format(n);
  const totalVentas  = data.reduce((s, v) => s + Number(v.total_venta), 0);
  const totalTon     = data.reduce((s, v) => s + Number(v.cantidad_kg), 0);
  const liveTotal    = (parseFloat(form.cantidad_ton) || 0) * (parseFloat(form.precio_por_ton) || 0);

  const negociacion = (v: VentaArenas) => v.negociacion || v.factura_referencia || '—';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white/90 font-bold tracking-tight text-2xl flex items-center gap-3">
            <Waves className="w-6 h-6 text-cyan-400" /> Venta de Arenas
          </h1>
          <p className="text-white/40 text-sm mt-1">
            <span className="text-emerald-400 font-semibold">{fmt(totalVentas)}</span> vendido —{' '}
            <span className="text-cyan-400 font-semibold">{fmtNum(totalTon)} t</span> totales
          </p>
        </div>
        <button onClick={() => { setForm(emptyForm); setShowModal(true); }} className="btn-primary">
          <Plus className="w-4 h-4" /> Nueva Venta
        </button>
      </div>

      {/* Table & Cards */}
      {loading ? <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-amber-400 animate-spin" /></div> : (
        <>
          {/* Mobile Cards */}
          <div className="block md:hidden space-y-4">
            {data.map(v => (
              <div key={v.id} className="card-glass p-5 relative border-l-4 border-l-cyan-500/60">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-white/85 font-bold text-base leading-snug">{v.comprador}</h3>
                    <p className="text-white/40 text-xs mt-0.5">{v.fecha}</p>
                    {negociacion(v) !== '—' && (
                      <span className="text-[10px] text-cyan-400/70 font-semibold mt-1 block">{negociacion(v)}</span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-emerald-400/60 uppercase font-bold block mb-0.5">Total</span>
                    <span className="font-black text-emerald-400 text-xl">{fmt(v.total_venta)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 p-3 bg-white/[0.04] rounded-lg border border-white/[0.07]">
                  <div>
                    <span className="text-white/35 text-[10px] uppercase font-bold tracking-wider block mb-1">Toneladas</span>
                    <span className="font-semibold text-white/80">{fmtNum(v.cantidad_kg)} t</span>
                  </div>
                  <div>
                    <span className="text-white/35 text-[10px] uppercase font-bold tracking-wider block mb-1">Precio/t</span>
                    <span className="font-semibold text-white/80">{fmt(v.precio_por_kg)}</span>
                  </div>
                  {v.humedad_pct != null && (
                    <div>
                      <span className="text-white/35 text-[10px] uppercase font-bold tracking-wider block mb-1">Humedad</span>
                      <span className="font-semibold text-cyan-400/80">{fmtNum(v.humedad_pct)}%</span>
                    </div>
                  )}
                  {v.pct_recuperacion_planta != null && (
                    <div>
                      <span className="text-white/35 text-[10px] uppercase font-bold tracking-wider block mb-1">Rec. Planta</span>
                      <span className="font-semibold text-amber-400/80">{fmtNum(v.pct_recuperacion_planta)}%</span>
                    </div>
                  )}
                  {v.pct_molino != null && (
                    <div>
                      <span className="text-white/35 text-[10px] uppercase font-bold tracking-wider block mb-1">% Molino</span>
                      <span className="font-semibold text-purple-400/80">{fmtNum(v.pct_molino)}%</span>
                    </div>
                  )}
                </div>

                <div className="flex justify-end mt-3 pt-3 border-t border-white/[0.07]">
                  <button onClick={() => handleDelete(v.id)} className="p-2 rounded-lg bg-red-500/10 text-red-400 font-medium text-xs flex items-center gap-1">
                    <Trash2 className="w-4 h-4" /> Eliminar
                  </button>
                </div>
              </div>
            ))}
            {data.length === 0 && (
              <EmptyState
                icon={<Waves className="w-8 h-8" />}
                title="Sin ventas registradas"
                description="Registra la primera venta de arenas (Relave) del período."
                action={{ label: 'Registrar primera venta', onClick: () => { setForm(emptyForm); setShowModal(true); } }}
              />
            )}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Comprador</th>
                  <th>Negociación</th>
                  <th className="text-right">Toneladas</th>
                  <th className="text-right">Precio/t</th>
                  <th className="text-right">Humedad %</th>
                  <th className="text-right">Rec. Planta %</th>
                  <th className="text-right">% Molino</th>
                  <th className="text-right">Total</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.map(v => (
                  <tr key={v.id}>
                    <td className="whitespace-nowrap">{v.fecha}</td>
                    <td className="text-white/80 font-medium">{v.comprador}</td>
                    <td className="text-white/50 text-sm">{negociacion(v)}</td>
                    <td className="text-right font-semibold text-white/80">{fmtNum(v.cantidad_kg)} <span className="text-white/35 text-xs font-normal">t</span></td>
                    <td className="text-right text-white/55">{fmt(v.precio_por_kg)}</td>
                    <td className="text-right">
                      {v.humedad_pct != null ? <span className="badge badge-info">{fmtNum(v.humedad_pct)}%</span> : <span className="text-white/25">—</span>}
                    </td>
                    <td className="text-right">
                      {v.pct_recuperacion_planta != null ? <span className="badge badge-warning">{fmtNum(v.pct_recuperacion_planta)}%</span> : <span className="text-white/25">—</span>}
                    </td>
                    <td className="text-right">
                      {v.pct_molino != null ? <span className="badge badge-neutral">{fmtNum(v.pct_molino)}%</span> : <span className="text-white/25">—</span>}
                    </td>
                    <td className="text-right font-bold text-emerald-400">{fmt(v.total_venta)}</td>
                    <td>
                      <button onClick={() => handleDelete(v.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
                {data.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-0">
                      <EmptyState
                        icon={<Waves className="w-8 h-8" />}
                        title="Sin ventas registradas"
                        description="Registra la primera venta de arenas."
                        action={{ label: 'Registrar primera venta', onClick: () => { setForm(emptyForm); setShowModal(true); } }}
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => { setShowModal(false); setFormError(null); }}>
          <div className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-6 md:p-8 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white/90 tracking-tight">Nueva Venta de Arenas</h2>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-xl hover:bg-white/[0.06] text-white/40 transition-colors"><X className="w-5 h-5" /></button>
            </div>

            {formError && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 mb-4">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span className="text-sm text-red-400">{formError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
              {/* ── Identificación ── */}
              <div><label className="input-label">Fecha *</label><input type="date" value={form.fecha} onChange={e => f('fecha', e.target.value)} className="input-field" /></div>
              <div><label className="input-label">Comprador *</label><input value={form.comprador} onChange={e => f('comprador', e.target.value)} className="input-field" placeholder="Nombre del comprador" /></div>
              <div className="col-span-1 md:col-span-2">
                <label className="input-label">Negociación</label>
                <input value={form.negociacion} onChange={e => f('negociacion', e.target.value)} className="input-field" placeholder="Ej: Contrato directo, precio fijo, spot market..." />
              </div>

              {/* ── Cantidad y Precio ── */}
              <div>
                <label className="input-label">Cantidad (toneladas) *</label>
                <input type="number" step="0.001" value={form.cantidad_ton} onChange={e => f('cantidad_ton', e.target.value)} className="input-field" placeholder="0.000" />
              </div>
              <div>
                <label className="input-label">Precio por tonelada (USD) *</label>
                <input type="number" step="0.01" value={form.precio_por_ton} onChange={e => f('precio_por_ton', e.target.value)} className="input-field" placeholder="0.00" />
              </div>

              {/* ── Total en vivo ── */}
              {liveTotal > 0 && (
                <div className="col-span-1 md:col-span-2 flex items-center justify-between py-4 px-5 bg-emerald-500/[0.07] border border-emerald-400/20 rounded-xl">
                  <span className="text-sm font-medium text-emerald-400/70">Total estimado</span>
                  <span className="text-3xl font-black tracking-tight text-emerald-400">{fmt(liveTotal)}</span>
                </div>
              )}

              {/* ── Parámetros técnicos ── */}
              <div className="col-span-1 md:col-span-2 mt-1">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-px flex-1 bg-white/[0.07]" />
                  <span className="text-[10px] text-white/35 font-bold uppercase tracking-widest">Parámetros Técnicos</span>
                  <div className="h-px flex-1 bg-white/[0.07]" />
                </div>
              </div>

              <div>
                <label className="input-label flex items-center gap-1.5"><Droplets className="w-3.5 h-3.5 text-cyan-400" /> Humedad (%)</label>
                <input type="number" step="0.1" min="0" max="100" value={form.humedad_pct} onChange={e => f('humedad_pct', e.target.value)} className="input-field" placeholder="0.0" />
              </div>
              <div>
                <label className="input-label flex items-center gap-1.5"><FlaskConical className="w-3.5 h-3.5 text-amber-400" /> % Recuperación Planta</label>
                <input type="number" step="0.01" min="0" max="100" value={form.pct_recuperacion_planta} onChange={e => f('pct_recuperacion_planta', e.target.value)} className="input-field" placeholder="0.00" />
              </div>
              <div>
                <label className="input-label flex items-center gap-1.5"><Cog className="w-3.5 h-3.5 text-purple-400" /> % para el Molino</label>
                <input type="number" step="0.01" min="0" max="100" value={form.pct_molino} onChange={e => f('pct_molino', e.target.value)} className="input-field" placeholder="0.00" />
              </div>
              <div>
                <label className="input-label">Observaciones</label>
                <input value={form.observaciones} onChange={e => f('observaciones', e.target.value)} className="input-field" placeholder="Notas adicionales" />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-zinc-800">
              <button onClick={() => { setShowModal(false); setFormError(null); }} className="btn-secondary">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary">
                {saving ? 'Guardando...' : 'Registrar Venta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

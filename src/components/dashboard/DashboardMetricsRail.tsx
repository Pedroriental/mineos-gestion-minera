'use client';

import { memo, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Factory,
  Gem,
  Layers,
  Pickaxe,
  Receipt,
  TrendingUp,
  Users,
  Wrench,
} from 'lucide-react';
import { SolidMetricCard } from './SolidMetricCard';
import { useBiblioteca, useBibliotecaOptions, useTurnoOptions } from '@/contexts/biblioteca-context';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { createProduccion } from '@/lib/actions/produccion';
import { createExtraccion } from '@/lib/actions/extraccion';
import { getOrCreateCategoria, createGasto } from '@/lib/actions/gastos';
import type { GlobalData } from './types';
import { AppSelect } from '@/components/ui/AppSelect';
import { AppDatePicker } from '@/components/ui/AppDatePicker';

type TabType = 'produccion' | 'extraccion' | 'gastos' | 'asistencia' | 'equipos';

const GASTOS_CATEGORIAS = ['Operación', 'Mantenimiento', 'Insumos', 'Transporte'] as const;

const EQUIPO_EVENTOS = [
  { value: 'mantenimiento', label: 'Mantenimiento' },
  { value: 'reparacion', label: 'Reparación' },
  { value: 'calibracion', label: 'Calibración' },
  { value: 'otro', label: 'Otro' },
] as const;

const GUARDIA_TURNOS = [
  { value: 'dia', label: 'Día' },
  { value: 'noche', label: 'Noche' },
] as const;

const TAB_ITEMS: { key: TabType; label: string; icon: React.ReactNode }[] = [
  { key: 'produccion', label: 'Producción', icon: <Factory className="h-3 w-3" /> },
  { key: 'extraccion', label: 'Extracción', icon: <Pickaxe className="h-3 w-3" /> },
  { key: 'gastos', label: 'Gastos', icon: <Receipt className="h-3 w-3" /> },
  { key: 'asistencia', label: 'Asistencia', icon: <Users className="h-3 w-3" /> },
  { key: 'equipos', label: 'Equipos', icon: <Wrench className="h-3 w-3" /> },
];

type DashboardMetricsRailProps = {
  globalData: GlobalData;
  activeNodes: number;
};

export const DashboardMetricsRail = memo(function DashboardMetricsRail({ globalData, activeNodes }: DashboardMetricsRailProps) {
  const router = useRouter();
  const { user } = useAuth();
  const turnoOpts = useTurnoOptions(false);
  const molinoOpts = useBibliotecaOptions('molinos');
  const verticalOpts = useBibliotecaOptions('verticales_voladura', { prependEmpty: true });
  const minaOpts = useBibliotecaOptions('minas');
  const biblioteca = useBiblioteca();

  const molinoDatalist = useMemo(
    () => molinoOpts.length > 0 ? molinoOpts : [{ value: 'Molino La Fe', label: 'Molino La Fe' }],
    [molinoOpts],
  );

  const gastosCategoriaOptions = useMemo(
    () => GASTOS_CATEGORIAS.map((c) => ({ value: c, label: c })),
    [],
  );
  const equipoEventoOptions = useMemo(
    () => EQUIPO_EVENTOS.map((o) => ({ value: o.value, label: o.label })),
    [],
  );
  const guardiaTurnoOptions = useMemo(
    () => GUARDIA_TURNOS.map((o) => ({ value: o.value, label: o.label })),
    [],
  );

  const materialDatalist = useMemo(() => {
    const items = biblioteca.options?.['asignacion_nomina'] ?? [];
    return items.length > 0 ? items : [
      { value: 'Vertical 1', label: 'Vertical 1' },
      { value: 'Vertical 2', label: 'Vertical 2' },
      { value: 'Vertical 3', label: 'Vertical 3' },
      { value: 'Mantenimiento', label: 'Mantenimiento' },
      { value: 'Repaso', label: 'Repaso' },
      { value: 'Caratal', label: 'Caratal' },
    ];
  }, [biblioteca]);

  const [activeTab, setActiveTab] = useState<TabType>('produccion');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  // Producción
  const [pFecha, setPFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [pTurno, setPTurno] = useState('dia');
  const [pMolino, setPMolino] = useState('');
  const [pMaterial, setPMaterial] = useState('');
  const [pCodigo, setPCodigo] = useState('');
  const [pSacos, setPSacos] = useState('');
  const [pAmalgama1, setPAmalgama1] = useState('');
  const [pAmalgama2, setPAmalgama2] = useState('');
  const [pOro, setPOro] = useState('');
  const [pResponsable, setPResponsable] = useState('');

  // Extracción
  const [eFecha, setEFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [eTurno, setETurno] = useState<'dia' | 'noche' | 'completo'>('dia');
  const [eVertical, setEVertical] = useState('');
  const [eMina, setEMina] = useState('');
  const [eSacos, setESacos] = useState('');
  const [eDisparo, setEDisparo] = useState('');
  const [eResponsable, setEResponsable] = useState('');

  // Gastos
  const [gFecha, setGFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [gMonto, setGMonto] = useState('');
  const [gCategoria, setGCategoria] = useState('');
  const [gDescripcion, setGDescripcion] = useState('');

  // Asistencia
  const [aFecha, setAFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [aTurno, setATurno] = useState('dia');
  const [aJefeSaliente, setAJefeSaliente] = useState('');
  const [aJefeEntrante, setAJefeEntrante] = useState('');
  const [aPersonalMina, setAPersonalMina] = useState('');
  const [aPersonalPlanta, setAPersonalPlanta] = useState('');
  const [aNovedades, setANovedades] = useState('');

  // Equipos
  const [qFecha, setQFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [qTipoEvento, setQTipoEvento] = useState('');
  const [qDescripcion, setQDescripcion] = useState('');
  const [qCosto, setQCosto] = useState('');

  const resetForm = useCallback(() => {
    setPFecha(new Date().toISOString().slice(0, 10)); setPTurno('dia'); setPMolino(''); setPMaterial(''); setPCodigo(''); setPSacos(''); setPAmalgama1(''); setPAmalgama2(''); setPOro(''); setPResponsable('');
    setEFecha(new Date().toISOString().slice(0, 10)); setETurno('dia'); setEVertical(''); setEMina(''); setESacos(''); setEDisparo(''); setEResponsable('');
    setGFecha(new Date().toISOString().slice(0, 10)); setGMonto(''); setGCategoria(''); setGDescripcion('');
    setAFecha(new Date().toISOString().slice(0, 10)); setATurno('dia'); setAJefeSaliente(''); setAJefeEntrante(''); setAPersonalMina(''); setAPersonalPlanta(''); setANovedades('');
    setQFecha(new Date().toISOString().slice(0, 10)); setQTipoEvento(''); setQDescripcion(''); setQCosto('');
    setActiveTab('produccion');
  }, []);

  const showSuccessAndRefresh = useCallback(() => {
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2500);
    resetForm();
    router.refresh();
  }, [resetForm, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      switch (activeTab) {
        case 'produccion': {
          if (!pMolino.trim() || !pMaterial.trim()) {
            setErrorMsg('Molino y material son obligatorios'); setIsSubmitting(false); return;
          }
          const res = await createProduccion({
            fecha: pFecha,
            turno: pTurno,
            molino: pMolino.trim(),
            material: pMaterial.trim(),
            material_codigo: pCodigo.trim() || undefined,
            sacos: Number(pSacos) || 0,
            amalgama_1_g: pAmalgama1 ? Number(pAmalgama1) : undefined,
            amalgama_2_g: pAmalgama2 ? Number(pAmalgama2) : undefined,
            oro_recuperado_g: Number(pOro) || 0,
            responsable: pResponsable.trim() || undefined,
            registrado_por: user?.id ?? null,
          });
          if (!res.ok) { setErrorMsg(res.message); setIsSubmitting(false); return; }
          break;
        }
        case 'extraccion': {
          const res = await createExtraccion({
            fecha: eFecha,
            turno: eTurno,
            vertical: eVertical || undefined,
            mina: eMina || undefined,
            sacos_extraidos: Number(eSacos) || 0,
            numero_disparo: eDisparo || undefined,
            responsable: eResponsable.trim() || undefined,
            registrado_por: user?.id ?? undefined,
          });
          if (!res.ok) { setErrorMsg(res.message ?? 'Error al registrar extracción'); setIsSubmitting(false); return; }
          break;
        }
        case 'gastos': {
          if (!gCategoria || !gDescripcion.trim()) {
            setErrorMsg('Categoría y descripción son obligatorias'); setIsSubmitting(false); return;
          }
          const catRes = await getOrCreateCategoria(gCategoria);
          if (!catRes.ok) { setErrorMsg(catRes.message); setIsSubmitting(false); return; }
          const res = await createGasto({
            fecha: gFecha,
            categoria_id: catRes.id,
            descripcion: gDescripcion.trim(),
            monto: Number(gMonto) || 0,
            registrado_por: user?.id ?? null,
          });
          if (!res.ok) { setErrorMsg(res.message); setIsSubmitting(false); return; }
          break;
        }
        case 'asistencia': {
          if (!aJefeSaliente.trim() || !aJefeEntrante.trim() || !aNovedades.trim()) {
            setErrorMsg('Jefes y novedades son obligatorios'); setIsSubmitting(false); return;
          }
          const { error: guardiaError } = await supabase.from('libro_guardia').insert({
            fecha: aFecha,
            turno: aTurno,
            jefe_saliente: aJefeSaliente.trim(),
            jefe_entrante: aJefeEntrante.trim(),
            personal_mina: Number(aPersonalMina) || 0,
            personal_planta: Number(aPersonalPlanta) || 0,
            personal_otros: 0,
            novedades_operativas: aNovedades.trim(),
            registrado_por: user?.id ?? null,
          });
          if (guardiaError) { setErrorMsg(guardiaError.message); setIsSubmitting(false); return; }
          break;
        }
        case 'equipos': {
          if (!qTipoEvento || !qDescripcion.trim()) {
            setErrorMsg('Tipo de evento y descripción son obligatorios'); setIsSubmitting(false); return;
          }
          const { error: equipoError } = await supabase.from('equipos_historial').insert({
            fecha: qFecha,
            tipo_evento: qTipoEvento,
            descripcion: qDescripcion.trim(),
            costo: Number(qCosto) || 0,
            registrado_por: user?.id ?? null,
          });
          if (equipoError) { setErrorMsg(equipoError.message); setIsSubmitting(false); return; }
          break;
        }
      }

      showSuccessAndRefresh();
    } catch (err) {
      console.error('[QuickEntry] Error:', err);
      setErrorMsg('Error inesperado. Intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <aside className="dashboard-metrics-rail" aria-labelledby="dashboard-kpi-heading">
      <div className="dashboard-metrics-rail__head">
        <h2 id="dashboard-kpi-heading" className="dashboard-metrics-rail__title">
          Panel operativo
        </h2>
        <p className="dashboard-metrics-rail__desc">Detalle financiero y de planta</p>
      </div>

      <div className="dashboard-metrics-rail__list scroll-y-fade">
        <p className="dashboard-metrics-rail__section">Producción</p>
        <SolidMetricCard
          layout="rail"
          label="Producción Mensual"
          value={globalData.produccionMensual.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
          unit="g Au"
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <SolidMetricCard
          layout="rail"
          featured
          label="Oro Total Recuperado"
          value={globalData.oroTotalRecuperado.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
          unit="g Au"
          icon={<Gem className="h-4 w-4" />}
        />
        <SolidMetricCard
          layout="rail"
          label="Balance Plancha 1"
          value={globalData.balancePlancha1.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          unit="g Au"
          icon={<Layers className="h-3.5 w-3.5" />}
        />

        {/* ── Quick Entry Panel ─────────────────────────────── */}
        <p className="dashboard-metrics-rail__section">Entrada Rápida</p>
        <div className="quick-entry-panel">
          <div className="quick-entry-panel__tabs">
            {TAB_ITEMS.map(({ key, label, icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={[
                  'quick-entry-panel__tab',
                  activeTab === key ? 'quick-entry-panel__tab--active' : '',
                ].filter(Boolean).join(' ')}
              >
                {icon}
                <span>{label}</span>
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="quick-entry-panel__form">
            {/* ── PRODUCCIÓN ── */}
            {activeTab === 'produccion' && (
              <>
                <div className="quick-entry-panel__row">
                  <label className="input-label">Fecha</label>
                  <AppDatePicker value={pFecha} onChange={setPFecha} />
                </div>
                <div className="quick-entry-panel__row">
                  <label className="input-label">Turno</label>
                  <AppSelect value={pTurno} onChange={setPTurno} options={turnoOpts} />
                </div>
                <div className="quick-entry-panel__row">
                  <label className="input-label">Molino</label>
                  <input type="text" value={pMolino} onChange={e => setPMolino(e.target.value)} list="qe-molino-list" placeholder="Molino La Fe…" className="input-field" />
                  <datalist id="qe-molino-list">
                    {molinoDatalist.map(o => <option key={o.value} value={o.value} />)}
                  </datalist>
                </div>
                <div className="quick-entry-panel__row">
                  <label className="input-label">Material / Origen</label>
                  <input type="text" value={pMaterial} onChange={e => setPMaterial(e.target.value)} list="qe-material-list" placeholder="Vertical 1, Repaso…" className="input-field" />
                  <datalist id="qe-material-list">
                    {materialDatalist.map(o => <option key={o.value} value={o.value} />)}
                  </datalist>
                </div>
                <div className="quick-entry-panel__row">
                  <label className="input-label">Código Lote/Veta</label>
                  <input type="text" value={pCodigo} onChange={e => setPCodigo(e.target.value)} placeholder="V-2D19" className="input-field" />
                </div>
                <div className="quick-entry-panel__row">
                  <label className="input-label">Sacos</label>
                  <input type="number" min="0" step="1" value={pSacos} onChange={e => setPSacos(e.target.value)} placeholder="0" className="input-field" />
                </div>
                <div className="quick-entry-panel__cols2">
                  <div className="quick-entry-panel__row">
                    <label className="input-label">Amalgama 1 (g)</label>
                    <input type="number" min="0" step="0.01" value={pAmalgama1} onChange={e => setPAmalgama1(e.target.value)} placeholder="0.00" className="input-field" />
                  </div>
                  <div className="quick-entry-panel__row">
                    <label className="input-label">Amalgama 2 (g)</label>
                    <input type="number" min="0" step="0.01" value={pAmalgama2} onChange={e => setPAmalgama2(e.target.value)} placeholder="0.00" className="input-field" />
                  </div>
                </div>
                <div className="quick-entry-panel__row">
                  <label className="input-label">Oro recuperado (g Au) *</label>
                  <input type="number" min="0" step="0.0001" value={pOro} onChange={e => setPOro(e.target.value)} placeholder="0.0000" className="input-field" />
                </div>
                <div className="quick-entry-panel__row">
                  <label className="input-label">Responsable</label>
                  <input type="text" value={pResponsable} onChange={e => setPResponsable(e.target.value)} placeholder="Opcional" className="input-field" />
                </div>
              </>
            )}

            {/* ── EXTRACCIÓN ── */}
            {activeTab === 'extraccion' && (
              <>
                <div className="quick-entry-panel__row">
                  <label className="input-label">Fecha</label>
                  <AppDatePicker value={eFecha} onChange={setEFecha} />
                </div>
                <div className="quick-entry-panel__row">
                  <label className="input-label">Turno</label>
                  <AppSelect
                    value={eTurno}
                    onChange={(v) => setETurno(v as 'dia' | 'noche' | 'completo')}
                    options={turnoOpts}
                  />
                </div>
                <div className="quick-entry-panel__row">
                  <label className="input-label">Vertical</label>
                  <AppSelect
                    value={eVertical}
                    onChange={setEVertical}
                    options={verticalOpts}
                    placeholder="— Sin especificar —"
                  />
                </div>
                <div className="quick-entry-panel__row">
                  <label className="input-label">Mina</label>
                  <AppSelect value={eMina} onChange={setEMina} options={minaOpts} placeholder="Seleccionar…" />
                </div>
                <div className="quick-entry-panel__row">
                  <label className="input-label">Sacos extraídos</label>
                  <input type="number" min="0" step="1" value={eSacos} onChange={e => setESacos(e.target.value)} placeholder="0" className="input-field" />
                </div>
                <div className="quick-entry-panel__row">
                  <label className="input-label">N° Disparo</label>
                  <input type="text" value={eDisparo} onChange={e => setEDisparo(e.target.value)} placeholder="Opcional" className="input-field" />
                </div>
                <div className="quick-entry-panel__row">
                  <label className="input-label">Responsable</label>
                  <input type="text" value={eResponsable} onChange={e => setEResponsable(e.target.value)} placeholder="Opcional" className="input-field" />
                </div>
              </>
            )}

            {/* ── GASTOS ── */}
            {activeTab === 'gastos' && (
              <>
                <div className="quick-entry-panel__row">
                  <label className="input-label">Fecha</label>
                  <AppDatePicker value={gFecha} onChange={setGFecha} />
                </div>
                <div className="quick-entry-panel__row">
                  <label className="input-label">Monto ($)</label>
                  <input type="number" min="0" step="0.01" value={gMonto} onChange={e => setGMonto(e.target.value)} placeholder="0.00" className="input-field" />
                </div>
                <div className="quick-entry-panel__row">
                  <label className="input-label">Categoría</label>
                  <AppSelect
                    value={gCategoria}
                    onChange={setGCategoria}
                    options={gastosCategoriaOptions}
                    placeholder="Seleccionar…"
                  />
                </div>
                <div className="quick-entry-panel__row">
                  <label className="input-label">Descripción</label>
                  <textarea value={gDescripcion} onChange={e => setGDescripcion(e.target.value)} placeholder="Detalle del gasto" rows={2} className="input-field resize-none" />
                </div>
              </>
            )}

            {/* ── ASISTENCIA (Libro de Guardia) ── */}
            {activeTab === 'asistencia' && (
              <>
                <div className="quick-entry-panel__row">
                  <label className="input-label">Fecha</label>
                  <AppDatePicker value={aFecha} onChange={setAFecha} />
                </div>
                <div className="quick-entry-panel__row">
                  <label className="input-label">Turno</label>
                  <AppSelect value={aTurno} onChange={setATurno} options={guardiaTurnoOptions} />
                </div>
                <div className="quick-entry-panel__row">
                  <label className="input-label">Jefe saliente</label>
                  <input type="text" value={aJefeSaliente} onChange={e => setAJefeSaliente(e.target.value)} placeholder="Nombre" className="input-field" />
                </div>
                <div className="quick-entry-panel__row">
                  <label className="input-label">Jefe entrante</label>
                  <input type="text" value={aJefeEntrante} onChange={e => setAJefeEntrante(e.target.value)} placeholder="Nombre" className="input-field" />
                </div>
                <div className="quick-entry-panel__cols2">
                  <div className="quick-entry-panel__row">
                    <label className="input-label">P. Mina</label>
                    <input type="number" min="0" step="1" value={aPersonalMina} onChange={e => setAPersonalMina(e.target.value)} placeholder="0" className="input-field" />
                  </div>
                  <div className="quick-entry-panel__row">
                    <label className="input-label">P. Planta</label>
                    <input type="number" min="0" step="1" value={aPersonalPlanta} onChange={e => setAPersonalPlanta(e.target.value)} placeholder="0" className="input-field" />
                  </div>
                </div>
                <div className="quick-entry-panel__row">
                  <label className="input-label">Novedades operativas</label>
                  <textarea value={aNovedades} onChange={e => setANovedades(e.target.value)} placeholder="Novedades del turno" rows={2} className="input-field resize-none" />
                </div>
              </>
            )}

            {/* ── EQUIPOS (Historial) ── */}
            {activeTab === 'equipos' && (
              <>
                <div className="quick-entry-panel__row">
                  <label className="input-label">Fecha</label>
                  <AppDatePicker value={qFecha} onChange={setQFecha} />
                </div>
                <div className="quick-entry-panel__row">
                  <label className="input-label">Tipo de evento</label>
                  <AppSelect
                    value={qTipoEvento}
                    onChange={setQTipoEvento}
                    options={equipoEventoOptions}
                    placeholder="Seleccionar…"
                  />
                </div>
                <div className="quick-entry-panel__row">
                  <label className="input-label">Descripción</label>
                  <textarea value={qDescripcion} onChange={e => setQDescripcion(e.target.value)} placeholder="Detalle del evento" rows={2} className="input-field resize-none" />
                </div>
                <div className="quick-entry-panel__row">
                  <label className="input-label">Costo ($)</label>
                  <input type="number" min="0" step="0.01" value={qCosto} onChange={e => setQCosto(e.target.value)} placeholder="0.00" className="input-field" />
                </div>
              </>
            )}

            {errorMsg && (
              <p className="quick-entry-panel__error">{errorMsg}</p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="quick-entry-panel__submit"
            >
              {showSuccess ? '✓ Registrado' : isSubmitting ? 'Registrando…' : 'REGISTRAR'}
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
});
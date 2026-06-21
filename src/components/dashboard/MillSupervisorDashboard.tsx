'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Factory,
  Gem,
  Flame,
  TrendingUp,
  Truck,
  Users,
  Activity,
  Layers,
} from 'lucide-react';
import { DashboardShell } from './DashboardShell';
import { SolidMetricCard } from './SolidMetricCard';
import { NodesOperationsMap } from './NodesOperationsMap';
import { NodeTacticalPanel } from './NodeTacticalPanel';
import { useAuth } from '@/lib/auth-context';
import { useBiblioteca, useBibliotecaOptions, useTurnoOptions } from '@/contexts/biblioteca-context';
import { createProduccion } from '@/lib/actions/produccion';
import { supabase } from '@/lib/supabase';
import type { GlobalData, LocationData } from './types';
import { AppSelect } from '@/components/ui/AppSelect';
import { AppDatePicker } from '@/components/ui/AppDatePicker';

type TabType = 'produccion' | 'acarreo' | 'asistencia';

const GUARDIA_TURNOS = [
  { value: 'dia', label: 'Día' },
  { value: 'noche', label: 'Noche' },
] as const;

const TAB_ITEMS: { key: TabType; label: string; icon: React.ReactNode }[] = [
  { key: 'produccion', label: 'Producción', icon: <Factory className="h-3 w-3" /> },
  { key: 'acarreo', label: 'Acarreo', icon: <Truck className="h-3 w-3" /> },
  { key: 'asistencia', label: 'Guardia', icon: <Users className="h-3 w-3" /> },
];

export default function MillSupervisorDashboard({
  data,
  locations,
}: {
  data: GlobalData;
  locations: LocationData[];
}) {
  const router = useRouter();
  const { user } = useAuth();
  const turnoOpts = useTurnoOptions(false);
  const molinoOpts = useBibliotecaOptions('molinos');
  const biblioteca = useBiblioteca();

  const molinoDatalist = useMemo(
    () => molinoOpts.length > 0 ? molinoOpts : [{ value: 'Molino La Fe', label: 'Molino La Fe' }],
    [molinoOpts],
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

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('produccion');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  // Producción form
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

  // Asistencia form
  const [aFecha, setAFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [aTurno, setATurno] = useState('dia');
  const [aJefeSaliente, setAJefeSaliente] = useState('');
  const [aJefeEntrante, setAJefeEntrante] = useState('');
  const [aPersonalMina, setAPersonalMina] = useState('');
  const [aPersonalPlanta, setAPersonalPlanta] = useState('');
  const [aNovedades, setANovedades] = useState('');

  const selectedNode = useMemo(
    () => locations.find((l) => l.id === selectedNodeId) ?? null,
    [locations, selectedNodeId],
  );

  const activeNodes = locations.filter((l) => l.status === 'Activo').length;

  const resetForm = useCallback(() => {
    setPFecha(new Date().toISOString().slice(0, 10)); setPTurno('dia'); setPMolino(''); setPMaterial(''); setPCodigo(''); setPSacos(''); setPAmalgama1(''); setPAmalgama2(''); setPOro(''); setPResponsable('');
    setAFecha(new Date().toISOString().slice(0, 10)); setATurno('dia'); setAJefeSaliente(''); setAJefeEntrante(''); setAPersonalMina(''); setAPersonalPlanta(''); setANovedades('');
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
      }
      showSuccessAndRefresh();
    } catch {
      setErrorMsg('Error inesperado. Intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const planchas = data.planchasBreakdown ?? data.balancesPlanchas?.map(p => ({
    id: p.id,
    label: p.label,
    oro: p.grams,
    amalgama: 0,
  })) ?? [];

  return (
    <DashboardShell>
      <div className="dashboard-command-layout">
        {/* ── Role Badge ── */}
        <div className="flex items-center gap-2 border-b border-[var(--dashboard-border)] bg-[var(--dashboard-card-muted)] px-4 py-1.5">
          <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
            Molino
          </span>
          <span className="text-[11px] text-[var(--dashboard-text-muted)]">
            Supervisor de Molino — datos de producción, quemado y acarreo
          </span>
        </div>

        {/* ── Header KPI ── */}
        <header className="dashboard-command-header dashboard-command-header--no-alerts">
          <div className="dashboard-command-header__brand">
            <p className="dashboard-command-header__eyebrow">Complejo operativo La Fe</p>
            <h1 className="dashboard-command-header__title">Supervisor de Molino</h1>
            <p className="dashboard-command-header__subtitle">
              Panel de control de molinos, producción y planchas
            </p>
          </div>

          <div className="dashboard-command-stat dashboard-command-stat--hero" role="listitem">
            <span className="dashboard-command-stat__icon" aria-hidden>
              <Gem className="h-4 w-4" />
            </span>
            <div className="dashboard-command-stat__body">
              <span className="dashboard-command-stat__label">Oro Total Recuperado</span>
              <span className="dashboard-command-stat__value">
                {data.oroTotalRecuperado.toLocaleString('en-US', {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })}
                <span className="dashboard-command-stat__unit">g Au</span>
              </span>
            </div>
          </div>

          <div className="dashboard-command-stat dashboard-command-stat--nodes" role="listitem">
            <span className="dashboard-command-stat__icon" aria-hidden>
              <Factory className="h-4 w-4" />
            </span>
            <div className="dashboard-command-stat__body">
              <span className="dashboard-command-stat__label">Molinos Activos</span>
              <span className="dashboard-command-stat__value">
                {activeNodes}
                <span className="dashboard-command-stat__unit">/ {locations.length}</span>
              </span>
            </div>
          </div>

          <div className="dashboard-command-stat dashboard-command-stat--personnel" role="listitem">
            <span className="dashboard-command-stat__icon" aria-hidden>
              <Users className="h-4 w-4" />
            </span>
            <div className="dashboard-command-stat__body">
              <span className="dashboard-command-stat__label">Personal Planta Activo</span>
              <span className="dashboard-command-stat__value">
                {data.activePersonnel}
                <span className="dashboard-command-stat__unit">operarios</span>
              </span>
            </div>
          </div>

          <div className="dashboard-command-stat dashboard-command-stat--expenses" role="listitem">
            <span className="dashboard-command-stat__icon" aria-hidden>
              <Flame className="h-4 w-4" />
            </span>
            <div className="dashboard-command-stat__body">
              <span className="dashboard-command-stat__label">Oro Quemado Periodo</span>
              <span className="dashboard-command-stat__value">
                {(data.oroQuemadoPeriodo ?? 0).toLocaleString('en-US', {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })}
                <span className="dashboard-command-stat__unit">g Au</span>
              </span>
            </div>
          </div>
        </header>

        {/* ── Main ── */}
        <div className="dashboard-command-main">
          <NodesOperationsMap
            locations={locations}
            selectedId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
          />

          <div className="dashboard-command-rail">
            {selectedNode ? (
              <NodeTacticalPanel
                loc={selectedNode}
                allLocations={locations}
                onClose={() => setSelectedNodeId(null)}
              />
            ) : (
              <div className="flex flex-col gap-3">
                <aside className="dashboard-metrics-rail" aria-labelledby="mill-kpi-heading">
                  <div className="dashboard-metrics-rail__head">
                    <h2 id="mill-kpi-heading" className="dashboard-metrics-rail__title">
                      Panel de Molino
                    </h2>
                    <p className="dashboard-metrics-rail__desc">Producción, planchas y entrada rápida</p>
                  </div>

                  <div className="dashboard-metrics-rail__list scroll-y-fade">
                    <p className="dashboard-metrics-rail__section">Producción</p>
                    <SolidMetricCard
                      layout="rail"
                      featured
                      label="Producción Mensual"
                      value={data.produccionMensual.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                      unit="g Au"
                      icon={<TrendingUp className="h-4 w-4" />}
                    />
                    <SolidMetricCard
                      layout="rail"
                      label="Informes de Producción"
                      value={data.produccionesPeriodo ?? 0}
                      unit="reportes"
                      icon={<Activity className="h-3.5 w-3.5" />}
                    />

                    <p className="dashboard-metrics-rail__section">Acarreo</p>
                    <SolidMetricCard
                      layout="rail"
                      label="Carga Acarreada"
                      value={(data.cargaAcarreadaPeriodo ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      unit="ton"
                      icon={<Truck className="h-3.5 w-3.5" />}
                    />
                    <SolidMetricCard
                      layout="rail"
                      label="Viajes de Acarreo"
                      value={data.acarreosPeriodo ?? 0}
                      unit="viajes"
                      icon={<Activity className="h-3.5 w-3.5" />}
                    />

                    {planchas.length > 0 && (
                      <>
                        <p className="dashboard-metrics-rail__section">Planchas</p>
                        {planchas.map((p) => (
                          <SolidMetricCard
                            key={p.id}
                            layout="rail"
                            label={p.label}
                            value={p.oro.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                            unit="g Au"
                            icon={<Layers className="h-3.5 w-3.5" />}
                          />
                        ))}
                      </>
                    )}

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
                              <input type="text" value={pMolino} onChange={e => setPMolino(e.target.value)} list="ms-molino-list" placeholder="Molino La Fe…" className="input-field" />
                              <datalist id="ms-molino-list">
                                {molinoDatalist.map(o => <option key={o.value} value={o.value} />)}
                              </datalist>
                            </div>
                            <div className="quick-entry-panel__row">
                              <label className="input-label">Material / Origen</label>
                              <input type="text" value={pMaterial} onChange={e => setPMaterial(e.target.value)} list="ms-material-list" placeholder="Vertical 1, Repaso…" className="input-field" />
                              <datalist id="ms-material-list">
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

                        {activeTab === 'acarreo' && (
                          <div className="flex flex-col items-center justify-center py-4 text-center text-[11px] text-[var(--dashboard-text-muted)]">
                            <Truck className="h-6 w-6 mb-1.5 opacity-40" />
                            <p>El registro de acarreo se realiza en</p>
                            <button
                              type="button"
                              onClick={() => router.push('/planta/acarreo')}
                              className="mt-1.5 rounded bg-[var(--dashboard-accent)]/10 px-3 py-1 text-[11px] font-semibold text-[var(--dashboard-accent)] transition-colors hover:bg-[var(--dashboard-accent)]/20"
                            >
                              Ir a Acarreo →
                            </button>
                          </div>
                        )}

                        {activeTab === 'asistencia' && (
                          <>
                            <div className="quick-entry-panel__row">
                              <label className="input-label">Fecha</label>
                              <AppDatePicker value={aFecha} onChange={setAFecha} />
                            </div>
                            <div className="quick-entry-panel__row">
                              <label className="input-label">Turno</label>
                              <AppSelect value={aTurno} onChange={setATurno} options={GUARDIA_TURNOS.map(o => ({ value: o.value, label: o.label }))} />
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

                        {errorMsg && (
                          <p className="quick-entry-panel__error">{errorMsg}</p>
                        )}

                        {activeTab !== 'acarreo' && (
                          <button
                            type="submit"
                            disabled={isSubmitting}
                            className="quick-entry-panel__submit"
                          >
                            {showSuccess ? '✓ Registrado' : isSubmitting ? 'Registrando…' : 'REGISTRAR'}
                          </button>
                        )}
                      </form>
                    </div>
                  </div>
                </aside>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

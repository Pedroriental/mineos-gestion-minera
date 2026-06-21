'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Pickaxe,
  HardHat,
  Wrench,
  Users,
  TrendingUp,
  AlertTriangle,
  Activity,
  LandPlot,
} from 'lucide-react';
import { DashboardShell } from './DashboardShell';
import { SolidMetricCard } from './SolidMetricCard';
import { useAuth } from '@/lib/auth-context';
import { useBibliotecaOptions, useTurnoOptions } from '@/contexts/biblioteca-context';
import { createExtraccion } from '@/lib/actions/extraccion';
import { supabase } from '@/lib/supabase';
import type { GlobalData } from './types';
import { AppSelect } from '@/components/ui/AppSelect';
import { AppDatePicker } from '@/components/ui/AppDatePicker';

type TabType = 'extraccion' | 'asistencia' | 'equipos';

const GUARDIA_TURNOS = [
  { value: 'dia', label: 'Día' },
  { value: 'noche', label: 'Noche' },
] as const;

const EQUIPO_EVENTOS = [
  { value: 'mantenimiento', label: 'Mantenimiento' },
  { value: 'reparacion', label: 'Reparación' },
  { value: 'calibracion', label: 'Calibración' },
  { value: 'otro', label: 'Otro' },
] as const;

const TAB_ITEMS: { key: TabType; label: string; icon: React.ReactNode }[] = [
  { key: 'extraccion', label: 'Extracción', icon: <Pickaxe className="h-3 w-3" /> },
  { key: 'asistencia', label: 'Guardia', icon: <Users className="h-3 w-3" /> },
  { key: 'equipos', label: 'Equipos', icon: <Wrench className="h-3 w-3" /> },
];

const VERTICAL_COLORS = [
  'border-l-[var(--mineos-general)] bg-[var(--mineos-general-soft)]',
  'border-l-[var(--mineos-benefit)] bg-[var(--mineos-benefit-soft)]',
  'border-l-[var(--mineos-expense)] bg-[var(--mineos-expense-soft)]',
  'border-l-amber-500/30 bg-amber-500/5',
  'border-l-sky-500/30 bg-sky-500/5',
  'border-l-violet-500/30 bg-violet-500/5',
];

export default function MiningSupervisorDashboard({ data }: { data: GlobalData }) {
  const router = useRouter();
  const { user } = useAuth();
  const turnoOpts = useTurnoOptions(false);
  const verticalOpts = useBibliotecaOptions('verticales_voladura', { prependEmpty: true });
  const minaOpts = useBibliotecaOptions('minas');

  const [activeTab, setActiveTab] = useState<TabType>('extraccion');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  // Extracción form
  const [eFecha, setEFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [eTurno, setETurno] = useState<'dia' | 'noche' | 'completo'>('dia');
  const [eVertical, setEVertical] = useState('');
  const [eMina, setEMina] = useState('');
  const [eSacos, setESacos] = useState('');
  const [eDisparo, setEDisparo] = useState('');
  const [eResponsable, setEResponsable] = useState('');

  // Asistencia form
  const [aFecha, setAFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [aTurno, setATurno] = useState('dia');
  const [aJefeSaliente, setAJefeSaliente] = useState('');
  const [aJefeEntrante, setAJefeEntrante] = useState('');
  const [aPersonalMina, setAPersonalMina] = useState('');
  const [aPersonalPlanta, setAPersonalPlanta] = useState('');
  const [aNovedades, setANovedades] = useState('');

  // Equipos form
  const [qFecha, setQFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [qTipoEvento, setQTipoEvento] = useState('');
  const [qDescripcion, setQDescripcion] = useState('');
  const [qCosto, setQCosto] = useState('');

  const resetForm = useCallback(() => {
    setEFecha(new Date().toISOString().slice(0, 10)); setETurno('dia'); setEVertical(''); setEMina(''); setESacos(''); setEDisparo(''); setEResponsable('');
    setAFecha(new Date().toISOString().slice(0, 10)); setATurno('dia'); setAJefeSaliente(''); setAJefeEntrante(''); setAPersonalMina(''); setAPersonalPlanta(''); setANovedades('');
    setQFecha(new Date().toISOString().slice(0, 10)); setQTipoEvento(''); setQDescripcion(''); setQCosto('');
    setActiveTab('extraccion');
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
    } catch {
      setErrorMsg('Error inesperado. Intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const verticales = data.miningVerticales ?? [];
  const minas = data.miningMinas ?? [];
  const equiposOperativos = data.equiposOperativos ?? 0;
  const equiposTotal = data.eqTotal ?? 0;
  const hasEquiposInactivos = equiposTotal > equiposOperativos;

  return (
    <DashboardShell>
      <div className="dashboard-command-layout">
        {/* ── Role Badge ── */}
        <div className="flex items-center gap-2 border-b border-[var(--dashboard-border)] bg-[var(--dashboard-card-muted)] px-4 py-1.5">
          <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-400">
            Mina
          </span>
          <span className="text-[11px] text-[var(--dashboard-text-muted)]">
            Supervisor de Mina — datos de extracción, voladuras y equipos
          </span>
        </div>

        {/* ── Header KPI ── */}
        <header className="dashboard-command-header dashboard-command-header--no-alerts">
          <div className="dashboard-command-header__brand">
            <p className="dashboard-command-header__eyebrow">Complejo operativo La Fe</p>
            <h1 className="dashboard-command-header__title">Supervisor de Mina</h1>
            <p className="dashboard-command-header__subtitle">
              Panel de control de extracción, voladuras y equipos
            </p>
          </div>

          <div className="dashboard-command-stat dashboard-command-stat--hero" role="listitem">
            <span className="dashboard-command-stat__icon" aria-hidden>
              <Pickaxe className="h-4 w-4" />
            </span>
            <div className="dashboard-command-stat__body">
              <span className="dashboard-command-stat__label">Sacos Extraídos Hoy</span>
              <span className="dashboard-command-stat__value">
                {(data.sacosExtraidosHoy ?? 0).toLocaleString('en-US')}
                <span className="dashboard-command-stat__unit">sacos</span>
              </span>
            </div>
          </div>

          <div className="dashboard-command-stat dashboard-command-stat--nodes" role="listitem">
            <span className="dashboard-command-stat__icon" aria-hidden>
              <HardHat className="h-4 w-4" />
            </span>
            <div className="dashboard-command-stat__body">
              <span className="dashboard-command-stat__label">Voladuras Periodo</span>
              <span className="dashboard-command-stat__value">
                {data.voladurasPeriodo ?? 0}
                <span className="dashboard-command-stat__unit">total</span>
              </span>
            </div>
          </div>

          <div className="dashboard-command-stat dashboard-command-stat--personnel" role="listitem">
            <span className="dashboard-command-stat__icon" aria-hidden>
              <Users className="h-4 w-4" />
            </span>
            <div className="dashboard-command-stat__body">
              <span className="dashboard-command-stat__label">Personal Mina Activo</span>
              <span className="dashboard-command-stat__value">
                {data.activePersonnel}
                <span className="dashboard-command-stat__unit">operarios</span>
              </span>
            </div>
          </div>

          <div className="dashboard-command-stat dashboard-command-stat--expenses" role="listitem">
            <span className="dashboard-command-stat__icon" aria-hidden>
              <Wrench className="h-4 w-4" />
            </span>
            <div className="dashboard-command-stat__body">
              <span className="dashboard-command-stat__label">Equipos Operativos</span>
              <span className="dashboard-command-stat__value">
                {equiposOperativos}
                <span className="dashboard-command-stat__unit">/ {equiposTotal}</span>
              </span>
            </div>
          </div>
        </header>

        {/* ── Main Grid ── */}
        <div className="dashboard-command-main">
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
            {/* ── Summary Cards ── */}
            <div className="grid grid-cols-2 gap-3">
              <SolidMetricCard
                layout="grid"
                label="Sacos Periodo"
                value={(data.sacosExtraidosPeriodo ?? 0).toLocaleString('en-US')}
                unit="sacos"
                icon={<TrendingUp className="h-4 w-4" />}
              />
              <SolidMetricCard
                layout="grid"
                label="Extracciones"
                value={data.extraccionesPeriodo ?? 0}
                unit="informes"
                icon={<Activity className="h-4 w-4" />}
              />
              <SolidMetricCard
                layout="grid"
                label="Voladuras c/ Novedad"
                value={data.voladurasConNovedad ?? 0}
                unit={data.voladurasConNovedad && data.voladurasConNovedad > 0 ? 'atender' : 'sin novedad'}
                icon={<AlertTriangle className="h-4 w-4" />}
                alert={(data.voladurasConNovedad ?? 0) > 0}
              />
              <SolidMetricCard
                layout="grid"
                label="Equipos Inactivos"
                value={equiposTotal - equiposOperativos}
                unit="requieren atención"
                icon={<Wrench className="h-4 w-4" />}
                alert={hasEquiposInactivos}
              />
            </div>

            {/* ── Verticales Breakdown ── */}
            {verticales.length > 0 && (
              <section className="dashboard-metrics-rail__section">
                <div className="flex items-center gap-2 mb-2">
                  <LandPlot className="h-3.5 w-3.5 text-[var(--dashboard-accent)]" />
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--dashboard-text-muted)]">
                    Extracción por Vertical
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {verticales.map((v, i) => {
                    const totalSacos = verticales.reduce((s, x) => s + x.sacos, 0) || 1;
                    const pct = ((v.sacos / totalSacos) * 100).toFixed(0);
                    return (
                      <div
                        key={v.name}
                        className={`rounded-lg border border-l-[3px] ${VERTICAL_COLORS[i % VERTICAL_COLORS.length]} p-3`}
                      >
                        <p className="text-[11px] font-semibold text-[var(--dashboard-text)] truncate">{v.name}</p>
                        <div className="mt-1.5 flex items-baseline gap-2">
                          <span className="text-lg font-bold tabular-nums text-[var(--dashboard-text)]">
                            {v.sacos.toLocaleString('en-US')}
                          </span>
                          <span className="text-[10px] text-[var(--dashboard-text-muted)]">{pct}%</span>
                        </div>
                        <span className="block text-[10px] text-[var(--dashboard-text-muted)] mt-0.5">sacos</span>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ── Minas Activity ── */}
            {minas.length > 0 && (
              <section className="dashboard-metrics-rail__section">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-3.5 w-3.5 text-[var(--dashboard-accent)]" />
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--dashboard-text-muted)]">
                    Actividad de Voladuras por Mina
                  </p>
                </div>
                <div className="space-y-1.5">
                  {minas.map((m) => (
                    <div
                      key={m.name}
                      className="flex items-center justify-between rounded-lg border border-[var(--dashboard-border)] bg-[var(--dashboard-card)] px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-block h-2 w-2 rounded-full ${m.sinNovedad ? 'bg-emerald-500' : 'bg-red-500'}`}
                        />
                        <span className="text-[12px] font-medium text-[var(--dashboard-text)]">{m.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] tabular-nums font-semibold text-[var(--dashboard-text)]">
                          {m.voladuras} vol.
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                            m.sinNovedad
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-red-500/10 text-red-400'
                          }`}
                        >
                          {m.sinNovedad ? 'OK' : 'Novedad'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* ── Right Rail: Quick Entry ── */}
          <div className="dashboard-command-rail">
            <aside className="dashboard-metrics-rail" aria-labelledby="mining-kpi-heading">
              <div className="dashboard-metrics-rail__head">
                <h2 id="mining-kpi-heading" className="dashboard-metrics-rail__title">
                  Panel de Mina
                </h2>
                <p className="dashboard-metrics-rail__desc">Entrada rápida y resumen</p>
              </div>

              <div className="dashboard-metrics-rail__list scroll-y-fade">
                <p className="dashboard-metrics-rail__section">Resumen</p>
                <SolidMetricCard
                  layout="rail"
                  featured
                  label="Sacos Extraídos (Periodo)"
                  value={(data.sacosExtraidosPeriodo ?? 0).toLocaleString('en-US')}
                  unit="sacos"
                  icon={<Pickaxe className="h-4 w-4" />}
                />
                <SolidMetricCard
                  layout="rail"
                  label="Gastos Hoy (Mina)"
                  value={`$${(data.todayExpenses ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
                  icon={<Activity className="h-3.5 w-3.5" />}
                />

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

                    {activeTab === 'asistencia' && (
                      <>
                        <div className="quick-entry-panel__row">
                          <label className="input-label">Fecha</label>
                          <AppDatePicker value={aFecha} onChange={setAFecha} />
                        </div>
                        <div className="quick-entry-panel__row">
                          <label className="input-label">Turno</label>
                          <AppSelect value={aTurno} onChange={setATurno} options={[{ value: 'dia', label: 'Día' }, { value: 'noche', label: 'Noche' }]} />
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
                            options={EQUIPO_EVENTOS.map(o => ({ value: o.value, label: o.label }))}
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
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

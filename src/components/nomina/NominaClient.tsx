'use client';

import { useState, useTransition, useMemo, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useCanEdit } from '@/lib/use-can-edit';
import { 
  Pickaxe, RefreshCw, Plus, Trash2, Loader2, Calendar, 
  Clock, ChevronDown, ChevronUp, CheckCircle2, AlertTriangle, 
  Search, Factory, Shield, Truck, Briefcase, Edit2, Receipt, 
  Printer, X, Users, Wallet, ChevronRight, FileText, Download,
  Hammer, Umbrella, XCircle, Copy, Check, Lock, FileSpreadsheet
} from 'lucide-react';
import { toast } from 'sonner';
import { toastError } from '@/lib/app-toast';
import { useConfirm } from '@/components/ui/ConfirmDialogProvider';
import { cn } from '@/lib/utils';

import {
  ASIGNACION_NOMINA_OPCIONES,
  formatNombrePropio,
  getGrupoNominaKey,
  isAsignacionNominaValid,
} from '@/lib/personal-master';
import NominaNovedadTurnoCell from '@/components/nomina/NominaNovedadTurnoCell';
import type { NominaRegistroCerrado } from '@/lib/nomina-preview';
import type { ManualPeriodPlantillaContext } from '@/lib/nomina/nomina-preview-plantilla';
import type { NominaPreviewRange } from '@/components/nomina/NominaVistaPreviaContent';
import { AppSelect } from '@/components/ui/AppSelect';
import { AppDatePicker } from '@/components/ui/AppDatePicker';
import { MINEOS_BTN_NOMINA_PRIMARY, mineosBtnSubtleClass } from '@/lib/mineos-visual';
import {
  type NominaNovedadManual,
  readNovedadesManuales,
  writeNovedadesManuales,
  totalNovedadesManuales,
  mapNovedadManualToPreview,
} from '@/lib/nomina-novedades-manuales';
import { NominaNovedadModal } from '@/components/nomina/NominaNovedadModal';
import { NominaNovedadesManualesSection } from '@/components/nomina/NominaNovedadesManualesSection';
import {
  hasNovedadTurno,
  nominaNovedadDraftKey,
  describeNovedadTurnoSemana,
  parseNovedadTurno,
  patchAlMarcarNovedadTurno,
  patchAlCambiarAsistencia,
  preNominaRowToWeekDraft,
  parseReposoCondicionFromObs,
  readNominaNovedadDraft,
  reposoPagoUnicoMontoFromRow,
  weekDraftToRowOverrides,
  writeNominaNovedadDraft,
  type NominaWeekDraft,
} from '@/lib/nomina-novedad-turno';
import { PageFormModal, PageFormModalFooter } from '@/components/ui/PageFormModal';
import { SheetIconBadge } from '@/components/mobile';
import NominaDistribucionPanel from '@/components/nomina/NominaDistribucionPanel';
import { useNominaDivisionesConfig } from '@/hooks/use-nomina-divisiones-config';
import { listRotacionPlantillasAction } from '@/lib/actions/rotacion-plantillas';
import { syncRotacionEstadosLaboralesAction } from '@/lib/actions/rotacion-sync';
import {
  RotacionInstanciaPanel,
  RotacionInstanciaBanner,
} from '@/components/nomina/RotacionInstanciaPanel';
import { resolveWorkerRotacionContext } from '@/lib/rotacion-plantillas/projection';
import { resolveDiasInputBloqueadoPlantilla, calculatePayForPlantillaNominaRow } from '@/lib/rotacion-plantillas/semana-cierre';
import { deserializeInstanciaSnapshot } from '@/lib/rotacion-plantillas/instancia-serialize';
import type { InstanciaActivaSerialized } from '@/lib/rotacion-plantillas/instancia-serialize';
import type { RotacionPlantillaRecord } from '@/lib/rotacion-plantillas/types';
import type { PerfilCompensacion, PoliticaReposo } from '@/lib/types';
import { validarCierreRotacionSemanalAction } from '@/lib/actions/rotacion-instancias';
import { resolveNominaTemporalContext, resolveWorkingWeek, resolveWeekRangeAfterOperationalCierre, formatTemporalContextHint } from '@/lib/nomina/temporal-context';
import {
  attachSemanaToManualPeriod,
  detachSemanaFromManualPeriod,
  weekInManualPeriod,
  clearLocalDraftsForPeriod,
  computeManualPeriodProgress,
  manualPeriodFromPeriodoSummary,
  resolveClosedSemanaForManualPeriod,
  resolveClosedSemanaForWeekView,
  isHistoricalManualPeriodWeek,
  type ManualNominaPeriod,
} from '@/lib/nomina/manual-period';
import {
  emptyManualPeriodsSession,
  ensureWorkingWeekInPeriodAssignment,
  getPeriodById,
  getEditorPeriod,
  loadManualPeriodsSession,
  periodsEnCurso,
  removePeriodFromSession,
  resolveManualPeriodForWeek,
  saveManualPeriodsSession,
  upsertPeriodInSession,
  type ManualPeriodsSession,
} from '@/lib/nomina/manual-period-session';
import {
  addToManualWeekRoster,
  clearManualWeekRoster,
  isOperationalWeekEmptied,
  markOperationalWeekEmptied,
  mergeManualWeekRosterIds,
  readManualWeekRosterEntries,
  removeFromManualWeekRoster,
  writeManualWeekRosterEntries,
} from '@/lib/nomina/manual-period-roster';
import {
  carryManualWeekToNext,
  carryoverRowsFromSemanaRegistros,
  mergePersonalCatalogWithRosterEntries,
  resetNovedadDraftForRoster,
  seedManualWeekIfEmpty,
  type ManualWeekCarryoverRow,
} from '@/lib/nomina/manual-period-carryover';
import { previousWeekInManualPeriod, nextWeekInManualPeriod } from '@/lib/nomina/manual-period';
import {
  buildManualPlantillaNominaRows,
  manualPlantillaCuadrillaOrder,
  manualPlantillaCuadrillaOrderForWeek,
  nominaRowBelongsToCuadrilla,
  resolveActiveCuadrillaIdsForWeek,
} from '@/lib/rotacion-plantillas/manual-plantilla-projection';
import { mineosPanel } from '@/lib/mineos-visual';
import { getWeekEnd } from '@/lib/nomina/week-utils';
import { distribucionFromCierreLegacy } from '@/lib/nomina-distribucion';
import { calculateExpectedAttendance, getWeekStart } from '@/lib/rotacion-personal';
import {
  calculateNominaRowPay,
  calculateWeeklyBaseRate,
  explicitWeeklyBaseRate,
  defaultDiasTrabajados,
  formatProportionalSalarioHint,
  MAX_DIAS_TRABAJADOS,
  NOMINA_DIAS_POR_SEMANA,
  resolveEstadoYDias,
  aplicarPoliticaReposoSemanal,
  type EstadoAsistenciaNomina,
} from '@/lib/nomina-calculo';
import { esEstatusSemanaBonoTransporte } from '@/lib/rotacion-plantillas/bono-transporte-semana';
import {
  diasTrabajadosPorDefectoCiclo,
  etiquetaEstadoRotacion,
  estadoObservadoOpcionesPorEsquema,
  fechaInicioRotacionDesdeEstadoObservado,
  inputsDiasBloqueados,
  posicionEsquemaPersonal,
  rolSemanaPorPosicion,
} from '@/lib/nomina/perfil-ciclo-reglas';
import {
  buildGrupoMixtoRosterProjection,
  isGrupoMixtoPersonal,
  type GrupoMixtoHistoryWeek,
  type GrupoMixtoRosterProjection,
} from '@/lib/nomina/grupo-mixto-roster';
import { useBiblioteca } from '@/contexts/biblioteca-context';
import { buildPersonalSnapshot } from '@/lib/nomina/types';
import {
  downloadNominaSemanaCsv,
  type NominaSemanaExportRow,
} from '@/lib/nomina/nomina-semana-export';
import {
  buildPlantillaPdfData,
  type PlantillaPdfData,
} from '@/lib/rotacion-plantillas/plantilla-pdf-data';
import {
  previewNominaPlantillaPdf,
  downloadNominaPlantillaPdf,
  shareNominaPlantillaPdf,
  canSharePdf as canSharePdfGlobal,
  type ShareOutcome,
} from '@/lib/nomina/nomina-plantilla-pdf';
import { NominaPdfPreviewModal } from '@/components/nomina/NominaPdfPreviewModal';
import type { Personal, NominaRegistro, NominaSemana, NominaVale, HistorialPagoRow, RolSemana } from '@/lib/types';

import { findConsolidatedPeriodForWeekAction } from '@/lib/actions/nomina-actions';

import {
  getGrupoMixtoHistoryWeeksAction,
  updatePersonalEstatusAction,
  getSemanaRegistrosAction
} from '@/lib/actions/nomina-v2';

import {
  upsertPersonalV3Action,
  procesarCierreNominaV3Action,
  getValesPendientesBulkAction,
  crearValeAction,
  eliminarValeAction,
  getHistorialPagosAction,
  getSemanaCierreAction,
  registrarAuditAction,
} from '@/lib/actions/nomina-v3';

import {
  NominaMobileDock,
  NominaMobileMoreSheet,
  NominaMobileSemanaSheet,
  NominaMobileStickyChrome,
  NominaMobileWorkerCard,
  type PreNominaRowState,
} from '@/components/nomina/nomina-mobile';

// ── Helpers ────────────────────────────────────────────────────────────────────
type SemanaRegistroDetalle = NominaRegistro & {
  personal?: Personal | null;
  personal_snapshot?: Partial<Personal> | null;
};

const PersonalQuickAssignModal = dynamic(() =>
  import('@/components/nomina/PersonalQuickAssignModal').then((mod) => mod.PersonalQuickAssignModal),
);
const NominaTrabajadorModal = dynamic(() => import('@/components/nomina/NominaTrabajadorModal'));
const NominaCiclosView = dynamic(() =>
  import('@/components/nomina/NominaCiclosView').then((mod) => mod.NominaCiclosView),
);
const NominaCierreMesView = dynamic(() =>
  import('@/components/nomina/NominaCierreMesView').then((mod) => mod.NominaCierreMesView),
);
const NominaVistaPreviaModal = dynamic(() =>
  import('@/components/nomina/NominaVistaPreviaModal').then((mod) => mod.NominaVistaPreviaModal),
);
const NominaArchivoModal = dynamic(() =>
  import('@/components/nomina/NominaArchivoModal').then((mod) => mod.NominaArchivoModal),
);
const NominaImportModal = dynamic(() =>
  import('@/components/nomina/NominaImportModal').then((mod) => mod.NominaImportModal),
);
const RotacionPlantillaSandboxModal = dynamic(() =>
  import('@/components/nomina/RotacionPlantillaSandboxModal').then((mod) => mod.RotacionPlantillaSandboxModal),
);
const LiquidacionDespedidosPanel = dynamic(() =>
  import('@/components/nomina/LiquidacionDespedidosPanel').then((mod) => mod.LiquidacionDespedidosPanel),
);

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, day] = iso.split('-');
  return `${day}/${m}/${y}`;
}

function fmtMoney(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

// ── Avatar Color Generator ─────────────────────────────────────────────────
function getAvatarColor(cargo: string): string {
  const c = (cargo || '').toUpperCase();
  if (c.includes('SUPERVISOR') || c.includes('SUPERVISION') || c.includes('SUPERVISIÓN')) {
    return 'bg-amber-600 border border-amber-500/30';
  }
  if (c.includes('ADMIN')) return 'bg-rose-600 border border-rose-500/30';
  if (c.includes('MINA') || c.includes('MINER') || c.includes('PERFOR') || c.includes('PALA')) return 'bg-amber-600 border border-amber-500/30';
  if (c.includes('PLANT') || c.includes('MOLIN') || c.includes('OPERAD')) return 'bg-emerald-600 border border-emerald-500/30';
  if (c.includes('SEGURID') || c.includes('VIGILAN') || c.includes('SEREN')) return 'bg-blue-600 border border-blue-500/30';
  if (c.includes('MECANIC') || c.includes('ELECTRI') || c.includes('MANTEN')) return 'bg-violet-600 border border-violet-500/30';
  if (c.includes('CHOFER') || c.includes('TRANSPORT') || c.includes('VOLQUE')) return 'bg-pink-600 border border-pink-500/30';
  if (c.includes('COCIN') || c.includes('LIMPIEZ')) return 'bg-teal-600 border border-teal-500/30';
  
  let hash = 0;
  for (let i = 0; i < c.length; i++) {
    hash = c.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    'bg-cyan-600', 'bg-violet-600', 'bg-fuchsia-600', 'bg-indigo-600',
    'bg-rose-600', 'bg-sky-600', 'bg-purple-600', 'bg-slate-600'
  ];
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0]?.[0] || '?').toUpperCase();
}

/**
 * Chip de predicción de rotación. Single source of truth: la posición viene
 * de `posicionEsquemaPersonal` y la etiqueta/rol de `perfil-ciclo-reglas.ts`
 * (las mismas reglas con las que el servidor calcula el pago).
 */
function RotacionPredBadge({
  esquema,
  posicion,
  estadoAsistencia,
}: {
  esquema: string;
  posicion: number | null | undefined;
  estadoAsistencia?: EstadoAsistenciaNomina;
}) {
  let label = posicion != null ? etiquetaEstadoRotacion(esquema, posicion) : null;
  let rol: RolSemana | null = posicion != null ? rolSemanaPorPosicion(esquema, posicion) : null;
  if (!label) {
    rol = estadoAsistencia === 'libre' ? 'libre' : 'trabajada';
    label = estadoAsistencia === 'libre' ? 'Libre (pred.)' : 'Labor (pred.)';
  }
  if (label === 'Libre No Pagada') label = 'Libre $0';
  const tone =
    rol === 'libre'
      ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
      : rol === 'no_laborada'
        ? 'bg-red-500/10 text-red-400 border-red-500/20'
        : 'bg-amber-500/10 text-amber-400 border-amber-500/20';
  return (
    <span className={`px-1.5 py-0.5 rounded border text-[8px] font-bold uppercase ${tone}`}>
      🔄 {label}
    </span>
  );
}

// ── Types ────────────────────────────────────────────────────────────────────
export interface NominaClientProps {
  data: Personal[];
  masterCatalog: Personal[];
  perfilesCompensacion?: PerfilCompensacion[];
  semanas: NominaSemana[];
  area: 'administracion' | 'mina' | 'planta' | 'seguridad' | 'transporte';
  instanciaActiva?: InstanciaActivaSerialized | null;
  rotacionPlantillas?: RotacionPlantillaRecord[];
  rotacionMigrationRequired?: boolean;
}

function recomputePreNominaRow(
  row: PreNominaRowState,
  weekStart: string,
  overrides?: Partial<PreNominaRowState>,
  politicaReposo?: PoliticaReposo | null,
): PreNominaRowState {
  const merged = { ...row, ...overrides };
  const p = merged.personal;
  const cicloPosicion = posicionEsquemaPersonal(p, weekStart);
  const esquemaDiasBloqueados = inputsDiasBloqueados(p.esquema_rotacion, cicloPosicion);
  const fromPlantilla = merged.rotacionFuente === 'plantilla';

  const estadoAsistencia = merged.estadoAsistencia;
  let diasTrabajados = merged.diasTrabajados;

  // La rotación (esquema o plantilla) solo SUGIERE asistencia; la elección
  // explícita del operador manda. Con asistencia «trabajada» los días quedan
  // siempre editables aunque el ciclo prediga semana libre.
  const diasBloqueados =
    fromPlantilla && merged.estatusPlantilla
      ? resolveDiasInputBloqueadoPlantilla(merged.estatusPlantilla, estadoAsistencia)
      : fromPlantilla
        ? Boolean(merged.diasInputBloqueado) && estadoAsistencia !== 'trabajada'
        : esquemaDiasBloqueados && estadoAsistencia !== 'trabajada';

  if (overrides?.estadoAsistencia !== undefined) {
    if (overrides.diasTrabajados !== undefined && !diasBloqueados) {
      diasTrabajados = overrides.diasTrabajados;
    } else if (!diasBloqueados) {
      diasTrabajados = defaultDiasTrabajados(overrides.estadoAsistencia);
    } else if (fromPlantilla) {
      diasTrabajados =
        overrides.estadoAsistencia === 'trabajada'
          ? NOMINA_DIAS_POR_SEMANA
          : overrides.estadoAsistencia === 'no_laborado'
            ? 0
            : defaultDiasTrabajados(overrides.estadoAsistencia);
    } else {
      diasTrabajados = diasTrabajadosPorDefectoCiclo(
        p.esquema_rotacion,
        cicloPosicion,
        overrides.estadoAsistencia,
      );
    }
  } else if (overrides?.diasTrabajados !== undefined && !diasBloqueados) {
    diasTrabajados = overrides.diasTrabajados;
  }

  if (diasBloqueados && !fromPlantilla) {
    diasTrabajados = 0;
  }

  const resolved = resolveEstadoYDias(estadoAsistencia, diasTrabajados);
  const esSemanaBono =
    fromPlantilla &&
    merged.estatusPlantilla != null &&
    esEstatusSemanaBonoTransporte(merged.estatusPlantilla);
  const bonoManual = merged.bonoTransporte;
  const bonificaciones = diasBloqueados && !esSemanaBono ? 0 : merged.bonificaciones;
  const pay =
    fromPlantilla && merged.estatusPlantilla
      ? calculatePayForPlantillaNominaRow({
          estatus: merged.estatusPlantilla,
          personal: p,
          estadoAsistencia: resolved.estadoAsistencia,
          diasTrabajados: resolved.diasTrabajados,
          bonoTransporte: esSemanaBono ? bonoManual || undefined : bonoManual,
          bonificaciones,
          totalVales: merged.totalVales,
        })
      : calculateNominaRowPay({
        personal: p,
        estadoAsistencia: resolved.estadoAsistencia,
        diasTrabajados: resolved.diasTrabajados,
        weekStart,
        bonoTransporte: bonoManual,
        bonificaciones,
        totalVales: merged.totalVales,
      });
  const payEstadoAsistencia =
    fromPlantilla && merged.estatusPlantilla && 'estadoAsistencia' in pay
      ? (pay.estadoAsistencia as EstadoAsistenciaNomina)
      : resolved.estadoAsistencia;

  let salarioBaseCalculado = pay.salarioBaseCalculado;
  let total = pay.total;
  let esSemanaLibre = pay.esSemanaLibre;

  // Reposo (novedad turno): sueldo según condición elegida en la semana.
  if (merged.novedadTurno === 'REPOSO') {
    const cond = merged.reposoCondicion ?? politicaReposo ?? 'SIN_PAGO';
    const diasReposo =
      cond === 'PARCIAL'
        ? Math.max(0, Math.min(NOMINA_DIAS_POR_SEMANA, Math.round(merged.reposoDiasPagados ?? 0)))
        : resolved.diasTrabajados;
    let compensacionReposo = 0;
    if (cond === 'PAGO_UNICO') {
      salarioBaseCalculado = 0;
      compensacionReposo = Number(merged.reposoCompensacionMonto) || 0;
    } else {
      salarioBaseCalculado = aplicarPoliticaReposoSemanal(cond, p, diasReposo);
    }
    esSemanaLibre = false;
    total = Math.max(
      0,
      parseFloat(
        (
          salarioBaseCalculado +
          pay.bonoTransporte +
          bonificaciones +
          compensacionReposo -
          merged.totalVales
        ).toFixed(2),
      ),
    );
  }

  return {
    ...merged,
    estadoAsistencia: payEstadoAsistencia,
    diasTrabajados: resolved.diasTrabajados,
    salarioBaseCalculado,
    bonoTransporte: pay.bonoTransporte,
    bonificaciones,
    esSemanaLibre,
    total,
    deducciones: merged.totalVales,
    cicloPosicion,
    diasInputBloqueado: diasBloqueados,
  };
}


const ICONS = {
  administracion: Briefcase,
  mina: Pickaxe,
  planta: Factory,
  seguridad: Shield,
  transporte: Truck,
};

const TITLES = {
  administracion: 'Nómina Administrativa',
  mina: 'Nómina Mina Belén',
  planta: 'Nómina Molino La Fé',
  seguridad: 'Nómina Seguridad',
  transporte: 'Nómina Transporte',
};

function getCargoTheme(cargo: string): { bg: string; text: string; border: string } {
  const l = (cargo || '').toLowerCase();
  if (l.includes('supervisor') || l.includes('supervisión') || l.includes('supervision')) {
    return { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' };
  }
  if (l.includes('administrativo') || l === 'administración' || l === 'administracion') {
    return { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20' };
  }
  if (l === 'cocina') return { bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-pink-500/20' };
  if (l === 'técnicos' || l === 'tecnicos') {
    return { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/20' };
  }
  if (l.includes('vertical 1') || l.includes('1pd')) return { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20' };
  if (l.includes('vertical 2')) return { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' };
  if (l.includes('cocinera') || l.includes('nurbelis')) return { bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-pink-500/20' };
  if (l.includes('compresor') || l.includes('tecnico')) return { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/20' };
  if (l.includes('grupo') || l.includes('mixto') || l.includes('molino')) return { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' };
  if (l.includes('transporte') || l.includes('fecha')) return { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/20' };
  return { bg: 'bg-zinc-800/10', text: 'text-zinc-400', border: 'border-zinc-700/20' };
}

async function fetchSemanaRegistros(semanaId: string): Promise<{ ok: boolean; data?: any[]; message?: string }> {
  try {
    const res = await fetch(`/api/nomina/semana-registros?semanaId=${encodeURIComponent(semanaId)}`);
    const json = await res.json();
    if (json.ok && json.data) return json;
  } catch (e) {
    console.warn('[NominaClient] Error in /api/nomina/semana-registros, fallback to Server Action:', e);
  }
  return getSemanaRegistrosAction(semanaId);
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function NominaClient({
  data,
  masterCatalog,
  perfilesCompensacion = [],
  semanas: semanasProp = [],
  area,
  instanciaActiva: instanciaActivaProp = null,
  rotacionPlantillas: rotacionPlantillasProp = [],
  rotacionMigrationRequired = false,
}: NominaClientProps) {
  const router = useRouter();
  const revertedWeeksRef = useRef<Set<string>>(new Set());
  const [semanas, setSemanas] = useState<NominaSemana[]>(semanasProp);

  useEffect(() => {
    if (!revertedWeeksRef.current.size) {
      setSemanas(semanasProp);
    } else {
      setSemanas(
        semanasProp.filter(
          (s) =>
            !revertedWeeksRef.current.has(s.id) &&
            !revertedWeeksRef.current.has(`${s.area || area}:${s.semana_inicio}`),
        ),
      );
    }
  }, [semanasProp, area]);

  const [rotacionPlantillas, setRotacionPlantillas] = useState(rotacionPlantillasProp);

  useEffect(() => {
    setRotacionPlantillas(rotacionPlantillasProp);
  }, [rotacionPlantillasProp]);

  const refreshPlantillas = useCallback(async () => {
    const list = await listRotacionPlantillasAction(area);
    setRotacionPlantillas(list);
  }, [area]);
  const confirmDialog = useConfirm();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const canEdit = useCanEdit();
  const biblioteca = useBiblioteca();

  const personalCatalog = useMemo(
    () =>
      (data || []).map((p) => ({
        ...p,
        nombre_completo: formatNombrePropio(p.nombre_completo || ''),
      })),
    [data],
  );

  /** Catálogo maestro (`personal`) — misma fuente que Base de Trabajadores */
  const baseTrabajadores = useMemo(
    () =>
      (masterCatalog || []).map((p) => ({
        ...p,
        nombre_completo: formatNombrePropio(p.nombre_completo || ''),
      })),
    [masterCatalog],
  );

  /** Área + maestro: permite proyectar filas manuales antes de que `data` se actualice tras refresh. */
  const personalCatalogMerged = useMemo(() => {
    const byId = new Map<string, Personal>();
    for (const p of personalCatalog) byId.set(p.id, p);
    for (const p of baseTrabajadores) {
      if (!byId.has(p.id)) byId.set(p.id, p);
    }
    return [...byId.values()];
  }, [personalCatalog, baseTrabajadores]);
  const [rotacionCierreError, setRotacionCierreError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isCerrando, setIsCerrando] = useState(false);
  const [cierreModalError, setCierreModalError] = useState<string | null>(null);

  const instanciaSnapshot = useMemo(
    () => deserializeInstanciaSnapshot(instanciaActivaProp),
    [instanciaActivaProp],
  );

  // State
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignModalPreselectedId, setAssignModalPreselectedId] = useState<string | null>(null);
  const [showExcelPreview, setShowExcelPreview] = useState(false);
  // Import modal (roster / planilla semana)
  const [showImport, setShowImport] = useState(false);
  const [showRotacionSandbox, setShowRotacionSandbox] = useState(false);
  const [sandboxPlantillaId, setSandboxPlantillaId] = useState<string | undefined>();
  const [manualPeriodSession, setManualPeriodSession] = useState<ManualPeriodsSession>(
    emptyManualPeriodsSession,
  );
  const [manualSessionHydrated, setManualSessionHydrated] = useState(false);
  const [consolidatedLockedIds, setConsolidatedLockedIds] = useState<Set<string>>(new Set());
  const [editedConsolidatedPeriodIds, setEditedConsolidatedPeriodIds] = useState<Set<string>>(
    new Set(),
  );
  /** Fuerza relectura del roster manual en localStorage tras asignar trabajador. */
  const [manualRosterTick, setManualRosterTick] = useState(0);
  const [showArchivo, setShowArchivo] = useState(false);
  const [previewInitialRange, setPreviewInitialRange] = useState<NominaPreviewRange | null>(null);
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0);
  const [archivoRefreshKey, setArchivoRefreshKey] = useState(0);
  const [showProcesarModal, setShowProcesarModal] = useState(false);
  const [showBorrarModal, setShowBorrarModal] = useState(false);
  const [showHistorial, setShowHistorial] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<PreNominaRowState | null>(null);
  const [copiedReceipt, setCopiedReceipt] = useState(false);
  const [novedadesManuales, setNovedadesManuales] = useState<NominaNovedadManual[]>([]);
  const [showNovedadModal, setShowNovedadModal] = useState(false);
  const [editingNovedad, setEditingNovedad] = useState<NominaNovedadManual | null>(null);

  // Slide-over Drawer
  const [drawerPersonalId, setDrawerPersonalId] = useState<string | null>(null);
  const [drawerVales, setDrawerVales] = useState<NominaVale[]>([]);
  const [drawerHistorial, setDrawerHistorial] = useState<HistorialPagoRow[]>([]);
  const [loadingDrawer, setLoadingDrawer] = useState(false);
  const [isHistoricalLoading, setIsHistoricalLoading] = useState(false);
  const [newValeMonto, setNewValeMonto] = useState('');
  const [newValeMotivo, setNewValeMotivo] = useState('');
  // Vista activa: Semanal (tradicional), Ciclos (21 días) o Plantillas rotación
  const [viewMode, setViewMode] = useState<'semanal' | 'ciclos' | 'cierre_mes' | 'plantillas' | 'despedidos'>('semanal');

  // Pre-Nómina
  const [preNominaRows, setPreNominaRows] = useState<PreNominaRowState[]>([]);
  const [grupoMixtoRosterProjection, setGrupoMixtoRosterProjection] =
    useState<GrupoMixtoRosterProjection | null>(null);
  const [showProjectionModal, setShowProjectionModal] = useState(false);
  const [selectedProjectionIds, setSelectedProjectionIds] = useState<string[]>([]);
  const proximosPagosValesPorPersonal = useMemo(() => {
    const map: Record<string, number> = {};
    for (const row of preNominaRows) {
      const totalVales =
        Number(row.totalVales) ||
        row.valesPendientes.reduce((sum, vale) => sum + Number(vale.monto), 0);
      if (totalVales > 0) {
        map[row.personal.id] = totalVales;
      }
    }
    return map;
  }, [preNominaRows]);
  // Forms
  const [editItem, setEditItem] = useState<Personal | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    cedula: '', nombre_completo: '', cargo: '', area, area_detalle: '',
    perfil_compensacion_id: '',
    salario_base: '', salario_libre: '', bono_transporte: '', telefono: '', notas: '',
    fecha_nacimiento: '',
    fecha_ingreso: new Date().toISOString().split('T')[0],
    ajuste_antiguedad_dias: '0',
    ubicacion_laboral: '',
    rotacion_estado_referencia_semana: new Date().toISOString().slice(0, 10),
    rotacion_estado_referencia_posicion: '',
    rotacion_inicio_fecha: '',
  });

  const editSelectedPerfil = useMemo(
    () => perfilesCompensacion.find((p) => p.id === form.perfil_compensacion_id) ?? null,
    [perfilesCompensacion, form.perfil_compensacion_id],
  );
  const editPerfilTieneRotacion =
    !!editSelectedPerfil &&
    editSelectedPerfil.esquema_rotacion_default !== 'FIJO_SEMANAL' &&
    editSelectedPerfil.esquema_rotacion_default !== 'MOLINO_FIJO';
  const editRotacionEstadoOptions = useMemo(
    () =>
      editSelectedPerfil
        ? estadoObservadoOpcionesPorEsquema(editSelectedPerfil.esquema_rotacion_default).map((o) => ({
            value: String(o.posicion),
            label: o.label,
          }))
        : [],
    [editSelectedPerfil],
  );
  const editRotacionInicioDeducido = useMemo(() => {
    if (
      !editPerfilTieneRotacion ||
      !editSelectedPerfil ||
      !form.rotacion_estado_referencia_semana ||
      form.rotacion_estado_referencia_posicion === ''
    ) {
      return '';
    }
    return (
      fechaInicioRotacionDesdeEstadoObservado(
        form.rotacion_estado_referencia_semana,
        editSelectedPerfil.esquema_rotacion_default,
        Number(form.rotacion_estado_referencia_posicion),
      ) ?? ''
    );
  }, [
    editPerfilTieneRotacion,
    editSelectedPerfil,
    form.rotacion_estado_referencia_semana,
    form.rotacion_estado_referencia_posicion,
  ]);
  const editUbicacionSugerencias = useMemo(
    () => biblioteca.ubicacionSugerenciasPorArea[area] || [],
    [biblioteca.ubicacionSugerenciasPorArea, area],
  );

  const temporalCtx = useMemo(() => resolveNominaTemporalContext(semanas), [semanas]);

  const [weekRange, setWeekRange] = useState(() => {
    const w = resolveWorkingWeek(semanas);
    return { inicio: w.inicio, fin: w.fin };
  });

  useEffect(() => {
    if (!weekRange.inicio) return;
    setNovedadesManuales(readNovedadesManuales(area, weekRange.inicio));
  }, [area, weekRange.inicio]);

  const handleSaveNovedad = useCallback((item: NominaNovedadManual) => {
    setNovedadesManuales((prev) => {
      const idx = prev.findIndex((n) => n.id === item.id);
      const updated = idx >= 0 ? [...prev.slice(0, idx), item, ...prev.slice(idx + 1)] : [...prev, item];
      writeNovedadesManuales(area, weekRange.inicio, updated);
      return updated;
    });
  }, [area, weekRange.inicio]);

  const handleDeleteNovedad = useCallback((id: string) => {
    setNovedadesManuales((prev) => {
      const updated = prev.filter((n) => n.id !== id);
      writeNovedadesManuales(area, weekRange.inicio, updated);
      return updated;
    });
  }, [area, weekRange.inicio]);

  useEffect(() => {
    setManualPeriodSession(loadManualPeriodsSession(area));
    setManualSessionHydrated(true);
  }, [area]);

  // ── Auto-hidratar período consolidado de la DB ───────────────────────────
  // Si localStorage no tiene un período para la semana actual, busca en la DB
  // un período consolidado manual que cubra esa semana y lo inyecta.
  const dbHydrateAttemptedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!manualSessionHydrated) return;
    // Solo buscar si la sesión local no tiene un período para esta semana
    const localResolved = resolveManualPeriodForWeek(
      manualPeriodSession,
      weekRange.inicio,
      temporalCtx.workingWeekStart,
    );
    if (localResolved) return;
    // Evitar búsquedas repetidas para la misma semana+área
    const attemptKey = `${area}:${weekRange.inicio}`;
    if (dbHydrateAttemptedRef.current === attemptKey) return;
    dbHydrateAttemptedRef.current = attemptKey;

    void findConsolidatedPeriodForWeekAction(area, weekRange.inicio).then((res) => {
      if (!res.ok || !res.periodo) return;
      const dbPeriod = manualPeriodFromPeriodoSummary(res.periodo);
      if (!dbPeriod) return;
      setManualPeriodSession((prev) => {
        // Re-check: otro efecto pudo haber inyectado mientras esperábamos
        const already = resolveManualPeriodForWeek(
          prev,
          weekRange.inicio,
          temporalCtx.workingWeekStart,
        );
        if (already) return prev;
        const next = upsertPeriodInSession(prev, dbPeriod);
        return {
          ...next,
          editorPeriodId: next.editorPeriodId ?? dbPeriod.id,
          historicalPeriodId: dbPeriod.id,
          workingWeekPeriodId: next.workingWeekPeriodId ?? dbPeriod.id,
        };
      });
    }).catch((err) => {
      console.warn('[nomina] Error buscando periodo consolidado:', err);
    });
  }, [
    manualSessionHydrated,
    manualPeriodSession,
    weekRange.inicio,
    temporalCtx.workingWeekStart,
    area,
  ]);

  useEffect(() => {
    if (!manualSessionHydrated) return;
    saveManualPeriodsSession(area, manualPeriodSession);
  }, [manualPeriodSession, area, manualSessionHydrated]);

  useEffect(() => {
    if (area !== 'planta' && area !== 'mina') return;
    const syncWeekStart = getWeekStart();
    const key = `nomina-rotacion-sync:${area}:${syncWeekStart}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    void syncRotacionEstadosLaboralesAction(syncWeekStart).then((res) => {
      if (!res.ok) {
        sessionStorage.removeItem(key);
        console.error('[nomina] Error sincronizando rotación:', res.message);
        return;
      }
      if (res.vacaciones > 0 || res.reactivados > 0) {
        try { router.refresh(); } catch {}
      }
    }).catch((err) => {
      sessionStorage.removeItem(key);
      console.warn('[nomina] Error en syncRotacion Server Action:', err);
    });
  }, [area, router]);

  const handleEditorPeriodChange = useCallback(
    (
      period: ManualNominaPeriod | null,
      meta?: { fromConsolidated?: boolean; resetReconsolidation?: boolean },
    ) => {
      if (!period) {
        setManualPeriodSession((prev) => ({ ...prev, editorPeriodId: null }));
        return;
      }
      setManualPeriodSession((prev) => {
        let next = upsertPeriodInSession(prev, period);
        next = {
          ...next,
          editorPeriodId: period.id,
          historicalPeriodId:
            meta?.fromConsolidated && meta.resetReconsolidation === false
              ? next.historicalPeriodId
              : period.id,
        };
        return next;
      });
      setConsolidatedLockedIds((prev) => {
        const next = new Set(prev);
        if (meta?.fromConsolidated === true) {
          if (meta.resetReconsolidation === false) next.delete(period.id);
          else next.add(period.id);
        } else if (meta?.fromConsolidated === false) {
          next.delete(period.id);
        }
        return next;
      });
    },
    [],
  );

  const handleWorkingWeekPeriodChange = useCallback(
    (periodId: string | null) => {
      setManualPeriodSession((prev) => {
        let session: ManualPeriodsSession = { ...prev, workingWeekPeriodId: periodId };
        if (periodId) {
          const p = getPeriodById(session, periodId);
          if (p) {
            const pl = rotacionPlantillas.find((x) => x.id === p.plantillaId);
            session = upsertPeriodInSession(
              session,
              ensureWorkingWeekInPeriodAssignment(p, temporalCtx.workingWeekStart, pl),
            );
          }
        }
        return session;
      });
    },
    [rotacionPlantillas, temporalCtx.workingWeekStart],
  );

  const handleStartNewPeriod = useCallback(() => {
    setManualPeriodSession((prev) => ({ ...prev, editorPeriodId: null }));
  }, []);

  const handleDeleteDraftPeriod = useCallback(async () => {
    const periodId = manualPeriodSession.editorPeriodId;
    if (!periodId) return;
    const period = getPeriodById(manualPeriodSession, periodId);
    if (!period) return;

    const progress = computeManualPeriodProgress(period, semanas, area);
    const closedNote =
      progress.closedCount > 0
        ? `\n\nTiene ${progress.closedCount} semana(s) ya cerrada(s) en nómina; esas no se borran.`
        : '';
    const label = period.label.trim() || `${period.rangeStart} — ${period.rangeEnd}`;

    if (
      !(await confirmDialog({
        title: 'Descartar ciclo',
        message: `¿Descartar «${label}»?${closedNote}\n\nSe quitará de los ciclos armados y se limpiarán borradores locales.`,
        variant: 'danger',
      }))
    ) {
      return;
    }

    clearLocalDraftsForPeriod(area, period);
    setManualPeriodSession((prev) => removePeriodFromSession(prev, periodId));
    setConsolidatedLockedIds((prev) => {
      const next = new Set(prev);
      next.delete(periodId);
      return next;
    });
    setManualRosterTick((t) => t + 1);
    toast.success('Ciclo descartado');
  }, [manualPeriodSession, semanas, area, confirmDialog]);

  const manualPeriodForView = useMemo(
    () =>
      resolveManualPeriodForWeek(
        manualPeriodSession,
        weekRange.inicio,
        temporalCtx.workingWeekStart,
      ),
    [manualPeriodSession, weekRange.inicio, temporalCtx.workingWeekStart],
  );

  const isManualPeriodWeek = Boolean(manualPeriodForView);
  /** Ciclo manual en semana pasada (histórico). La semana de curso cierra como operativa V3. */
  const isHistoricalManualWeek = isHistoricalManualPeriodWeek(
    weekRange.inicio,
    temporalCtx.workingWeekStart,
    manualPeriodForView,
  );
  const manualPeriodId = manualPeriodForView?.id ?? null;

  const manuallyAddedIdsSet = useMemo(() => {
    const entries = readManualWeekRosterEntries(area, weekRange.inicio, manualPeriodId);
    return new Set(entries.map((e) => e.id));
  }, [area, weekRange.inicio, manualPeriodId, manualRosterTick]);

  const grupoMixtoWorkers = useMemo(() => {
    return personalCatalogMerged.filter(isGrupoMixtoPersonal);
  }, [personalCatalogMerged]);

  const toggleProjectionWorker = useCallback((id: string) => {
    setSelectedProjectionIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const handleApplyProjection = useCallback(() => {
    writeManualWeekRosterEntries(
      area,
      weekRange.inicio,
      selectedProjectionIds.map((id) => ({ id })),
      manualPeriodId,
    );
    markOperationalWeekEmptied(area, weekRange.inicio, true);
    setManualRosterTick((t) => t + 1);
    setShowProjectionModal(false);
    toast.success("Roster proyectado aplicado. Ahora puedes editarlo libremente.");
  }, [area, weekRange.inicio, selectedProjectionIds, manualPeriodId]);


  const novedadDraftKeyForWeek = useCallback(
    (weekStart: string) => nominaNovedadDraftKey(area, weekStart, manualPeriodId),
    [area, manualPeriodId],
  );

  const manualPlantillaActiva = useMemo(() => {
    if (!isManualPeriodWeek || !manualPeriodForView?.plantillaId) return null;
    return rotacionPlantillas.find((p) => p.id === manualPeriodForView.plantillaId) ?? null;
  }, [isManualPeriodWeek, manualPeriodForView, rotacionPlantillas]);

  const operativaPlantilla = useMemo(() => {
    if (isManualPeriodWeek || !instanciaSnapshot || instanciaSnapshot.estado !== 'ACTIVA') {
      return null;
    }
    return rotacionPlantillas.find((p) => p.id === instanciaSnapshot.plantillaId) ?? null;
  }, [isManualPeriodWeek, instanciaSnapshot, rotacionPlantillas]);

  const initRowsGenRef = useRef(0);
  const [procesadoOk, setProcesadoOk] = useState<string | null>(null);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [semanaSheetOpen, setSemanaSheetOpen] = useState(false);

  function handleNominaImported() {
    try { router.refresh(); } catch {}
    setPreviewRefreshKey((k) => k + 1);
    setArchivoRefreshKey((k) => k + 1);
    
    // Para cargas históricas o cualquier importación, ya no alteramos la semana de trabajo
    // del workspace de fondo ni forzamos a que la Vista Previa se inicialice en el rango histórico.
    // La Vista Previa siempre se abrirá mostrando la semana de trabajo actual por defecto,
    // y el usuario podrá buscar periodos anteriores por su respectivo intervalo.
    setPreviewInitialRange(null);
    setShowExcelPreview(true);
  }

  useEffect(() => {
    const tool = searchParams.get('tool');
    if (!tool) return;
    if (tool === 'historico' || tool === 'import') setShowImport(true);
    else if (tool === 'archivo') setShowArchivo(true);
    else if (tool === 'vista') setShowExcelPreview(true);
    router.replace(pathname, { scroll: false });
  }, [searchParams, pathname, router]);

  const politicaReposoFor = useCallback(
    (personal: Personal): PoliticaReposo =>
      perfilesCompensacion.find((pf) => pf.id === personal.perfil_compensacion_id)?.politica_reposo ??
      'SIN_PAGO',
    [perfilesCompensacion],
  );

  const applyWeekDraft = useCallback(
    (
      row: PreNominaRowState,
      weekStart: string,
      draft: ReturnType<typeof readNominaNovedadDraft>[string] | undefined,
    ) =>
      recomputePreNominaRow(
        {
          ...row,
          novedadTurno: parseNovedadTurno(draft?.novedadTurno ?? row.novedadTurno),
          novedadTurnoObs: draft?.novedadTurnoObs ?? row.novedadTurnoObs ?? '',
          reposoCondicion: draft?.reposoCondicion ?? row.reposoCondicion ?? null,
        },
        weekStart,
        weekDraftToRowOverrides(draft),
        politicaReposoFor(row.personal),
      ),
    [politicaReposoFor],
  );

  const buildOperationalNominaRow = useCallback(
    (
      p: Personal,
      weekStart: string,
      valesMap: Record<string, NominaVale[]>,
    ): PreNominaRowState => {
      const rotacion = resolveWorkerRotacionContext(p, instanciaSnapshot, weekStart);
      const predicted = rotacion
        ? rotacion.estadoAsistencia
        : calculateExpectedAttendance(p.esquema_rotacion, p.rotacion_inicio_fecha, weekStart);
      const workerVales = valesMap[p.id] || [];
      const totalVales = workerVales.reduce((s, v) => s + Number(v.monto), 0);
      const cicloPosicion = rotacion ? rotacion.posicionCiclo : posicionEsquemaPersonal(p, weekStart);
      const diasBloqueados = rotacion
        ? resolveDiasInputBloqueadoPlantilla(rotacion.estatus, predicted)
        : inputsDiasBloqueados(p.esquema_rotacion, cicloPosicion);
      const diasTrabajados = rotacion
        ? rotacion.estadoAsistencia === 'trabajada'
          ? NOMINA_DIAS_POR_SEMANA
          : rotacion.estadoAsistencia === 'no_laborado'
            ? 0
            : defaultDiasTrabajados(predicted)
        : diasTrabajadosPorDefectoCiclo(p.esquema_rotacion, cicloPosicion, predicted);
      const pay = calculateNominaRowPay({
        personal: p,
        estadoAsistencia: predicted,
        diasTrabajados,
        weekStart,
        bonificaciones: 0,
        totalVales,
        // El bono de transporte es un componente SEPARADO que se paga
        // solo cuando el usuario lo captura manualmente. No se pasa
        // aquí para que el cálculo automático retorne 0.
      });
      return {
        personal: p,
        esSemanaLibre: pay.esSemanaLibre,
        bonoTransporte: pay.bonoTransporte,
        bonificaciones: 0,
        deducciones: totalVales,
        total: pay.total,
        estadoAsistencia: predicted,
        diasTrabajados,
        salarioBaseCalculado: pay.salarioBaseCalculado,
        valesPendientes: workerVales,
        totalVales,
        novedadTurno: 'ACTIVO',
        novedadTurnoObs: '',
        reposoCondicion: null,
        reposoDiasPagados: 0,
        reposoCompensacionMonto: 0,
        ajusteMotivo: '',
        cicloPosicion,
        diasInputBloqueado: diasBloqueados,
        rotacionFuente: (rotacion ? 'plantilla' : 'legacy') as 'plantilla' | 'legacy',
        cuadrillaNombre: rotacion?.cuadrillaNombre,
        posicionCiclo: rotacion?.posicionCiclo,
        estatusPlantillaLabel: rotacion?.estatusLabel,
        estatusPlantilla: rotacion?.estatus,
      };
    },
    [instanciaSnapshot],
  );

  const appendAssignedWorker = useCallback(
    (personalId: string, areaDetalle: string, createdPersonal?: Personal) => {
      const source =
        createdPersonal ??
        baseTrabajadores.find((p) => p.id === personalId) ??
        personalCatalog.find((p) => p.id === personalId);
      if (!source) return;

      const personal: Personal = {
        ...source,
        area,
        area_detalle: areaDetalle,
        activo: true,
        estatus: 'ACTIVO',
        nombre_completo: formatNombrePropio(source.nombre_completo || ''),
      };

      setPreNominaRows((prev) => {
        try {
          const existingIdx = prev.findIndex((r) => r.personal.id === personalId);
          if (existingIdx >= 0) {
            const updated = prev.map((r) =>
              r.personal.id === personalId
                ? { ...r, personal: { ...r.personal, area_detalle: areaDetalle } }
                : r,
            );
            if (isManualPeriodWeek && manualPlantillaActiva && manualPeriodForView) {
              const rebuilt = buildManualPlantillaNominaRows({
                plantilla: manualPlantillaActiva,
                personalCatalog: updated.map((r) => r.personal),
                personalIds: [personalId],
                weekStart: weekRange.inicio,
                periodStart: manualPeriodForView.rangeStart,
                periodEnd: manualPeriodForView.rangeEnd,
                weekColumnAssignment: manualPeriodForView.weekColumnAssignment,
                weekColumnCuadrillas: manualPeriodForView.weekColumnCuadrillas,
                valesMap: {},
                weekEnd: weekRange.fin,
                forceIncludeIds: [personalId],
              });
              if (rebuilt.length) {
                const weekDraft = readNominaNovedadDraft(
                  novedadDraftKeyForWeek(weekRange.inicio),
                );
                const nextRow = applyWeekDraft(rebuilt[0], weekRange.inicio, weekDraft[personalId]);
                return prev.map((r) => (r.personal.id === personalId ? nextRow : r));
              }
            }
            return updated;
          }

          if (isManualPeriodWeek && manualPlantillaActiva && manualPeriodForView) {
            const built = buildManualPlantillaNominaRows({
              plantilla: manualPlantillaActiva,
              personalCatalog: [personal],
              personalIds: [personalId],
              weekStart: weekRange.inicio,
              periodStart: manualPeriodForView.rangeStart,
              periodEnd: manualPeriodForView.rangeEnd,
              weekColumnAssignment: manualPeriodForView.weekColumnAssignment,
              weekColumnCuadrillas: manualPeriodForView.weekColumnCuadrillas,
              valesMap: {},
              weekEnd: weekRange.fin,
              forceIncludeIds: [personalId],
            });
            if (!built.length) return prev;
            const weekDraft = readNominaNovedadDraft(novedadDraftKeyForWeek(weekRange.inicio));
            return [...prev, applyWeekDraft(built[0], weekRange.inicio, weekDraft[personalId])];
          }

          const weekDraft = readNominaNovedadDraft(novedadDraftKeyForWeek(weekRange.inicio));
          return [
            ...prev,
            applyWeekDraft(
              buildOperationalNominaRow(personal, weekRange.inicio, {}),
              weekRange.inicio,
              weekDraft[personalId],
            ),
          ];
        } catch (err) {
          console.error('[appendAssignedWorker] error adding row, falling back to operational row:', err);
          const weekDraft = readNominaNovedadDraft(novedadDraftKeyForWeek(weekRange.inicio));
          return [
            ...prev,
            applyWeekDraft(
              buildOperationalNominaRow(personal, weekRange.inicio, {}),
              weekRange.inicio,
              weekDraft[personalId],
            ),
          ];
        }
      });
    },
    [
      area,
      baseTrabajadores,
      personalCatalog,
      isManualPeriodWeek,
      manualPlantillaActiva,
      manualPeriodForView,
      weekRange.inicio,
      weekRange.fin,
      buildOperationalNominaRow,
      applyWeekDraft,
      novedadDraftKeyForWeek,
    ],
  );

  // ── Initialize rows with rotation predictions and vales ─────────────────
  useEffect(() => {
    if (!data || !manualSessionHydrated) return;
    const runGen = ++initRowsGenRef.current;
    const initRows = async () => {
      try {
      const currentWeekStart = weekRange.inicio;
      const currentWeekEnd = weekRange.fin;
      let rosterEntries = readManualWeekRosterEntries(
        area,
        currentWeekStart,
        manualPeriodForView?.id,
      );
      let weekRoster = rosterEntries.map((e) => e.id);
      const weekRosterSet = new Set(weekRoster);

      // 1. Semana cerrada: operativa en curso; manual solo en semanas históricas del ciclo
      const closedWeek = resolveClosedSemanaForWeekView(
        manualPeriodForView,
        semanas,
        currentWeekStart,
        temporalCtx.workingWeekStart,
        area,
      );
      if (closedWeek?.id) {
        setIsHistoricalLoading(true);
        try {
          const res = await fetchSemanaRegistros(closedWeek.id);
          if (res.ok && res.data) {
            const rows = (res.data as SemanaRegistroDetalle[]).map((reg) => {
              const snap = reg.personal_snapshot || null;
              const fromCatalog = personalCatalogMerged.find((w) => w.id === reg.personal_id);
              const pRaw = reg.personal || fromCatalog || {
                id: reg.personal_id,
                nombre_completo: snap?.nombre_completo || 'Trabajador no encontrado',
                cedula: snap?.cedula || 'SC-N/A',
                cargo: snap?.cargo || 'General',
                area: snap?.area || area,
                area_detalle: snap?.area_detalle || 'General',
                salario_base: Number(snap?.salario_base) || 0,
                salario_libre: Number(snap?.salario_libre) || 0,
                bono_transporte: Number(snap?.bono_transporte) || 0,
                esquema_rotacion: snap?.esquema_rotacion || 'FIJO_SEMANAL',
                rotacion_inicio_fecha: snap?.rotacion_inicio_fecha || undefined,
                estatus: 'ACTIVO',
                fecha_ingreso: snap?.fecha_ingreso || '',
                activo: false,
                created_at: '',
                updated_at: '',
              };
              const p = {
                ...pRaw,
                nombre_completo: formatNombrePropio(pRaw.nombre_completo || ''),
              } as Personal;
              const estadoAsistencia = (reg.estado_asistencia ||
                (reg.es_semana_libre ? 'libre' : 'trabajada')) as EstadoAsistenciaNomina;
              const diasTrabajados =
                reg.dias_trabajados ??
                (estadoAsistencia === 'no_laborado' ? 0 : NOMINA_DIAS_POR_SEMANA);
              const novedadTurno = parseNovedadTurno(reg.novedad_turno);
              const reposoParsed =
                novedadTurno === 'REPOSO'
                  ? parseReposoCondicionFromObs(String(reg.novedad_turno_obs || ''))
                  : { novedadTurnoObs: String(reg.novedad_turno_obs || '') };
              return {
                personal: p,
                esSemanaLibre: reg.es_semana_libre,
                bonoTransporte: Number(reg.bono_transporte_pagado || 0),
                bonificaciones: 0,
                deducciones: 0,
                total: Number(reg.monto_pagado),
                estadoAsistencia,
                diasTrabajados,
                salarioBaseCalculado: Number(reg.salario_base_calculado || 0),
                valesPendientes: [],
                totalVales: 0,
                novedadTurno,
                novedadTurnoObs: reposoParsed.novedadTurnoObs,
                reposoCondicion: reposoParsed.reposoCondicion ?? null,
                reposoDiasPagados: reposoParsed.reposoDiasPagados ?? 0,
                reposoCompensacionMonto: reposoParsed.reposoCompensacionMonto ?? 0,
                cuadrillaNombre: snap?.cuadrilla_nombre || undefined,
                rotacionFuente: reg.periodo_id ? 'plantilla' : 'legacy',
                cicloPosicion: reg.posicion_en_ciclo ?? null,
                estatusPlantillaLabel: reg.es_semana_libre ? (Number(reg.monto_pagado) === 0 ? 'Libre $0' : 'Libre Pagada') : 'Labor',
                estatusPlantilla: reg.es_semana_libre ? (Number(reg.monto_pagado) === 0 ? 'libre_sin_pago' : 'libre_paga') : 'trabajada_paga',
              };
            });
            if (runGen !== initRowsGenRef.current) return;
            setGrupoMixtoRosterProjection(null);
            setPreNominaRows(rows);
            setIsHistoricalLoading(false);
            return;
          }
        } catch (err) {
          console.error('[initRows] Error loading historical:', err);
        }
        setIsHistoricalLoading(false);
      }

      // 2. Periodo manual activo: solo en semanas históricas del periodo (no la semana de curso)
      if (manualPeriodForView) {
        if (!weekInManualPeriod(currentWeekStart, manualPeriodForView)) {
          if (runGen !== initRowsGenRef.current) return;
          setGrupoMixtoRosterProjection(null);
          setPreNominaRows([]);
          return;
        }

        if (manualPeriodForView.plantillaId) {
          const plantilla = rotacionPlantillas.find((p) => p.id === manualPeriodForView.plantillaId);
          if (plantilla) {
            if (!rosterEntries.length) {
              const prevWeek = previousWeekInManualPeriod(manualPeriodForView, currentWeekStart);
              const prevClosed = prevWeek
                ? resolveClosedSemanaForManualPeriod(
                    manualPeriodForView,
                    semanas,
                    prevWeek,
                    area,
                  )
                : undefined;
              if (prevClosed) {
                try {
                  const prevRes = await fetchSemanaRegistros(prevClosed.id);
                  if (prevRes.ok && prevRes.data?.length) {
                    const carryRows = carryoverRowsFromSemanaRegistros(prevRes.data, area);
                    if (
                      seedManualWeekIfEmpty(
                        area,
                        currentWeekStart,
                        carryRows,
                        manualPeriodForView.id,
                      )
                    ) {
                      rosterEntries = readManualWeekRosterEntries(
                        area,
                        currentWeekStart,
                        manualPeriodForView.id,
                      );
                      weekRoster = rosterEntries.map((e) => e.id);
                    }
                  }
                } catch {
                  /* silent */
                }
              }
            }

            const plantillaIds = plantilla.cuadrillas.flatMap((c) =>
              c.filas.map((f) => f.personalId),
            );
            const personalIds = [...new Set([...plantillaIds, ...weekRoster])];
            const catalogForWeek =
              rosterEntries.length > 0
                ? mergePersonalCatalogWithRosterEntries(
                    personalCatalogMerged,
                    rosterEntries,
                    area,
                  )
                : personalCatalogMerged;
            const valesMap: Record<string, NominaVale[]> = {};
            if (personalIds.length) {
              try {
                const res = await getValesPendientesBulkAction(personalIds);
                if (res.ok && res.data) {
                  res.data.forEach((v) => {
                    if (!valesMap[v.personal_id]) valesMap[v.personal_id] = [];
                    valesMap[v.personal_id].push(v);
                  });
                }
              } catch {
                /* silent */
              }
            }

            const novedadDraft = readNominaNovedadDraft(
              nominaNovedadDraftKey(area, currentWeekStart, manualPeriodForView.id),
            );
            const baseRows = buildManualPlantillaNominaRows({
              plantilla,
              personalCatalog: catalogForWeek.length ? catalogForWeek : personalCatalogMerged,
              personalIds,
              weekStart: currentWeekStart,
              periodStart: manualPeriodForView.rangeStart,
              periodEnd: manualPeriodForView.rangeEnd,
              weekColumnAssignment: manualPeriodForView.weekColumnAssignment,
              weekColumnCuadrillas: manualPeriodForView.weekColumnCuadrillas,
              valesMap,
              weekEnd: currentWeekEnd,
              forceIncludeIds: weekRoster,
            });
            const rows = baseRows.map((row) =>
              applyWeekDraft(row, currentWeekStart, novedadDraft[row.personal.id]),
            );
            if (runGen !== initRowsGenRef.current) return;
            setGrupoMixtoRosterProjection(null);
            setPreNominaRows(rows);
            return;
          }
        }

        if (!rosterEntries.length) {
          const prevWeek = previousWeekInManualPeriod(manualPeriodForView, currentWeekStart);
          const prevClosed = prevWeek
            ? resolveClosedSemanaForManualPeriod(
                manualPeriodForView,
                semanas,
                prevWeek,
                area,
              )
            : undefined;
          if (prevClosed) {
            try {
              const prevRes = await fetchSemanaRegistros(prevClosed.id);
              if (prevRes.ok && prevRes.data?.length) {
                const carryRows = carryoverRowsFromSemanaRegistros(prevRes.data, area);
                if (
                  seedManualWeekIfEmpty(
                    area,
                    currentWeekStart,
                    carryRows,
                    manualPeriodForView.id,
                  )
                ) {
                  rosterEntries = readManualWeekRosterEntries(
                    area,
                    currentWeekStart,
                    manualPeriodForView.id,
                  );
                  weekRoster = rosterEntries.map((e) => e.id);
                }
              }
            } catch {
              /* silent */
            }
          }
        }

        const activeWorkersMap = new Map<string, Personal>();
        for (const p of personalCatalogMerged) {
          if (weekRoster.includes(p.id)) activeWorkersMap.set(p.id, p);
        }
        const manualActiveWorkers = [...activeWorkersMap.values()];

        if (manualActiveWorkers.length === 0) {
          if (runGen !== initRowsGenRef.current) return;
          setGrupoMixtoRosterProjection(null);
          setPreNominaRows([]);
          return;
        }

        const valesMapFallback: Record<string, NominaVale[]> = {};
        const fallbackPersonalIds = manualActiveWorkers.map((p) => p.id);
        try {
          const res = await getValesPendientesBulkAction(fallbackPersonalIds);
          if (res.ok && res.data) {
            res.data.forEach((v) => {
              if (!valesMapFallback[v.personal_id]) valesMapFallback[v.personal_id] = [];
              valesMapFallback[v.personal_id].push(v);
            });
          }
        } catch {
          /* silent */
        }

        const novedadDraftFallback = readNominaNovedadDraft(
          nominaNovedadDraftKey(area, currentWeekStart),
        );
        const fallbackRows = manualActiveWorkers.map((p) =>
          applyWeekDraft(
            buildOperationalNominaRow(p, currentWeekStart, valesMapFallback),
            currentWeekStart,
            novedadDraftFallback[p.id],
          ),
        );

        if (runGen !== initRowsGenRef.current) return;
        setGrupoMixtoRosterProjection(null);
        setPreNominaRows(fallbackRows);
        return;
      }

      // 3. Semana operativa (no cerrada) → roster vigente
      const operationalEmptied =
        !manualPeriodForView && isOperationalWeekEmptied(area, currentWeekStart);

      // Carryover: si no hay roster guardado y la semana no fue vaciada,
      // arrastrar el roster de la semana anterior cerrada en vez de cargar
      // TODO el personal del área.
      let operationalCarryoverIds: string[] | null = null;
      if (!operationalEmptied && !weekRoster.length && !manualPeriodForView) {
        try {
          const prevWeekStart = getWeekStart(
            new Date(Date.parse(currentWeekStart) - 7 * 86400000),
          );
          const prevClosed = semanas.find(
            (s) =>
              s.area === area &&
              s.semana_inicio === prevWeekStart &&
              s.id,
          );
          if (prevClosed) {
            const prevRes = await fetchSemanaRegistros(prevClosed.id);
            if (prevRes.ok && prevRes.data?.length) {
              operationalCarryoverIds = prevRes.data
                .map((r) => r.personal_id)
                .filter(Boolean);
            }
          }
        } catch {
          /* silent — fallback a cargar todos */
        }
      }

      const activeWorkersMap = new Map<string, Personal>();
      if (!operationalEmptied) {
        if (operationalCarryoverIds) {
          // Carryover: solo cargar los trabajadores de la semana anterior
          for (const id of operationalCarryoverIds) {
            const p = personalCatalogMerged.find((row) => row.id === id);
            if (!p) continue;
            if (p.estatus && p.estatus !== 'ACTIVO') continue;
            activeWorkersMap.set(p.id, p);
          }
        } else {
          for (const p of personalCatalog) {
            if (p.estatus && p.estatus !== 'ACTIVO') continue;
            if (
              p.fecha_ingreso &&
              currentWeekEnd &&
              p.fecha_ingreso > currentWeekEnd &&
              !weekRosterSet.has(p.id)
            ) {
              continue;
            }
            activeWorkersMap.set(p.id, p);
          }
        }
      }
      for (const personalId of weekRoster) {
        if (activeWorkersMap.has(personalId)) continue;
        const p = personalCatalogMerged.find((row) => row.id === personalId);
        if (!p) continue;
        if (p.estatus && p.estatus !== 'ACTIVO') continue;
        activeWorkersMap.set(p.id, p);
      }
      let activeWorkers = [...activeWorkersMap.values()];

      let grupoMixtoProjection: GrupoMixtoRosterProjection | null = null;
      if (
        area === 'planta' &&
        !operationalEmptied &&
        activeWorkers.some(isGrupoMixtoPersonal)
      ) {
        let historyWeeks: GrupoMixtoHistoryWeek[] = [];
        try {
          const historyRes = await getGrupoMixtoHistoryWeeksAction(area, currentWeekStart, 12);
          historyWeeks = historyRes.ok
            ? (historyRes.data ?? []).filter((week) => week.registros.length > 0)
            : [];
        } catch {
          historyWeeks = [];
        }

        try {
          grupoMixtoProjection = buildGrupoMixtoRosterProjection({
            activePersonal: activeWorkers,
            targetWeekStart: currentWeekStart,
            historyWeeks,
          });
        } catch (err) {
          console.error('[initRows] Grupo mixto roster projection failed:', err);
          grupoMixtoProjection = null;
        }


      }

      if (activeWorkers.length === 0) {
        if (runGen !== initRowsGenRef.current) return;
        setGrupoMixtoRosterProjection(null);
        setPreNominaRows([]);
        return;
      }

      const personalIds = activeWorkers.map(p => p.id);
      const valesMap: Record<string, NominaVale[]> = {};
      try {
        const res = await getValesPendientesBulkAction(personalIds);
        if (res.ok && res.data) {
          res.data.forEach(v => {
            if (!valesMap[v.personal_id]) valesMap[v.personal_id] = [];
            valesMap[v.personal_id].push(v);
          });
        }
      } catch { /* silent */ }

      const novedadDraft = readNominaNovedadDraft(
        nominaNovedadDraftKey(area, currentWeekStart, null),
      );

      const rows = activeWorkers.map((p) =>
        applyWeekDraft(
          buildOperationalNominaRow(p, currentWeekStart, valesMap),
          currentWeekStart,
          novedadDraft[p.id],
        ),
      );
      if (runGen !== initRowsGenRef.current) return;
      setGrupoMixtoRosterProjection(grupoMixtoProjection?.shouldApply ? grupoMixtoProjection : null);
      setPreNominaRows(rows);
      } catch (err) {
        console.error('[initRows] Failed to initialize weekly roster:', err);
        if (runGen !== initRowsGenRef.current) return;
        setGrupoMixtoRosterProjection(null);
        setPreNominaRows([]);
        setIsHistoricalLoading(false);
      }
    };
    void initRows().catch((err) => {
      console.error('[initRows] Unhandled initialization error:', err);
    });
  }, [
    personalCatalogMerged,
    personalCatalog,
    data,
    weekRange.inicio,
    weekRange.fin,
    semanas,
    area,
    instanciaSnapshot,
    manualPeriodForView,
    rotacionPlantillas,
    temporalCtx.workingWeekStart,
    manualRosterTick,
    manualSessionHydrated,
    buildOperationalNominaRow,
    applyWeekDraft,
  ]);

  useEffect(() => {
    const linked = manualPeriodSession.workingWeekPeriodId;
    if (!linked || weekRange.inicio !== temporalCtx.workingWeekStart) return;
    const ids = preNominaRows.map((r) => r.personal.id).filter(Boolean);
    if (ids.length && manualPeriodId) {
      mergeManualWeekRosterIds(area, weekRange.inicio, ids, manualPeriodId);
    }
  }, [
    manualPeriodSession.workingWeekPeriodId,
    weekRange.inicio,
    temporalCtx.workingWeekStart,
    area,
    preNominaRows,
    manualPeriodId,
  ]);

  const semanaActual = useMemo(
    () =>
      resolveClosedSemanaForWeekView(
        manualPeriodForView,
        semanas,
        weekRange.inicio,
        temporalCtx.workingWeekStart,
        area,
      ),
    [manualPeriodForView, semanas, weekRange.inicio, temporalCtx.workingWeekStart, area],
  );

  const semanaActualCerrada = semanaActual?.id ? semanaActual : undefined;
  const semanaActualProcesada = Boolean(semanaActualCerrada);

  useEffect(() => {
    if (
      !instanciaSnapshot ||
      semanaActualProcesada ||
      preNominaRows.length === 0 ||
      isHistoricalManualWeek
    ) {
      setRotacionCierreError(null);
      return;
    }
    let cancelled = false;
    const rows = preNominaRows.map((r) => ({
      personalId: r.personal.id,
      total: r.total,
      bonoTransporte: r.bonoTransporte,
      diasTrabajados: r.diasTrabajados,
    }));
    validarCierreRotacionSemanalAction({
      area,
      semanaInicio: weekRange.inicio,
      semanaFin: weekRange.fin,
      rows,
    })
      .then((res) => {
        if (cancelled) return;
        setRotacionCierreError(res.ok ? null : res.message);
      })
      .catch((err) => {
        console.warn('[NominaClient] Error comprobando rotación:', err);
        if (cancelled) return;
        setRotacionCierreError(null);
      });
    return () => {
      cancelled = true;
    };
  }, [
    instanciaSnapshot,
    semanaActualProcesada,
    preNominaRows,
    area,
    weekRange.inicio,
    weekRange.fin,
    isHistoricalManualWeek,
  ]);

  // ── Live Calculation Engine ──────────────────────────────────────────────
  const applyRowPatch = useCallback(
    (row: PreNominaRowState, fields: Partial<PreNominaRowState>): Partial<PreNominaRowState> => {
      if (fields.estadoAsistencia !== undefined && fields.novedadTurno === undefined) {
        return { ...patchAlCambiarAsistencia(fields.estadoAsistencia), ...fields };
      }
      if (fields.novedadTurno !== undefined) {
        return { ...patchAlMarcarNovedadTurno(row, fields.novedadTurno), ...fields };
      }
      return fields;
    },
    [],
  );

  const handleUpdateRow = (personalId: string, fields: Partial<PreNominaRowState>) => {
    setPreNominaRows((prev) => {
      const next = prev.map((row) => {
        if (row.personal.id !== personalId) return row;
        const patch = applyRowPatch(row, fields);
        return recomputePreNominaRow(
          row,
          weekRange.inicio,
          patch,
          politicaReposoFor(row.personal),
        );
      });
      if (!semanaActualProcesada) {
        writeNominaNovedadDraft(
          novedadDraftKeyForWeek(weekRange.inicio),
          Object.fromEntries(next.map((r) => [r.personal.id, preNominaRowToWeekDraft(r)])),
        );
      }
      return next;
    });
  };

  const subtotalFilas = useMemo(() => preNominaRows.reduce((s, r) => s + r.total, 0), [preNominaRows]);
  const subtotalNovedades = useMemo(() => totalNovedadesManuales(novedadesManuales), [novedadesManuales]);
  const totalSemana = useMemo(() => subtotalFilas + subtotalNovedades, [subtotalFilas, subtotalNovedades]);
  const distribucion = useNominaDivisionesConfig(totalSemana);
  const semanaActualCerradaId = semanaActualCerrada?.id;
  const applyDistribucionPlantilla = distribucion.applyPlantilla;

  const novedadesTurnoSemana = useMemo(
    () =>
      preNominaRows.filter((r) => hasNovedadTurno(r.novedadTurno, r.novedadTurnoObs)),
    [preNominaRows],
  );

  const novedadPagoUnicoTotal = useMemo(
    () => preNominaRows.reduce((s, r) => s + reposoPagoUnicoMontoFromRow(r), 0),
    [preNominaRows],
  );

  useEffect(() => {
    if (!semanaActualCerradaId) return;
    getSemanaCierreAction(semanaActualCerradaId).then((res) => {
      if (res.ok && res.data) {
        applyDistribucionPlantilla(distribucionFromCierreLegacy(res.data));
      }
    });
  }, [semanaActualCerradaId, applyDistribucionPlantilla]);

  // Week-over-week comparison
  const prevSemana = semanas.length >= 2 ? semanas.find(s => s.semana_inicio < weekRange.inicio) : null;
  const weekDelta = prevSemana ? totalSemana - Number(prevSemana.total_pagado) : 0;
  const weekDeltaPct = prevSemana && Number(prevSemana.total_pagado) > 0
    ? ((weekDelta / Number(prevSemana.total_pagado)) * 100)
    : 0;

  const IconComponent = ICONS[area];
  const pageTitle = TITLES[area];
  const assignedIds = useMemo(
    () => new Set(preNominaRows.map((r) => r.personal.id)),
    [preNominaRows],
  );
  const currentAssignments = useMemo(
    () => Object.fromEntries(preNominaRows.map((r) => [r.personal.id, r.personal.area_detalle])),
    [preNominaRows],
  );

  // Filter & Group
  const filteredRows = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return preNominaRows;
    return preNominaRows.filter(r => r.personal.nombre_completo.toLowerCase().includes(q) || (r.personal.cedula && r.personal.cedula.includes(q)));
  }, [preNominaRows, search]);

  const groupRowsByPlantillaCuadrillas = useCallback(
    (
      plantilla: RotacionPlantillaRecord,
      cuadrillaOrder: string[],
    ): Record<string, PreNominaRowState[]> => {
      const groups: Record<string, PreNominaRowState[]> = {};
      const assigned = new Set<string>();
      for (const nombre of cuadrillaOrder) {
        groups[nombre] = [];
        for (const row of filteredRows) {
          if (assigned.has(row.personal.id)) continue;
          if (nominaRowBelongsToCuadrilla(row, nombre, plantilla)) {
            groups[nombre].push(row);
            assigned.add(row.personal.id);
          }
        }
      }
      const orphans = filteredRows.filter((r) => !assigned.has(r.personal.id));
      for (const row of orphans) {
        const grupo = row.cuadrillaNombre?.trim() || getGrupoNominaKey(row.personal);
        if (!groups[grupo]) groups[grupo] = [];
        groups[grupo].push(row);
      }
      return groups;
    },
    [filteredRows],
  );

  const groupedRows = useMemo(() => {
    if (manualPlantillaActiva && isManualPeriodWeek && !semanaActualProcesada && manualPeriodForView) {
      const activeIds = resolveActiveCuadrillaIdsForWeek(
        manualPeriodForView,
        weekRange.inicio,
        manualPlantillaActiva,
      );
      return groupRowsByPlantillaCuadrillas(
        manualPlantillaActiva,
        manualPlantillaCuadrillaOrderForWeek(manualPlantillaActiva, activeIds),
      );
    }
    if (operativaPlantilla && instanciaSnapshot && !semanaActualProcesada && !isManualPeriodWeek) {
      const activeIds = instanciaSnapshot.cuadrillas
        .filter((c) => c.estado === 'ACTIVA')
        .map((c) => c.cuadrillaId);
      const order = manualPlantillaCuadrillaOrder(operativaPlantilla).filter((nombre) => {
        const c = operativaPlantilla.cuadrillas.find((x) => x.nombre === nombre);
        return c && activeIds.includes(c.id);
      });
      if (order.length) {
        return groupRowsByPlantillaCuadrillas(operativaPlantilla, order);
      }
    }
    const groups: Record<string, PreNominaRowState[]> = {};
    filteredRows.forEach((row) => {
      const grupo = getGrupoNominaKey(row.personal);
      if (!groups[grupo]) groups[grupo] = [];
      groups[grupo].push(row);
    });
    const ordered: Record<string, PreNominaRowState[]> = {};
    for (const key of ASIGNACION_NOMINA_OPCIONES) {
      if (groups[key]) ordered[key] = groups[key];
    }
    Object.keys(groups)
      .filter((key) => !(ASIGNACION_NOMINA_OPCIONES as readonly string[]).includes(key))
      .sort((a, b) => {
        if (a === 'Sin asignación') return 1;
        if (b === 'Sin asignación') return -1;
        return a.localeCompare(b, 'es');
      })
      .forEach((key) => {
        ordered[key] = groups[key];
      });
    return ordered;
  }, [
    filteredRows,
    manualPlantillaActiva,
    isManualPeriodWeek,
    semanaActualProcesada,
    manualPeriodForView,
    weekRange.inicio,
    operativaPlantilla,
    instanciaSnapshot,
    groupRowsByPlantillaCuadrillas,
  ]);

  const nominaExportRows = useMemo((): NominaSemanaExportRow[] => {
    return preNominaRows.map((row) => ({
      personal: {
        nombre_completo: row.personal.nombre_completo,
        cedula: row.personal.cedula,
        cargo: row.personal.cargo,
        area_detalle: row.personal.area_detalle,
      },
      estadoAsistencia: row.estadoAsistencia,
      diasTrabajados: row.diasTrabajados,
      novedadTurno: row.novedadTurno,
      novedadTurnoObs: row.novedadTurnoObs,
      reposoCondicion: row.reposoCondicion,
      reposoDiasPagados: row.reposoDiasPagados,
      salarioBaseCalculado: row.salarioBaseCalculado,
      bonoTransporte: row.bonoTransporte,
      bonificaciones: row.bonificaciones,
      deducciones: row.deducciones,
      totalVales: row.totalVales,
      total: row.total,
    }));
  }, [preNominaRows]);

  const nominaExportMeta = useMemo(
    () => ({
      area,
      areaLabel: pageTitle,
      weekStart: weekRange.inicio,
      weekEnd: weekRange.fin,
      cerrada: semanaActualProcesada,
      workerCount: preNominaRows.length,
      totalSemana,
    }),
    [area, pageTitle, weekRange.inicio, weekRange.fin, semanaActualProcesada, preNominaRows.length, totalSemana],
  );

  const previewActiveRegistros = useMemo((): NominaRegistroCerrado[] => {
    return preNominaRows.map((row) => {
      const cuadrillaNombre = row.cuadrillaNombre?.trim() || null;
      const cuadrillaId =
        manualPlantillaActiva?.cuadrillas.find((c) => c.nombre === cuadrillaNombre)?.id ?? null;
      return {
        personal_id: row.personal.id,
        semana_inicio: weekRange.inicio,
        area: area,
        monto_pagado: row.total,
        es_semana_libre: row.esSemanaLibre,
        estado_asistencia: row.estadoAsistencia,
        dias_trabajados: row.diasTrabajados,
        salario_base_calculado: row.salarioBaseCalculado,
        novedad_turno: row.novedadTurno ?? null,
        novedad_turno_obs: row.novedadTurnoObs,
        personal_snapshot: buildPersonalSnapshot(
          row.personal,
          cuadrillaNombre || cuadrillaId
            ? {
                cuadrillaId,
                cuadrillaNombre,
                plantillaArea:
                  manualPlantillaActiva?.area ?? (area === 'planta' ? 'planta' : 'mina'),
              }
            : undefined,
        ),
        periodo_id: null,
      };
    });
  }, [preNominaRows, weekRange.inicio, area, manualPlantillaActiva]);

  const previewManualPeriod = useMemo((): ManualPeriodPlantillaContext | undefined => {
    if (!manualPeriodForView) return undefined;
    return {
      rangeStart: manualPeriodForView.rangeStart,
      rangeEnd: manualPeriodForView.rangeEnd,
      weekColumnAssignment: manualPeriodForView.weekColumnAssignment,
      weekColumnCuadrillas: manualPeriodForView.weekColumnCuadrillas,
      weekColumnCuadrillaNombres: manualPeriodForView.weekColumnCuadrillaNombres,
    };
  }, [manualPeriodForView]);

  const previewDefaultRange = useMemo((): NominaPreviewRange => {
    if (previewInitialRange) return previewInitialRange;
    const editor = getEditorPeriod(manualPeriodSession);
    if (
      editor?.periodoArchivoId &&
      editor.rangeStart &&
      editor.rangeEnd &&
      weekInManualPeriod(weekRange.inicio, editor)
    ) {
      return { start: editor.rangeStart, end: editor.rangeEnd };
    }
    return { start: weekRange.inicio, end: weekRange.fin };
  }, [
    previewInitialRange,
    manualPeriodSession,
    weekRange.inicio,
    weekRange.fin,
  ]);

  // ── CSV Export ──────────────────────────────────────────────────────────
  const handleExportCSV = useCallback(() => {
    downloadNominaSemanaCsv(nominaExportRows, nominaExportMeta);
  }, [nominaExportRows, nominaExportMeta]);


  // ── WhatsApp receipt copy ──────────────────────────────────────────────
  const copyReceiptToClipboard = useCallback((row: PreNominaRowState) => {
      const p = row.personal;
      const baseSal = row.salarioBaseCalculado;
      const diasHint =
        row.diasTrabajados < NOMINA_DIAS_POR_SEMANA
          ? ` (${row.diasTrabajados}/${NOMINA_DIAS_POR_SEMANA} días)`
          : '';
    const text = [
      `📋 *COMPROBANTE DE PAGO*`,
      `━━━━━━━━━━━━━━━━━━`,
      `👷 *${p.nombre_completo}*`,
      `📄 C.I. ${p.cedula}`,
      `🏗 Cargo: ${p.cargo}`,
      `📅 Periodo: ${fmtDate(weekRange.inicio)} al ${fmtDate(weekRange.fin)}`,
      ``,
      `💰 Sueldo ${row.estadoAsistencia === 'libre' ? 'Libre' : row.estadoAsistencia === 'no_laborado' ? 'Sin labor' : 'Labor'}${diasHint}: ${fmtMoney(baseSal)}`,
      row.bonoTransporte > 0 ? `🚌 Bono Transporte: +${fmtMoney(row.bonoTransporte)}` : null,
      row.bonificaciones > 0 ? `⭐ Bonificaciones: +${fmtMoney(row.bonificaciones)}` : null,
      row.totalVales > 0 ? `📝 Vales/Adelantos: -${fmtMoney(row.totalVales)}` : null,
      ``,
      `━━━━━━━━━━━━━━━━━━`,
      `✅ *TOTAL NETO: ${fmtMoney(row.total)}*`,
      ``,
      `_Molinos La Fé - Mina Belén_`,
      `_Complejo Operativo El Callao_`,
    ].filter(Boolean).join('\n');
    navigator.clipboard.writeText(text);
    setCopiedReceipt(true);
    setTimeout(() => setCopiedReceipt(false), 2000);
  }, [weekRange]);

  // ── Drawer ─────────────────────────────────────────────────────────────
  const openDrawer = useCallback(async (personalId: string) => {
    setDrawerPersonalId(personalId);
    setLoadingDrawer(true);
    setNewValeMonto(''); setNewValeMotivo('');
    try {
      const [valesRes, historialRes] = await Promise.all([
        getValesPendientesBulkAction([personalId]),
        getHistorialPagosAction(personalId, 10),
      ]);
      setDrawerVales(valesRes.ok && valesRes.data ? valesRes.data : []);
      setDrawerHistorial(historialRes.ok && historialRes.data ? historialRes.data : []);
    } catch { setDrawerVales([]); setDrawerHistorial([]); }
    setLoadingDrawer(false);
  }, []);

  const handleAddVale = useCallback(async () => {
    if (!drawerPersonalId || !newValeMonto) return;
    try {
      await crearValeAction(drawerPersonalId, Number(newValeMonto), newValeMotivo || 'Adelanto');
      await registrarAuditAction('CREAR_VALE', 'nomina_vales', drawerPersonalId, `Monto: $${newValeMonto} - ${newValeMotivo || 'Adelanto'}`, user?.id, user?.email);
      const vRes = await getValesPendientesBulkAction([drawerPersonalId]);
      const newVales = vRes.ok && vRes.data ? vRes.data : [];
      setDrawerVales(newVales); setNewValeMonto(''); setNewValeMotivo('');
      const totalVales = newVales.reduce((s, v) => s + Number(v.monto), 0);
      setPreNominaRows((prev) =>
        prev.map((row) =>
          row.personal.id !== drawerPersonalId
            ? row
            : recomputePreNominaRow(row, weekRange.inicio, {
                valesPendientes: newVales,
                totalVales,
              }),
        ),
      );
    } catch (err: any) {
      console.error('[handleAddVale] error:', err);
      toastError(err?.message || 'Error al agregar vale');
    }
  }, [drawerPersonalId, newValeMonto, newValeMotivo, user, weekRange.inicio]);

  const handleDeleteVale = useCallback(async (valeId: string) => {
    if (!drawerPersonalId) return;
    try {
      await eliminarValeAction(valeId);
      await registrarAuditAction('ELIMINAR_VALE', 'nomina_vales', valeId, `Eliminado por ${user?.email}`, user?.id, user?.email);
      const vRes = await getValesPendientesBulkAction([drawerPersonalId]);
      const newVales = vRes.ok && vRes.data ? vRes.data : [];
      setDrawerVales(newVales);
      const totalVales = newVales.reduce((s, v) => s + Number(v.monto), 0);
      setPreNominaRows((prev) =>
        prev.map((row) =>
          row.personal.id !== drawerPersonalId
            ? row
            : recomputePreNominaRow(row, weekRange.inicio, {
                valesPendientes: newVales,
                totalVales,
              }),
        ),
      );
    } catch (err: any) {
      console.error('[handleDeleteVale] error:', err);
      toastError(err?.message || 'Error al eliminar vale');
    }
  }, [drawerPersonalId, user, weekRange.inicio]);

  const drawerRow = useMemo(() => {
    if (!drawerPersonalId) return null;
    return preNominaRows.find(r => r.personal.id === drawerPersonalId) || null;
  }, [drawerPersonalId, preNominaRows]);

  // ── Actions ────────────────────────────────────────────────────────────
  function openEdit(item: Personal) {
    setEditItem(item);
    const asignacion = item.area_detalle || '';
    setForm({
      cedula: item.cedula,
      nombre_completo: item.nombre_completo,
      cargo: item.cargo,
      area: item.area as typeof area,
      area_detalle: isAsignacionNominaValid(asignacion) ? asignacion : '',
      perfil_compensacion_id: item.perfil_compensacion_id || '',
      salario_base: String(item.salario_base),
      salario_libre: String(item.salario_libre || ''),
      bono_transporte: String(item.bono_transporte || ''),
      telefono: item.telefono || '',
      notas: item.notas || '',
      fecha_nacimiento: item.fecha_nacimiento || '',
      fecha_ingreso: item.fecha_ingreso || new Date().toISOString().split('T')[0],
      ajuste_antiguedad_dias: String(item.ajuste_antiguedad_dias ?? 0),
      ubicacion_laboral: item.ubicacion_laboral || '',
      rotacion_estado_referencia_semana: new Date().toISOString().slice(0, 10),
      rotacion_estado_referencia_posicion: '',
      rotacion_inicio_fecha: item.rotacion_inicio_fecha || '',
    });
    setFormError(null);
    setShowModal(true);
  }

  function resetForm() {
    setEditItem(null);
    setForm({
      cedula: '',
      nombre_completo: '',
      cargo: '',
      area,
      area_detalle: '',
      perfil_compensacion_id: '',
      salario_base: '',
      salario_libre: '',
      bono_transporte: '',
      telefono: '',
      notas: '',
      fecha_nacimiento: '',
      fecha_ingreso: new Date().toISOString().split('T')[0],
      ajuste_antiguedad_dias: '0',
      ubicacion_laboral: biblioteca.ubicacionDefaultPorArea[area] || '',
      rotacion_estado_referencia_semana: new Date().toISOString().slice(0, 10),
      rotacion_estado_referencia_posicion: '',
      rotacion_inicio_fecha: '',
    });
    setFormError(null);
  }

  async function handleSave() {
    setFormError(null);
    if (!form.perfil_compensacion_id) {
      setFormError('Selecciona un perfil de compensación.');
      return;
    }
    try {
      const res = await upsertPersonalV3Action({
        id: editItem?.id,
        cedula: form.cedula,
        nombre_completo: form.nombre_completo,
        cargo: form.cargo,
        area,
        area_detalle: form.area_detalle,
        perfil_compensacion_id: form.perfil_compensacion_id,
        salario_base: Number(form.salario_base) || 0,
        salario_libre: Number(form.salario_libre) || 0,
        bono_transporte: Number(form.bono_transporte) || 0,
        telefono: form.telefono,
        notas: form.notas,
        fecha_nacimiento: form.fecha_nacimiento || null,
        fecha_ingreso: form.fecha_ingreso,
        ajuste_antiguedad_dias: Number(form.ajuste_antiguedad_dias || 0),
        ubicacion_laboral: form.ubicacion_laboral,
        rotacion_inicio_fecha: editRotacionInicioDeducido || form.rotacion_inicio_fecha || null,
        rotacion_estado_referencia_semana: form.rotacion_estado_referencia_semana || null,
        rotacion_estado_referencia_posicion:
          form.rotacion_estado_referencia_posicion === ''
            ? null
            : Number(form.rotacion_estado_referencia_posicion),
      });

      if (!res.ok) {
        setFormError(res.message);
        return;
      }

      await registrarAuditAction(
        editItem ? 'EDITAR_PERSONAL' : 'CREAR_PERSONAL',
        'personal',
        editItem?.id || form.cedula,
        `${form.nombre_completo} - ${form.cargo}`,
        user?.id,
        user?.email,
      );

      const targetId = editItem?.id || (res.data?.id as string | undefined);
      if (editItem && targetId) {
        setPreNominaRows((prev) =>
          prev.map((row) => {
            if (row.personal.id !== targetId) return row;
            const updatedPersonal: Personal = {
              ...row.personal,
              cedula: form.cedula,
              nombre_completo: form.nombre_completo,
              cargo: form.cargo,
              area: area as any,
              area_detalle: form.area_detalle,
              perfil_compensacion_id: form.perfil_compensacion_id,
              salario_base: Number(form.salario_base) || 0,
              salario_libre: Number(form.salario_libre) || 0,
              bono_transporte: Number(form.bono_transporte) || 0,
              telefono: form.telefono,
              notas: form.notas,
              fecha_nacimiento: form.fecha_nacimiento || null,
              fecha_ingreso: form.fecha_ingreso,
              ajuste_antiguedad_dias: Number(form.ajuste_antiguedad_dias || 0),
              ubicacion_laboral: form.ubicacion_laboral,
              rotacion_inicio_fecha:
                editRotacionInicioDeducido ||
                form.rotacion_inicio_fecha ||
                row.personal.rotacion_inicio_fecha,
            };
            return recomputePreNominaRow(row, weekRange.inicio, {
              personal: updatedPersonal,
            });
          }),
        );
      } else if (targetId) {
        const newPersonal: Personal = {
          id: targetId,
          cedula: form.cedula,
          nombre_completo: form.nombre_completo,
          cargo: form.cargo,
          area: area as any,
          area_detalle: form.area_detalle,
          perfil_compensacion_id: form.perfil_compensacion_id,
          salario_base: Number(form.salario_base) || 0,
          salario_libre: Number(form.salario_libre) || 0,
          bono_transporte: Number(form.bono_transporte) || 0,
          telefono: form.telefono,
          notas: form.notas,
          fecha_nacimiento: form.fecha_nacimiento || null,
          fecha_ingreso: form.fecha_ingreso,
          ajuste_antiguedad_dias: Number(form.ajuste_antiguedad_dias || 0),
          ubicacion_laboral: form.ubicacion_laboral,
          rotacion_inicio_fecha: form.rotacion_inicio_fecha,
          esquema_rotacion: 'FIJO_SEMANAL',
          estatus: 'ACTIVO',
          activo: true,
          estado_laboral: 'ACTIVO',
        };
        const newRow = buildOperationalNominaRow(newPersonal, weekRange.inicio, {});
        setPreNominaRows((prev) => [...prev, newRow]);
      }

      toast.success(editItem ? 'Trabajador actualizado exitosamente' : 'Trabajador creado exitosamente');
      setShowModal(false);
      resetForm();
    } catch (err: any) {
      console.error('[handleSave] error:', err);
      setFormError(err?.message || 'Error al guardar los cambios.');
    }
  }

  function openAssignForReassign(personalId: string) {
    setAssignModalPreselectedId(personalId);
    setShowAssignModal(true);
  }

  async function handleDelete(id: string) {
    const isManuallyAdded = manuallyAddedIdsSet.has(id);

    if (isManuallyAdded) {
      if (!(await confirmDialog({
        title: 'Quitar de la semana',
        message: '¿Quitar este trabajador de la planilla de esta semana? (Seguirá activo en la base de datos)',
        variant: 'warning'
      }))) return;

      setPreNominaRows(prev => prev.filter(row => row.personal.id !== id));
      removeFromManualWeekRoster(area, weekRange.inicio, id, manualPeriodId);
      setManualRosterTick(t => t + 1);
      toast.success('Trabajador removido de esta semana.');
      return;
    }

    if (!(await confirmDialog({
      title: 'Desactivar trabajador',
      message: '¿Desactivar este trabajador del sistema? (Baja definitiva)',
      variant: 'danger'
    }))) return;
    
    // Optimistic update: remover fila inmediatamente del estado local
    setPreNominaRows(prev => prev.filter(row => row.personal.id !== id));
    removeFromManualWeekRoster(area, weekRange.inicio, id, manualPeriodId);
    setManualRosterTick(t => t + 1);
    
    try {
      await updatePersonalEstatusAction(id, 'INACTIVO');
      await registrarAuditAction('DESACTIVAR_PERSONAL', 'personal', id, `Desactivado por ${user?.email}`, user?.id, user?.email);
      toast.success('Trabajador desactivado.');
    } catch (err) {
      console.error('[handleDelete] error:', err);
    }
  }

  async function handleProcesarNomina() {
    setCierreModalError(null);
    if (preNominaRows.length === 0) {
      const msg = 'No hay trabajadores activos en la pre-nómina.';
      setCierreModalError(msg);
      toastError(msg);
      return;
    }
    if (!distribucion.validation.ok) {
      const msg = distribucion.validation.message ?? 'Revisa la distribución de pagos.';
      setCierreModalError(msg);
      toastError(msg);
      return;
    }

    if (semanaActualCerrada && !(await confirmDialog({
      title: 'Sobreescribir nómina',
      message: 'La semana ya fue procesada. ¿Deseas sobreescribirla?',
      variant: 'warning'
    }))) return;

    const closedWeekInicio = weekRange.inicio;
    const closedWeekFin = weekRange.fin;
    const closedWasWorkingWeek =
      closedWeekInicio === temporalCtx.workingWeekStart && !isHistoricalManualWeek;
    const closedWasHistoricalManual = isHistoricalManualWeek || Boolean(manualPeriodForView);
    setProcesadoOk(null);
    setIsCerrando(true);

    try {
      const formattedRows = preNominaRows.map((r) => {
        const estadoAsistencia =
          r.estadoAsistencia ?? (r.esSemanaLibre ? ('libre' as const) : ('trabajada' as const));
        return {
          personalId: r.personal.id,
          estadoAsistencia,
          diasTrabajados: Number(r.diasTrabajados) ?? defaultDiasTrabajados(estadoAsistencia),
          total: Math.max(0, Number(r.total) || 0),
          bonoTransporte: Math.max(0, Number(r.bonoTransporte) || 0),
          bonificaciones: Math.max(0, Number(r.bonificaciones) || 0),
          totalVales: Math.max(0, Number(r.totalVales) || 0),
          novedadTurno: r.novedadTurno || 'ACTIVO',
          novedadTurnoObs: r.novedadTurnoObs || '',
          esSemanaLibre: Boolean(r.esSemanaLibre),
          salarioBaseCalculado: Number.isFinite(Number(r.salarioBaseCalculado))
            ? Number(r.salarioBaseCalculado)
            : undefined,
          reposoCondicion: r.reposoCondicion ?? null,
          reposoDiasPagados: Number(r.reposoDiasPagados) || 0,
          reposoCompensacionMonto: Number(r.reposoCompensacionMonto) || 0,
          ajusteMotivo: r.ajusteMotivo?.trim() || undefined,
          estatusPlantilla: r.estatusPlantilla,
          cuadrillaId:
            manualPlantillaActiva?.cuadrillas.find((c) => c.nombre === r.cuadrillaNombre)?.id ||
            undefined,
          cuadrillaNombre: r.cuadrillaNombre?.trim() || undefined,
          posicionCiclo: Number.isInteger(r.cicloPosicion) ? r.cicloPosicion : null,
        };
      });

      const formattedDistribucion = (distribucion.partes || []).map((p) => ({
        id: p.id,
        nombre: p.nombre,
        porcentaje: Number(p.porcentaje) || 0,
        pagoDirecto: Math.max(0, Number(p.pagoDirecto) || 0),
      }));

      const payloadModoCierre = manualPeriodForView ? 'historico_manual' : 'operativo';
      const payloadPeriodoManual = manualPeriodForView
        ? {
            label: manualPeriodForView.label,
            rangeStart: manualPeriodForView.rangeStart,
            rangeEnd: manualPeriodForView.rangeEnd,
            plantillaId: manualPeriodForView.plantillaId || undefined,
          }
        : undefined;

      const response = await fetch('/api/nomina/cierre', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          area,
          inicio: weekRange.inicio,
          fin: weekRange.fin,
          rows: formattedRows,
          distribucion: formattedDistribucion,
          modoCierre: payloadModoCierre,
          periodoManual: payloadPeriodoManual,
        }),
      });

      const res = await response.json();

      if (res.ok) {
        try {
          localStorage.removeItem(novedadDraftKeyForWeek(weekRange.inicio));
          clearManualWeekRoster(area, weekRange.inicio, manualPeriodId);
          if (isManualPeriodWeek && manualPeriodForView) {
            const closeData = res.data as { semanaId?: string; periodoId?: string } | undefined;
            const closedSemanaId = closeData?.semanaId ?? semanaActualCerrada?.id;
            if (closedSemanaId) {
              setManualPeriodSession((prev) => {
                const periodId =
                  prev.editorPeriodId ??
                  prev.workingWeekPeriodId ??
                  manualPeriodForView.id;
                const period = getPeriodById(prev, periodId);
                if (!period) return prev;
                return upsertPeriodInSession(
                  prev,
                  attachSemanaToManualPeriod(
                    period,
                    closedSemanaId,
                    closeData?.periodoId,
                  ),
                );
              });
            }
            const carryRows: ManualWeekCarryoverRow[] = preNominaRows.map((r) => ({
              personal: {
                id: r.personal.id,
                area_detalle: r.personal.area_detalle,
              },
              novedadTurno: r.novedadTurno,
              novedadTurnoObs: r.novedadTurnoObs,
              reposoCondicion: r.reposoCondicion ?? null,
              reposoDiasPagados: r.reposoDiasPagados ?? 0,
              reposoCompensacionMonto: r.reposoCompensacionMonto ?? 0,
              estadoAsistencia: r.estadoAsistencia,
              diasTrabajados: r.diasTrabajados,
              bonoTransporte: r.bonoTransporte,
              bonificaciones: r.bonificaciones,
            }));
            carryManualWeekToNext(area, manualPeriodForView, weekRange.inicio, carryRows);
            clearManualWeekRoster(area, weekRange.inicio, manualPeriodForView.id);
          }
        } catch {
          /* ignore */
        }
        if (res.data?.semanaId) {
          const newSemana: NominaSemana = {
            id: res.data.semanaId,
            area,
            semana_inicio: weekRange.inicio,
            semana_fin: weekRange.fin,
            total_pagado: formattedRows.reduce((acc, r) => acc + (r.total || 0), 0),
            total_trabajadores: formattedRows.length,
            created_at: new Date().toISOString(),
            periodo_id: res.data.periodoId ?? null,
          } as NominaSemana;
          setSemanas((prev) => [newSemana, ...prev.filter((s) => s.id !== newSemana.id)]);
        }
        distribucion.saveAsDefault();
        setProcesadoOk(`✓ ${res.message}`);
        setShowProcesarModal(false);
        if (closedWasWorkingWeek) {
          setWeekRange(
            resolveWeekRangeAfterOperationalCierre(semanas, closedWeekInicio, closedWeekFin),
          );
        } else if (closedWasHistoricalManual && manualPeriodForView) {
          const nextWeek = nextWeekInManualPeriod(manualPeriodForView, closedWeekInicio);
          if (nextWeek) {
            setWeekRange({ inicio: nextWeek, fin: getWeekEnd(nextWeek) });
          }
        }
        try { router.refresh(); } catch {}
      } else {
        const errMsg = res.message || 'Error al procesar el cierre.';
        setCierreModalError(errMsg);
        toastError(errMsg);
      }
    } catch (err: any) {
      console.error('[NominaClient] Error al procesar cierre nómina:', err);
      const errMsg = err?.message || 'Error de conexión con el servidor al procesar el cierre.';
      setCierreModalError(errMsg);
      toastError(errMsg);
    } finally {
      setIsCerrando(false);
    }
  }

  async function handleRevertirSemana(sem: NominaSemana) {
    if (!(await confirmDialog({
      title: 'Revertir nómina',
      message: `¿Revertir la nómina del ${fmtDate(sem.semana_inicio)} al ${fmtDate(sem.semana_fin)}?`,
      variant: 'danger'
    }))) return;
    setIsPending(true);
    try {
      const response = await fetch('/api/nomina/revertir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          semanaId: sem.id,
          area: sem.area || area,
          semana_inicio: sem.semana_inicio,
          semana_fin: sem.semana_fin,
          gasto_id: sem.gasto_id,
          total_pagado: sem.total_pagado,
        }),
      });
      const res = await response.json();
      if (res.ok) {
        const deletedIds = new Set<string>(
          [sem.id, ...(res.data?.deletedSemanaIds || [])].filter(Boolean),
        );
        for (const id of deletedIds) revertedWeeksRef.current.add(id);
        revertedWeeksRef.current.add(`${sem.area || area}:${sem.semana_inicio}`);
        if (sem.id) revertedWeeksRef.current.add(sem.id);

        // 1. Remover de memoria todas las semanas que coincidan con este id o con (semana_inicio, area)
        setSemanas((prev) =>
          prev.filter(
            (s) =>
              !deletedIds.has(s.id) &&
              !(s.semana_inicio === sem.semana_inicio && (s.area || area) === (sem.area || area)),
          ),
        );

        // 2. Localizar el periodo que contiene esta semana
        const targetPeriod =
          (manualPeriodSession && sem.periodo_id ? getPeriodById(manualPeriodSession, sem.periodo_id) : null) ||
          (manualPeriodSession ? resolveManualPeriodForWeek(manualPeriodSession, sem.semana_inicio, temporalCtx.workingWeekStart) : null) ||
          manualPeriodForView;

        const manualPeriodId = targetPeriod?.id ?? null;

        // Limpiar el período en la sesión local (quitar todos los IDs eliminados)
        setManualPeriodSession((prev) => {
          if (!prev) return prev;
          let nextPeriods = { ...prev.periods };
          let changed = false;
          for (const [key, p] of Object.entries(nextPeriods)) {
            if (p.semanaIds?.length) {
              const filtered = p.semanaIds.filter((id) => !deletedIds.has(id));
              if (filtered.length !== p.semanaIds.length) {
                nextPeriods[key] = { ...p, semanaIds: filtered };
                changed = true;
              }
            }
          }
          return changed ? { ...prev, periods: nextPeriods } : prev;
        });

        if (targetPeriod) {
          setConsolidatedLockedIds((prev) => {
            const next = new Set(prev);
            next.delete(targetPeriod.id);
            return next;
          });
        }

        dbHydrateAttemptedRef.current = null;

        if (res.data?.registros?.length) {
          const restoredRegs = res.data.registros as Array<{
            personal_id: string;
            monto_pagado?: number | string;
            es_semana_libre?: boolean;
            estado_asistencia?: any;
            dias_trabajados?: number | null;
            salario_base_calculado?: number | string;
            novedad_turno?: string | null;
            novedad_turno_obs?: string | null;
          }>;
          const restoredIds = restoredRegs.map((r) => r.personal_id);

          // Roster para el ciclo del periodo manual activo
          if (manualPeriodId) {
            writeManualWeekRosterEntries(
              area,
              sem.semana_inicio,
              restoredIds.map((id) => ({ id })),
              manualPeriodId,
            );
          }
          // Roster para la vista semanal general (fallback cuando no hay periodoId activo)
          writeManualWeekRosterEntries(
            area,
            sem.semana_inicio,
            restoredIds.map((id) => ({ id })),
            null,
          );

          const draftKeyWithPeriod = nominaNovedadDraftKey(area, sem.semana_inicio, manualPeriodId);
          const draftKeyNoPeriod = nominaNovedadDraftKey(area, sem.semana_inicio, null);

          const existingWithPeriod = readNominaNovedadDraft(draftKeyWithPeriod);
          const existingNoPeriod = readNominaNovedadDraft(draftKeyNoPeriod);

          const restoredDraftWithPeriod: Record<string, any> = { ...existingWithPeriod };
          const restoredDraftNoPeriod: Record<string, any> = { ...existingNoPeriod };

          for (const reg of restoredRegs) {
            const draftRow = {
              estadoAsistencia: reg.estado_asistencia || (reg.es_semana_libre ? 'libre' : 'trabajada'),
              diasTrabajados: reg.dias_trabajados != null ? Number(reg.dias_trabajados) : undefined,
              novedadTurno: reg.novedad_turno ? parseNovedadTurno(reg.novedad_turno) : undefined,
              novedadTurnoObs: reg.novedad_turno_obs || '',
            };
            restoredDraftWithPeriod[reg.personal_id] = {
              ...(existingWithPeriod[reg.personal_id] ?? {}),
              ...draftRow,
            };
            restoredDraftNoPeriod[reg.personal_id] = {
              ...(existingNoPeriod[reg.personal_id] ?? {}),
              ...draftRow,
            };
          }

          writeNominaNovedadDraft(draftKeyWithPeriod, restoredDraftWithPeriod);
          writeNominaNovedadDraft(draftKeyNoPeriod, restoredDraftNoPeriod);

          // Generar inmediatamente las filas editables para la vista semanal
          const draftMap = manualPeriodId ? restoredDraftWithPeriod : restoredDraftNoPeriod;
          const restoredRows = restoredRegs.map((reg) => {
            const p = personalCatalogMerged.find((w) => w.id === reg.personal_id) || {
              id: reg.personal_id,
              nombre_completo: 'Trabajador',
              cedula: 'SC-N/A',
              cargo: 'General',
              area: area,
              area_detalle: 'General',
              salario_base: Number(reg.salario_base_calculado || 0),
              salario_libre: Number(reg.salario_base_calculado || 0),
              bono_transporte: 0,
              esquema_rotacion: 'FIJO_SEMANAL',
              estatus: 'ACTIVO',
              fecha_ingreso: '',
              activo: false,
              created_at: '',
              updated_at: '',
            } as Personal;
            const baseRow = buildOperationalNominaRow(p, sem.semana_inicio, {});
            return applyWeekDraft(baseRow, sem.semana_inicio, draftMap[p.id]);
          });
          setPreNominaRows(restoredRows);
        }

        // Navegar inmediatamente a la semana revertida en Vista Semanal
        setWeekRange({
          inicio: sem.semana_inicio,
          fin: sem.semana_fin || getWeekEnd(sem.semana_inicio),
        });
        setViewMode('semanal');
        setManualRosterTick((t) => t + 1);

        toastSuccess(`Nómina del ${fmtDate(sem.semana_inicio)} al ${fmtDate(sem.semana_fin)} revertida. Ya puedes editar los trabajadores.`);
        try { router.refresh(); } catch {}
      } else {
        toastError(res.message || 'Error al revertir');
      }
    } catch (err: any) {
      console.error('[NominaClient] Error inesperado al revertir semana:', err);
      toastError(err?.message || 'No se pudo revertir la semana.');
    } finally {
      setIsPending(false);
    }
  }

  function handleVaciarSemana() {
    if (semanaActualProcesada) {
      toastError('La semana ya está cerrada.');
      return;
    }
    startTransition(async () => {
      if (manualPeriodId) {
        // Si hay plantilla activa, conservar sus trabajadores y solo quitar
        // los agregados manualmente. Esto preserva la estructura del ciclo.
        if (manualPlantillaActiva && manualPeriodForView?.plantillaId) {
          const plantillaIds = manualPlantillaActiva.cuadrillas.flatMap((c) =>
            c.filas.map((f) => f.personalId),
          );
          const keptIds = [...new Set(plantillaIds)];
          if (keptIds.length > 0) {
            writeManualWeekRosterEntries(
              area,
              weekRange.inicio,
              keptIds.map((id) => ({ id })),
              manualPeriodId,
            );
            // Reset del draft para que las novedades manuales se limpien,
            // pero conservando los IDs de la plantilla.
            const draftKey = nominaNovedadDraftKey(area, weekRange.inicio, manualPeriodId);
            const freshDraft = resetNovedadDraftForRoster(keptIds);
            writeNominaNovedadDraft(draftKey, freshDraft);
            // Recargar filas respetando la plantilla (estatus, días bloqueados, etc.)
            const valesMapEmpty: Record<string, NominaVale[]> = {};
            const baseRows = buildManualPlantillaNominaRows({
              plantilla: manualPlantillaActiva,
              personalCatalog: personalCatalogMerged,
              personalIds: keptIds,
              weekStart: weekRange.inicio,
              periodStart: manualPeriodForView.rangeStart,
              periodEnd: manualPeriodForView.rangeEnd,
              weekColumnAssignment: manualPeriodForView.weekColumnAssignment,
              weekColumnCuadrillas: manualPeriodForView.weekColumnCuadrillas,
              valesMap: valesMapEmpty,
              weekEnd: weekRange.fin,
              forceIncludeIds: keptIds,
            });
            const rows = baseRows.map((row) =>
              applyWeekDraft(row, weekRange.inicio, freshDraft[row.personal.id]),
            );
            setPreNominaRows(rows);
            setManualRosterTick((t) => t + 1);
            setShowBorrarModal(false);
            toast.success(`Semana vaciada. Se conservan ${keptIds.length} trabajadores de la plantilla.`);
            return;
          }
        }
        // Sin plantilla activa: PRESERVAR el roster existente en localStorage
        // y solo resetear el draft. Antes se borraba el roster completo, lo cual
        // destruía la estructura de la semana del periodo.
        const existingRoster = readManualWeekRosterEntries(
          area,
          weekRange.inicio,
          manualPeriodId,
        );
        const existingIds = existingRoster.map((e) => e.id);
        const draftKey = nominaNovedadDraftKey(area, weekRange.inicio, manualPeriodId);
        writeNominaNovedadDraft(draftKey, resetNovedadDraftForRoster(existingIds));
        // Limpiar state; initRows se vuelve a ejecutar al cambiar manualRosterTick
        // y regenera las filas desde el roster preservado + draft fresco.
        setPreNominaRows([]);
        setManualRosterTick((t) => t + 1);
        setShowBorrarModal(false);
        toast.success(
          existingIds.length
            ? `Semana vaciada. Se conservan ${existingIds.length} trabajadores del roster.`
            : 'Semana vaciada. El roster ya estaba vacío.',
        );
        return;
      }
      // Sin periodo manual: solo marcar como vaciada (modo operativo).
      markOperationalWeekEmptied(area, weekRange.inicio, true);
      setPreNominaRows([]);
      setManualRosterTick((t) => t + 1);
      setShowBorrarModal(false);
      toast.success('Semana vaciada. Los trabajadores siguen activos en la base.');
    });
  }

  // ── PDF de Plantilla (reemplaza al semanal clásico) ────────────────────
  const [pdfPreview, setPdfPreview] = useState<{
    open: boolean;
    loading: boolean;
    error: string | null;
    blob: Blob | null;
    url: string | null;
    title: string;
    meta: { plantillaNombre: string; area: string; cycleStart: string } | null;
  }>({
    open: false,
    loading: false,
    error: null,
    blob: null,
    url: null,
    title: '',
    meta: null,
  });
  const [pdfShareSupported, setPdfShareSupported] = useState(false);
  useEffect(() => {
    setPdfShareSupported(canSharePdfGlobal());
  }, []);

  const buildPdfData = useCallback((): { data: PlantillaPdfData; meta: { plantillaNombre: string; area: string; cycleStart: string } } | null => {
    const snap = deserializeInstanciaSnapshot(instanciaSnapshot);
    if (!snap) return null;
    const plantillaActiva = rotacionPlantillas.find((p) => p.id === snap.plantillaId);
    if (!plantillaActiva) return null;
    const personalMap = new Map<string, Personal>(
      (masterCatalog ?? []).map((p) => [p.id, p]),
    );
    const data = buildPlantillaPdfData(plantillaActiva, snap, personalMap);
    return {
      data,
      meta: {
        plantillaNombre: plantillaActiva.nombre,
        area: plantillaActiva.area,
        cycleStart: snap.fechaInicioCiclo,
      },
    };
  }, [instanciaSnapshot, rotacionPlantillas, masterCatalog]);

  const handlePreviewPlantillaPdf = useCallback(async () => {
    const built = buildPdfData();
    if (!built) {
      toastError('No hay plantilla activa con datos para exportar.');
      return;
    }
    setPdfPreview({
      open: true,
      loading: true,
      error: null,
      blob: null,
      url: null,
      title: built.meta.plantillaNombre,
      meta: built.meta,
    });
    try {
      const { blob, url } = await Promise.race([
        previewNominaPlantillaPdf(built.data),
        new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(
                  'La generación del PDF tardó demasiado tiempo. Puedes usar el botón de Descargar.',
                ),
              ),
            8000,
          ),
        ),
      ]);
      setPdfPreview((prev) => ({ ...prev, loading: false, blob, url }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo generar el PDF.';
      setPdfPreview((prev) => ({ ...prev, loading: false, error: msg }));
    }
  }, [buildPdfData]);

  const handleDownloadPlantillaPdf = useCallback(async () => {
    const built = buildPdfData();
    if (!built) {
      toastError('No hay plantilla activa con datos para exportar.');
      return;
    }
    try {
      await downloadNominaPlantillaPdf(built.data, built.meta);
      toast.success('PDF descargado.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo descargar el PDF.';
      toastError(msg);
    }
  }, [buildPdfData]);

  const handleSharePlantillaPdf = useCallback(async () => {
    const built = buildPdfData();
    if (!built) {
      toastError('No hay plantilla activa para compartir.');
      return;
    }
    try {
      const outcome: ShareOutcome = await shareNominaPlantillaPdf(built.data, built.meta);
      if (outcome === 'unsupported') {
        toastError('Tu navegador no soporta compartir PDF.');
      } else if (outcome === 'cancelled') {
        toast.info('Compartir cancelado.');
      } else if (outcome === 'failed') {
        toastError('No se pudo compartir el PDF.');
      } else {
        toast.success('Compartido.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al compartir.';
      toastError(msg);
    }
  }, [buildPdfData]);

  const closePdfPreview = useCallback(() => {
    setPdfPreview((prev) => {
      if (prev.url) URL.revokeObjectURL(prev.url);
      return { open: false, loading: false, error: null, blob: null, url: null, title: '', meta: null };
    });
  }, []);

  const toolbarPrimaryActions = (
    <>
      {!semanaActualProcesada ? (
        <button onClick={() => { setCierreModalError(null); setShowProcesarModal(true); }} disabled={!canEdit || preNominaRows.length === 0 || !!rotacionCierreError} title={rotacionCierreError ?? 'Cerrar y Distribuir'} className={`${MINEOS_BTN_NOMINA_PRIMARY} h-9 shrink-0 px-3 text-xs`}>
          <Wallet className="w-3.5 h-3.5 shrink-0" /> Cerrar
        </button>
      ) : (
        <button onClick={() => semanaActualCerrada && handleRevertirSemana(semanaActualCerrada)} disabled={!canEdit || isPending || !semanaActualCerrada} title="Revertir cierre" className="nomina-page__toolbar-btn btn-danger h-9 shrink-0 text-xs disabled:opacity-40">
          {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Revertir
        </button>
      )}
      <button onClick={() => setShowAssignModal(true)} disabled={!canEdit} title="Buscar en base o registrar nuevo" className={`${MINEOS_BTN_NOMINA_PRIMARY} h-9 shrink-0 px-3 text-xs`}>
        <Plus className="w-3.5 h-3.5 shrink-0" /> Trabajador
      </button>
      <button
        type="button"
        onClick={() => {
          setEditingNovedad(null);
          setShowNovedadModal(true);
        }}
        disabled={!canEdit || semanaActualProcesada}
        title="Registrar pago extraordinario o novedad"
        className={`${mineosBtnSubtleClass('general')} h-9 shrink-0 px-3 text-xs`}
      >
        <FileText className="w-3.5 h-3.5 shrink-0" /> Novedad
      </button>
    </>
  );

  const toolbarSecondaryActions = (
    <>
      <button
        type="button"
        onClick={() => {
          setPreviewInitialRange({ start: weekRange.inicio, end: weekRange.fin });
          setShowExcelPreview(true);
        }}
        title="Vista previa de la planilla"
        className="nomina-page__toolbar-btn btn-secondary"
      >
        <FileSpreadsheet className="shrink-0 text-zinc-400" /> Previsualización
      </button>
      <button onClick={handleExportCSV} title="CSV" className="nomina-page__toolbar-btn btn-secondary">
        <Download className="shrink-0 text-zinc-400" /> CSV
      </button>
      {canEdit && preNominaRows.length > 0 && !semanaActualProcesada && (
        <button onClick={() => setShowBorrarModal(true)} title="Quitar todos de la semana actual" className="nomina-page__toolbar-btn btn-secondary">
          <Trash2 className="shrink-0 text-zinc-400" /> Vaciar
        </button>
      )}
    </>
  );

  // ── RENDER ─────────────────────────────────────────────────────────────
  return (
    <div className="nomina-page flex min-h-0 w-full flex-1 flex-col overflow-hidden">
      <div className="nomina-page__body nomina-page__grid min-h-0 flex-1 grid grid-cols-1 gap-3 lg:grid-cols-12 lg:gap-4">

        <aside className="nomina-page__aside scroll-y-fade hidden lg:col-span-3 lg:flex flex-col gap-3 min-h-0 lg:overflow-y-auto">
          <header className="nomina-page__aside-head shrink-0">
            <h1 className="nomina-page__title">
              <IconComponent className="nomina-page__title-icon" aria-hidden />
              <span className="nomina-page__title-text">{pageTitle}</span>
            </h1>
          </header>

          <div className="nomina-page__kpis grid grid-cols-2 gap-2.5 shrink-0">
            <div className="nomina-page__kpi-card bg-zinc-900 border border-zinc-800 rounded-lg">
              <p className="nomina-page__kpi-label">Total Semanal</p>
              <p className="nomina-page__kpi-value text-amber-400">{fmtMoney(totalSemana)}</p>
            </div>
            <div className="nomina-page__kpi-card bg-zinc-900 border border-zinc-800 rounded-lg">
              <p className="nomina-page__kpi-label">Personal Activo</p>
              <p className="nomina-page__kpi-value text-white/90">{data.length}</p>
            </div>
          </div>

          {(preNominaRows.length > 0 || semanaActualProcesada) && (
            <div className="nomina-page__distribucion-aside shrink-0">
              <NominaDistribucionPanel
                totalNomina={totalSemana}
                partes={distribucion.partes}
                lineas={distribucion.lineas}
                sumPct={distribucion.sumPct}
                validationOk={distribucion.validation.ok}
                validationMessage={distribucion.validation.message}
                onUpdateParte={distribucion.updateParte}
                onAddParte={distribucion.addParte}
                onRemoveParte={distribucion.removeParte}
                onRebalance={distribucion.rebalanceIgual}
                onSaveDefault={distribucion.saveAsDefault}
                variant="dark"
                compact
                readOnly={semanaActualProcesada}
              />
            </div>
          )}

          <div className="nomina-page__aside-tools shrink-0 flex flex-col gap-1.5">
            <div className="nomina-page__toolbar-actions nomina-page__toolbar-actions--grid">
              {toolbarSecondaryActions}
            </div>
          </div>

          <div className="nomina-page__status shrink-0 flex flex-col gap-2">
            {semanaActualProcesada ? (
              <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/5 px-4 py-3.5 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-500/10">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-emerald-400">Nómina Cerrada</p>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[8px] font-black text-emerald-400 uppercase tracking-widest mt-1">
                      <Lock className="w-2.5 h-2.5" /> Frozen
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950/60 px-2.5 py-1">
                    <Calendar className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden />
                    <span className="text-[9px] font-bold uppercase text-white/40">Desde:</span>
                    <input type="date" value={weekRange.inicio} onChange={e => { const newInicio = e.target.value; if (!newInicio) return; const d = new Date(newInicio); if (isNaN(d.getTime())) return; d.setDate(d.getDate() + 6); setWeekRange({ inicio: newInicio, fin: d.toISOString().split('T')[0] }); }} className="nomina-page__date-input min-w-0 flex-1 cursor-pointer border-0 bg-transparent p-0 text-xs text-white/90 outline-none focus:ring-0" />
                  </label>
                  <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950/60 px-2.5 py-1">
                    <Calendar className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden />
                    <span className="text-[9px] font-bold uppercase text-white/40">Hasta:</span>
                    <input type="date" value={weekRange.fin} onChange={e => setWeekRange(prev => ({ ...prev, fin: e.target.value }))} className="nomina-page__date-input min-w-0 flex-1 cursor-pointer border-0 bg-transparent p-0 text-xs text-white/90 outline-none focus:ring-0" />
                  </label>
                  <p className="text-[11px] text-white/50">{semanaActualCerrada?.total_trabajadores ?? 0} trabajadores · <span className="font-bold text-emerald-400">{fmtMoney(Number(semanaActualCerrada?.total_pagado ?? 0))}</span></p>
                </div>
                <button onClick={() => semanaActualCerrada && handleRevertirSemana(semanaActualCerrada)} disabled={!canEdit || isPending || !semanaActualCerrada} className="h-8 px-3 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-40">
                  {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Revertir
                </button>
              </div>
            ) : (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3.5 flex flex-col gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-500/10">
                    <AlertTriangle className="h-3.5 w-3.5 animate-pulse text-amber-500" />
                  </div>
                  <p className="text-xs font-semibold text-amber-500">Nómina Pendiente</p>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 px-2.5 py-1.5">
                    <Calendar className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden />
                    <span className="text-[9px] font-bold uppercase text-white/40">Desde:</span>
                    <input type="date" value={weekRange.inicio} onChange={e => { const newInicio = e.target.value; if (!newInicio) return; const d = new Date(newInicio); if (isNaN(d.getTime())) return; d.setDate(d.getDate() + 6); setWeekRange({ inicio: newInicio, fin: d.toISOString().split('T')[0] }); }} className="nomina-page__date-input min-w-0 flex-1 cursor-pointer border-0 bg-transparent p-0 text-xs text-white/90 outline-none focus:ring-0" />
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 px-2.5 py-1.5">
                    <Calendar className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden />
                    <span className="text-[9px] font-bold uppercase text-white/40">Hasta:</span>
                    <input type="date" value={weekRange.fin} onChange={e => setWeekRange(prev => ({ ...prev, fin: e.target.value }))} className="nomina-page__date-input min-w-0 flex-1 cursor-pointer border-0 bg-transparent p-0 text-xs text-white/90 outline-none focus:ring-0" />
                  </label>
                  <p className="text-[11px] text-white/50">{preNominaRows.length} activos · <span className="font-bold text-amber-400">{fmtMoney(totalSemana)}</span></p>
                </div>
                {grupoMixtoRosterProjection && (
                  <div className="rounded-lg border border-[var(--mineos-benefit-border)] bg-[var(--mineos-benefit-soft)] px-2.5 py-2">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--mineos-benefit)]">
                      <Users className="h-3.5 w-3.5" />
                      Roster mixto proyectado
                    </div>
                    <p className="mt-1 text-[10px] leading-snug text-[var(--text-secondary)]">
                      {grupoMixtoRosterProjection.expectedIds.length} esperados ·{' '}
                      {grupoMixtoRosterProjection.suppressedIds.length} no esperados. Fuente:{' '}
                      {grupoMixtoRosterProjection.sourceWeekStart
                        ? fmtDate(grupoMixtoRosterProjection.sourceWeekStart)
                        : 'historial'}.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProjectionIds(grupoMixtoRosterProjection.expectedIds);
                        setShowProjectionModal(true);
                      }}
                      className="mt-2 w-full py-1.5 px-2.5 rounded bg-[var(--mineos-benefit)] text-zinc-950 text-[10px] font-bold uppercase tracking-wider hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" aria-hidden />
                      Revisar y Aplicar
                    </button>
                  </div>
                )}
                {procesadoOk && <div className="mt-2.5 flex items-center gap-2 text-xs text-emerald-400 font-bold"><CheckCircle2 className="w-3.5 h-3.5" />{procesadoOk}</div>}
              </div>
            )}
            {weekRange.inicio !== temporalCtx.workingWeekStart && (
              <div className="rounded-xl border border-sky-500/25 bg-sky-500/5 px-3 py-2.5">
                <p className="text-[10px] leading-snug text-sky-200/90">{formatTemporalContextHint(temporalCtx)}</p>
                <button
                  type="button"
                  onClick={() =>
                    setWeekRange({
                      inicio: temporalCtx.workingWeekStart,
                      fin: temporalCtx.workingWeekEnd,
                    })
                  }
                  className="mt-2 text-[10px] font-bold uppercase tracking-wide text-sky-400 hover:text-sky-300"
                >
                  Ir a semana de curso
                </button>
              </div>
            )}
            {prevSemana && Math.abs(weekDeltaPct) > 15 && (
              <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-3 py-2.5 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                <p className="text-[10px] text-yellow-300 leading-snug">
                  <strong>Anomalía:</strong> {Math.abs(weekDeltaPct).toFixed(1)}% vs semana anterior.
                </p>
              </div>
            )}
          </div>

          {semanas.length > 0 && (
            <div className="nomina-page__historial hidden lg:flex flex-col flex-1 min-h-0 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <button onClick={() => setShowHistorial(!showHistorial)} className="w-full flex justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors border-b border-zinc-850 flex-shrink-0">
                <div className="flex items-center gap-2 text-xs font-bold text-white/50 uppercase tracking-widest"><Clock className="w-4 h-4 text-amber-500" /> Historial</div>
                {showHistorial ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
              </button>
              {showHistorial && (
                <div className="p-2.5 overflow-y-auto flex-1 flex flex-col gap-2 scroll-y-fade">
                  {semanas.map(sem => (
                    <div key={sem.id} className="bg-zinc-950/40 border border-zinc-850 rounded-lg p-3 hover:border-zinc-800 transition-colors">
                      <div className="flex justify-between items-start gap-2">
                        <p className="text-[11px] font-bold text-white/90 leading-snug">{fmtDate(sem.semana_inicio)} – {fmtDate(sem.semana_fin)}</p>
                        <span className="text-[8px] uppercase font-bold px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded shrink-0">OK</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 mt-2 border-t border-zinc-800/40">
                        <p className="text-xs font-bold text-amber-500">{fmtMoney(Number(sem.total_pagado))}</p>
                        {canEdit && <button onClick={() => handleRevertirSemana(sem)} disabled={isPending} className="text-[9px] font-bold text-red-400 hover:text-red-300 uppercase">Revertir</button>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </aside>

        <div className="nomina-page__content lg:col-span-9 flex min-h-0 flex-col gap-3 overflow-hidden">
          <NominaMobileStickyChrome
            pageTitle={pageTitle}
            cerrada={semanaActualProcesada}
            weekLabel={`${fmtDate(weekRange.inicio)} – ${fmtDate(weekRange.fin)}`}
            totalSemana={totalSemana}
            preNominaCount={preNominaRows.length}
            onOpenSemana={() => setSemanaSheetOpen(true)}
            search={search}
            onSearchChange={setSearch}
            fmtMoney={fmtMoney}
          />

          <div className="nomina-page__main nomina-page__table-stack flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/30 lg:border lg:bg-zinc-900/30">
            {/* Tabs de Vista */}
            <div className="shrink-0 border-b border-zinc-800/80 bg-zinc-950/40 px-2 py-1">
              <div className="grid w-full grid-cols-3 gap-1 sm:grid-cols-5">
                <button
                  type="button"
                  onClick={() => setViewMode('semanal')}
                  className={`rounded-md px-2 py-1 text-center text-[10px] font-bold uppercase transition-all ${
                    viewMode === 'semanal'
                      ? 'border border-amber-500/30 bg-amber-500/10 text-amber-400'
                      : 'border border-transparent text-white/50 hover:text-white/70'
                  }`}
                >
                  Vista Semanal
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('ciclos')}
                  className={`rounded-md px-2 py-1 text-center text-[10px] font-bold uppercase transition-all ${
                    viewMode === 'ciclos'
                      ? 'border border-amber-500/30 bg-amber-500/10 text-amber-400'
                      : 'border border-transparent text-white/50 hover:text-white/70'
                  }`}
                >
                  Vista por Ciclo
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('cierre_mes')}
                  className={`rounded-md px-2 py-1 text-center text-[10px] font-bold uppercase transition-all ${
                    viewMode === 'cierre_mes'
                      ? 'border border-amber-500/30 bg-amber-500/10 text-amber-400'
                      : 'border border-transparent text-white/50 hover:text-white/70'
                  }`}
                >
                  Cierre de mes
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('plantillas')}
                  className={`rounded-md px-2 py-1 text-center text-[10px] font-bold uppercase transition-all ${
                    viewMode === 'plantillas'
                      ? 'border border-amber-500/30 bg-amber-500/10 text-amber-400'
                      : 'border border-transparent text-white/50 hover:text-white/70'
                  }`}
                >
                  Plantillas Rotación
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('despedidos')}
                  className={`rounded-md px-2 py-1 text-center text-[10px] font-bold uppercase transition-all ${
                    viewMode === 'despedidos'
                      ? 'border border-amber-500/30 bg-amber-500/10 text-amber-400'
                      : 'border border-transparent text-white/50 hover:text-white/70'
                  }`}
                >
                  Despedidos
                </button>
              </div>
            </div>

            {viewMode !== 'semanal' ? (
              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                <div className="nomina-page__table-scroll scroll-y-fade flex min-h-0 flex-1 flex-col gap-3 overflow-x-hidden overflow-y-auto p-2.5 pb-[calc(4.25rem+env(safe-area-inset-bottom))] lg:gap-4 lg:p-3 lg:pb-3">
                  {viewMode === 'cierre_mes' ? (
                    <NominaCierreMesView
                      area={area}
                      canEdit={canEdit}
                      semanas={semanas}
                      activePeriod={getEditorPeriod(manualPeriodSession)}
                      refreshKey={archivoRefreshKey}
                      userId={user?.id}
                      onConsolidated={() => {
                        setManualPeriodSession((prev) => {
                          const editorId = prev.editorPeriodId;
                          return editorId ? removePeriodFromSession(prev, editorId) : prev;
                        });
                        setConsolidatedLockedIds(new Set());
                        setEditedConsolidatedPeriodIds(new Set());
                        try { router.refresh(); } catch {}
                        setArchivoRefreshKey((k) => k + 1);
                      }}
                      onViewPeriod={(p) => {
                        handleEditorPeriodChange(p, { fromConsolidated: true });
                        setViewMode('ciclos');
                      }}
                      onWorkWeek={(p, ws) => {
                        handleEditorPeriodChange(p, { fromConsolidated: true, resetReconsolidation: false });
                        setManualPeriodSession((prev) => ({
                          ...prev,
                          editorPeriodId: p.id,
                          historicalPeriodId: p.id,
                        }));
                        setWeekRange({ inicio: ws, fin: getWeekEnd(ws) });
                        setViewMode('semanal');
                      }}
                      onEditWeek={(p, ws) => {
                        handleEditorPeriodChange(p, { fromConsolidated: true, resetReconsolidation: false });
                        setManualPeriodSession((prev) => ({
                          ...prev,
                          editorPeriodId: p.id,
                          historicalPeriodId: p.id,
                        }));
                        setEditedConsolidatedPeriodIds((prev) => {
                          const next = new Set(prev);
                          next.add(p.id);
                          return next;
                        });
                        setWeekRange({ inicio: ws, fin: getWeekEnd(ws) });
                        setViewMode('semanal');
                      }}
                    />
                  ) : viewMode === 'ciclos' ? (
                    <NominaCiclosView
                      area={area}
                      canEdit={canEdit}
                      semanas={semanas}
                      weekStart={weekRange.inicio}
                      workingWeekStart={temporalCtx.workingWeekStart}
                      periodsSession={manualPeriodSession}
                      onSessionChange={setManualPeriodSession}
                      onEditorPeriodChange={handleEditorPeriodChange}
                      onWorkingWeekPeriodChange={handleWorkingWeekPeriodChange}
                      onStartNewPeriod={handleStartNewPeriod}
                      onDeleteDraftPeriod={handleDeleteDraftPeriod}
                      plantillas={rotacionPlantillas}
                      onGoToWeek={(inicio, fin) => setWeekRange({ inicio, fin })}
                      onOpenSemanal={() => setViewMode('semanal')}
                      onGoPlantillas={() => setViewMode('plantillas')}
                      onGoCierreMes={() => setViewMode('cierre_mes')}
                      instanciaActiva={instanciaActivaProp}
                      userId={user?.id}
                      personal={personalCatalogMerged}
                      valesPorPersonal={proximosPagosValesPorPersonal}
                      consolidatedLockedPeriodIds={consolidatedLockedIds}
                      editedAfterConsolidationPeriodIds={editedConsolidatedPeriodIds}
                      onConsolidated={() => {
                        setManualPeriodSession((prev) => {
                          const editorId = prev.editorPeriodId;
                          return editorId ? removePeriodFromSession(prev, editorId) : prev;
                        });
                        setConsolidatedLockedIds(new Set());
                        setEditedConsolidatedPeriodIds(new Set());
                        try { router.refresh(); } catch {}
                        setArchivoRefreshKey((k) => k + 1);
                      }}
                      periodosRefreshKey={archivoRefreshKey}
                      onRevertirWeek={(ws) => {
                        const found = semanas.find(
                          (s) => s.semana_inicio === ws && (s.area || area) === area,
                        );
                        const targetSem: NominaSemana = found || {
                          id: '',
                          semana_inicio: ws,
                          semana_fin: getWeekEnd(ws),
                          area: area,
                          total_pagado: 0,
                          periodo_id: manualPeriodForView?.id || undefined,
                        };
                        if (!targetSem.periodo_id && manualPeriodForView?.id) {
                          targetSem.periodo_id = manualPeriodForView.id;
                        }
                        handleRevertirSemana(targetSem);
                      }}
                    />
                  ) : viewMode === 'despedidos' ? (
                    <LiquidacionDespedidosPanel
                      area={area}
                      personal={personalCatalogMerged}
                      distribucionPartes={distribucion.partes}
                      onRefresh={() => { try { router.refresh(); } catch {} }}
                      canEdit={canEdit}
                    />
                  ) : (
                    <RotacionInstanciaPanel
                      area={area}
                      plantillas={rotacionPlantillas}
                      instanciaActiva={instanciaActivaProp}
                      canEdit={canEdit}
                      migrationRequired={rotacionMigrationRequired}
                      onOpenSandbox={() => {
                        setSandboxPlantillaId(undefined);
                        setShowRotacionSandbox(true);
                      }}
                      onEditPlantilla={(id) => {
                        setSandboxPlantillaId(id);
                        setShowRotacionSandbox(true);
                      }}
                      onInstanciaChange={() => {
                        void refreshPlantillas();
                        try { router.refresh(); } catch {}
                      }}
                      onPreviewPdf={() => {
                        void handlePreviewPlantillaPdf();
                      }}
                      onDownloadPdf={() => {
                        void handleDownloadPlantillaPdf();
                      }}
                      onSharePdf={() => {
                        void handleSharePlantillaPdf();
                      }}
                      canSharePdf={pdfShareSupported}
                    />
                  )}
                </div>
              </div>
            ) : (
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {instanciaActivaProp && !isManualPeriodWeek && (
              <div className="w-full min-w-0 shrink-0 px-3 pt-2">
                <RotacionInstanciaBanner
                  instanciaActiva={instanciaActivaProp}
                  weekStart={weekRange.inicio}
                />
              </div>
            )}
            <div className="w-full min-w-0 shrink-0 px-3 pt-2">
              {isManualPeriodWeek && !semanaActualProcesada && (
                <div className={cn(mineosPanel('general'), 'text-[11px] text-[var(--text-secondary)]')}>
                  Periodo manual «{manualPeriodForView?.label}»: edite y cierre esta semana.{' '}
                  <button
                    type="button"
                    onClick={() => setViewMode('ciclos')}
                    className="font-semibold text-[var(--mineos-general-bright)] hover:underline"
                  >
                    Ver progreso del periodo
                  </button>
                </div>
              )}
            </div>
            {rotacionCierreError && !semanaActualProcesada && !isHistoricalManualWeek && (
              <div className="mx-3 mt-2 w-full min-w-0 shrink-0 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-300">
                Rotación: {rotacionCierreError}
              </div>
            )}
            <div className="nomina-page__toolbar hidden shrink-0 border-b border-zinc-800/80 px-3 py-2.5 lg:block">
              <div className="nomina-page__toolbar-row flex w-full min-w-0 items-center gap-2">
                <div className="nomina-page__toolbar-search flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2">
                  <Search className="h-4 w-4 shrink-0 text-white/40" aria-hidden />
                  <input
                    type="text"
                    placeholder="Buscar por nombre o cédula..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full min-w-0 border-0 bg-transparent text-sm text-white/90 outline-none placeholder:text-white/30"
                  />
                </div>
                <div className="nomina-page__toolbar-actions nomina-page__toolbar-actions--inline shrink-0">
                  {toolbarPrimaryActions}
                </div>
              </div>
            </div>

            <div className="nomina-page__table-scroll scroll-y-fade flex min-h-0 flex-1 flex-col gap-3 overflow-x-hidden overflow-y-auto p-2.5 pb-[calc(4.25rem+env(safe-area-inset-bottom))] lg:gap-6 lg:p-3 lg:pb-3">
            {isHistoricalLoading ? (
              <div className="bg-zinc-900/40 backdrop-blur-md border border-zinc-800 rounded-xl p-20 text-center flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
                <p className="text-sm text-white/50 font-medium">Cargando registros históricos de nómina...</p>
              </div>
            ) : Object.keys(groupedRows).length === 0 ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
                <Users className="w-12 h-12 text-white/20 mx-auto mb-3" />
                {periodsEnCurso(manualPeriodSession).length > 0 &&
                !isManualPeriodWeek &&
                weekRange.inicio === temporalCtx.workingWeekStart ? (
                  <>
                    <p className="text-sm text-white/50">
                      Semana de curso sin ciclo vinculado.
                    </p>
                    <p className="mt-2 text-xs text-white/35">
                      En Vista por Ciclo use el desplegable «Semana de curso» para aplicar la
                      plantilla sin vaciar trabajadores.
                    </p>
                    <button
                      type="button"
                      onClick={() => setViewMode('ciclos')}
                      className="mt-4 text-xs font-semibold text-[var(--mineos-general-bright)] hover:underline"
                    >
                      Ir a Vista por Ciclo
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-white/40">No hay trabajadores en esta nómina.</p>
                    {canEdit && !search.trim() && (!manualPeriodForView || isManualPeriodWeek) && (
                      <button
                        type="button"
                        onClick={() => setShowAssignModal(true)}
                        className={`${MINEOS_BTN_NOMINA_PRIMARY} mt-4 px-4 py-2 text-xs`}
                      >
                        <Plus className="h-3.5 w-3.5" /> Asignar desde la base
                      </button>
                    )}
                  </>
                )}
              </div>
            ) : (
              Object.entries(groupedRows).map(([cargoName, rows]) => {
                const theme = getCargoTheme(cargoName);
                const groupTotal = rows.reduce((s, r) => s + r.total, 0);
                const groupSueldo = rows.reduce((s, r) => {
                  return s + r.salarioBaseCalculado;
                }, 0);
                const groupBono = rows.reduce((s, r) => s + r.bonoTransporte, 0);
                const groupBonif = rows.reduce((s, r) => s + r.bonificaciones, 0);
                const groupVales = rows.reduce((s, r) => s + r.totalVales, 0);
                return (
                  <div key={cargoName} className="nomina-cargo-group shrink-0 overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-900/40 shadow-sm">
                    {/* Group Header */}
                    <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-zinc-800 bg-zinc-900/80 px-3 py-2 lg:gap-2 lg:px-5 lg:py-3.5">
                      <div className="flex min-w-0 items-center gap-2 lg:gap-3">
                        <div className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider lg:px-3 lg:py-1 lg:text-[10px] ${theme.bg} ${theme.text} ${theme.border}`}>{cargoName}</div>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-white/40 lg:text-[10px]">{rows.length} trab.</span>
                        {semanaActualProcesada && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/25 text-[8px] font-bold uppercase tracking-wider">
                            <Lock className="w-2.5 h-2.5" /> Bloqueado (Historial)
                          </span>
                        )}
                      </div>
                      <span className="shrink-0 text-xs font-semibold tabular-nums text-amber-500 lg:text-sm">Subtotal {fmtMoney(groupTotal)}</span>
                    </div>

                    {rows.length === 0 && manualPlantillaActiva && isManualPeriodWeek && (
                      <div className="border-b border-zinc-800/60 px-4 py-6 text-center text-xs text-white/40">
                        Cuadrilla activa en este intervalo. Cargue trabajadores en Vista Semanal.
                      </div>
                    )}

                    <div className="space-y-1.5 p-2 lg:hidden">
                      {rows.map((row) => {
                        const p = row.personal;
                        return (
                          <NominaMobileWorkerCard
                            key={p.id}
                            row={row}
                            locked={semanaActualProcesada}
                            canEdit={canEdit}
                            theme={theme}
                            initials={getInitials(p.nombre_completo)}
                            avatarColor={getAvatarColor(p.cargo)}
                            onOpenDrawer={() => openDrawer(p.id)}
                            onOpenReceipt={() => setSelectedReceipt(row)}
                            onReassign={() => openAssignForReassign(p.id)}
                            onEdit={() => openEdit(p)}
                            onDelete={() => handleDelete(p.id)}
                            onUpdateRow={(fields) => handleUpdateRow(p.id, fields)}
                            onNovedadTurnoChange={(fields) => handleUpdateRow(p.id, fields)}
                            fmtMoney={fmtMoney}
                          />
                        );
                      })}
                      <div className="flex items-center justify-between rounded-xl border border-zinc-700/50 bg-zinc-950/60 px-3 py-2.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-white/45">Subtotal {cargoName}</span>
                        <span className="text-sm font-black tabular-nums text-amber-500">{fmtMoney(groupTotal)}</span>
                      </div>
                    </div>

                    <div className="hidden overflow-x-auto lg:block">
                      {rows.length === 0 && manualPlantillaActiva && isManualPeriodWeek ? (
                        <div className="px-5 py-8 text-center text-xs text-white/40">
                          Cuadrilla activa en este intervalo. Cargue trabajadores en Vista Semanal.
                        </div>
                      ) : (
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-zinc-950/40 border-b border-zinc-800 text-[10px] font-bold text-white/50 uppercase tracking-wider">
                            <th className="px-5 py-3">Trabajador</th>
                            <th className="px-2 py-3 text-center text-[10px]">Novedad turno</th>
                            <th className="px-5 py-3 text-center">Asistencia</th>
                            <th className="px-3 py-3 text-center">Días</th>
                            <th className="px-5 py-3 text-right">Sueldo</th>
                            <th className="px-5 py-3 text-right">Bono T.</th>
                            <th className="px-5 py-3 text-right">Bonos</th>
                            <th className="px-5 py-3 text-right">Vales</th>
                            <th className="px-5 py-3 text-right text-amber-500">Total</th>
                            <th className="px-5 py-3 text-center">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-850/40">
                          {rows.map(row => {
                            const p = row.personal;
                            const avatarColor = getAvatarColor(p.cargo);
                            const initials = getInitials(p.nombre_completo);
                            const isPredicted = p.esquema_rotacion !== 'FIJO_SEMANAL' && p.esquema_rotacion !== 'MOLINO_FIJO';
                            return (
                              <tr key={p.id} className="border-b border-zinc-850/20 hover:bg-zinc-800/20 transition-colors">
                                {/* Avatar + Name */}
                                <td className="px-5 py-3">
                                  <button onClick={() => openDrawer(p.id)} className="text-left group flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-lg ${avatarColor} flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm`}>{initials}</div>
                                    <div>
                                      <div className="font-semibold text-white/90 text-sm leading-snug group-hover:text-amber-400 transition-colors flex items-center gap-1.5">
                                        {p.nombre_completo}
                                        <ChevronRight className="w-3 h-3 text-white/20 group-hover:text-amber-400 transition-colors" />
                                      </div>
                                      <div className="text-[10px] text-white/40 mt-0.5 flex items-center gap-1.5 flex-wrap">
                                        <span>{p.cedula}</span>
                                        {row.rotacionFuente === 'plantilla' && row.estatusPlantillaLabel && (
                                          <span className="rounded border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 text-[8px] font-bold uppercase text-amber-300">
                                            Plantilla · {row.cuadrillaNombre} · {row.estatusPlantillaLabel}
                                          </span>
                                        )}
                                        {row.rotacionFuente !== 'plantilla' && isPredicted && (
                                          <RotacionPredBadge
                                            esquema={p.esquema_rotacion}
                                            posicion={row.cicloPosicion}
                                            estadoAsistencia={row.estadoAsistencia}
                                          />
                                        )}
                                      </div>
                                    </div>
                                  </button>
                                </td>
                                <td className="px-2 py-3 align-middle text-center">
                                  <NominaNovedadTurnoCell
                                    value={row.novedadTurno}
                                    observacion={row.novedadTurnoObs}
                                    reposoCondicion={row.reposoCondicion}
                                    reposoDiasPagados={row.reposoDiasPagados ?? 0}
                                    reposoCompensacionMonto={row.reposoCompensacionMonto ?? 0}
                                    disabled={!canEdit || semanaActualProcesada}
                                    workerName={p.nombre_completo}
                                    onChange={(novedadTurno) =>
                                      handleUpdateRow(p.id, { novedadTurno })
                                    }
                                    onObservacionChange={(novedadTurnoObs) =>
                                      handleUpdateRow(p.id, { novedadTurnoObs })
                                    }
                                    onReposoCondicionChange={(reposoCondicion) =>
                                      handleUpdateRow(p.id, {
                                        reposoCondicion,
                                        ...(reposoCondicion === 'PARCIAL' &&
                                        !(row.reposoDiasPagados && row.reposoDiasPagados > 0)
                                          ? { reposoDiasPagados: NOMINA_DIAS_POR_SEMANA }
                                          : {}),
                                        ...(reposoCondicion !== 'PAGO_UNICO'
                                          ? { reposoCompensacionMonto: 0 }
                                          : {}),
                                      })
                                    }
                                    onReposoDiasPagadosChange={(reposoDiasPagados) =>
                                      handleUpdateRow(p.id, { reposoDiasPagados })
                                    }
                                    onReposoCompensacionMontoChange={(reposoCompensacionMonto) =>
                                      handleUpdateRow(p.id, { reposoCompensacionMonto })
                                    }
                                  />
                                </td>
                                {/* Attendance Toggles - Turno/Libre/Falta */}
                                <td className="px-3 py-3 text-center">
                                  <div className="inline-flex p-1 rounded-xl bg-zinc-950/60 border border-zinc-800/50">
                                    <button onClick={() => handleUpdateRow(p.id, { estadoAsistencia: 'trabajada' })} title="Semana Turno Laboral" disabled={semanaActualProcesada}
                                      className={`px-2.5 py-1.5 text-[10px] font-bold uppercase rounded-lg border transition-all flex items-center gap-1 disabled:opacity-45 disabled:cursor-not-allowed ${row.estadoAsistencia === 'trabajada' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30 shadow-md shadow-amber-500/5' : 'border-transparent text-white/40 hover:text-white/70'}`}>
                                      <Hammer className="w-3.5 h-3.5" /> Turno
                                    </button>
                                    <button onClick={() => handleUpdateRow(p.id, { estadoAsistencia: 'libre' })} title="Semana Libre" disabled={semanaActualProcesada}
                                      className={`px-2.5 py-1.5 text-[10px] font-bold uppercase rounded-lg border transition-all flex items-center gap-1 disabled:opacity-45 disabled:cursor-not-allowed ${row.estadoAsistencia === 'libre' ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30 shadow-md shadow-cyan-500/5' : 'border-transparent text-white/40 hover:text-white/70'}`}>
                                      <Umbrella className="w-3.5 h-3.5" /> Libre
                                    </button>
                                    <button onClick={() => handleUpdateRow(p.id, { estadoAsistencia: 'no_laborado' })} title="No laboró" disabled={semanaActualProcesada}
                                      className={`px-2.5 py-1.5 text-[10px] font-bold uppercase rounded-lg border transition-all flex items-center gap-1 disabled:opacity-45 disabled:cursor-not-allowed ${row.estadoAsistencia === 'no_laborado' ? 'bg-red-500/15 text-red-400 border-red-500/30 shadow-md shadow-red-500/5' : 'border-transparent text-white/40 hover:text-white/70'}`}>
                                      <XCircle className="w-3.5 h-3.5" /> Falta
                                    </button>
                                  </div>
                                </td>
                                <td className="px-3 py-3 text-center">
                                  {!row.diasInputBloqueado && row.estadoAsistencia === 'trabajada' ? (
                                    <div className="inline-flex flex-col items-center gap-1">
                                      <input
                                        type="number"
                                        min={0}
                                        max={MAX_DIAS_TRABAJADOS}
                                        step={1}
                                        value={row.diasTrabajados}
                                        disabled={semanaActualProcesada}
                                        onChange={(e) =>
                                          handleUpdateRow(p.id, {
                                            diasTrabajados: Number(e.target.value),
                                          })
                                        }
                                        title={`Días trabajados (0–${MAX_DIAS_TRABAJADOS}). El sueldo base se prorratea: (salario semanal ÷ 7) × días.`}
                                        className="w-12 rounded-lg border border-zinc-800 bg-zinc-950/50 px-2 py-1 text-center text-xs font-bold tabular-nums text-white outline-none focus:border-amber-500/50 disabled:opacity-40"
                                      />
                                      <span className="text-[8px] font-medium text-white/35">de {NOMINA_DIAS_POR_SEMANA} (máx {MAX_DIAS_TRABAJADOS})</span>
                                    </div>
                                  ) : (
                                    <div className="inline-flex flex-col items-center gap-1 opacity-40">
                                      <span className="text-xs font-bold tabular-nums text-white/60">
                                        {row.estadoAsistencia === 'libre' || row.diasInputBloqueado ? '—' : '0'}
                                      </span>
                                      <span className="text-[8px] font-medium text-white/35">
                                        {row.diasInputBloqueado
                                          ? 'ciclo'
                                          : row.estadoAsistencia === 'libre'
                                            ? 'libre'
                                            : 'falta'}
                                      </span>
                                    </div>
                                  )}
                                </td>
                                {/* Sueldo */}
                                <td className="px-5 py-3 text-right font-sans tabular-nums text-xs text-white/80">
                                  <div className="flex flex-col items-end gap-0.5">
                                    <span>{fmtMoney(row.salarioBaseCalculado)}</span>
                                    {(() => {
                                      const tarifa =
                                        row.rotacionFuente === 'plantilla'
                                          ? explicitWeeklyBaseRate(p, row.estadoAsistencia)
                                          : calculateWeeklyBaseRate(
                                              p,
                                              row.estadoAsistencia,
                                              weekRange.inicio,
                                            );
                                      const hint = formatProportionalSalarioHint(
                                        tarifa,
                                        row.diasTrabajados,
                                      );
                                      return hint ? (
                                        <span className="text-[9px] font-medium text-white/35">{hint}</span>
                                      ) : null;
                                    })()}
                                  </div>
                                </td>
                                {/* Bono */}
                                <td className="px-5 py-3 text-right">
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={row.bonoTransporte ?? ''}
                                    onChange={e => {
                                      if (typeof window !== 'undefined') {
                                        console.info('[BonoT] onChange', { personalId: p.id, value: e.target.value });
                                      }
                                      handleUpdateRow(p.id, { bonoTransporte: e.target.value === '' ? 0 : Number(e.target.value) });
                                    }}
                                    onFocus={() => {
                                      if (typeof window !== 'undefined') {
                                        console.info('[BonoT] onFocus', { personalId: p.id, currentValue: row.bonoTransporte, semanaActualProcesada });
                                      }
                                    }}
                                    placeholder="0.00"
                                    disabled={semanaActualProcesada}
                                    className="w-20 bg-zinc-950/40 border border-zinc-800 hover:border-zinc-700 focus:border-amber-500 text-white rounded-lg px-2.5 py-1 text-right text-xs transition-colors outline-none focus:ring-1 focus:ring-amber-500/50 disabled:opacity-40 disabled:cursor-not-allowed"
                                  />
                                </td>
                                {/* Bonificaciones */}
                                <td className="px-5 py-3 text-right">
                                  <input type="number" value={row.bonificaciones || ''} onChange={e => handleUpdateRow(p.id, { bonificaciones: Number(e.target.value) || 0 })} placeholder="0.00" disabled={semanaActualProcesada || row.diasInputBloqueado} className="w-20 bg-zinc-950/40 border border-zinc-800 hover:border-zinc-700 focus:border-amber-500 text-white rounded-lg px-2.5 py-1 text-right text-xs transition-colors outline-none focus:ring-1 focus:ring-amber-500/50 disabled:opacity-40 disabled:cursor-not-allowed" />
                                </td>
                                {/* Vales Badge */}
                                <td className="px-5 py-3 text-right">
                                  <button onClick={() => openDrawer(p.id)} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${row.totalVales > 0 ? 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20' : 'bg-zinc-950/40 border-zinc-800 text-white/50 hover:border-zinc-700 hover:text-white/70'}`}>
                                    <FileText className="w-3.5 h-3.5" />
                                    {row.totalVales > 0 ? (
                                      <><span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500/30 text-[8px] font-black text-red-300">{row.valesPendientes.length}</span> {fmtMoney(row.totalVales)}</>
                                    ) : '0.00'}
                                  </button>
                                </td>
                                {/* Total */}
                                <td className="px-5 py-3 text-right text-xs font-black tabular-nums text-amber-500">{fmtMoney(row.total)}</td>
                                {/* Actions */}
                                <td className="px-5 py-3 text-center">
                                  <div className="flex flex-col items-center gap-1.5">
                                    <div className="flex items-center justify-center gap-1">
                                      <button onClick={() => setSelectedReceipt(row)} title="Ficha" className="p-1.5 rounded-lg hover:bg-white/[0.04] text-white/40 hover:text-white transition-colors"><Receipt className="w-4 h-4" /></button>
                                      {canEdit && !semanaActualProcesada && (
                                        <>
                                          <button
                                            onClick={() => openAssignForReassign(p.id)}
                                            title="Cambiar asignación"
                                            className="p-1.5 rounded-lg hover:bg-white/[0.04] text-white/40 hover:text-cyan-400 transition-colors"
                                          >
                                            <RefreshCw className="w-4 h-4" />
                                          </button>
                                          <button onClick={() => openEdit(p)} title="Editar" className="p-1.5 rounded-lg hover:bg-white/[0.04] text-white/40 hover:text-amber-500 transition-colors"><Edit2 className="w-4 h-4" /></button>
                                          <button
                                            onClick={() => handleDelete(p.id)}
                                            title={manuallyAddedIdsSet.has(p.id) ? "Quitar de esta semana" : "Baja"}
                                            className={`p-1.5 rounded-lg transition-colors ${
                                              manuallyAddedIdsSet.has(p.id)
                                                ? 'hover:bg-amber-500/10 text-white/40 hover:text-amber-400'
                                                : 'hover:bg-red-500/10 text-white/40 hover:text-red-400'
                                            }`}
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </button>
                                        </>
                                      )}
                                    </div>
                                    {canEdit && !semanaActualProcesada ? (
                                      <input
                                        value={row.ajusteMotivo || ''}
                                        onChange={(e) => handleUpdateRow(p.id, { ajusteMotivo: e.target.value })}
                                        placeholder="Motivo ajuste"
                                        className="w-32 rounded-md border border-zinc-800 bg-zinc-950/40 px-2 py-1 text-[10px] text-white outline-none transition-colors placeholder:text-white/25 focus:border-amber-500"
                                      />
                                    ) : null}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                          {/* SUBTOTAL FOOTER ROW — celda única para fondo oscuro a todo el ancho */}
                          <tr className="nomina-cargo-group__subtotal-row border-t border-zinc-700/50">
                            <td colSpan={10} className="nomina-cargo-group__subtotal-cell bg-zinc-950/60 p-0">
                              <div className="flex min-w-full items-center gap-4 px-5 py-2.5">
                                <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-white/50">
                                  Subtotal {cargoName}
                                </span>
                                <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-0">
                                  <span className="w-20 shrink-0 text-right text-xs font-bold tabular-nums text-white/60 sm:w-24">
                                    {fmtMoney(groupSueldo)}
                                  </span>
                                  <span className="w-20 shrink-0 border-l border-amber-500/10 px-3 text-right text-xs font-bold tabular-nums text-white/60 sm:w-24">
                                    {fmtMoney(groupBono)}
                                  </span>
                                  <span className="w-20 shrink-0 px-3 text-right text-xs font-bold tabular-nums text-white/60 sm:w-24">
                                    {fmtMoney(groupBonif)}
                                  </span>
                                  <span className="w-20 shrink-0 border-r border-amber-500/10 px-3 text-right text-xs font-bold tabular-nums text-red-400/70 sm:w-24">
                                    {groupVales > 0 ? `-${fmtMoney(groupVales)}` : '$0.00'}
                                  </span>
                                  <span className="w-24 shrink-0 pl-3 text-right text-sm font-black tabular-nums text-amber-500 sm:w-28">
                                    {fmtMoney(groupTotal)}
                                  </span>
                                </div>
                              </div>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {novedadesTurnoSemana.length > 0 ? (
              <div className="rounded-xl border border-[var(--mineos-general-border,rgba(212,175,55,0.15))] bg-[var(--mineos-general-soft,rgba(212,175,55,0.04))] px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">
                  Novedades del turno · semana actual
                </p>
                <ul className="mt-2 space-y-1.5">
                  {novedadesTurnoSemana.map((r) => {
                    const pagoUnico = reposoPagoUnicoMontoFromRow(r);
                    return (
                      <li
                        key={r.personal.id}
                        className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-xs text-[var(--text-secondary)]"
                      >
                        <span className="font-semibold text-[var(--text-primary)]">
                          {r.personal.nombre_completo}
                        </span>
                        <span className="flex flex-wrap items-baseline justify-end gap-x-2 gap-y-0.5 text-right">
                          <span>{describeNovedadTurnoSemana(r)}</span>
                          {pagoUnico > 0 ? (
                            <span className="font-semibold tabular-nums text-[var(--accent)]">
                              +{fmtMoney(pagoUnico)}
                            </span>
                          ) : null}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {novedadPagoUnicoTotal > 0 ? (
                  <p className="mt-2 border-t border-[var(--card-border)] pt-2 text-right text-[10px] font-semibold tabular-nums text-[var(--text-secondary)]">
                    Pagos únicos (novedad):{' '}
                    <span className="text-[var(--accent)]">{fmtMoney(novedadPagoUnicoTotal)}</span>
                    <span className="ml-1 font-normal text-[var(--text-muted)]">
                      · incluidos en total semana, no en sueldo cuadrilla
                    </span>
                  </p>
                ) : null}
              </div>
            ) : null}

            <NominaNovedadesManualesSection
              items={novedadesManuales}
              canEdit={canEdit && !semanaActualProcesada}
              onAdd={() => {
                setEditingNovedad(null);
                setShowNovedadModal(true);
              }}
              onEdit={(item) => {
                setEditingNovedad(item);
                setShowNovedadModal(true);
              }}
              onDelete={handleDeleteNovedad}
            />
          </div>
          </div>
            )}
        </div>
        </div>
      </div>

      <NominaMobileDock
        cerrada={semanaActualProcesada}
        canEdit={canEdit}
        hasRows={preNominaRows.length > 0}
        isPending={isPending}
        onCerrar={() => { setCierreModalError(null); setShowProcesarModal(true); }}
        onRevertir={() => semanaActualCerrada && handleRevertirSemana(semanaActualCerrada)}
        onRegistrar={() => setShowAssignModal(true)}
        onMore={() => setMobileMoreOpen(true)}
      />
      <NominaMobileSemanaSheet
        open={semanaSheetOpen}
        onClose={() => setSemanaSheetOpen(false)}
        cerrada={semanaActualProcesada}
        semanaActual={semanaActualCerrada}
        weekRange={weekRange}
        setWeekRange={setWeekRange}
        preNominaCount={preNominaRows.length}
        totalSemana={totalSemana}
        activos={data.length}
        procesadoOk={procesadoOk}
        semanas={semanas}
        showHistorial={showHistorial}
        setShowHistorial={setShowHistorial}
        canEdit={canEdit}
        isPending={isPending}
        onRevertir={handleRevertirSemana}
        anomalyPct={prevSemana ? weekDeltaPct : null}
        temporalHint={
          weekRange.inicio !== temporalCtx.workingWeekStart
            ? formatTemporalContextHint(temporalCtx)
            : null
        }
        onGoWorkingWeek={() =>
          setWeekRange({
            inicio: temporalCtx.workingWeekStart,
            fin: temporalCtx.workingWeekEnd,
          })
        }
        distribucionPanel={
          preNominaRows.length > 0 || semanaActualProcesada ? (
            <NominaDistribucionPanel
              totalNomina={totalSemana}
              partes={distribucion.partes}
              lineas={distribucion.lineas}
              sumPct={distribucion.sumPct}
              validationOk={distribucion.validation.ok}
              validationMessage={distribucion.validation.message}
              onUpdateParte={distribucion.updateParte}
              onAddParte={distribucion.addParte}
              onRemoveParte={distribucion.removeParte}
              onRebalance={distribucion.rebalanceIgual}
              onSaveDefault={distribucion.saveAsDefault}
              variant="dark"
              compact
              readOnly={semanaActualProcesada}
            />
          ) : undefined
        }
        fmtMoney={fmtMoney}
        fmtDate={fmtDate}
      />
      <NominaMobileMoreSheet
        open={mobileMoreOpen}
        onClose={() => setMobileMoreOpen(false)}
        canEdit={canEdit}
        hasData={preNominaRows.length > 0 && !semanaActualProcesada}
        onNovedad={() => {
          setEditingNovedad(null);
          setShowNovedadModal(true);
        }}
        onCsv={handleExportCSV}
        onExcel={() => {
          setMobileMoreOpen(false);
          setPreviewInitialRange({ start: weekRange.inicio, end: weekRange.fin });
          setShowExcelPreview(true);
        }}
        onBorrar={() => setShowBorrarModal(true)}
        onInicio={() => router.push('/dashboard')}
      />

      {drawerRow ? (
        <NominaTrabajadorModal
          open={!!drawerPersonalId}
          onClose={() => setDrawerPersonalId(null)}
          row={drawerRow}
          vales={drawerVales}
          historial={drawerHistorial}
          loading={loadingDrawer}
          canEdit={canEdit}
          locked={semanaActualProcesada}
          weekStart={weekRange.inicio}
          weekEnd={weekRange.fin}
          isPending={isPending}
          newValeMonto={newValeMonto}
          newValeMotivo={newValeMotivo}
          onNewValeMontoChange={setNewValeMonto}
          onNewValeMotivoChange={setNewValeMotivo}
          onAddVale={handleAddVale}
          onDeleteVale={handleDeleteVale}
          onEditPerfil={() => {
            openEdit(drawerRow.personal);
            setDrawerPersonalId(null);
          }}
          onFichaPago={() => {
            setSelectedReceipt(drawerRow);
            setDrawerPersonalId(null);
          }}
          fmtMoney={fmtMoney}
          fmtDate={fmtDate}
          initials={getInitials(drawerRow.personal.nombre_completo)}
          avatarColor={getAvatarColor(drawerRow.personal.cargo)}
        />
      ) : null}

      {showAssignModal ? (
        <PersonalQuickAssignModal
          open={showAssignModal}
          onClose={() => {
            setShowAssignModal(false);
            setAssignModalPreselectedId(null);
          }}
          area={area}
          masterCatalog={baseTrabajadores}
          perfilesCompensacion={perfilesCompensacion}
          assignedIds={assignedIds}
          currentAssignments={currentAssignments}
          preselectedPersonalId={assignModalPreselectedId}
          onAssigned={(personalId, areaDetalle, createdPersonal) => {
            markOperationalWeekEmptied(area, weekRange.inicio, false);
            addToManualWeekRoster(
              area,
              weekRange.inicio,
              personalId,
              areaDetalle,
              manualPeriodId,
            );
            appendAssignedWorker(personalId, areaDetalle, createdPersonal);
            setManualRosterTick((t) => t + 1);
          }}
        />
      ) : null}

      {showExcelPreview ? (
        <NominaVistaPreviaModal
          open={showExcelPreview}
          onClose={() => {
            setShowExcelPreview(false);
            setPreviewInitialRange(null);
            if (searchParams.get('tool') === 'vista') {
              router.replace(pathname, { scroll: false });
            }
          }}
          initialRange={previewDefaultRange}
          refreshKey={previewRefreshKey}
          filterArea={area}
          areaLabel={pageTitle}
          activeWeek={
            weekRange.inicio
              ? { semana_inicio: weekRange.inicio, semana_fin: weekRange.fin }
              : undefined
          }
          activeRegistros={previewActiveRegistros}
          activePlantilla={manualPlantillaActiva}
          availablePlantillas={rotacionPlantillas}
          activeManualPeriod={previewManualPeriod}
          novedadesManuales={novedadesManuales.map(mapNovedadManualToPreview)}
        />
      ) : null}

      {showNovedadModal && (
        <NominaNovedadModal
          open={showNovedadModal}
          onClose={() => {
            setShowNovedadModal(false);
            setEditingNovedad(null);
          }}
          onSave={handleSaveNovedad}
          personalCatalog={personalCatalogMerged}
          initialData={editingNovedad}
          area={area}
          weekStart={weekRange.inicio}
        />
      )}

      {showArchivo ? (
        <NominaArchivoModal
          open={showArchivo}
          onClose={() => setShowArchivo(false)}
          userId={user?.id}
          area={area as 'mina' | 'planta'}
          refreshKey={archivoRefreshKey}
          onImport={() => {
            setShowArchivo(false);
            setShowImport(true);
          }}
          onPeriodDeleted={() => {
            setArchivoRefreshKey((k) => k + 1);
            setPreviewRefreshKey((k) => k + 1);
          }}
        />
      ) : null}

      <PageFormModal
        open={showModal}
        onClose={() => setShowModal(false)}
        sheetTitle={editItem ? 'Editar Trabajador' : 'Registrar Nuevo Trabajador'}
        sheetIcon={<SheetIconBadge icon={Users} tone="success" />}
        panelClassName="sm:max-w-3xl"
      >
            <button type="button" onClick={() => setShowModal(false)} className="absolute right-5 top-5 hidden rounded-lg p-1.5 text-white/40 transition-colors hover:bg-white/[0.06] hover:text-white lg:flex sm:right-6 sm:top-6" aria-label="Cerrar"><X className="w-5 h-5" /></button>
            <h3 className="page-form-modal-title hidden pr-10 text-xl font-bold tracking-wide text-white/90 lg:block">{editItem ? 'Editar Trabajador' : 'Registrar Nuevo Trabajador'}</h3>
            {formError && <p className="text-red-400 text-xs mb-4 bg-red-500/10 p-2.5 rounded-xl border border-red-500/20">{formError}</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="input-label">Nombre y apellido *</label>
                <input type="text" placeholder="Ej: Alexander Villasmil" value={form.nombre_completo} onChange={e => setForm({...form, nombre_completo: e.target.value})} className="input-field" />
              </div>
              <div>
                <label className="input-label">Cédula *</label>
                <input type="text" placeholder="9933498" value={form.cedula} onChange={e => setForm({...form, cedula: e.target.value})} className="input-field" />
              </div>
              <div>
                <label className="input-label">Cargo</label>
                <input type="text" placeholder="Opcional" value={form.cargo} onChange={e => setForm({...form, cargo: e.target.value})} className="input-field" />
              </div>
              <div>
                <label className="input-label">Fecha de nacimiento</label>
                <AppDatePicker value={form.fecha_nacimiento} onChange={(v) => setForm({ ...form, fecha_nacimiento: v })} />
              </div>
              <div>
                <label className="input-label">Fecha de ingreso</label>
                <AppDatePicker value={form.fecha_ingreso} onChange={(v) => setForm({ ...form, fecha_ingreso: v })} />
              </div>
              <div>
                <label className="input-label">Ajuste antigüedad (días)</label>
                <input type="number" min="0" className="input-field" value={form.ajuste_antiguedad_dias} onChange={e => setForm({...form, ajuste_antiguedad_dias: e.target.value})} />
              </div>
              <div>
                <label className="input-label">Teléfono</label>
                <input type="text" placeholder="0414-1234567" value={form.telefono} onChange={e => setForm({...form, telefono: e.target.value})} className="input-field" />
              </div>
              <div className="sm:col-span-2">
                <label className="input-label">Asignación (vertical / sector) *</label>
                <AppSelect
                  value={form.area_detalle}
                  onChange={(val) => setForm({ ...form, area_detalle: val })}
                  options={ASIGNACION_NOMINA_OPCIONES.map((value) => ({ value, label: value }))}
                  placeholder="Seleccionar vertical/sector"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="input-label">Perfil de compensación *</label>
                <AppSelect
                  value={form.perfil_compensacion_id}
                  onChange={(val) => setForm({ ...form, perfil_compensacion_id: val })}
                  options={perfilesCompensacion.map((p) => ({ value: p.id, label: p.nombre }))}
                  placeholder="Seleccionar perfil"
                />
                {editSelectedPerfil ? (
                  <p className="mt-1 text-[10px] text-white/35">
                    Esquema: {editSelectedPerfil.esquema_rotacion_default} · {editSelectedPerfil.semanas_trabajadas_por_ciclo} trab. / {editSelectedPerfil.semanas_libres_por_ciclo} libre
                  </p>
                ) : null}
              </div>
              <div>
                <label className="input-label">Sueldo base semanal (USD) *</label>
                <input type="number" step="0.01" min="0" placeholder="150.00" value={form.salario_base} onChange={e => setForm({...form, salario_base: e.target.value})} className="input-field" />
              </div>
              <div>
                <label className="input-label">Sueldo libre / tarifa plana</label>
                <input type="number" step="0.01" min="0" placeholder="Vacío = sueldo base" value={form.salario_libre} onChange={e => setForm({...form, salario_libre: e.target.value})} className="input-field" />
              </div>
              <div>
                <label className="input-label">Bono transporte</label>
                <input type="number" step="0.01" min="0" placeholder="30" value={form.bono_transporte} onChange={e => setForm({...form, bono_transporte: e.target.value})} className="input-field" />
              </div>
              <div>
                <label className="input-label">Área / sitio laboral</label>
                <input
                  list="nomina-edit-ubicacion-options"
                  className="input-field"
                  value={form.ubicacion_laboral}
                  onChange={e => setForm({...form, ubicacion_laboral: e.target.value})}
                  placeholder={biblioteca.ubicacionDefaultPorArea[area] || 'Opcional'}
                />
                <datalist id="nomina-edit-ubicacion-options">
                  {editUbicacionSugerencias.map((u) => (
                    <option key={u} value={u} />
                  ))}
                </datalist>
              </div>
              {editPerfilTieneRotacion ? (
                <div className="sm:col-span-2 rounded-lg border border-[var(--card-border)] bg-[var(--surface-elevated)] p-3">
                  <p className="text-xs font-semibold text-[var(--text-primary)]">Asistente de rotación</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-muted)]">
                    Indica una semana conocida y el estado observado; MineOS deduce el inicio del ciclo.
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="input-label">Semana de referencia</label>
                      <AppDatePicker
                        value={form.rotacion_estado_referencia_semana}
                        onChange={(v) => setForm({ ...form, rotacion_estado_referencia_semana: v, rotacion_inicio_fecha: '' })}
                      />
                    </div>
                    <div>
                      <label className="input-label">Estado observado</label>
                      <AppSelect
                        value={form.rotacion_estado_referencia_posicion}
                        onChange={(v) => setForm({ ...form, rotacion_estado_referencia_posicion: v, rotacion_inicio_fecha: '' })}
                        options={editRotacionEstadoOptions}
                        placeholder="Seleccionar estado"
                      />
                    </div>
                  </div>
                  <div className="mt-3 rounded-md border border-[var(--card-border)] bg-black/10 px-3 py-2 text-[11px] text-[var(--text-secondary)]">
                    Inicio deducido:{' '}
                    <span className="font-semibold text-[var(--text-primary)]">
                      {editRotacionInicioDeducido || form.rotacion_inicio_fecha || 'pendiente'}
                    </span>
                  </div>
                </div>
              ) : null}
              <div className="sm:col-span-2">
                <label className="input-label">Observación general</label>
                <textarea placeholder="Notas internas sobre el trabajador" value={form.notas} onChange={e => setForm({...form, notas: e.target.value})} className="input-field h-20 resize-none text-xs" />
              </div>
            </div>
            <PageFormModalFooter className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
              <button type="button" onClick={handleSave} disabled={isPending} className="btn-primary min-w-[110px] justify-center">{isPending ? 'Guardando...' : 'Guardar'}</button>
            </PageFormModalFooter>
      </PageFormModal>

      <PageFormModal
        open={showProcesarModal}
        onClose={() => setShowProcesarModal(false)}
        sheetTitle="Consola de Cierre"
        sheetIcon={<SheetIconBadge icon={Wallet} tone="warn" />}
        panelClassName="sm:max-w-lg"
      >
            <button type="button" onClick={() => setShowProcesarModal(false)} className="absolute right-5 top-5 hidden rounded-lg p-1.5 text-white/40 hover:text-white lg:flex sm:right-6 sm:top-6" aria-label="Cerrar"><X className="w-5 h-5" /></button>
            <h3 className="page-form-modal-title mb-2 hidden items-center gap-2 pr-10 text-lg font-semibold text-white/90 lg:flex"><Wallet className="w-5 h-5 text-amber-500" /> Consola de Cierre</h3>
            <p className="text-xs text-white/40 mb-6 uppercase tracking-wider">Rango de nómina semanal</p>
            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1"><label className="input-label">Inicio</label><AppDatePicker value={weekRange.inicio} onChange={(v) => setWeekRange({ ...weekRange, inicio: v })} /></div>
              <span className="text-white/40 self-end mb-3">a</span>
              <div className="flex-1"><label className="input-label">Fin</label><AppDatePicker value={weekRange.fin} onChange={(v) => setWeekRange({ ...weekRange, fin: v })} /></div>
            </div>
            <p className="mb-4 text-[10px] text-white/40 uppercase tracking-wider">
              {preNominaRows.length} trabajadores · {preNominaRows.filter((r) => r.totalVales > 0).length} con vales
            </p>
            <NominaDistribucionPanel
              totalNomina={totalSemana}
              partes={distribucion.partes}
              lineas={distribucion.lineas}
              sumPct={distribucion.sumPct}
              validationOk={distribucion.validation.ok}
              validationMessage={distribucion.validation.message}
              onUpdateParte={distribucion.updateParte}
              onAddParte={distribucion.addParte}
              onRemoveParte={distribucion.removeParte}
              onRebalance={distribucion.rebalanceIgual}
              onSaveDefault={distribucion.saveAsDefault}
              variant="dark"
            />
            {cierreModalError ? (
              <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/15 p-3.5 text-xs text-red-200">
                <div className="font-bold text-red-300 flex items-center gap-2">
                  <AlertTriangle className="size-4 shrink-0 text-red-400" />
                  No se pudo cerrar la nómina
                </div>
                <div className="mt-1 text-red-200/90">{cierreModalError}</div>
              </div>
            ) : null}
            <PageFormModalFooter className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowProcesarModal(false);
                  setCierreModalError(null);
                }}
                disabled={isCerrando}
                className="btn-secondary"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleProcesarNomina}
                disabled={isCerrando}
                className="btn-primary min-w-[120px] justify-center"
              >
                {isCerrando ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Procesando...
                  </span>
                ) : (
                  'Confirmar Cierre'
                )}
              </button>
            </PageFormModalFooter>
      </PageFormModal>

      {showImport ? (
        <NominaImportModal
          open={showImport}
          onClose={() => setShowImport(false)}
          area={area}
          data={data}
          weekStart={weekRange.inicio}
          canEdit={canEdit}
          onWeekDetected={(inicio, fin) => setWeekRange({ inicio, fin })}
          onImported={handleNominaImported}
        />
      ) : null}

      <NominaPdfPreviewModal
        open={pdfPreview.open}
        onClose={closePdfPreview}
        title={pdfPreview.title}
        blobUrl={pdfPreview.url}
        loading={pdfPreview.loading}
        error={pdfPreview.error}
        onDownload={() => {
          if (pdfPreview.blob && pdfPreview.meta) {
            const meta = pdfPreview.meta;
            const url = pdfPreview.url;
            if (!url) return;
            const a = document.createElement('a');
            a.href = url;
            a.download = `nomina-plantilla-${meta.plantillaNombre.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-ciclo-${meta.cycleStart}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
          }
        }}
        onShare={
          pdfShareSupported && pdfPreview.blob && pdfPreview.meta
            ? () => {
                void handleSharePlantillaPdf();
              }
            : undefined
        }
        canShare={pdfShareSupported}
      />

      {showRotacionSandbox ? (
        <RotacionPlantillaSandboxModal
          open={showRotacionSandbox}
          onClose={() => {
            setShowRotacionSandbox(false);
            setSandboxPlantillaId(undefined);
          }}
          area={area}
          canEdit={canEdit}
          initialPlantillaId={sandboxPlantillaId}
          onSaved={async () => {
            await refreshPlantillas();
            try { router.refresh(); } catch {}
          }}
        />
      ) : null}

      <PageFormModal
        open={showBorrarModal}
        onClose={() => setShowBorrarModal(false)}
        sheetTitle="¿Vaciar la semana?"
        sheetIcon={<SheetIconBadge icon={AlertTriangle} tone="warn" />}
        panelClassName="max-w-sm text-center"
      >
            <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-amber-500" />
            <h3 className="page-form-modal-title mb-2 hidden text-lg font-bold lg:block">¿Vaciar la semana?</h3>
            <p className="mb-6 text-xs text-white/50">
              Se quitarán {preNominaRows.length} trabajadores de la planilla de esta semana. No se desactivan de la base de datos.
            </p>
            <PageFormModalFooter className="flex gap-3">
              <button type="button" onClick={() => setShowBorrarModal(false)} className="btn-secondary flex-1 py-2.5 text-xs font-bold">Cancelar</button>
              <button type="button" onClick={handleVaciarSemana} disabled={isPending} className="btn-primary flex-1 py-2.5 text-xs font-bold disabled:opacity-40">{isPending ? 'Procesando...' : 'Vaciar semana'}</button>
            </PageFormModalFooter>
      </PageFormModal>

      <PageFormModal
        open={showProjectionModal}
        onClose={() => setShowProjectionModal(false)}
        sheetTitle="Revisar y Aplicar Roster Proyectado"
        sheetIcon={<SheetIconBadge icon={Users} tone="info" />}
        panelClassName="max-w-md text-left"
      >
        <div className="flex flex-col min-h-0 text-white">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-5 w-5 text-[var(--mineos-benefit)]" />
            <h3 className="page-form-modal-title text-base font-bold">Revisar y Aplicar Proyección</h3>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mb-4 leading-normal">
            Selecciona los trabajadores de <strong className="text-amber-400">Grupo (Mixto)</strong> que deseas incluir en la nómina de esta semana del <span className="font-semibold">{fmtDate(weekRange.inicio)} al {fmtDate(weekRange.fin)}</span>:
          </p>

          <div className="max-h-[300px] overflow-y-auto border border-zinc-800 rounded-lg bg-zinc-950/40 p-2.5 space-y-2 mb-5 scroll-y-fade">
            {grupoMixtoWorkers.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] text-center py-4">No hay trabajadores de Grupo (Mixto) activos.</p>
            ) : (
              grupoMixtoWorkers.map((p) => {
                const isSelected = selectedProjectionIds.includes(p.id);
                const isExpected = grupoMixtoRosterProjection?.expectedIds.includes(p.id) ?? false;
                return (
                  <label
                    key={p.id}
                    className={`flex items-center justify-between p-2 rounded-lg border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[var(--mineos-benefit-border)] bg-[var(--mineos-benefit-soft)] text-white'
                        : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/30 text-white/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleProjectionWorker(p.id)}
                        className="rounded border-zinc-700 bg-zinc-950 text-[var(--mineos-benefit)] focus:ring-[var(--mineos-benefit)] w-4 h-4 cursor-pointer"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate">{p.nombre_completo}</p>
                        <p className="text-[10px] text-[var(--text-muted)]">C.I. {p.cedula}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {isExpected ? (
                        <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-400 uppercase tracking-wide">
                          Esperado
                        </span>
                      ) : (
                        <span className="text-[8px] font-medium px-1 py-0.5 rounded bg-zinc-800 text-zinc-500 uppercase tracking-wide">
                          No esperado
                        </span>
                      )}
                      {p.cargo && (
                        <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-white/[0.04] text-white/40 uppercase tracking-wider max-w-[80px] truncate">
                          {p.cargo}
                        </span>
                      )}
                    </div>
                  </label>
                );
              })
            )}
          </div>

          <PageFormModalFooter className="flex gap-3">
            <button
              type="button"
              onClick={() => setShowProjectionModal(false)}
              className="btn-secondary flex-1 py-2.5 text-xs font-bold"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleApplyProjection}
              disabled={grupoMixtoWorkers.length === 0}
              className="btn-primary flex-1 py-2.5 text-xs font-bold disabled:opacity-40"
            >
              Aplicar Roster
            </button>
          </PageFormModalFooter>
        </div>
      </PageFormModal>

      {selectedReceipt ? (
      <PageFormModal open onClose={() => setSelectedReceipt(null)} panelClassName="max-w-md">
          <style>{`@media print{body *{visibility:hidden}#printable-receipt-card,#printable-receipt-card *{visibility:visible}#printable-receipt-card{position:absolute;left:0;top:0;width:100%;color:black!important;background:white!important;border:0!important;box-shadow:none!important}#receipt-buttons-bar{display:none!important}#printable-receipt-card button{display:none!important}#printable-receipt-card *{color:black!important}}`}</style>
          <div id="printable-receipt-card" className="text-white">
            <div className="text-center pb-4 border-b border-dashed border-white/10">
              <h2 className="text-sm font-bold tracking-wider uppercase">MOLINOS LA FÉ - MINA BELÉN</h2>
              <p className="text-[9px] text-white/35 tracking-widest uppercase mt-0.5">COMPLEJO OPERATIVO EL CALLAO, BOLÍVAR</p>
              <p className="text-[10px] text-amber-500 font-bold tracking-wider mt-2 uppercase">VOUCHER DE NÓMINA SEMANAL</p>
            </div>
            <div className="py-4 space-y-2 border-b border-dashed border-white/10 text-xs">
              <div className="flex justify-between"><span className="text-white/40">Trabajador:</span><span className="font-bold text-white/95">{selectedReceipt.personal.nombre_completo}</span></div>
              <div className="flex justify-between"><span className="text-white/40">C.I.:</span><span className="text-white/95">{selectedReceipt.personal.cedula}</span></div>
              <div className="flex justify-between"><span className="text-white/40">Cargo:</span><span className="text-white/95">{selectedReceipt.personal.cargo}</span></div>
              <div className="flex justify-between"><span className="text-white/40">Periodo:</span><span className="text-white/95">{fmtDate(weekRange.inicio)} al {fmtDate(weekRange.fin)}</span></div>
              <div className="flex justify-between"><span className="text-white/40">Asistencia:</span><span className="font-bold text-amber-500 uppercase">{selectedReceipt.estadoAsistencia}</span></div>
            </div>
            <div className="py-4 space-y-2 border-b border-dashed border-white/10 text-xs">
              <div className="flex justify-between"><span className="text-white/40">Días trabajados:</span><span className="font-bold text-amber-500">{selectedReceipt.diasTrabajados} {selectedReceipt.diasTrabajados > NOMINA_DIAS_POR_SEMANA ? `(sem. base ${NOMINA_DIAS_POR_SEMANA} + extra)` : `/ ${NOMINA_DIAS_POR_SEMANA}`}</span></div>
              <div className="flex justify-between"><span className="text-white/40">Sueldo:</span><span className="text-white/95 font-semibold tabular-nums">{fmtMoney(selectedReceipt.salarioBaseCalculado)}</span></div>
              <div className="flex justify-between"><span className="text-white/40">Bono Transporte:</span><span className="text-emerald-400 font-semibold tabular-nums">+{fmtMoney(selectedReceipt.bonoTransporte)}</span></div>
              <div className="flex justify-between"><span className="text-white/40">Bonificaciones:</span><span className="text-emerald-400 font-semibold tabular-nums">+{fmtMoney(selectedReceipt.bonificaciones)}</span></div>
              <div className="flex justify-between"><span className="text-white/40">Vales/Adelantos:</span><span className="text-red-400 font-semibold tabular-nums">-{fmtMoney(selectedReceipt.totalVales)}</span></div>
              {selectedReceipt.valesPendientes.length > 0 && (<div className="pl-4 space-y-1 pt-1">{selectedReceipt.valesPendientes.map(v => (<div key={v.id} className="flex justify-between text-[10px] text-white/30"><span>→ {v.motivo || 'Adelanto'} ({fmtDate(v.fecha)})</span><span className="tabular-nums">-{fmtMoney(Number(v.monto))}</span></div>))}</div>)}
            </div>
            <div className="py-4 flex justify-between items-center border-b border-dashed border-white/10">
              <span className="font-bold text-white/50 tracking-wider text-sm">TOTAL NETO:</span>
              <span className="text-xl font-black text-amber-500 tabular-nums">{fmtMoney(selectedReceipt.total)}</span>
            </div>
            <div className="grid grid-cols-2 gap-6 pt-6 pb-2 text-[8px] uppercase tracking-widest text-center text-white/35">
              <div className="border-t border-white/10 pt-4 flex flex-col gap-1"><span>Pedro G. / Darinel R.</span><span>ADMINISTRACIÓN</span></div>
              <div className="border-t border-white/10 pt-4 flex flex-col gap-1"><span>{selectedReceipt.personal.nombre_completo.split(' ')[1] || 'Trabajador'}</span><span>FIRMA CONFORME</span></div>
            </div>
            <div id="receipt-buttons-bar">
            <PageFormModalFooter className="mt-6 flex gap-2">
              <button type="button" onClick={() => setSelectedReceipt(null)} className="btn-secondary flex h-10 flex-1 items-center justify-center gap-1.5 text-xs font-bold"><X className="w-3.5 h-3.5" /> Cerrar</button>
              <button type="button" onClick={() => copyReceiptToClipboard(selectedReceipt)} className="btn-secondary flex h-10 flex-1 items-center justify-center gap-1.5 text-xs font-bold">
                {copiedReceipt ? <><Check className="w-3.5 h-3.5 text-emerald-400" /> ¡Copiado!</> : <><Copy className="w-3.5 h-3.5" /> WhatsApp</>}
              </button>
              <button type="button" onClick={() => window.print()} className="btn-primary flex h-10 flex-1 items-center justify-center gap-1.5 text-xs font-bold"><Printer className="w-3.5 h-3.5" /> Imprimir</button>
            </PageFormModalFooter>
            </div>
          </div>
      </PageFormModal>
      ) : null}
    </div>
  );
}

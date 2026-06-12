'use client';

import { useState, useTransition, useMemo, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useCanEdit } from '@/lib/use-can-edit';
import { 
  Pickaxe, Upload, RefreshCw, Plus, Trash2, Loader2, Calendar, 
  Clock, ChevronDown, ChevronUp, CheckCircle2, AlertTriangle, 
  Search, Factory, Shield, Truck, Briefcase, Edit2, Receipt, 
  Printer, X, Users, Wallet, ChevronRight, FileText, Download,
  TrendingUp, TrendingDown, RotateCcw, Clipboard,
  Hammer, Umbrella, XCircle, Copy, Check, Lock, FileSpreadsheet, Archive, LayoutGrid
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
import { PersonalQuickAssignModal } from '@/components/nomina/PersonalQuickAssignModal';
import NominaNovedadTurnoCell from '@/components/nomina/NominaNovedadTurnoCell';
import NominaTrabajadorModal from '@/components/nomina/NominaTrabajadorModal';
import { NominaCiclosView } from '@/components/nomina/NominaCiclosView';
import { NominaVistaPreviaModal } from '@/components/nomina/NominaVistaPreviaModal';
import type { NominaPreviewRange } from '@/components/nomina/NominaVistaPreviaContent';
import type { NominaImportResult } from '@/components/nomina/NominaImportWizard';
import { NominaArchivoModal } from '@/components/nomina/NominaArchivoModal';
import { AppSelect } from '@/components/ui/AppSelect';
import { AppDatePicker } from '@/components/ui/AppDatePicker';
import { MINEOS_BTN_NOMINA_PRIMARY } from '@/lib/mineos-visual';
import {
  hasNovedadTurno,
  nominaNovedadDraftKey,
  describeNovedadTurnoSemana,
  parseNovedadTurno,
  patchAlMarcarNovedadTurno,
  patchAlCambiarAsistencia,
  preNominaRowToWeekDraft,
  parseReposoCondicionFromObs,
  formatNovedadTurnoObsForSave,
  readNominaNovedadDraft,
  reposoPagoUnicoMontoFromRow,
  weekDraftToRowOverrides,
  writeNominaNovedadDraft,
} from '@/lib/nomina-novedad-turno';
import { PageFormModal, PageFormModalFooter } from '@/components/ui/PageFormModal';
import { SheetIconBadge } from '@/components/mobile';
import NominaDistribucionPanel from '@/components/nomina/NominaDistribucionPanel';
import { useNominaDivisionesConfig } from '@/hooks/use-nomina-divisiones-config';
import { NominaImportModal } from '@/components/nomina/NominaImportModal';
import { RotacionPlantillaSandboxModal } from '@/components/nomina/RotacionPlantillaSandboxModal';
import { listRotacionPlantillasAction } from '@/lib/actions/rotacion-plantillas';
import {
  RotacionInstanciaPanel,
  RotacionInstanciaBanner,
} from '@/components/nomina/RotacionInstanciaPanel';
import { resolveWorkerRotacionContext } from '@/lib/rotacion-plantillas/projection';
import { resolveDiasInputBloqueadoPlantilla } from '@/lib/rotacion-plantillas/semana-cierre';
import { deserializeInstanciaSnapshot } from '@/lib/rotacion-plantillas/instancia-serialize';
import type { InstanciaActivaSerialized } from '@/lib/rotacion-plantillas/instancia-serialize';
import type { RotacionPlantillaRecord } from '@/lib/rotacion-plantillas/types';
import type { PerfilCompensacion, PoliticaReposo } from '@/lib/types';
import { validarCierreRotacionSemanalAction } from '@/lib/actions/rotacion-instancias';
import { resolveNominaTemporalContext, resolveWorkingWeek, formatTemporalContextHint } from '@/lib/nomina/temporal-context';
import {
  attachSemanaToManualPeriod,
  detachSemanaFromManualPeriod,
  normalizeManualPeriod,
  weekInManualPeriod,
  clearLocalDraftsForPeriod,
  computeManualPeriodProgress,
  resolveClosedSemanaForManualPeriod,
  type ManualNominaPeriod,
} from '@/lib/nomina/manual-period';
import {
  emptyManualPeriodsSession,
  ensureWorkingWeekInPeriodAssignment,
  getPeriodById,
  loadManualPeriodsSession,
  removePeriodFromSession,
  resolveManualPeriodForWeek,
  saveManualPeriodsSession,
  upsertPeriodInSession,
  type ManualPeriodsSession,
} from '@/lib/nomina/manual-period-session';
import {
  addToManualWeekRoster,
  clearManualWeekRoster,
  mergeManualWeekRosterIds,
  readManualWeekRosterEntries,
  removeFromManualWeekRoster,
} from '@/lib/nomina/manual-period-roster';
import {
  carryManualWeekToNext,
  carryoverRowsFromSemanaRegistros,
  mergePersonalCatalogWithRosterEntries,
  seedManualWeekIfEmpty,
  type ManualWeekCarryoverRow,
} from '@/lib/nomina/manual-period-carryover';
import { previousWeekInManualPeriod } from '@/lib/nomina/manual-period';
import {
  buildManualPlantillaNominaRows,
  manualPlantillaCuadrillaOrder,
  manualPlantillaCuadrillaOrderForWeek,
  nominaRowBelongsToCuadrilla,
  resolveActiveCuadrillaIdsForWeek,
} from '@/lib/rotacion-plantillas/manual-plantilla-projection';
import { mineosPanel } from '@/lib/mineos-visual';
import { getWeekEnd, getWeekStart } from '@/lib/nomina/week-utils';
import { distribucionFromCierreLegacy } from '@/lib/nomina-distribucion';
import { calculateExpectedAttendance } from '@/lib/rotacion-personal';
import {
  calculateNominaRowPay,
  calculateExplicitAsistenciaPay,
  calculateWeeklyBaseRate,
  explicitWeeklyBaseRate,
  defaultDiasTrabajados,
  formatProportionalSalarioHint,
  NOMINA_DIAS_POR_SEMANA,
  resolveEstadoYDias,
  aplicarPoliticaReposoSemanal,
  type EstadoAsistenciaNomina,
} from '@/lib/nomina-calculo';
import {
  diasTrabajadosPorDefectoCiclo,
  etiquetaEstadoRotacion,
  inputsDiasBloqueados,
  posicionEsquemaPersonal,
  rolSemanaPorPosicion,
} from '@/lib/nomina/perfil-ciclo-reglas';
import { useBiblioteca } from '@/contexts/biblioteca-context';
import { buildPersonalSnapshot } from '@/lib/nomina/types';
import type { Personal, NominaSemana, NominaVale, HistorialPagoRow, RolSemana, TendenciaSemanalRow } from '@/lib/types';

import { 
  revertirSemanaAction,
  borrarTodoPersonalArea
} from '@/lib/actions/nomina';

import {
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
  getTendenciaSemanalAction,
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
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, day] = iso.split('-');
  return `${day}/${m}/${y}`;
}

function fmtMoney(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

// ── Avatar Color Generator ─────────────────────────────────────────────────
const AVATAR_COLORS = [
  'bg-cyan-600', 'bg-amber-600', 'bg-emerald-600', 'bg-violet-600',
  'bg-pink-600', 'bg-blue-600', 'bg-yellow-600', 'bg-red-600',
  'bg-teal-600', 'bg-indigo-600', 'bg-orange-600', 'bg-lime-600',
];

function getAvatarColor(cargo: string): string {
  const c = (cargo || '').toUpperCase();
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
interface NominaClientProps {
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

  let estadoAsistencia = merged.estadoAsistencia;
  let diasTrabajados = merged.diasTrabajados;

  const diasBloqueados =
    fromPlantilla && merged.estatusPlantilla
      ? resolveDiasInputBloqueadoPlantilla(merged.estatusPlantilla, estadoAsistencia)
      : fromPlantilla
        ? Boolean(merged.diasInputBloqueado)
        : esquemaDiasBloqueados;

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
  const bonoManual = diasBloqueados ? 0 : merged.bonoTransporte;
  const bonificaciones = diasBloqueados ? 0 : merged.bonificaciones;
  const pay = fromPlantilla
    ? calculateExplicitAsistenciaPay({
        personal: p,
        estadoAsistencia: resolved.estadoAsistencia,
        diasTrabajados: resolved.diasTrabajados,
        bonoTransporte: bonoManual,
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
    estadoAsistencia: resolved.estadoAsistencia,
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
  const l = cargo.toLowerCase();
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

// ── Main Component ─────────────────────────────────────────────────────────
export default function NominaClient({
  data,
  masterCatalog,
  perfilesCompensacion = [],
  semanas,
  area,
  instanciaActiva: instanciaActivaProp = null,
  rotacionPlantillas: rotacionPlantillasProp = [],
  rotacionMigrationRequired = false,
}: NominaClientProps) {
  const router = useRouter();
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
  const esquemaOpciones = biblioteca.esquemasPorArea[area] || ['FIJO_SEMANAL'];

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

  const instanciaSnapshot = useMemo(
    () => deserializeInstanciaSnapshot(instanciaActivaProp),
    [instanciaActivaProp],
  );

  // State
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'primario' | 'esquema'>('primario');
  const [showModal, setShowModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showExcelPreview, setShowExcelPreview] = useState(false);
  // Import modal (roster / planilla semana)
  const [showImport, setShowImport] = useState(false);
  const [showRotacionSandbox, setShowRotacionSandbox] = useState(false);
  const [sandboxPlantillaId, setSandboxPlantillaId] = useState<string | undefined>();
  const [manualPeriodSession, setManualPeriodSession] = useState<ManualPeriodsSession>(
    emptyManualPeriodsSession,
  );
  const [consolidatedLockedIds, setConsolidatedLockedIds] = useState<Set<string>>(new Set());
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

  // Slide-over Drawer
  const [drawerPersonalId, setDrawerPersonalId] = useState<string | null>(null);
  const [drawerVales, setDrawerVales] = useState<NominaVale[]>([]);
  const [drawerHistorial, setDrawerHistorial] = useState<HistorialPagoRow[]>([]);
  const [loadingDrawer, setLoadingDrawer] = useState(false);
  const [isHistoricalLoading, setIsHistoricalLoading] = useState(false);
  const [newValeMonto, setNewValeMonto] = useState('');
  const [newValeMotivo, setNewValeMotivo] = useState('');
  // Paso activo del flujo guiado (Nómina 2.0)
  const [activeStep, setActiveStep] = useState<1 | 2>(1);

  // Vista activa: Semanal (tradicional), Ciclos (21 días) o Plantillas rotación
  const [viewMode, setViewMode] = useState<'semanal' | 'ciclos' | 'plantillas'>('semanal');

  // Pre-Nómina
  const [preNominaRows, setPreNominaRows] = useState<PreNominaRowState[]>([]);

  // Sparkline trend data
  const [trendData, setTrendData] = useState<TendenciaSemanalRow[]>([]);

  // Forms
  const [editItem, setEditItem] = useState<Personal | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    cedula: '', nombre_completo: '', cargo: '', area, area_detalle: '',
    salario_base: '', salario_libre: '', bono_transporte: '', telefono: '', notas: '',
    fecha_ingreso: new Date().toISOString().split('T')[0],
    esquema_rotacion: 'FIJO_SEMANAL', rotacion_inicio_fecha: '',
  });

  const temporalCtx = useMemo(() => resolveNominaTemporalContext(semanas), [semanas]);

  const [weekRange, setWeekRange] = useState(() => {
    const w = resolveWorkingWeek(semanas);
    return { inicio: w.inicio, fin: w.fin };
  });

  useEffect(() => {
    setManualPeriodSession(loadManualPeriodsSession(area));
  }, [area]);

  useEffect(() => {
    saveManualPeriodsSession(area, manualPeriodSession);
  }, [manualPeriodSession, area]);

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

  function handleNominaImported(result?: NominaImportResult) {
    router.refresh();
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

  // ── Load trend data for sparklines ──────────────────────────────────────
  useEffect(() => {
    getTendenciaSemanalAction(area, 8).then(res => {
      if (res.ok && res.data) setTrendData(res.data.reverse());
    });
  }, [area]);

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
        bonoTransporte: diasBloqueados ? 0 : undefined,
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
    (personalId: string, areaDetalle: string) => {
      const source =
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
                nominaNovedadDraftKey(area, weekRange.inicio),
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
          const weekDraft = readNominaNovedadDraft(nominaNovedadDraftKey(area, weekRange.inicio));
          return [...prev, applyWeekDraft(built[0], weekRange.inicio, weekDraft[personalId])];
        }

        const weekDraft = readNominaNovedadDraft(nominaNovedadDraftKey(area, weekRange.inicio));
        return [
          ...prev,
          applyWeekDraft(
            buildOperationalNominaRow(personal, weekRange.inicio, {}),
            weekRange.inicio,
            weekDraft[personalId],
          ),
        ];
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
    ],
  );

  // ── Initialize rows with rotation predictions and vales ─────────────────
  useEffect(() => {
    if (!data) return;
    const runGen = ++initRowsGenRef.current;
    const initRows = async () => {
      const currentWeekStart = weekRange.inicio;
      const currentWeekEnd = weekRange.fin;
      let rosterEntries = readManualWeekRosterEntries(area, currentWeekStart);
      let weekRoster = rosterEntries.map((e) => e.id);
      const weekRosterSet = new Set(weekRoster);

      // 1. Check if this is a closed week (solo la del ciclo manual activo, no otra con mismas fechas)
      const closedWeek =
        manualPeriodForView && weekInManualPeriod(currentWeekStart, manualPeriodForView)
          ? resolveClosedSemanaForManualPeriod(
              manualPeriodForView,
              semanas,
              currentWeekStart,
              area,
            )
          : semanas.find(
              (s) =>
                s.semana_inicio === currentWeekStart &&
                (!s.area || s.area === area),
            );
      if (closedWeek?.id) {
        setIsHistoricalLoading(true);
        try {
          const res = await getSemanaRegistrosAction(closedWeek.id);
          if (res.ok && res.data) {
            const rows = res.data.map((reg: any) => {
              const snap = reg.personal_snapshot || null;
              const pRaw = reg.personal || {
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
                activo: false,
              };
              const p = {
                ...pRaw,
                nombre_completo: formatNombrePropio(pRaw.nombre_completo || ''),
              };
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
              };
            });
            if (runGen !== initRowsGenRef.current) return;
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
                  const prevRes = await getSemanaRegistrosAction(prevClosed.id);
                  if (prevRes.ok && prevRes.data?.length) {
                    const carryRows = carryoverRowsFromSemanaRegistros(prevRes.data, area);
                    if (seedManualWeekIfEmpty(area, currentWeekStart, carryRows)) {
                      rosterEntries = readManualWeekRosterEntries(area, currentWeekStart);
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
            const personalIds = [
              ...new Set(weekRoster.length > 0 ? weekRoster : [...plantillaIds, ...weekRoster]),
            ];
            const catalogForWeek =
              rosterEntries.length > 0
                ? mergePersonalCatalogWithRosterEntries(
                    personalCatalogMerged,
                    rosterEntries,
                    area,
                  )
                : personalCatalogMerged;
            let valesMap: Record<string, NominaVale[]> = {};
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
              nominaNovedadDraftKey(area, currentWeekStart),
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
            setPreNominaRows(rows);
            return;
          }
        }

        if (!rosterEntries.length) {
          const prevWeek = previousWeekInManualPeriod(manualPeriodForView, currentWeekStart);
          const prevClosed = prevWeek
            ? semanas.find((s) => s.semana_inicio === prevWeek && s.area === area)
            : null;
          if (prevClosed) {
            try {
              const prevRes = await getSemanaRegistrosAction(prevClosed.id);
              if (prevRes.ok && prevRes.data?.length) {
                const carryRows = carryoverRowsFromSemanaRegistros(prevRes.data, area);
                if (seedManualWeekIfEmpty(area, currentWeekStart, carryRows)) {
                  rosterEntries = readManualWeekRosterEntries(area, currentWeekStart);
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
          setPreNominaRows([]);
          return;
        }

        let valesMapFallback: Record<string, NominaVale[]> = {};
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
        setPreNominaRows(fallbackRows);
        return;
      }

      // 3. Semana operativa (no cerrada) → roster vigente
      const activeWorkersMap = new Map<string, Personal>();
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
      for (const personalId of weekRoster) {
        if (activeWorkersMap.has(personalId)) continue;
        const p = personalCatalogMerged.find((row) => row.id === personalId);
        if (!p) continue;
        if (p.estatus && p.estatus !== 'ACTIVO') continue;
        activeWorkersMap.set(p.id, p);
      }
      const activeWorkers = [...activeWorkersMap.values()];

      if (activeWorkers.length === 0) {
        if (runGen !== initRowsGenRef.current) return;
        setPreNominaRows([]);
        return;
      }

      const personalIds = activeWorkers.map(p => p.id);
      let valesMap: Record<string, NominaVale[]> = {};
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
        nominaNovedadDraftKey(area, currentWeekStart),
      );

      const rows = activeWorkers.map((p) =>
        applyWeekDraft(
          buildOperationalNominaRow(p, currentWeekStart, valesMap),
          currentWeekStart,
          novedadDraft[p.id],
        ),
      );
      if (runGen !== initRowsGenRef.current) return;
      setPreNominaRows(rows);
    };
    initRows();
  }, [
    personalCatalogMerged,
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
    buildOperationalNominaRow,
    applyWeekDraft,
  ]);

  useEffect(() => {
    const linked = manualPeriodSession.workingWeekPeriodId;
    if (!linked || weekRange.inicio !== temporalCtx.workingWeekStart) return;
    const ids = preNominaRows.map((r) => r.personal.id).filter(Boolean);
    if (ids.length) mergeManualWeekRosterIds(area, weekRange.inicio, ids);
  }, [
    manualPeriodSession.workingWeekPeriodId,
    weekRange.inicio,
    temporalCtx.workingWeekStart,
    area,
    preNominaRows,
  ]);

  const semanaActual = semanas.find((r) => r.semana_inicio === weekRange.inicio);
  const semanaActualProcesada = !!semanaActual;

  useEffect(() => {
    if (!instanciaSnapshot || semanaActualProcesada || preNominaRows.length === 0 || isManualPeriodWeek) {
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
    }).then((res) => {
      if (cancelled) return;
      setRotacionCierreError(res.ok ? null : res.message);
    });
    return () => {
      cancelled = true;
    };
  }, [instanciaSnapshot, semanaActualProcesada, preNominaRows, area, weekRange.inicio, weekRange.fin, isManualPeriodWeek]);

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
          nominaNovedadDraftKey(area, weekRange.inicio),
          Object.fromEntries(next.map((r) => [r.personal.id, preNominaRowToWeekDraft(r)])),
        );
      }
      return next;
    });
  };

  const totalSemana = useMemo(() => preNominaRows.reduce((s, r) => s + r.total, 0), [preNominaRows]);
  const distribucion = useNominaDivisionesConfig(totalSemana);

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
    if (!semanaActual?.id || !semanaActualProcesada) return;
    getSemanaCierreAction(semanaActual.id).then((res) => {
      if (res.ok && res.data) {
        distribucion.applyPlantilla(distribucionFromCierreLegacy(res.data));
      }
    });
  }, [semanaActual?.id, semanaActualProcesada, distribucion.applyPlantilla]);

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
    return groups;
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

  // ── CSV Export ──────────────────────────────────────────────────────────
  const handleExportCSV = useCallback(() => {
    const headers = ['Nombre','Cédula','Cargo','Estado','Días','Sueldo Base','Bono Trans.','Bonos','Vales','Total Neto'];
    const csvRows = [headers.join(',')];
    preNominaRows.forEach(row => {
      const p = row.personal;
      csvRows.push([
        `"${p.nombre_completo}"`,
        p.cedula,
        `"${p.cargo}"`,
        row.estadoAsistencia,
        String(row.diasTrabajados),
        row.salarioBaseCalculado.toFixed(2),
        row.bonoTransporte.toFixed(2),
        row.bonificaciones.toFixed(2),
        row.totalVales.toFixed(2),
        row.total.toFixed(2),
      ].join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `nomina_${area}_${weekRange.inicio}.csv`; a.click();
    URL.revokeObjectURL(url);
  }, [preNominaRows, area, weekRange.inicio]);

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
    startTransition(async () => {
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
    });
  }, [drawerPersonalId, newValeMonto, newValeMotivo, startTransition, user, weekRange.inicio]);

  const handleDeleteVale = useCallback(async (valeId: string) => {
    if (!drawerPersonalId) return;
    startTransition(async () => {
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
    });
  }, [drawerPersonalId, startTransition, user, weekRange.inicio]);

  const drawerRow = useMemo(() => {
    if (!drawerPersonalId) return null;
    return preNominaRows.find(r => r.personal.id === drawerPersonalId) || null;
  }, [drawerPersonalId, preNominaRows]);

  // ── Actions ────────────────────────────────────────────────────────────
  function openEdit(item: Personal) {
    setEditItem(item);
    const asignacion = item.area_detalle || '';
    setForm({
      cedula: item.cedula, nombre_completo: item.nombre_completo, cargo: item.cargo,
      area: item.area as typeof area,
      area_detalle: isAsignacionNominaValid(asignacion) ? asignacion : '',
      salario_base: String(item.salario_base), salario_libre: String(item.salario_libre || ''),
      bono_transporte: String(item.bono_transporte || ''), telefono: item.telefono || '',
      notas: item.notas || '', fecha_ingreso: item.fecha_ingreso || new Date().toISOString().split('T')[0],
      esquema_rotacion: item.esquema_rotacion || 'FIJO_SEMANAL',
      rotacion_inicio_fecha: item.rotacion_inicio_fecha || '',
    });
    setActiveTab('primario'); setShowModal(true);
  }

  function resetForm() {
    setEditItem(null);
    setForm({ cedula: '', nombre_completo: '', cargo: '', area, area_detalle: '', salario_base: '', salario_libre: '', bono_transporte: '', telefono: '', notas: '', fecha_ingreso: new Date().toISOString().split('T')[0], esquema_rotacion: 'FIJO_SEMANAL', rotacion_inicio_fecha: '' });
    setActiveTab('primario'); setFormError(null);
  }

  function handleSave() {
    setFormError(null);
    startTransition(async () => {
      const res = await upsertPersonalV3Action({
        id: editItem?.id, cedula: form.cedula, nombre_completo: form.nombre_completo,
        cargo: form.cargo, area, area_detalle: form.area_detalle,
        perfil_compensacion_id: editItem?.perfil_compensacion_id || '',
        salario_base: Number(form.salario_base) || 0,
        bono_transporte: Number(form.bono_transporte) || 0, telefono: form.telefono, notas: form.notas,
        fecha_ingreso: form.fecha_ingreso,
        rotacion_inicio_fecha: form.rotacion_inicio_fecha || null,
      });
      if (res.ok) {
        await registrarAuditAction(editItem ? 'EDITAR_PERSONAL' : 'CREAR_PERSONAL', 'personal', editItem?.id || form.cedula, `${form.nombre_completo} - ${form.cargo}`, user?.id, user?.email);
        setShowModal(false); resetForm();
      } else setFormError(res.message);
    });
  }

  async function handleDelete(id: string) {
    if (!(await confirmDialog({
      title: 'Desactivar trabajador',
      message: '¿Desactivar este trabajador del sistema?',
      variant: 'danger'
    }))) return;
    
    // Optimistic update: remover fila inmediatamente del estado local
    setPreNominaRows(prev => prev.filter(row => row.personal.id !== id));
    if (isManualPeriodWeek) {
      removeFromManualWeekRoster(area, weekRange.inicio, id);
    }
    
    startTransition(async () => {
      await updatePersonalEstatusAction(id, 'INACTIVO');
      await registrarAuditAction('DESACTIVAR_PERSONAL', 'personal', id, `Desactivado por ${user?.email}`, user?.id, user?.email);
    });
  }

  async function handleProcesarNomina() {
    if (preNominaRows.length === 0) {
      toastError('No hay trabajadores activos.');
      return;
    }
    if (!distribucion.validation.ok) {
      toastError(distribucion.validation.message ?? 'Revisa la distribución de pagos.');
      return;
    }
    if (rotacionCierreError && !isManualPeriodWeek) {
      toastError(rotacionCierreError);
      return;
    }
    if (!isManualPeriodWeek) {
    const rotacionRows = preNominaRows.map((r) => ({
      personalId: r.personal.id,
      total: r.total,
      bonoTransporte: r.bonoTransporte,
      diasTrabajados: r.diasTrabajados,
    }));
    const valRot = await validarCierreRotacionSemanalAction({
      area,
      semanaInicio: weekRange.inicio,
      semanaFin: weekRange.fin,
      rows: rotacionRows,
    });
    if (!valRot.ok) {
      toastError(valRot.message);
      return;
    }
    }
    if (semanaActual && !(await confirmDialog({
      title: 'Sobreescribir nómina',
      message: 'La semana ya fue procesada. ¿Deseas sobreescribirla?',
      variant: 'warning'
    }))) return;
    setProcesadoOk(null);
    startTransition(async () => {
      try {
        const formattedRows = preNominaRows.map((r) => {
          const estadoAsistencia =
            r.estadoAsistencia ?? (r.esSemanaLibre ? ('libre' as const) : ('trabajada' as const));
          return {
            personalId: r.personal.id,
            estadoAsistencia,
            diasTrabajados: r.diasTrabajados ?? defaultDiasTrabajados(estadoAsistencia),
            total: r.total,
            bonoTransporte: Number(r.bonoTransporte) || 0,
            bonificaciones: Number(r.bonificaciones) || 0,
            totalVales: Number(r.totalVales) || 0,
            novedadTurno: r.novedadTurno,
            novedadTurnoObs: r.novedadTurnoObs,
            esSemanaLibre: r.esSemanaLibre,
            salarioBaseCalculado: r.salarioBaseCalculado,
            reposoCondicion: r.reposoCondicion ?? null,
            reposoDiasPagados: r.reposoDiasPagados ?? 0,
            reposoCompensacionMonto: r.reposoCompensacionMonto ?? 0,
          };
        });
        const res = await procesarCierreNominaV3Action({
          area,
          inicio: weekRange.inicio,
          fin: weekRange.fin,
          rows: formattedRows,
          distribucion: distribucion.partes,
          modoCierre: isManualPeriodWeek ? 'historico_manual' : 'operativo',
          periodoManual:
            isManualPeriodWeek && manualPeriodForView
              ? {
                  label: manualPeriodForView.label,
                  rangeStart: manualPeriodForView.rangeStart,
                  rangeEnd: manualPeriodForView.rangeEnd,
                  plantillaId: manualPeriodForView.plantillaId,
                }
              : undefined,
        });
        if (res.ok) {
          try {
            localStorage.removeItem(nominaNovedadDraftKey(area, weekRange.inicio));
            if (isManualPeriodWeek && manualPeriodForView) {
              const closeData = res.data as { semanaId?: string; periodoId?: string } | undefined;
              const closedSemanaId = closeData?.semanaId ?? semanaActual?.id;
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
              clearManualWeekRoster(area, weekRange.inicio);
            }
          } catch {
            /* ignore */
          }
          distribucion.saveAsDefault();
          await registrarAuditAction('CERRAR_NOMINA', 'nomina_semanas', area, `${weekRange.inicio} a ${weekRange.fin} - ${preNominaRows.length} trabajadores - Total: $${totalSemana.toFixed(2)}`, user?.id, user?.email);
          setProcesadoOk(`✓ ${res.message}`);
          setShowProcesarModal(false);
          router.refresh();
        } else {
          toastError(res.message);
        }
      } catch (err) {
        console.error('[NominaClient] Error inesperado al cerrar nómina:', err);
        toastError('No se pudo procesar el cierre. Verifica tu conexión e intenta de nuevo.');
      }
    });
  }

  async function handleRevertirSemana(sem: NominaSemana) {
    if (!(await confirmDialog({
      title: 'Revertir nómina',
      message: `¿Revertir la nómina del ${fmtDate(sem.semana_inicio)} al ${fmtDate(sem.semana_fin)}?`,
      variant: 'danger'
    }))) return;
    startTransition(async () => {
      try {
        const res = await revertirSemanaAction(sem);
        if (res.ok) {
          if (manualPeriodForView && weekInManualPeriod(sem.semana_inicio, manualPeriodForView)) {
            setManualPeriodSession((prev) => {
              const period = getPeriodById(prev, manualPeriodForView.id);
              if (!period?.semanaIds?.length) return prev;
              return upsertPeriodInSession(prev, detachSemanaFromManualPeriod(period, sem.id));
            });
            setConsolidatedLockedIds((prev) => {
              const next = new Set(prev);
              next.delete(manualPeriodForView.id);
              return next;
            });
          }
          await registrarAuditAction('REVERTIR_NOMINA', 'nomina_semanas', sem.id, `Revertida: ${fmtDate(sem.semana_inicio)} a ${fmtDate(sem.semana_fin)}`, user?.id, user?.email);
          router.refresh();
        } else {
          toastError(res.message || 'Error al revertir');
        }
      } catch (err) {
        console.error('[NominaClient] Error inesperado al revertir semana:', err);
        toastError('No se pudo revertir la semana. Verifica tu conexión e intenta de nuevo.');
      }
    });
  }

  function handleBorrarTodo() {
    startTransition(async () => {
      const res = await borrarTodoPersonalArea(area);
      if (res.ok) {
        await registrarAuditAction('BORRAR_TODO_PERSONAL', 'personal', area, `Todos los trabajadores de ${area} desactivados`, user?.id, user?.email);
        setShowBorrarModal(false);
        toast.success('Todos los trabajadores desactivados.');
      } else toastError(res.message);
    });
  }

  // ── PDF Consolidated Report ─────────────────────────────────────────────
  const handlePrintReport = useCallback(() => {
    const rows = preNominaRows;
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Reporte Nómina ${area.toUpperCase()}</title>
<style>
  body{font-family:system-ui,sans-serif;padding:40px;color:#111;font-size:12px}
  h1{font-size:18px;margin-bottom:4px}
  h2{font-size:14px;color:#666;margin-top:0}
  table{width:100%;border-collapse:collapse;margin-top:16px}
  th{background:#f5f5f5;border:1px solid #ddd;padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase}
  td{border:1px solid #eee;padding:5px 8px}
  .total-row{font-weight:bold;background:#fffde7}
  .text-right{text-align:right}
  .signatures{display:flex;justify-content:space-between;margin-top:60px;padding-top:40px}
  .sig-box{text-align:center;width:200px;border-top:1px solid #333;padding-top:8px;font-size:10px}
  .footer{margin-top:30px;font-size:9px;color:#999;text-align:center}
</style></head><body>
<h1>MOLINOS LA FÉ - MINA BELÉN</h1>
<h2>Reporte Consolidado de Nómina Semanal — ${area.toUpperCase()}</h2>
<p>Periodo: ${fmtDate(weekRange.inicio)} al ${fmtDate(weekRange.fin)} · ${rows.length} trabajadores · Generado: ${new Date().toLocaleString('es-VE')}</p>
<table>
<thead><tr><th>#</th><th>Nombre</th><th>C.I.</th><th>Cargo</th><th>Estado</th><th>Días</th><th class="text-right">Sueldo</th><th class="text-right">Bono Trans.</th><th class="text-right">Bonos</th><th class="text-right">Vales</th><th class="text-right">TOTAL</th></tr></thead>
<tbody>
${rows.map((r, i) => {
  const baseSal = r.salarioBaseCalculado;
  return `<tr><td>${i+1}</td><td><strong>${r.personal.nombre_completo}</strong></td><td>${r.personal.cedula}</td><td>${r.personal.cargo}</td><td>${r.estadoAsistencia}</td><td class="text-center">${r.diasTrabajados}</td><td class="text-right">$${baseSal.toFixed(2)}</td><td class="text-right">$${r.bonoTransporte.toFixed(2)}</td><td class="text-right">$${r.bonificaciones.toFixed(2)}</td><td class="text-right">$${r.totalVales.toFixed(2)}</td><td class="text-right"><strong>$${r.total.toFixed(2)}</strong></td></tr>`;
}).join('')}
<tr class="total-row"><td colspan="9">TOTAL GENERAL</td><td class="text-right"><strong>$${totalSemana.toFixed(2)}</strong></td></tr>
</tbody></table>
<h2 style="margin-top:24px">Distribución de pagos</h2>
<table style="width:auto"><thead><tr><th>Beneficiario</th><th>%</th><th class="text-right">Bruto</th><th class="text-right">Pagos Directos</th><th class="text-right">Neto</th></tr></thead>
<tbody>
${distribucion.lineas.map((l) => `<tr><td>${l.nombre}</td><td>${l.porcentaje}%</td><td class="text-right">$${l.bruto.toFixed(2)}</td><td class="text-right">$${l.pagoDirecto.toFixed(2)}</td><td class="text-right"><strong>$${l.neto.toFixed(2)}</strong></td></tr>`).join('')}
</tbody></table>
<div class="signatures">${distribucion.lineas.map((l) => `<div class="sig-box">${l.nombre.toUpperCase()}<br>Beneficiario</div>`).join('')}</div>
<p class="footer">Generado automáticamente por MineOS — Sistema de Gestión Minera · ${new Date().toISOString()}</p>
</body></html>`;
    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); win.print(); }
  }, [preNominaRows, totalSemana, area, weekRange, distribucion.lineas]);

  const toolbarPrimaryActions = (
    <>
      {!semanaActualProcesada ? (
        <button onClick={() => setShowProcesarModal(true)} disabled={!canEdit || preNominaRows.length === 0 || !!rotacionCierreError} title={rotacionCierreError ?? 'Cerrar y Distribuir'} className={`${MINEOS_BTN_NOMINA_PRIMARY} h-9 shrink-0 px-3 text-xs`}>
          <Wallet className="w-3.5 h-3.5 shrink-0" /> Cerrar
        </button>
      ) : (
        <button onClick={() => semanaActual && handleRevertirSemana(semanaActual)} disabled={!canEdit || isPending} title="Revertir cierre" className="nomina-page__toolbar-btn btn-danger h-9 shrink-0 text-xs disabled:opacity-40">
          {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Revertir
        </button>
      )}
      <button onClick={() => setShowAssignModal(true)} disabled={!canEdit} title="Buscar en base o registrar nuevo" className={`${MINEOS_BTN_NOMINA_PRIMARY} h-9 shrink-0 px-3 text-xs`}>
        <Plus className="w-3.5 h-3.5 shrink-0" /> Trabajador
      </button>
    </>
  );

  const toolbarSecondaryActions = (
    <>
      <button onClick={() => setShowImport(true)} disabled={!canEdit} title="Importar planilla o roster" className="nomina-page__toolbar-btn btn-secondary border border-emerald-500/25 text-emerald-200/90 hover:bg-emerald-500/10">
        <Upload className="shrink-0" /> Importar
      </button>
      <button
        type="button"
        onClick={() => setShowRotacionSandbox(true)}
        title="Plantillas de rotación"
        className="nomina-page__toolbar-btn btn-secondary border border-violet-500/30 text-violet-200/90 hover:bg-violet-500/10"
      >
        <LayoutGrid className="shrink-0" /> Rotación
      </button>
      <button type="button" onClick={() => setShowArchivo(true)} title="Periodos archivados" className="nomina-page__toolbar-btn btn-secondary">
        <Archive className="shrink-0 text-zinc-400" /> Archivo
      </button>
      <button
        type="button"
        onClick={() => setShowExcelPreview(true)}
        title="Vista previa Excel"
        className="nomina-page__toolbar-btn btn-secondary border border-amber-500/40 text-amber-200/95 hover:bg-amber-500/10"
      >
        <FileSpreadsheet className="shrink-0" /> Excel
      </button>
      <button onClick={handlePrintReport} title="PDF" className="nomina-page__toolbar-btn btn-secondary">
        <Printer className="shrink-0 text-zinc-400" /> PDF
      </button>
      <button onClick={handleExportCSV} title="CSV" className="nomina-page__toolbar-btn btn-secondary">
        <Download className="shrink-0 text-zinc-400" /> CSV
      </button>
      {canEdit && data.length > 0 && (
        <button onClick={() => setShowBorrarModal(true)} title="Baja todo" className="nomina-page__toolbar-btn nomina-page__toolbar-btn--danger">
          <Trash2 className="shrink-0" /> Baja
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
            <div className="nomina-page__kpi-card bg-zinc-900 border border-zinc-800 rounded-lg">
              <p className="nomina-page__kpi-label">Promedio</p>
              <p className="nomina-page__kpi-value text-white/90">{data.length > 0 ? fmtMoney(totalSemana / data.length) : '$0.00'}</p>
            </div>
            <div className="nomina-page__kpi-card bg-zinc-900 border border-zinc-800 rounded-lg">
              <p className="nomina-page__kpi-label">Vales Pend.</p>
              <p className="nomina-page__kpi-value text-red-400">{fmtMoney(preNominaRows.reduce((s, r) => s + r.totalVales, 0))}</p>
            </div>
          </div>

          {(activeStep >= 2 || semanaActualProcesada) && (
            <div className="nomina-page__distribucion-aside shrink-0 max-h-[min(22rem,40vh)] overflow-y-auto">
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

          <div className="nomina-page__console shrink-0 flex flex-col gap-3">
            <div className="flex flex-col text-left">
              <span className="text-[9px] font-bold text-amber-500 uppercase tracking-widest">Consola de Control</span>
              <h2 className="text-sm font-black text-white/90 uppercase tracking-wide mt-0.5">Nómina Guiada 2.0</h2>
            </div>
            <div className="flex flex-col gap-2">
              {[
                { step: 1, title: 'Asistencia', desc: 'Turno y días trabajados' },
                { step: 2, title: 'Vales & Ajustes', desc: 'Bono Trans./Adelantos' },
              ].map((s) => {
                const isActive = activeStep === s.step;
                return (
                  <button
                    key={s.step}
                    type="button"
                    onClick={() => setActiveStep(s.step as 1 | 2)}
                    className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-1.5 text-left transition-all group ${
                      isActive
                        ? 'border-amber-500/40 bg-amber-600/10 text-amber-400 shadow-md shadow-amber-500/5'
                        : 'border-zinc-800/80 bg-zinc-950/30 text-white/40 hover:border-zinc-700 hover:text-white/60'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold leading-tight">{s.title}</p>
                      <p className="mt-0.5 text-[8px] leading-none text-white/30 group-hover:text-white/40">{s.desc}</p>
                    </div>
                  </button>
                );
              })}
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
                  <p className="text-[11px] text-white/50">{semanaActual.total_trabajadores} trabajadores · <span className="font-bold text-emerald-400">{fmtMoney(Number(semanaActual.total_pagado))}</span></p>
                </div>
                <button onClick={() => handleRevertirSemana(semanaActual)} disabled={!canEdit || isPending} className="h-8 px-3 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-40">
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
            activeStep={activeStep}
            onStep={setActiveStep}
            onOpenSemana={() => setSemanaSheetOpen(true)}
            search={search}
            onSearchChange={setSearch}
            fmtMoney={fmtMoney}
          />

          <div className="nomina-page__main nomina-page__table-stack flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/30 lg:border lg:bg-zinc-900/30">
            {/* Tabs de Vista */}
            <div className="shrink-0 border-b border-zinc-800/80 bg-zinc-950/40 px-2 py-1">
              <div className="grid w-full grid-cols-3 gap-1">
                <button
                  type="button"
                  onClick={() => setViewMode('semanal')}
                  className={`rounded-md px-2 py-1 text-center text-[10px] font-bold uppercase tracking-wide transition-all ${
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
                  className={`rounded-md px-2 py-1 text-center text-[10px] font-bold uppercase tracking-wide transition-all ${
                    viewMode === 'ciclos'
                      ? 'border border-amber-500/30 bg-amber-500/10 text-amber-400'
                      : 'border border-transparent text-white/50 hover:text-white/70'
                  }`}
                >
                  Vista por Ciclo
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('plantillas')}
                  className={`rounded-md px-2 py-1 text-center text-[10px] font-bold uppercase tracking-wide transition-all ${
                    viewMode === 'plantillas'
                      ? 'border border-amber-500/30 bg-amber-500/10 text-amber-400'
                      : 'border border-transparent text-white/50 hover:text-white/70'
                  }`}
                >
                  Plantillas Rotación
                </button>
              </div>
            </div>

            {viewMode === 'ciclos' ? (
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
                instanciaActiva={instanciaActivaProp}
                userId={user?.id}
                consolidatedLockedPeriodIds={consolidatedLockedIds}
                onConsolidated={() => {
                  setManualPeriodSession((prev) => {
                    const editorId = prev.editorPeriodId;
                    return editorId ? removePeriodFromSession(prev, editorId) : prev;
                  });
                  setConsolidatedLockedIds(new Set());
                  router.refresh();
                  setArchivoRefreshKey((k) => k + 1);
                }}
                periodosRefreshKey={archivoRefreshKey}
              />
            ) : viewMode === 'plantillas' ? (
              <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto p-2.5 pb-[calc(4.25rem+env(safe-area-inset-bottom))] lg:p-3 lg:pb-3">
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
                    router.refresh();
                  }}
                />
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
            {rotacionCierreError && !semanaActualProcesada && !isManualPeriodWeek && (
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
                {manualPeriodSession.periods.length > 0 &&
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
                            activeStep={activeStep}
                            locked={semanaActualProcesada}
                            canEdit={canEdit}
                            theme={theme}
                            initials={getInitials(p.nombre_completo)}
                            avatarColor={getAvatarColor(p.cargo)}
                            onOpenDrawer={() => openDrawer(p.id)}
                            onOpenReceipt={() => setSelectedReceipt(row)}
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
                            <th className={`px-5 py-3 text-center transition-all duration-300 ${activeStep === 1 ? 'bg-amber-500/10 text-amber-400 font-black border-x border-amber-500/20 shadow-sm' : ''}`}>Asistencia</th>
                            <th className={`px-3 py-3 text-center transition-all duration-300 ${activeStep === 1 ? 'bg-amber-500/10 text-amber-400 font-black shadow-sm' : ''}`}>Días</th>
                            <th className="px-5 py-3 text-right">Sueldo</th>
                            <th className={`px-5 py-3 text-right transition-all duration-300 ${activeStep === 2 ? 'bg-amber-500/10 text-amber-400 font-black border-l border-amber-500/20 shadow-sm' : ''}`}>Bono T.</th>
                            <th className={`px-5 py-3 text-right transition-all duration-300 ${activeStep === 2 ? 'bg-amber-500/10 text-amber-400 font-black shadow-sm' : ''}`}>Bonos</th>
                            <th className={`px-5 py-3 text-right transition-all duration-300 ${activeStep === 2 ? 'bg-amber-500/10 text-amber-400 font-black border-r border-amber-500/20 shadow-sm' : ''}`}>Vales</th>
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
                                <td className={`px-3 py-3 text-center transition-all duration-300 ${activeStep === 1 ? 'bg-amber-500/5 border-x border-amber-500/10' : ''}`}>
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
                                <td className={`px-3 py-3 text-center transition-all duration-300 ${activeStep === 1 ? 'bg-amber-500/5' : ''}`}>
                                  {!row.diasInputBloqueado && row.estadoAsistencia === 'trabajada' ? (
                                    <div className="inline-flex flex-col items-center gap-1">
                                      <input
                                        type="number"
                                        min={0}
                                        max={NOMINA_DIAS_POR_SEMANA}
                                        step={1}
                                        value={row.diasTrabajados}
                                        disabled={semanaActualProcesada}
                                        onChange={(e) =>
                                          handleUpdateRow(p.id, {
                                            diasTrabajados: Number(e.target.value),
                                          })
                                        }
                                        title={`Días trabajados (0–${NOMINA_DIAS_POR_SEMANA}). El sueldo base se prorratea: (salario semanal ÷ 7) × días.`}
                                        className="w-12 rounded-lg border border-zinc-800 bg-zinc-950/50 px-2 py-1 text-center text-xs font-bold tabular-nums text-white outline-none focus:border-amber-500/50 disabled:opacity-40"
                                      />
                                      <span className="text-[8px] font-medium text-white/35">de {NOMINA_DIAS_POR_SEMANA}</span>
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
                                <td className={`px-5 py-3 text-right transition-all duration-300 ${activeStep === 2 ? 'bg-amber-500/5 border-l border-amber-500/10' : ''}`}>
                                  <input type="number" value={row.bonoTransporte || ''} onChange={e => handleUpdateRow(p.id, { bonoTransporte: Number(e.target.value) || 0 })} placeholder="0.00" disabled={semanaActualProcesada || row.diasInputBloqueado} className="w-20 bg-zinc-950/40 border border-zinc-800 hover:border-zinc-700 focus:border-amber-500 text-white rounded-lg px-2.5 py-1 text-right text-xs transition-colors outline-none focus:ring-1 focus:ring-amber-500/50 disabled:opacity-40 disabled:cursor-not-allowed" />
                                </td>
                                {/* Bonificaciones */}
                                <td className={`px-5 py-3 text-right transition-all duration-300 ${activeStep === 2 ? 'bg-amber-500/5' : ''}`}>
                                  <input type="number" value={row.bonificaciones || ''} onChange={e => handleUpdateRow(p.id, { bonificaciones: Number(e.target.value) || 0 })} placeholder="0.00" disabled={semanaActualProcesada || row.diasInputBloqueado} className="w-20 bg-zinc-950/40 border border-zinc-800 hover:border-zinc-700 focus:border-amber-500 text-white rounded-lg px-2.5 py-1 text-right text-xs transition-colors outline-none focus:ring-1 focus:ring-amber-500/50 disabled:opacity-40 disabled:cursor-not-allowed" />
                                </td>
                                {/* Vales Badge */}
                                <td className={`px-5 py-3 text-right transition-all duration-300 ${activeStep === 2 ? 'bg-amber-500/5 border-r border-amber-500/10' : ''}`}>
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
                                  <div className="flex items-center justify-center gap-1">
                                    <button onClick={() => setSelectedReceipt(row)} title="Ficha" className="p-1.5 rounded-lg hover:bg-white/[0.04] text-white/40 hover:text-white transition-colors"><Receipt className="w-4 h-4" /></button>
                                    {canEdit && !semanaActualProcesada && (
                                      <>
                                        <button onClick={() => openEdit(p)} title="Editar" className="p-1.5 rounded-lg hover:bg-white/[0.04] text-white/40 hover:text-amber-500 transition-colors"><Edit2 className="w-4 h-4" /></button>
                                        <button onClick={() => handleDelete(p.id)} title="Baja" className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                      </>
                                    )}
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
        onCerrar={() => setShowProcesarModal(true)}
        onRevertir={() => semanaActual && handleRevertirSemana(semanaActual)}
        onRegistrar={() => setShowAssignModal(true)}
        onMore={() => setMobileMoreOpen(true)}
      />
      <NominaMobileSemanaSheet
        open={semanaSheetOpen}
        onClose={() => setSemanaSheetOpen(false)}
        cerrada={semanaActualProcesada}
        semanaActual={semanaActual}
        weekRange={weekRange}
        setWeekRange={setWeekRange}
        preNominaCount={preNominaRows.length}
        totalSemana={totalSemana}
        activos={data.length}
        promedio={data.length > 0 ? totalSemana / data.length : 0}
        valesPend={preNominaRows.reduce((s, r) => s + r.totalVales, 0)}
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
          activeStep >= 2 || semanaActualProcesada ? (
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
        hasData={data.length > 0}
        onImport={() => setShowImport(true)}
        onArchivo={() => setShowArchivo(true)}
        onPdf={handlePrintReport}
        onCsv={handleExportCSV}
        onExcel={() => {
          setMobileMoreOpen(false);
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

      <PersonalQuickAssignModal
        open={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        area={area}
        masterCatalog={baseTrabajadores}
        perfilesCompensacion={perfilesCompensacion}
        assignedIds={assignedIds}
        onAssigned={(personalId, areaDetalle) => {
          addToManualWeekRoster(area, weekRange.inicio, personalId, areaDetalle);
          setManualRosterTick((t) => t + 1);
          appendAssignedWorker(personalId, areaDetalle);
          router.refresh();
        }}
      />

      <NominaVistaPreviaModal
        open={showExcelPreview}
        onClose={() => {
          setShowExcelPreview(false);
          setPreviewInitialRange(null);
        }}
        initialRange={previewInitialRange}
        refreshKey={previewRefreshKey}
        activeWeek={
          weekRange.inicio
            ? { semana_inicio: weekRange.inicio, semana_fin: weekRange.fin }
            : undefined
        }
        activeRegistros={preNominaRows.map((row) => ({
          personal_id: row.personal.id,
          semana_inicio: weekRange.inicio,
          area: area,
          monto_pagado: row.total,
          es_semana_libre: row.esSemanaLibre,
          estado_asistencia: row.estadoAsistencia,
          dias_trabajados: row.diasTrabajados,
          salario_base_calculado: row.salarioBaseCalculado,
          novedad_turno: row.novedadTurno ? JSON.stringify(row.novedadTurno) : null,
          novedad_turno_obs: row.novedadTurnoObs,
          personal_snapshot: buildPersonalSnapshot(row.personal),
          periodo_id: null,
        }))}
      />

      <NominaArchivoModal
        open={showArchivo}
        onClose={() => setShowArchivo(false)}
        userId={user?.id}
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

      <PageFormModal
        open={showModal}
        onClose={() => setShowModal(false)}
        sheetTitle={editItem ? 'Editar Trabajador' : 'Registrar Nuevo Trabajador'}
        sheetIcon={<SheetIconBadge icon={Users} tone="success" />}
        panelClassName="sm:max-w-xl"
      >
            <button type="button" onClick={() => setShowModal(false)} className="absolute right-5 top-5 hidden rounded-lg p-1.5 text-white/40 transition-colors hover:bg-white/[0.06] hover:text-white lg:flex sm:right-6 sm:top-6" aria-label="Cerrar"><X className="w-5 h-5" /></button>
            <h3 className="page-form-modal-title hidden pr-10 text-xl font-bold tracking-wide text-white/90 lg:block">{editItem ? 'Editar Trabajador' : 'Registrar Nuevo Trabajador'}</h3>
            {formError && <p className="text-red-400 text-xs mb-4 bg-red-500/10 p-2.5 rounded-xl border border-red-500/20">{formError}</p>}
            <div className="flex border-b border-zinc-800 mb-5">
              <button onClick={() => setActiveTab('primario')} className={`pb-2.5 px-4 text-xs font-bold tracking-wider uppercase border-b-2 transition-all ${activeTab === 'primario' ? 'border-amber-500 text-amber-500' : 'border-transparent text-white/45'}`}>Datos</button>
              <button onClick={() => setActiveTab('esquema')} className={`pb-2.5 px-4 text-xs font-bold tracking-wider uppercase border-b-2 transition-all ${activeTab === 'esquema' ? 'border-amber-500 text-amber-500' : 'border-transparent text-white/45'}`}>Esquema & Rotación</button>
            </div>
            <div className="space-y-4">
              {activeTab === 'primario' ? (
                <>
                  <div className="space-y-1"><label className="input-label">Nombre Completo</label><input type="text" placeholder="Ej: Márquez Pedro" value={form.nombre_completo} onChange={e => setForm({...form, nombre_completo: e.target.value})} className="input-field" /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1"><label className="input-label">Cédula</label><input type="text" placeholder="9933498" value={form.cedula} onChange={e => setForm({...form, cedula: e.target.value})} className="input-field" /></div>
                    <div className="space-y-1"><label className="input-label">Cargo</label><input type="text" placeholder="Vertical 1PD" value={form.cargo} onChange={e => setForm({...form, cargo: e.target.value})} className="input-field" /></div>
                  </div>
                  <div className="space-y-1">
                    <label className="input-label">Asignación (Vertical / Sector)</label>
                    <AppSelect
                      value={form.area_detalle}
                      onChange={(val) => setForm({ ...form, area_detalle: val })}
                      options={ASIGNACION_NOMINA_OPCIONES.map((value) => ({ value, label: value }))}
                      placeholder="Seleccionar vertical/sector"
                    />
                  </div>
                  <div className="space-y-1"><label className="input-label">Salario Labor Semanal ($)</label><input type="number" placeholder="150.00" value={form.salario_base} onChange={e => setForm({...form, salario_base: e.target.value})} className="input-field" /></div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1"><label className="input-label">Sueldo Libre ($)</label><input type="number" placeholder="100" value={form.salario_libre} onChange={e => setForm({...form, salario_libre: e.target.value})} className="input-field" /></div>
                    <div className="space-y-1"><label className="input-label">Bono Transporte ($)</label><input type="number" placeholder="30" value={form.bono_transporte} onChange={e => setForm({...form, bono_transporte: e.target.value})} className="input-field" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1"><label className="input-label">Teléfono</label><input type="text" placeholder="0414-1234567" value={form.telefono} onChange={e => setForm({...form, telefono: e.target.value})} className="input-field" /></div>
                    <div className="space-y-1"><label className="input-label">Fecha Ingreso</label><AppDatePicker value={form.fecha_ingreso} onChange={(v) => setForm({ ...form, fecha_ingreso: v })} /></div>
                  </div>
                  <div className="pt-3 border-t border-zinc-800 space-y-3">
                    <div className="flex items-center gap-2"><RotateCcw className="w-3.5 h-3.5 text-cyan-400" /><label className="input-label !mb-0">Esquema de Rotación</label></div>
                    <AppSelect
                      value={form.esquema_rotacion}
                      onChange={(val) => setForm({ ...form, esquema_rotacion: val as Personal['esquema_rotacion'] })}
                      options={esquemaOpciones.map((code) => ({
                        value: code,
                        label: biblioteca.esquemaLabels[code] || code,
                      }))}
                    />
                    {(form.esquema_rotacion === 'MINA_2X1' || form.esquema_rotacion === 'MOLINO_ROTATIVO' || form.esquema_rotacion === 'MINA_ROTATIVA_3G' || form.esquema_rotacion === 'MOLINO_15X15') && (
                      <div className="space-y-1"><label className="input-label">Fecha Inicio Ciclo</label><AppDatePicker value={form.rotacion_inicio_fecha} onChange={(v) => setForm({ ...form, rotacion_inicio_fecha: v })} /><p className="text-[10px] text-white/30">Primera semana laboral del trabajador.</p></div>
                    )}
                  </div>
                  <div className="space-y-1"><label className="input-label">Notas</label><textarea placeholder="Observaciones..." value={form.notas} onChange={e => setForm({...form, notas: e.target.value})} className="input-field h-20 resize-none text-xs" /></div>
                </>
              )}
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
            <PageFormModalFooter className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setShowProcesarModal(false)} className="btn-secondary">Cancelar</button>
              <button type="button" onClick={handleProcesarNomina} disabled={isPending} className="btn-primary min-w-[110px] justify-center">{isPending ? 'Procesando...' : 'Confirmar Cierre'}</button>
            </PageFormModalFooter>
      </PageFormModal>

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
          router.refresh();
        }}
      />

      <PageFormModal
        open={showBorrarModal}
        onClose={() => setShowBorrarModal(false)}
        sheetTitle="¿Dar de baja todo?"
        sheetIcon={<SheetIconBadge icon={AlertTriangle} tone="danger" />}
        panelClassName="max-w-sm text-center"
      >
            <AlertTriangle className="mx-auto mb-4 h-12 w-12 animate-bounce text-red-500" />
            <h3 className="page-form-modal-title mb-2 hidden text-lg font-bold lg:block">¿Dar de baja todo?</h3>
            <p className="mb-6 text-xs text-white/50">{data.length} trabajadores de {area.toUpperCase()} serán desactivados.</p>
            <PageFormModalFooter className="flex gap-3">
              <button type="button" onClick={() => setShowBorrarModal(false)} className="btn-secondary flex-1 py-2.5 text-xs font-bold">Cancelar</button>
              <button type="button" onClick={handleBorrarTodo} disabled={isPending} className="flex h-10 flex-1 items-center justify-center rounded-lg bg-red-600 px-4 text-xs font-bold text-white transition-colors hover:bg-red-500 disabled:opacity-40">{isPending ? 'Procesando...' : 'Dar de baja'}</button>
            </PageFormModalFooter>
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
              <div className="flex justify-between"><span className="text-white/40">Días trabajados:</span><span className="font-bold text-amber-500">{selectedReceipt.diasTrabajados} / {NOMINA_DIAS_POR_SEMANA}</span></div>
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

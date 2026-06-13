'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
} from 'react';
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  PencilLine,
  Plus,
  Search,
  ClipboardList,
  UserCircle,
  Users,
  X,
  Trash2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { toastError } from '@/lib/app-toast';
import { AppSelect } from '@/components/ui/AppSelect';
import { useBiblioteca, useBibliotecaOptions } from '@/contexts/biblioteca-context';
import { mergeSuggestions } from '@/lib/biblioteca-catalog';
import {
  areaNominaLabel,
  displayNombrePersonal,
  formatNombrePropio,
  getAsignacionNomina,
  getUbicacionLaboralLabel,
} from '@/lib/personal-master';
import type { Personal } from '@/lib/types';
import {
  upsertTrabajadorRegistroAction,
  updateTrabajadorEstadoAction,
  bulkDeleteTrabajadoresAction,
} from '@/lib/actions/trabajadores-registry';
import type { PerfilCompensacion } from '@/lib/types';
import { PageFormModal, PageFormModalFooter } from '@/components/ui/PageFormModal';
import { AppDatePicker } from '@/components/ui/AppDatePicker';
import {
  MobileFilterTrigger,
  MobileFilterSheet,
  SheetIconBadge,
  useMobileFilterSheet,
} from '@/components/mobile';
import { TrabajadoresImportAliasesPanel } from '@/components/nomina/TrabajadoresImportAliasesPanel';
import {
  estadoObservadoOpcionesPorEsquema,
  fechaInicioRotacionDesdeEstadoObservado,
} from '@/lib/nomina/perfil-ciclo-reglas';

type EstadoLaboral = 'ACTIVO' | 'DESPEDIDO' | 'REPOSO' | 'VACACIONES' | 'REENGANCHADO';

type Props = {
  trabajadores: Personal[];
  perfilesCompensacion: PerfilCompensacion[];
};

type FormState = {
  id?: string;
  nombre_completo: string;
  cedula: string;
  fecha_nacimiento: string;
  fecha_ingreso: string;
  ajuste_antiguedad_dias: string;
  cargo: string;
  area_detalle: string;
  ubicacion_laboral: string;
  area: 'mina' | 'planta' | 'administracion' | 'seguridad' | 'transporte';
  notas: string;
  estado_laboral: EstadoLaboral;
  observacion_estado: string;
  perfil_compensacion_id: string;
  salario_base: string;
  salario_libre: string;
  bono_transporte: string;
  rotacion_inicio_fecha: string;
  rotacion_estado_referencia_semana: string;
  rotacion_estado_referencia_posicion: string;
};

type EstadoModal = {
  open: boolean;
  id: string;
  nextEstado: EstadoLaboral;
  motivo: string;
  inicio: string;
  fin: string;
  duracion: string;
  despidoFecha: string;
  despidoCausa: string;
  reengancheFecha: string;
  reengancheCargo: string;
  reengancheObservacion: string;
};

const EMPTY_FORM: FormState = {
  nombre_completo: '',
  cedula: '',
  fecha_nacimiento: '',
  fecha_ingreso: new Date().toISOString().slice(0, 10),
  ajuste_antiguedad_dias: '0',
  cargo: '',
  area_detalle: '',
  ubicacion_laboral: '',
  area: 'administracion',
  notas: '',
  estado_laboral: 'ACTIVO',
  observacion_estado: '',
  perfil_compensacion_id: '',
  salario_base: '',
  salario_libre: '',
  bono_transporte: '',
  rotacion_inicio_fecha: '',
  rotacion_estado_referencia_semana: new Date().toISOString().slice(0, 10),
  rotacion_estado_referencia_posicion: '',
};

function statusTone(estado: EstadoLaboral) {
  if (estado === 'ACTIVO') return 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25';
  if (estado === 'REPOSO') return 'text-amber-300 bg-amber-500/10 border-amber-500/25';
  if (estado === 'VACACIONES') return 'text-cyan-300 bg-cyan-500/10 border-cyan-500/25';
  if (estado === 'REENGANCHADO') return 'text-orange-300 bg-orange-500/10 border-orange-500/25';
  return 'text-red-300 bg-red-500/10 border-red-500/25';
}

function calcEdad(fechaNacimiento?: string | null): number | null {
  if (!fechaNacimiento) return null;
  const birth = new Date(`${fechaNacimiento}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age < 0 ? null : age;
}

function formatFechaIngreso(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function antiguedadLabel(fechaIngreso?: string | null, ajusteDias?: number | null): string {
  if (!fechaIngreso) return 'Sin fecha de ingreso';
  const start = new Date(`${fechaIngreso}T00:00:00`);
  if (Number.isNaN(start.getTime())) return 'Fecha inválida';
  const now = new Date();
  const diffDays = Math.max(0, Math.floor((now.getTime() - start.getTime()) / 86400000) + Number(ajusteDias ?? 0));
  const years = Math.floor(diffDays / 365);
  const months = Math.floor((diffDays % 365) / 30);
  const days = diffDays - years * 365 - months * 30;
  return `${years}a ${months}m ${days}d`;
}

function addDaysIso(dateIso: string, days: number): string {
  const start = new Date(`${dateIso}T00:00:00`);
  if (Number.isNaN(start.getTime())) return '';
  const out = new Date(start);
  out.setDate(out.getDate() + days);
  return out.toISOString().slice(0, 10);
}

function diffDaysIso(startIso: string, endIso: string): number | null {
  const start = new Date(`${startIso}T00:00:00`);
  const end = new Date(`${endIso}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const diff = Math.round((end.getTime() - start.getTime()) / 86400000);
  return diff >= 0 ? diff : null;
}

const TRABAJADORES_PAGE_MAX = 50;
const TRABAJADORES_PAGE_BUTTONS_MAX = 5;
const TRABAJADORES_DEFAULT_PAGE_ROWS = 10;
/** Debe coincidir con --gastos-row-h (3.5rem) en globals.css */
const TRABAJADORES_ROW_PX = 56;
const TRABAJADORES_HEAD_FALLBACK_PX = 56;
const TRABAJADORES_LAYOUT_SAFETY_PX = 4;
const TRABAJADORES_TABLE_COLS = 10;

const ESTADOS_FILTRO: { value: EstadoLaboral; label: string }[] = [
  { value: 'ACTIVO', label: 'Activo' },
  { value: 'REPOSO', label: 'Reposo' },
  { value: 'VACACIONES', label: 'Vacaciones' },
  { value: 'DESPEDIDO', label: 'Retirado' },
  { value: 'REENGANCHADO', label: 'Reenganchado' },
];

function estadoLabel(estado: EstadoLaboral): string {
  const found = ESTADOS_FILTRO.find((e) => e.value === estado);
  if (found) return found.label;
  const raw = estado.trim().toLowerCase();
  return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : estado;
}

function filterPillClass(active: boolean) {
  return `rounded-md border px-2 py-1 text-left text-[10px] font-bold leading-tight transition-colors ${
    active
      ? 'border-amber-500/40 bg-amber-500/15 text-amber-200'
      : 'border-white/10 bg-white/[0.03] text-white/55 hover:bg-white/[0.06] hover:text-white/80'
  }`;
}

function emptyEstadoModal(): EstadoModal {
  return {
    open: false,
    id: '',
    nextEstado: 'ACTIVO',
    motivo: '',
    inicio: '',
    fin: '',
    duracion: '',
    despidoFecha: '',
    despidoCausa: '',
    reengancheFecha: '',
    reengancheCargo: '',
    reengancheObservacion: '',
  };
}

export default function TrabajadoresRegistryClient({
  trabajadores,
  perfilesCompensacion,
}: Props) {
  const router = useRouter();
  const biblioteca = useBiblioteca();
  const areaOptions = useBibliotecaOptions('areas_nomina');
  const asignacionOptions = useBibliotecaOptions('asignacion_nomina');
  const [localTrabajadores, setLocalTrabajadores] = useState(trabajadores);
  const [search, setSearch] = useState('');
  const [filterNomina, setFilterNomina] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [filterSitio, setFilterSitio] = useState('');
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: TRABAJADORES_DEFAULT_PAGE_ROWS,
  });
  const tableBodyRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [docCedula, setDocCedula] = useState<File | null>(null);
  const [fotoCarnet, setFotoCarnet] = useState<File | null>(null);
  const [estadoModal, setEstadoModal] = useState<EstadoModal>(emptyEstadoModal());
  const [estadoMenu, setEstadoMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLocalTrabajadores(trabajadores);
  }, [trabajadores]);

  const cargoOptions = useMemo(
    () =>
      mergeSuggestions(
        biblioteca.cargoSuggestions,
        localTrabajadores.map((t) => (t.cargo || '').trim()).filter(Boolean),
      ),
    [biblioteca.cargoSuggestions, localTrabajadores],
  );

  const selectedPerfil = useMemo(
    () => perfilesCompensacion.find((p) => p.id === form.perfil_compensacion_id) ?? null,
    [perfilesCompensacion, form.perfil_compensacion_id],
  );
  const selectedPerfilTieneRotacion =
    !!selectedPerfil &&
    selectedPerfil.esquema_rotacion_default !== 'FIJO_SEMANAL' &&
    selectedPerfil.esquema_rotacion_default !== 'MOLINO_FIJO';

  const rotacionEstadoOptions = useMemo(
    () =>
      selectedPerfil
        ? estadoObservadoOpcionesPorEsquema(selectedPerfil.esquema_rotacion_default).map((o) => ({
            value: String(o.posicion),
            label: o.label,
          }))
        : [],
    [selectedPerfil],
  );

  const rotacionInicioDeducido = useMemo(() => {
    if (
      !selectedPerfilTieneRotacion ||
      !selectedPerfil ||
      !form.rotacion_estado_referencia_semana ||
      form.rotacion_estado_referencia_posicion === ''
    ) {
      return '';
    }
    return (
      fechaInicioRotacionDesdeEstadoObservado(
        form.rotacion_estado_referencia_semana,
        selectedPerfil.esquema_rotacion_default,
        Number(form.rotacion_estado_referencia_posicion),
      ) ?? ''
    );
  }, [
    selectedPerfilTieneRotacion,
    selectedPerfil,
    form.rotacion_estado_referencia_semana,
    form.rotacion_estado_referencia_posicion,
  ]);

  const ubicacionSugerencias = useMemo(
    () => biblioteca.ubicacionSugerenciasPorArea,
    [biblioteca.ubicacionSugerenciasPorArea],
  );

  const sitiosDisponibles = useMemo(() => {
    const set = new Set<string>();
    for (const t of localTrabajadores) {
      const u = getUbicacionLaboralLabel(t);
      if (u) set.add(u);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [localTrabajadores]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return localTrabajadores.filter((t) => {
      const estado = (t.estado_laboral || 'ACTIVO') as EstadoLaboral;
      if (filterNomina && t.area !== filterNomina) return false;
      if (filterEstado && estado !== filterEstado) return false;
      if (filterSitio && getUbicacionLaboralLabel(t) !== filterSitio) return false;
      if (!q) return true;
      return [
        t.nombre_completo,
        t.cedula,
        t.cargo,
        t.area_detalle || '',
        getAsignacionNomina(t) || '',
        getUbicacionLaboralLabel(t),
        areaNominaLabel(t.area, biblioteca),
        estado,
      ]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [localTrabajadores, search, filterNomina, filterEstado, filterSitio, biblioteca]);

  const filterSummary = useMemo(() => {
    let activos = 0;
    let reposo = 0;
    let despedidos = 0;
    for (const t of filtered) {
      const e = (t.estado_laboral || 'ACTIVO') as EstadoLaboral;
      if (e === 'ACTIVO' || e === 'REENGANCHADO') activos += 1;
      else if (e === 'REPOSO' || e === 'VACACIONES') reposo += 1;
      else if (e === 'DESPEDIDO') despedidos += 1;
    }
    return { activos, reposo, despedidos, total: filtered.length };
  }, [filtered]);

  const tableColumns = useMemo(
    () => [{ id: 'id', accessorFn: (row: Personal) => row.id }],
    [],
  );

  const table = useReactTable({
    data: filtered,
    columns: tableColumns,
    state: { pagination },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const syncTableLayout = useCallback(() => {
    const el = tableBodyRef.current;
    if (!el) return;
    const available = el.clientHeight;
    if (available < TRABAJADORES_ROW_PX + TRABAJADORES_HEAD_FALLBACK_PX) return;

    const headPx =
      el.querySelector('thead')?.getBoundingClientRect().height ?? TRABAJADORES_HEAD_FALLBACK_PX;
    const bodyAvailable = Math.max(0, available - headPx);

    let pageRows = Math.floor((bodyAvailable - TRABAJADORES_LAYOUT_SAFETY_PX) / TRABAJADORES_ROW_PX);
    pageRows = Math.max(1, Math.min(TRABAJADORES_PAGE_MAX, pageRows));
    setPagination((prev) => (prev.pageSize === pageRows ? prev : { ...prev, pageSize: pageRows }));
  }, []);

  useEffect(() => {
    const el = tableBodyRef.current;
    if (!el) return;
    const run = () => syncTableLayout();
    run();
    const ro = new ResizeObserver(run);
    ro.observe(el);
    const mq = window.matchMedia('(min-width: 1024px)');
    mq.addEventListener('change', run);
    return () => {
      ro.disconnect();
      mq.removeEventListener('change', run);
    };
  }, [syncTableLayout]);

  useEffect(() => {
    setPagination((prev) => (prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }));
  }, [search, filterNomina, filterEstado, filterSitio]);

  const trabajadoresById = useMemo(
    () =>
      new Map(
        localTrabajadores.map((t) => [
          t.id,
          { nombre_completo: t.nombre_completo, cedula: t.cedula },
        ]),
      ),
    [localTrabajadores],
  );

  const filteredCount = table.getFilteredRowModel().rows.length;
  const pageRows = table.getPaginationRowModel().rows;
  const emptyRowSlots = Math.max(0, pagination.pageSize - pageRows.length);
  const pageCount = table.getPageCount();
  const displayPageCount = Math.max(1, pageCount);
  const pageIndex = Math.min(pagination.pageIndex, displayPageCount - 1);
  const activePageIndex = filteredCount === 0 ? 0 : pageIndex;
  const pageWindowStart =
    Math.floor(pageIndex / TRABAJADORES_PAGE_BUTTONS_MAX) * TRABAJADORES_PAGE_BUTTONS_MAX;
  const pageNumbers = useMemo(() => {
    const len = Math.min(
      TRABAJADORES_PAGE_BUTTONS_MAX,
      Math.max(0, displayPageCount - pageWindowStart),
    );
    if (len === 0) return [0];
    return Array.from({ length: len }, (_, i) => pageWindowStart + i);
  }, [displayPageCount, pageWindowStart]);

  useEffect(() => {
    const maxIndex = Math.max(0, displayPageCount - 1);
    if (pagination.pageIndex > maxIndex) {
      setPagination((p) => ({ ...p, pageIndex: maxIndex }));
    }
  }, [displayPageCount, pagination.pageIndex]);

  const hasActiveFilters = !!(search || filterNomina || filterEstado || filterSitio);
  const activeFilterCount = [filterNomina, filterEstado, filterSitio].filter(Boolean).length;
  const { open: filtersOpen, setOpen: setFiltersOpen } = useMobileFilterSheet();

  function clearFilters() {
    setSearch('');
    setFilterNomina('');
    setFilterEstado('');
    setFilterSitio('');
  }

  useEffect(() => {
    function onDocDown(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[data-estado-trigger]') || target.closest('[data-estado-menu]')) return;
      setEstadoMenu(null);
    }
    function onWindowChange() {
      setEstadoMenu(null);
    }
    document.addEventListener('mousedown', onDocDown);
    window.addEventListener('scroll', onWindowChange, true);
    window.addEventListener('resize', onWindowChange);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      window.removeEventListener('scroll', onWindowChange, true);
      window.removeEventListener('resize', onWindowChange);
    };
  }, []);

  function openCreate() {
    setForm({
      ...EMPTY_FORM,
      ubicacion_laboral: biblioteca.ubicacionDefaultPorArea.administracion || '',
    });
    setDocCedula(null);
    setFotoCarnet(null);
    setOpen(true);
  }

  function openEdit(t: Personal) {
    setForm({
      id: t.id,
      nombre_completo: formatNombrePropio(t.nombre_completo || ''),
      cedula: t.cedula || '',
      fecha_nacimiento: t.fecha_nacimiento || '',
      fecha_ingreso: t.fecha_ingreso || new Date().toISOString().slice(0, 10),
      ajuste_antiguedad_dias: String(t.ajuste_antiguedad_dias ?? 0),
      cargo: t.cargo || '',
      area_detalle: t.area_detalle || '',
      ubicacion_laboral: t.ubicacion_laboral || getUbicacionLaboralLabel(t),
      area: t.area || 'administracion',
      notas: t.notas || '',
      estado_laboral: (t.estado_laboral || 'ACTIVO') as EstadoLaboral,
      observacion_estado: t.observacion_estado || '',
      perfil_compensacion_id: t.perfil_compensacion_id || '',
      salario_base: String(t.salario_base ?? ''),
      salario_libre: String(t.salario_libre || ''),
      bono_transporte: String(t.bono_transporte ?? ''),
      rotacion_inicio_fecha: t.rotacion_inicio_fecha || '',
      rotacion_estado_referencia_semana: new Date().toISOString().slice(0, 10),
      rotacion_estado_referencia_posicion: '',
    });
    setDocCedula(null);
    setFotoCarnet(null);
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
    setForm(EMPTY_FORM);
    setDocCedula(null);
    setFotoCarnet(null);
  }

  function submitForm() {
    if (!form.nombre_completo.trim() || !form.cedula.trim()) {
      toastError('Nombre y cédula son obligatorios.');
      return;
    }

    if (!form.salario_base || Number(form.salario_base) <= 0) {
      toastError('El sueldo base semanal es obligatorio y debe ser mayor a 0.');
      return;
    }

    if (!form.perfil_compensacion_id) {
      toastError('Selecciona un perfil de compensación.');
      return;
    }

    const originalEstado = form.id
      ? ((localTrabajadores.find((t) => t.id === form.id)?.estado_laboral || 'ACTIVO') as EstadoLaboral)
      : null;
    const estadoChanged = originalEstado !== null && originalEstado !== form.estado_laboral;
    if (
      (form.estado_laboral === 'DESPEDIDO' || form.estado_laboral === 'REENGANCHADO') &&
      (!form.id || estadoChanged)
    ) {
      toastError(
        'Para Despedido o Reenganchado use el menú de estado en la tabla (requiere fecha y detalle).',
      );
      return;
    }

    const fd = new FormData();
    if (form.id) fd.set('id', form.id);
    fd.set('nombre_completo', formatNombrePropio(form.nombre_completo));
    fd.set('cedula', form.cedula);
    fd.set('fecha_nacimiento', form.fecha_nacimiento);
    fd.set('fecha_ingreso', form.fecha_ingreso);
    fd.set('ajuste_antiguedad_dias', form.ajuste_antiguedad_dias);
    fd.set('cargo', form.cargo);
    if (form.area_detalle) {
      fd.set('area_detalle', form.area_detalle);
    }
    fd.set('ubicacion_laboral', form.ubicacion_laboral);
    fd.set('area', form.area);
    fd.set('notas', form.notas);
    fd.set('estado_laboral', form.estado_laboral);
    fd.set('observacion_estado', form.observacion_estado);
    fd.set('perfil_compensacion_id', form.perfil_compensacion_id);
    fd.set('salario_base', form.salario_base);
    fd.set('salario_libre', form.salario_libre);
    fd.set('bono_transporte', form.bono_transporte);
    fd.set('rotacion_inicio_fecha', form.rotacion_inicio_fecha);
    fd.set('rotacion_estado_referencia_semana', form.rotacion_estado_referencia_semana);
    fd.set('rotacion_estado_referencia_posicion', form.rotacion_estado_referencia_posicion);
    if (docCedula) fd.set('doc_cedula', docCedula);
    if (fotoCarnet) fd.set('foto_carnet', fotoCarnet);

    startTransition(async () => {
      const res = await upsertTrabajadorRegistroAction(fd);
      if (!res.ok) {
        toastError(res.message);
        return;
      }
      closeModal();
      toast.success(res.message);
      router.refresh();
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((t) => t.id)));
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    const idsToDelete = Array.from(selectedIds);
    if (
      !confirm(
        `¿Eliminar ${idsToDelete.length} trabajador(es)? Esta acción es permanente y no se puede deshacer.`,
      )
    ) {
      return;
    }

    const snapshot = localTrabajadores;
    setLocalTrabajadores((prev) => prev.filter((t) => !idsToDelete.includes(t.id)));
    setSelectedIds(new Set());

    startTransition(async () => {
      const res = await bulkDeleteTrabajadoresAction(idsToDelete);
      if (!res.ok) {
        setLocalTrabajadores(snapshot);
        setSelectedIds(new Set(idsToDelete));
        toastError(res.message);
        return;
      }
      toast.success(res.message);
      router.refresh();
    });
  }

  function handleEstadoSelection(t: Personal, nextEstado: EstadoLaboral) {
    if (nextEstado === (t.estado_laboral || 'ACTIVO')) return;
    if (nextEstado === 'ACTIVO') {
      startTransition(async () => {
        const res = await updateTrabajadorEstadoAction({
          id: t.id,
          estado_laboral: 'ACTIVO',
          observacion_estado: '',
        });
        if (!res.ok) toastError(res.message);
        else {
          toast.success('Estado actualizado exitosamente');
          router.refresh();
        }
      });
      return;
    }
    setEstadoModal({
      open: true,
      id: t.id,
      nextEstado,
      motivo: t.observacion_estado || '',
      inicio: '',
      fin: t.estado_fin_fecha || '',
      duracion: t.estado_duracion_dias ? String(t.estado_duracion_dias) : '',
      despidoFecha: t.despido_fecha || '',
      despidoCausa: t.despido_causa || '',
      reengancheFecha: t.reenganche_fecha || '',
      reengancheCargo: t.reenganche_cargo || t.cargo || '',
      reengancheObservacion: t.reenganche_observacion || '',
    });
  }

  function submitEstadoModal() {
    const payload = {
      id: estadoModal.id,
      estado_laboral: estadoModal.nextEstado,
      observacion_estado: estadoModal.motivo,
      estado_inicio_fecha: estadoModal.inicio || undefined,
      estado_fin_fecha: estadoModal.fin || undefined,
      estado_duracion_dias: estadoModal.duracion ? Number(estadoModal.duracion) : null,
      despido_fecha: estadoModal.nextEstado === 'DESPEDIDO' ? estadoModal.despidoFecha : undefined,
      despido_causa: estadoModal.nextEstado === 'DESPEDIDO' ? estadoModal.despidoCausa : undefined,
      reenganche_fecha: estadoModal.nextEstado === 'REENGANCHADO' ? estadoModal.reengancheFecha : undefined,
      reenganche_cargo: estadoModal.nextEstado === 'REENGANCHADO' ? estadoModal.reengancheCargo : undefined,
      reenganche_observacion: estadoModal.nextEstado === 'REENGANCHADO' ? estadoModal.reengancheObservacion : undefined,
    } as const;

    if (
      estadoModal.nextEstado === 'DESPEDIDO' &&
      (!estadoModal.despidoFecha || !estadoModal.despidoCausa.trim())
    ) {
      toastError('Para despido debes indicar fecha y causa.');
      return;
    }
    if (
      estadoModal.nextEstado === 'REENGANCHADO' &&
      (!estadoModal.reengancheFecha || !estadoModal.reengancheCargo.trim())
    ) {
      toastError('Para reenganchado debes indicar fecha de reintegro y cargo.');
      return;
    }

    startTransition(async () => {
      const res = await updateTrabajadorEstadoAction(payload);
      if (!res.ok) {
        toastError(res.message);
        return;
      }
      setEstadoModal(emptyEstadoModal());
      toast.success(res.message);
      router.refresh();
    });
  }

  function onEstadoInicioChange(value: string) {
    setEstadoModal((prev) => {
      const next = { ...prev, inicio: value };
      const dur = Number(next.duracion || '0');
      if (value && Number.isFinite(dur) && dur >= 0) {
        next.fin = addDaysIso(value, dur);
      } else if (value && next.fin) {
        const dd = diffDaysIso(value, next.fin);
        if (dd !== null) next.duracion = String(dd);
      }
      return next;
    });
  }

  function onEstadoFinChange(value: string) {
    setEstadoModal((prev) => {
      const next = { ...prev, fin: value };
      if (next.inicio && value) {
        const dd = diffDaysIso(next.inicio, value);
        if (dd !== null) next.duracion = String(dd);
      }
      return next;
    });
  }

  function onEstadoDuracionChange(value: string) {
    setEstadoModal((prev) => {
      const next = { ...prev, duracion: value };
      const dur = Number(value || '0');
      if (next.inicio && Number.isFinite(dur) && dur >= 0) {
        next.fin = addDaysIso(next.inicio, dur);
      }
      return next;
    });
  }

  function renderPadRow(key: string) {
    return (
      <tr key={key} className="gastos-tr gastos-table__row trabajadores-table__row--pad" aria-hidden>
        {Array.from({ length: TRABAJADORES_TABLE_COLS }, (_, col) => (
          <td key={col} className="gastos-table__cell gastos-td px-3" />
        ))}
      </tr>
    );
  }

  function renderWorkerRow(t: Personal) {
    const estado = (t.estado_laboral || 'ACTIVO') as EstadoLaboral;
    const isFired = estado === 'DESPEDIDO';
    const isReengaged = estado === 'REENGANCHADO';
    const fechaIngresoFmt = formatFechaIngreso(t.fecha_ingreso);
    const isSelected = selectedIds.has(t.id);
    return (
      <tr
        key={t.id}
        className={`gastos-tr gastos-table__row ${
          isFired
            ? 'trabajadores-table__row--fired'
            : isReengaged
              ? 'trabajadores-table__row--reengaged'
              : ''
        } ${isSelected ? 'bg-amber-500/5' : ''}`}
      >
        <td className="gastos-table__cell gastos-td px-3">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => toggleSelect(t.id)}
            className="h-4 w-4 rounded border-white/20 bg-transparent text-amber-500 focus:ring-amber-500/50"
          />
        </td>
        <td className="gastos-table__cell gastos-td px-3">
          <div className="trabajadores-row-worker">
            <p className="truncate font-semibold text-white">{displayNombrePersonal(t)}</p>
            <p className="truncate text-[10px] text-white/45">{getUbicacionLaboralLabel(t)}</p>
          </div>
        </td>
        <td className="gastos-table__cell gastos-td px-3 text-white/80">{t.cedula}</td>
        <td className="gastos-table__cell gastos-td px-3 text-white/70">{calcEdad(t.fecha_nacimiento) ?? '-'}</td>
        <td className="gastos-table__cell gastos-td px-3 text-white/70">
          <p className="text-[11px] tabular-nums leading-tight">
            {antiguedadLabel(t.fecha_ingreso, t.ajuste_antiguedad_dias)}
          </p>
          {fechaIngresoFmt ? (
            <p className="mt-0.5 text-[10px] tabular-nums text-white/40" title="Fecha de ingreso">
              {fechaIngresoFmt}
            </p>
          ) : null}
        </td>
        <td className="gastos-table__cell gastos-td max-w-[9rem] px-3 text-white/80">
          <span className="line-clamp-2 text-[11px] leading-snug" title={t.cargo || undefined}>
            {t.cargo || '-'}
          </span>
        </td>
        <td className="gastos-table__cell gastos-td px-3">
          <div className="relative inline-flex max-w-full">
            <button
              type="button"
              data-estado-trigger
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const menuWidth = 160;
                const x = Math.max(8, Math.min(rect.left, window.innerWidth - menuWidth - 8));
                const y = rect.bottom + 6;
                setEstadoMenu((prev) => (prev?.id === t.id ? null : { id: t.id, x, y }));
              }}
              className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-wide ${statusTone(estado)}`}
            >
              <span className="truncate">{estadoLabel(estado)}</span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-75" />
            </button>
          </div>
        </td>
        <td className="gastos-table__cell gastos-td px-3 text-xs text-white/55">
          <span className="block truncate">
            {t.observacion_estado || t.despido_causa || t.notas || '-'}
          </span>
        </td>
        <td className="gastos-table__cell gastos-td px-3 text-xs">
          <div className="flex min-w-0 flex-col gap-0.5 leading-tight">
            {t.doc_cedula_url ? (
              <a className="truncate text-cyan-300 hover:underline" href={t.doc_cedula_url} target="_blank" rel="noreferrer">
                Cédula
              </a>
            ) : (
              <span className="text-white/35">Sin cédula</span>
            )}
            {t.foto_carnet_url ? (
              <a className="truncate text-cyan-300 hover:underline" href={t.foto_carnet_url} target="_blank" rel="noreferrer">
                Foto
              </a>
            ) : (
              <span className="text-white/35">Sin foto</span>
            )}
          </div>
        </td>
        <td className="gastos-table__cell gastos-td px-3 text-right">
          <button
            type="button"
            onClick={() => openEdit(t)}
            className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-300"
          >
            <PencilLine className="h-3.5 w-3.5" />
            Editar
          </button>
        </td>
      </tr>
    );
  }

  const trabajadoresFiltersPanel = (
    <>
      <div className="trabajadores-page__filters-body space-y-3">
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase text-white/40">Nómina (módulo)</p>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setFilterNomina('')}
              className={filterPillClass(filterNomina === '')}
            >
              Todas
            </button>
            {areaOptions.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setFilterNomina(filterNomina === o.value ? '' : o.value)}
                className={filterPillClass(filterNomina === o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase text-white/40">Estado laboral</p>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setFilterEstado('')}
              className={filterPillClass(filterEstado === '')}
            >
              Todos
            </button>
            {ESTADOS_FILTRO.map((e) => (
              <button
                key={e.value}
                type="button"
                onClick={() => setFilterEstado(filterEstado === e.value ? '' : e.value)}
                className={filterPillClass(filterEstado === e.value)}
              >
                {e.label}
              </button>
            ))}
          </div>
        </div>

        {sitiosDisponibles.length > 0 ? (
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase text-white/40">Sitio laboral</p>
            <div className="trabajadores-page__sitios flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setFilterSitio('')}
                className={filterPillClass(filterSitio === '')}
              >
                Todos
              </button>
              {sitiosDisponibles.map((sitio) => (
                <button
                  key={sitio}
                  type="button"
                  title={sitio}
                  onClick={() => setFilterSitio(filterSitio === sitio ? '' : sitio)}
                  className={`${filterPillClass(filterSitio === sitio)} max-w-full truncate`}
                >
                  {sitio}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="trabajadores-page__filter-summary mt-4 border-t border-white/[0.08] pt-3">
        <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/40">
          <Users className="h-3.5 w-3.5" />
          Resumen filtrado
        </div>
        <dl className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[11px]">
          <div>
            <dt className="text-white/40">Total</dt>
            <dd className="font-bold tabular-nums text-white">{filterSummary.total}</dd>
          </div>
          <div>
            <dt className="text-white/40">Activos</dt>
            <dd className="font-bold tabular-nums text-emerald-300">{filterSummary.activos}</dd>
          </div>
          <div>
            <dt className="text-white/40">Reposo / vac.</dt>
            <dd className="font-bold tabular-nums text-amber-300">{filterSummary.reposo}</dd>
          </div>
          <div>
            <dt className="text-white/40">Retirados</dt>
            <dd className="font-bold tabular-nums text-red-300">{filterSummary.despedidos}</dd>
          </div>
        </dl>
        {hasActiveFilters ? (
          <button
            type="button"
            onClick={clearFilters}
            className="btn-secondary mt-2.5 w-full !py-1.5 text-[10px]"
          >
            Limpiar filtros
          </button>
        ) : null}
      </div>
    </>
  );

  return (
    <div className="trabajadores-page gastos-page flex min-h-0 w-full flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden">
      <div className="trabajadores-page__grid gastos-page__grid min-h-[min(58dvh,36rem)] shrink-0 lg:min-h-0 lg:flex-1">
        <aside className="trabajadores-page__filters app-surface-card hidden min-h-0 flex-col p-3 md:flex">
          <p className="mb-3 shrink-0 text-[9px] font-bold uppercase tracking-widest text-[var(--dashboard-text-muted)]">
            Filtros
          </p>
          {trabajadoresFiltersPanel}
        </aside>

        <div className="trabajadores-page__table gastos-page__table app-surface-card relative flex min-h-[min(52dvh,32rem)] min-w-0 flex-col overflow-hidden lg:min-h-0">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="trabajadores-page__table-toolbar flex shrink-0 flex-col gap-2 border-b border-white/[0.08] px-3 py-2.5 lg:flex-row lg:flex-wrap lg:items-center">
              <MobileFilterTrigger
                activeCount={activeFilterCount}
                onOpen={() => setFiltersOpen(true)}
                className="trabajadores-page__filter-trigger lg:hidden"
              />
              <div className="trabajadores-page__toolbar-row flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <div className="gastos-search-wrap flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg px-3">
                <Search className="gastos-icon-muted h-3.5 w-3.5 shrink-0" aria-hidden />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar"
                  className="min-w-0 flex-1 border-none bg-transparent text-sm outline-none"
                />
                {search ? (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="gastos-page-btn shrink-0 rounded p-0.5"
                    aria-label="Limpiar búsqueda"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
              {selectedIds.size > 0 && (
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  disabled={isPending}
                  className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md border-2 border-cyan-400/70 bg-cyan-500/15 px-4 text-[11px] font-extrabold uppercase tracking-wide text-cyan-100 shadow-[3px_3px_0_0_rgba(34,211,238,0.45)] transition-all hover:-translate-y-px hover:bg-cyan-500/25 hover:shadow-[4px_4px_0_0_rgba(34,211,238,0.55)] disabled:translate-y-0 disabled:opacity-50 disabled:shadow-none"
                >
                  <Trash2 className="h-4 w-4 shrink-0" />
                  Eliminar ({selectedIds.size}) Trabajadores Seleccionados
                </button>
              )}
              <button
                type="button"
                onClick={openCreate}
                className="app-btn-primary inline-flex h-9 shrink-0 items-center justify-center gap-2 px-4 text-xs sm:min-w-[10.5rem]"
              >
                <Plus className="h-4 w-4" />
                Agregar Trabajador
              </button>
              </div>
            </div>

            <div
              ref={tableBodyRef}
              className="gastos-page__table-body min-h-0 flex-1"
              style={
                {
                  '--trabajadores-page-rows': pagination.pageSize,
                } as CSSProperties
              }
            >
              <table className="gastos-table trabajadores-table--uniform min-w-full border-collapse text-left text-sm">
                <thead className="gastos-thead sticky top-0 z-[1] bg-white/[0.03] text-[11px] uppercase tracking-wider text-white/45">
                  <tr className="gastos-table__row">
                    <th className="gastos-th gastos-table__cell w-10 px-3">
                      <input
                        type="checkbox"
                        checked={filtered.length > 0 && selectedIds.size === filtered.length}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 rounded border-white/20 bg-transparent text-amber-500 focus:ring-amber-500/50"
                      />
                    </th>
                    <th className="gastos-th gastos-table__cell px-3">Trabajador</th>
                    <th className="gastos-th gastos-table__cell px-3">Cédula</th>
                    <th className="gastos-th gastos-table__cell px-3">Edad</th>
                    <th className="gastos-th gastos-table__cell px-3">Antigüedad</th>
                    <th className="gastos-th gastos-table__cell px-3">Cargo</th>
                    <th className="gastos-th gastos-table__cell px-3">Estado</th>
                    <th className="gastos-th gastos-table__cell px-3">Observación</th>
                    <th className="gastos-th gastos-table__cell px-3">Adjuntos</th>
                    <th className="gastos-th gastos-table__cell px-3 text-right">Editar</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCount === 0 ? (
                    <>
                      <tr className="gastos-tr gastos-table__row">
                        <td
                          className="gastos-table__cell gastos-td px-3 text-center text-sm text-white/45"
                          colSpan={TRABAJADORES_TABLE_COLS}
                        >
                          No hay trabajadores para mostrar con este filtro.
                        </td>
                      </tr>
                      {Array.from({ length: Math.max(0, pagination.pageSize - 1) }, (_, i) =>
                        renderPadRow(`empty-pad-${i}`),
                      )}
                    </>
                  ) : (
                    <>
                      {pageRows.map((row) => renderWorkerRow(row.original))}
                      {Array.from({ length: emptyRowSlots }, (_, i) => renderPadRow(`pad-${i}`))}
                    </>
                  )}
                </tbody>
              </table>
            </div>

            <div className="gastos-page__table-footer gastos-footer-bar flex shrink-0 items-center justify-between border-t px-3 py-1.5">
              <span className="gastos-footer-label text-[10px]">
                {filteredCount === 0
                  ? '0 trabajadores'
                  : `${pageIndex * pagination.pageSize + 1}–${Math.min(
                      (pageIndex + 1) * pagination.pageSize,
                      filteredCount,
                    )} de ${filteredCount} trabajadores`}
              </span>
              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  className="gastos-page-btn rounded p-1 transition-colors disabled:opacity-30"
                  aria-label="Página anterior"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                {pageNumbers.map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => table.setPageIndex(page)}
                    disabled={filteredCount === 0 && page > 0}
                    aria-label={`Página ${page + 1}`}
                    aria-current={page === activePageIndex ? 'page' : undefined}
                    className={`gastos-page-btn min-w-[1.35rem] rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums transition-colors ${
                      page === activePageIndex ? 'gastos-page-btn--active' : ''
                    }`}
                  >
                    {page + 1}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  className="gastos-page-btn rounded p-1 transition-colors disabled:opacity-30"
                  aria-label="Página siguiente"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="shrink-0">
        <TrabajadoresImportAliasesPanel trabajadoresById={trabajadoresById} />
      </div>

      {estadoMenu && (
        <div
          data-estado-menu
          className="fixed z-[220] w-40 overflow-hidden rounded-lg border border-white/10 bg-zinc-950/95 p-1 shadow-2xl backdrop-blur-md"
          style={{ left: `${estadoMenu.x}px`, top: `${estadoMenu.y}px` }}
        >
          {(['ACTIVO', 'REPOSO', 'VACACIONES', 'DESPEDIDO', 'REENGANCHADO'] as EstadoLaboral[]).map((opt) => {
            const worker = localTrabajadores.find((w) => w.id === estadoMenu.id);
            const current = ((worker?.estado_laboral || 'ACTIVO') as EstadoLaboral);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  setEstadoMenu(null);
                  if (worker) handleEstadoSelection(worker, opt);
                }}
                className={`block w-full rounded-md px-2 py-1.5 text-left text-[11px] font-semibold transition-colors ${
                  opt === current
                    ? 'bg-amber-500/15 text-amber-300'
                    : 'text-white/75 hover:bg-white/5 hover:text-white'
                }`}
              >
                {estadoLabel(opt)}
              </button>
            );
          })}
        </div>
      )}

      <PageFormModal
        open={open}
        onClose={closeModal}
        sheetTitle={form.id ? 'Editar trabajador' : 'Nuevo trabajador'}
        sheetIcon={<SheetIconBadge icon={UserCircle} tone="success" />}
        panelClassName="sm:max-w-3xl"
      >
        <h2 className="mb-4 hidden text-lg font-bold text-white lg:block">{form.id ? 'Editar trabajador' : 'Nuevo trabajador'}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="input-label">Nombre y Apellido *</label>
            <input className="input-field" value={form.nombre_completo} onChange={(e) => setForm((p) => ({ ...p, nombre_completo: e.target.value }))} />
          </div>
          <div>
            <label className="input-label">Cédula *</label>
            <input className="input-field" value={form.cedula} onChange={(e) => setForm((p) => ({ ...p, cedula: e.target.value }))} />
          </div>
          <div>
            <label className="input-label">Fecha de Nacimiento</label>
            <AppDatePicker value={form.fecha_nacimiento} onChange={(v) => setForm((p) => ({ ...p, fecha_nacimiento: v }))} />
          </div>
          <div>
            <label className="input-label">Fecha de Ingreso</label>
            <AppDatePicker value={form.fecha_ingreso} onChange={(v) => setForm((p) => ({ ...p, fecha_ingreso: v }))} />
          </div>
          <div>
            <label className="input-label">Ajuste Antiguedad (días)</label>
            <input className="input-field" type="number" value={form.ajuste_antiguedad_dias} onChange={(e) => setForm((p) => ({ ...p, ajuste_antiguedad_dias: e.target.value }))} />
          </div>
          <div>
            <label className="input-label">Cargo</label>
            <input list="cargo-options" className="input-field" value={form.cargo} onChange={(e) => setForm((p) => ({ ...p, cargo: e.target.value }))} placeholder="Ej: Capataz, Palero, Cocinero" />
            <datalist id="cargo-options">
              {cargoOptions.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div className="sm:col-span-2">
            <label className="input-label">Perfil de Compensación *</label>
            <AppSelect
              value={form.perfil_compensacion_id}
              onChange={(val) => setForm((p) => ({ ...p, perfil_compensacion_id: val }))}
              options={perfilesCompensacion.map((p) => ({ value: p.id, label: p.nombre }))}
              placeholder="Seleccionar perfil de compensación"
            />
            {perfilesCompensacion.length === 0 ? (
              <p className="mt-1 text-[10px] text-amber-300/80">
                No hay perfiles activos en la base. Ejecuta el script de seed en Supabase.
              </p>
            ) : selectedPerfil ? (
              <div className="mt-2 rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <p className="text-xs font-semibold text-white/90">{selectedPerfil.nombre}</p>
                {selectedPerfil.descripcion && (
                  <p className="mt-1 text-[11px] leading-relaxed text-white/45">{selectedPerfil.descripcion}</p>
                )}
                <dl className="mt-2 grid gap-2 text-[11px] sm:grid-cols-2">
                  <div>
                    <dt className="text-white/35">Esquema de rotación</dt>
                    <dd className="font-medium text-white/75">{selectedPerfil.esquema_rotacion_default}</dd>
                  </div>
                  <div>
                    <dt className="text-white/35">Ciclo</dt>
                    <dd className="font-medium text-white/75">
                      {selectedPerfil.semanas_trabajadas_por_ciclo} trab. / {selectedPerfil.semanas_libres_por_ciclo} libre
                      {' · '}
                      {selectedPerfil.duracion_ciclo_dias} días
                    </dd>
                  </div>
                  <div>
                    <dt className="text-white/35">Día libre</dt>
                    <dd className="font-medium text-white/75">{selectedPerfil.politica_dia_libre}</dd>
                  </div>
                  <div>
                    <dt className="text-white/35">Reposo</dt>
                    <dd className="font-medium text-white/75">{selectedPerfil.politica_reposo}</dd>
                  </div>
                </dl>
                <p className="mt-2 text-[10px] text-white/35">
                  El esquema se deriva del perfil; el pago final siempre lo recalcula el backend.
                </p>
              </div>
            ) : (
              <p className="mt-1 text-[10px] text-white/35">
                Define esquema de rotación, políticas de pago y reglas del ciclo.
              </p>
            )}
          </div>
          <div>
            <label className="input-label">Sueldo Base Semanal (USD) *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="input-field"
              value={form.salario_base}
              onChange={(e) => setForm((p) => ({ ...p, salario_base: e.target.value }))}
              placeholder="Ej: 100.00"
            />
          </div>
          <div>
            <label className="input-label">Sueldo Libre / Tarifa Plana (USD)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="input-field"
              value={form.salario_libre}
              onChange={(e) => setForm((p) => ({ ...p, salario_libre: e.target.value }))}
              placeholder="Vacío = usa sueldo base"
            />
            <p className="mt-1 text-[10px] text-white/35">Usado para la semana libre pagada según el perfil.</p>
          </div>
          <div>
            <label className="input-label">Bono Transporte (USD)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="input-field"
              value={form.bono_transporte}
              onChange={(e) => setForm((p) => ({ ...p, bono_transporte: e.target.value }))}
              placeholder="Ej: 20.00"
            />
            <p className="mt-1 text-[10px] text-white/35">Opcional. Para grupos con bono fijo (ej: Molinos).</p>
          </div>
          {selectedPerfilTieneRotacion ? (
            <div className="sm:col-span-2 rounded-lg border border-[var(--card-border)] bg-[var(--surface-elevated)] p-3">
              <p className="text-xs font-semibold text-[var(--text-primary)]">Asistente de rotación</p>
              <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-muted)]">
                No necesitas saber cuándo empezó a rotar. Indica una semana conocida y cómo estaba el trabajador; MineOS deduce el inicio del ciclo.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="input-label">Semana de referencia</label>
                  <AppDatePicker
                    value={form.rotacion_estado_referencia_semana}
                    onChange={(v) =>
                      setForm((p) => ({
                        ...p,
                        rotacion_estado_referencia_semana: v,
                        rotacion_inicio_fecha: '',
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="input-label">Estado observado en esa semana</label>
                  <AppSelect
                    value={form.rotacion_estado_referencia_posicion}
                    onChange={(v) =>
                      setForm((p) => ({
                        ...p,
                        rotacion_estado_referencia_posicion: v,
                        rotacion_inicio_fecha: '',
                      }))
                    }
                    options={rotacionEstadoOptions}
                    placeholder="Seleccionar estado observado"
                  />
                </div>
              </div>
              <div className="mt-3 rounded-md border border-[var(--card-border)] bg-black/10 px-3 py-2 text-[11px] text-[var(--text-secondary)]">
                Inicio deducido:{' '}
                <span className="font-semibold text-[var(--text-primary)]">
                  {rotacionInicioDeducido || form.rotacion_inicio_fecha || 'pendiente'}
                </span>
              </div>
            </div>
          ) : null}
          <div>
            <label className="input-label">Área / Sitio laboral</label>
            <input
              list="ubicacion-options"
              className="input-field"
              value={form.ubicacion_laboral}
              onChange={(e) => setForm((p) => ({ ...p, ubicacion_laboral: e.target.value }))}
              placeholder="Ej: Mina Belén, otra mina…"
            />
            <datalist id="ubicacion-options">
              {(ubicacionSugerencias[form.area] || []).map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="input-label">Nómina (módulo)</label>
            <AppSelect
              value={form.area}
              onChange={(val) => {
                const area = val as FormState['area'];
                setForm((p) => ({
                  ...p,
                  area,
                  ubicacion_laboral: biblioteca.ubicacionDefaultPorArea[area] || p.ubicacion_laboral,
                }));
              }}
              options={areaOptions}
            />
            <p className="mt-1 text-[10px] text-white/35">Define en qué nómina semanal aparece el trabajador.</p>
          </div>
          <div>
            <label className="input-label">Asignación nómina</label>
            <AppSelect
              value={form.area_detalle}
              onChange={(val) => setForm((p) => ({ ...p, area_detalle: val }))}
              options={asignacionOptions}
              placeholder="Vertical, Molinos, Administración..."
            />
            <p className="mt-1 text-[10px] text-white/35">Centro de costo para subtotales y reportes.</p>
          </div>
          <div>
            <label className="input-label">Estado Inicial</label>
            <AppSelect
              value={form.estado_laboral}
              onChange={(val) => setForm((p) => ({ ...p, estado_laboral: val as EstadoLaboral }))}
              options={
                form.id
                  ? [
                      { value: 'ACTIVO', label: 'Activo' },
                      { value: 'REPOSO', label: 'Reposo' },
                      { value: 'VACACIONES', label: 'Vacaciones' },
                      { value: 'DESPEDIDO', label: 'Despedido' },
                      { value: 'REENGANCHADO', label: 'Reenganchado' },
                    ]
                  : [
                      { value: 'ACTIVO', label: 'Activo' },
                      { value: 'REPOSO', label: 'Reposo' },
                      { value: 'VACACIONES', label: 'Vacaciones' },
                    ]
              }
            />
          </div>
          <div className="sm:col-span-2">
            <label className="input-label">Observación General</label>
            <textarea className="input-field min-h-[72px]" value={form.notas} onChange={(e) => setForm((p) => ({ ...p, notas: e.target.value }))} />
          </div>
          <div>
            <label className="input-label">Adjuntar cédula (opcional)</label>
            <input type="file" accept="image/*,.pdf" className="input-field" onChange={(e) => setDocCedula(e.target.files?.[0] ?? null)} />
          </div>
          <div>
            <label className="input-label">Foto carnet (opcional)</label>
            <input type="file" accept="image/*" className="input-field" onChange={(e) => setFotoCarnet(e.target.files?.[0] ?? null)} />
          </div>
        </div>
        <PageFormModalFooter className="mt-5 flex justify-end gap-2">
          <button onClick={closeModal} className="btn-secondary" disabled={isPending}>Cancelar</button>
          <button onClick={submitForm} className="btn-primary" disabled={isPending}>
            {isPending ? 'Guardando...' : form.id ? 'Guardar cambios' : 'Registrar trabajador'}
          </button>
        </PageFormModalFooter>
      </PageFormModal>

      <PageFormModal
        open={estadoModal.open}
        onClose={() => setEstadoModal(emptyEstadoModal())}
        sheetTitle={`Detalle de estado: ${estadoModal.nextEstado}`}
        sheetIcon={<SheetIconBadge icon={ClipboardList} tone="info" />}
        panelClassName="sm:max-w-xl"
      >
        <h3 className="mb-3 hidden text-lg font-bold text-white lg:block">Detalle de estado: {estadoModal.nextEstado}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {(estadoModal.nextEstado === 'REPOSO' || estadoModal.nextEstado === 'VACACIONES') && (
            <>
              <div>
                <label className="input-label">Inicio</label>
                <AppDatePicker value={estadoModal.inicio} onChange={(val) => onEstadoInicioChange(val)} />
              </div>
              <div>
                <label className="input-label">Fin</label>
                <AppDatePicker value={estadoModal.fin} onChange={(val) => onEstadoFinChange(val)} />
              </div>
              <div>
                <label className="input-label">Duración (días)</label>
                <input className="input-field" type="number" value={estadoModal.duracion} onChange={(e) => onEstadoDuracionChange(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className="input-label">Observación</label>
                <textarea className="input-field min-h-[70px]" value={estadoModal.motivo} onChange={(e) => setEstadoModal((p) => ({ ...p, motivo: e.target.value }))} />
              </div>
            </>
          )}
          {estadoModal.nextEstado === 'DESPEDIDO' && (
            <>
              <div>
                <label className="input-label">Fecha de despido *</label>
                <AppDatePicker value={estadoModal.despidoFecha} onChange={(v) => setEstadoModal((p) => ({ ...p, despidoFecha: v }))} />
              </div>
              <div className="sm:col-span-2">
                <label className="input-label">Causa / Observación *</label>
                <textarea className="input-field min-h-[86px]" value={estadoModal.despidoCausa} onChange={(e) => setEstadoModal((p) => ({ ...p, despidoCausa: e.target.value }))} />
              </div>
            </>
          )}
          {estadoModal.nextEstado === 'REENGANCHADO' && (
            <>
              <div>
                <label className="input-label">Fecha de reintegro *</label>
                <AppDatePicker value={estadoModal.reengancheFecha} onChange={(v) => setEstadoModal((p) => ({ ...p, reengancheFecha: v }))} />
              </div>
              <div>
                <label className="input-label">Cargo de reintegro *</label>
                <input className="input-field" value={estadoModal.reengancheCargo} onChange={(e) => setEstadoModal((p) => ({ ...p, reengancheCargo: e.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <label className="input-label">Observación</label>
                <textarea className="input-field min-h-[86px]" value={estadoModal.reengancheObservacion} onChange={(e) => setEstadoModal((p) => ({ ...p, reengancheObservacion: e.target.value }))} />
              </div>
            </>
          )}
        </div>
        <PageFormModalFooter className="mt-5 flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setEstadoModal(emptyEstadoModal())}>Cancelar</button>
          <button className="btn-primary" onClick={submitEstadoModal} disabled={isPending}>
            {isPending ? 'Guardando...' : 'Guardar estado'}
          </button>
        </PageFormModalFooter>
      </PageFormModal>

      <MobileFilterSheet open={filtersOpen} onClose={() => setFiltersOpen(false)}>
        {trabajadoresFiltersPanel}
      </MobileFilterSheet>
    </div>
  );
}

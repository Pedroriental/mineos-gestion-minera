'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase-server';
import { isAsignacionNominaValid, PERSONAL_SYNC_PATHS } from '@/lib/personal-master';
import { loadBibliotecaAppSnapshot } from '@/lib/biblioteca-catalog';
import { AUTO_ROTACION_OBS, tieneEsquemaConRotacion } from '@/lib/rotacion-personal';
import {
  distribucionToCierrePayload,
  validateDistribucion,
  type DistribucionParte,
} from '@/lib/nomina-distribucion';
import { buildPersonalSnapshot } from '@/lib/nomina/types';
import { formatNovedadTurnoObsForSave, reposoPagoUnicoMontoFromRow, type NominaNovedadTurno, type ReposoModoSueldoSemana } from '@/lib/nomina-novedad-turno';
import {
  ensureManualVistaPeriodoId,
  findOrCreateNominaSemanaForCierre,
  linkSemanaToPeriodo,
  refreshPeriodoTotalUsd,
  upsertNominaCierreForSemana,
  type ManualPeriodoCierreRef,
} from '@/lib/nomina/cierre-semana-db';
import type { NominaVale, Personal, HistorialPagoRow, TendenciaSemanalRow } from '@/lib/types';
import { z } from 'zod';
import {
  PersonalV3Schema,
  PersonalV3UpdateSchema,
  AssignToNominaAreaSchema,
  CreateAndAssignPersonalNominaSchema,
  type CreateAndAssignPersonalNominaInput,
  CrearValeSchema,
} from '@/lib/validations/nomina-v3';
import {
  CierreNominaV3Schema,
  verificarTotalesCierre,
  type CierreNominaV3Input,
  type CierreNominaV3Parsed,
  type PersonalCierre,
} from '@/lib/validations/nomina-cierre';
import {
  vincularSemanaACicloAction,
  cerrarCicloAutomaticoAction,
} from './nomina-ciclos-automatizacion';
import {
  validarCierreRotacionSemanalAction,
  procesarCierreRotacionNominaAction,
} from './rotacion-instancias';

export type ActionResult =
  | { ok: true;  message: string; data?: any }
  | { ok: false; message: string };

function revalidateAll() {
  PERSONAL_SYNC_PATHS.forEach((p) => revalidatePath(p));
}

// ── Crear/Actualizar trabajador con campos V3 (rotación) ─────
export async function upsertPersonalV3Action(raw: {
  id?: string;
  cedula: string;
  nombre_completo: string;
  cargo: string;
  area: string;
  area_detalle: string;
  perfil_compensacion_id: string;
  salario_base: number;
  salario_libre?: number;
  bono_transporte: number;
  telefono: string;
  notas: string;
  fecha_ingreso: string;
  esquema_rotacion?: string;
  rotacion_inicio_fecha?: string | null;
}): Promise<ActionResult> {
  const schema = raw.id ? PersonalV3UpdateSchema : PersonalV3Schema;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const msg = Object.values(parsed.error.flatten().fieldErrors).flat()[0] ?? 'Datos inválidos';
    return { ok: false, message: msg };
  }
  const data = parsed.data as typeof parsed.data & { id?: string };
  try {
    const supabase = await createServerClient();

    const biblioteca = await loadBibliotecaAppSnapshot();

    if (!isAsignacionNominaValid(data.area_detalle, biblioteca)) {
      return { ok: false, message: 'La asignación nómina no es válida.' };
    }

    const { data: perfil, error: perfilError } = await supabase
      .from('perfiles_compensacion')
      .select('id, esquema_rotacion_default')
      .eq('id', data.perfil_compensacion_id)
      .eq('activo', true)
      .maybeSingle();

    if (perfilError || !perfil) {
      return { ok: false, message: 'El perfil de compensación seleccionado no es válido.' };
    }

    const esquemaRotacion = perfil.esquema_rotacion_default;
    const verticalAsignada = data.area_detalle.startsWith('Vertical') ? data.area_detalle : null;
    const grupoTurno = data.area_detalle === 'Molinos- Grupo (mixto)' ? data.area_detalle : null;
    const rotacionInicio =
      tieneEsquemaConRotacion(esquemaRotacion) && data.rotacion_inicio_fecha
        ? data.rotacion_inicio_fecha
        : tieneEsquemaConRotacion(esquemaRotacion)
          ? data.fecha_ingreso
          : null;

    const { data: existingByCedula } = await supabase
      .from('personal')
      .select(
        'id, estado_laboral, observacion_estado, despido_fecha, despido_causa, reenganche_fecha, reenganche_cargo, reenganche_observacion',
      )
      .eq('cedula', data.cedula)
      .maybeSingle();

    const hasId = 'id' in parsed.data && parsed.data.id !== undefined;
    const targetId = hasId ? (parsed.data as any).id : existingByCedula?.id;
    const estadoActual = (existingByCedula?.estado_laboral || 'ACTIVO') as string;

    const payload: Record<string, unknown> = {
      cedula: data.cedula,
      nombre_completo: data.nombre_completo,
      cargo: data.cargo,
      area: data.area,
      area_detalle: data.area_detalle,
      vertical_asignada: verticalAsignada,
      grupo_turno: grupoTurno,
      perfil_compensacion_id: data.perfil_compensacion_id,
      salario_base: data.salario_base,
      salario_libre: 0,
      bono_transporte: data.bono_transporte,
      telefono: data.telefono,
      notas: data.notas,
      fecha_ingreso: data.fecha_ingreso,
      esquema_rotacion: esquemaRotacion,
      rotacion_inicio_fecha: rotacionInicio,
    };

    if (estadoActual === 'DESPEDIDO') {
      payload.estado_laboral = 'REENGANCHADO';
      payload.reenganche_fecha = new Date().toISOString().split('T')[0];
      payload.reenganche_cargo = data.cargo;
      payload.reenganche_observacion = 'Reincorporado desde módulo de nómina.';
      payload.despido_fecha = null;
      payload.despido_causa = null;
      payload.activo = true;
      payload.estatus = 'ACTIVO';
    } else if (estadoActual === 'INACTIVO' || estadoActual === 'VACACIONES') {
      payload.estado_laboral = 'ACTIVO';
      if (String(existingByCedula?.observacion_estado || '').startsWith(AUTO_ROTACION_OBS)) {
        payload.observacion_estado = null;
      }
      payload.activo = true;
      payload.estatus = 'ACTIVO';
    } else if (estadoActual === 'ACTIVO' || estadoActual === 'REENGANCHADO') {
      payload.activo = true;
      payload.estatus = 'ACTIVO';
    }

    let error;
    if (targetId) {
      ({ error } = await supabase.from('personal').update(payload).eq('id', targetId));
    } else {
      ({ error } = await supabase.from('personal').insert({
        ...payload,
        estado_laboral: 'ACTIVO',
        activo: true,
        estatus: 'ACTIVO',
      }));
    }

    if (error) return { ok: false, message: error.message };
    revalidateAll();
    return { ok: true, message: hasId ? 'Trabajador actualizado.' : 'Trabajador registrado.' };
  } catch (e) {
    return { ok: false, message: 'Error interno del servidor.' };
  }
}

/** Asigna un trabajador existente de la base maestra a la nómina del área indicada. */
export async function assignPersonalToNominaAreaAction(input: {
  personalId: string;
  targetArea: string;
  areaDetalle?: string;
}): Promise<ActionResult> {
  const parsed = AssignToNominaAreaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: Object.values(parsed.error.flatten().fieldErrors).flat()[0] ?? 'Datos inválidos' };
  const data = parsed.data;
  try {
    const supabase = await createServerClient();
    const { data: row, error: fetchError } = await supabase
      .from('personal')
      .select('*')
      .eq('id', data.personalId)
      .maybeSingle();

    if (fetchError) return { ok: false, message: fetchError.message };
    if (!row) return { ok: false, message: 'Trabajador no encontrado en la base.' };

    const biblioteca = await loadBibliotecaAppSnapshot();
    const rawDetalle = (data.areaDetalle || String(row.area_detalle || '')).trim();
    // Server-side validation removed to avoid cache mismatch with client. 
    // Client UI already restricts options.

    const areaDetalle = rawDetalle;
    const estadoActual = String(row.estado_laboral || 'ACTIVO');

    const payload: Record<string, unknown> = {
      area: data.targetArea,
      area_detalle: areaDetalle,
      activo: true,
      estatus: 'ACTIVO',
    };

    if (estadoActual === 'DESPEDIDO') {
      payload.estado_laboral = 'REENGANCHADO';
      payload.reenganche_fecha = new Date().toISOString().split('T')[0];
      payload.reenganche_cargo = row.cargo;
      payload.reenganche_observacion = 'Reasignado desde nómina.';
      payload.despido_fecha = null;
      payload.despido_causa = null;
    } else if (
      estadoActual === 'VACACIONES' &&
      String(row.observacion_estado || '').startsWith(AUTO_ROTACION_OBS)
    ) {
      payload.estado_laboral = 'ACTIVO';
      payload.observacion_estado = null;
    } else if (estadoActual === 'INACTIVO' || estadoActual === 'VACACIONES') {
      payload.estado_laboral = 'ACTIVO';
      if (String(row.observacion_estado || '').startsWith(AUTO_ROTACION_OBS)) {
        payload.observacion_estado = null;
      }
    } else if (estadoActual === 'ACTIVO' || estadoActual === 'REENGANCHADO') {
      payload.estado_laboral = estadoActual;
    }

    // El esquema de rotación lo dicta el PERFIL DE COMPENSACIÓN del trabajador
    // (un administrativo fijo semanal nunca debe volverse rotativo por asignarlo
    // a la nómina de un área con default rotativo). Sin perfil, solo se aplica
    // el default del área cuando el trabajador no tiene esquema propio.
    const esquemaActual = String(row.esquema_rotacion || '');
    let esquemaPerfil: string | null = null;
    if (row.perfil_compensacion_id) {
      const { data: perfilRow } = await supabase
        .from('perfiles_compensacion')
        .select('esquema_rotacion_default')
        .eq('id', row.perfil_compensacion_id)
        .maybeSingle();
      esquemaPerfil = perfilRow?.esquema_rotacion_default ?? null;
    }

    if (esquemaPerfil && esquemaPerfil !== esquemaActual) {
      payload.esquema_rotacion = esquemaPerfil;
    } else if (!esquemaPerfil && !esquemaActual) {
      payload.esquema_rotacion =
        biblioteca.esquemaDefaultPorArea[data.targetArea] || ('FIJO_SEMANAL' as const);
    }
    const esquemaFinal = String(payload.esquema_rotacion || esquemaActual);
    if (tieneEsquemaConRotacion(esquemaFinal) && !row.rotacion_inicio_fecha) {
      payload.rotacion_inicio_fecha = new Date().toISOString().split('T')[0];
    }
    if (!tieneEsquemaConRotacion(esquemaFinal) && row.rotacion_inicio_fecha) {
      // Limpia restos de una conversión rotativa anterior para que la
      // proyección no vuelva a predecir semanas libres.
      payload.rotacion_inicio_fecha = null;
    }

    const { error } = await supabase.from('personal').update(payload).eq('id', data.personalId);
    if (error) return { ok: false, message: error.message };

    revalidateAll();
    return { ok: true, message: `${row.nombre_completo} asignado a esta nómina.` };
  } catch {
    return { ok: false, message: 'Error interno del servidor.' };
  }
}

/** Crea un trabajador nuevo y lo asigna directamente a la nómina del área. */
export async function createAndAssignPersonalNominaAction(
  input: CreateAndAssignPersonalNominaInput,
): Promise<ActionResult & { personalId?: string }> {
  const parsed = CreateAndAssignPersonalNominaSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message:
        Object.values(parsed.error.flatten().fieldErrors).flat()[0] ?? 'Datos inválidos',
    };
  }
  const data = parsed.data;
  const areaDetalle = data.areaDetalle.trim();
  try {
    const supabase = await createServerClient();
    const hoy = new Date().toISOString().split('T')[0];
    const biblioteca = await loadBibliotecaAppSnapshot();

    // Server-side validation removed to avoid cache mismatch with client.
    // Client UI already restricts options.

    // El esquema lo dicta el perfil de compensación elegido (igual que en la
    // ficha de Base de Trabajadores); el default del área es solo fallback.
    const { data: perfilRow } = await supabase
      .from('perfiles_compensacion')
      .select('esquema_rotacion_default')
      .eq('id', data.perfil_compensacion_id)
      .eq('activo', true)
      .maybeSingle();
    const esquemaDefault =
      perfilRow?.esquema_rotacion_default ||
      biblioteca.esquemaDefaultPorArea[data.targetArea] ||
      ('FIJO_SEMANAL' as const);

    const payload: Record<string, unknown> = {
      cedula: data.cedula.trim(),
      nombre_completo: data.nombre_completo.trim(),
      cargo: data.cargo.trim() || 'General',
      area: data.targetArea,
      area_detalle: areaDetalle,
      perfil_compensacion_id: data.perfil_compensacion_id,
      salario_base: data.salario_base,
      salario_libre: 0,
      bono_transporte: data.bono_transporte ?? 0,
      esquema_rotacion: esquemaDefault,
      estado_laboral: 'ACTIVO',
      activo: true,
      estatus: 'ACTIVO',
      fecha_ingreso: hoy,
    };
    if (tieneEsquemaConRotacion(esquemaDefault)) {
      payload.rotacion_inicio_fecha = hoy;
    }

    const { data: inserted, error } = await supabase
      .from('personal')
      .insert(payload)
      .select('id')
      .single();

    if (error) return { ok: false, message: error.message };

    revalidateAll();
    return {
      ok: true,
      message: `${data.nombre_completo.trim()} registrado y asignado a esta nómina.`,
      personalId: inserted.id,
      data: { personalId: inserted.id },
    };
  } catch {
    return { ok: false, message: 'Error interno del servidor.' };
  }
}

// ── VALES / ADELANTOS ────────────────────────────────────────

// Obtener vales pendientes de un trabajador
export async function getValesPendientesAction(personalId: string): Promise<{
  ok: boolean;
  data?: NominaVale[];
  message?: string;
}> {
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from('nomina_vales')
      .select('*')
      .eq('personal_id', personalId)
      .eq('estado', 'PENDIENTE')
      .order('fecha', { ascending: false });

    if (error) return { ok: false, message: error.message };
    return { ok: true, data: (data ?? []) as NominaVale[] };
  } catch {
    return { ok: false, message: 'Error interno.' };
  }
}

// Obtener vales pendientes de múltiples trabajadores (bulk)
export async function getValesPendientesBulkAction(personalIds: string[]): Promise<{
  ok: boolean;
  data?: NominaVale[];
  message?: string;
}> {
  if (personalIds.length === 0) return { ok: true, data: [] };
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from('nomina_vales')
      .select('*')
      .in('personal_id', personalIds)
      .eq('estado', 'PENDIENTE')
      .order('fecha', { ascending: false });

    if (error) return { ok: false, message: error.message };
    return { ok: true, data: (data ?? []) as NominaVale[] };
  } catch {
    return { ok: false, message: 'Error interno.' };
  }
}

// Crear un nuevo vale/adelanto
export async function crearValeAction(
  personalId: string,
  monto: number,
  motivo: string,
  fecha?: string
): Promise<ActionResult> {
  const parsed = CrearValeSchema.safeParse({ personalId, monto, motivo, fecha });
  if (!parsed.success) return { ok: false, message: Object.values(parsed.error.flatten().fieldErrors).flat()[0] ?? 'Datos inválidos' };
  const data = parsed.data;
  try {
    const supabase = await createServerClient();
    const { error } = await supabase.from('nomina_vales').insert({
      personal_id: data.personalId,
      monto: data.monto,
      motivo: data.motivo,
      fecha: data.fecha || new Date().toISOString().split('T')[0],
      estado: 'PENDIENTE',
    });
    if (error) return { ok: false, message: error.message };
    revalidateAll();
    return { ok: true, message: 'Vale registrado correctamente.' };
  } catch {
    return { ok: false, message: 'Error interno.' };
  }
}

// Eliminar un vale pendiente
export async function eliminarValeAction(valeId: string): Promise<ActionResult> {
  const parsed = z.string().uuid('ID inválido').safeParse(valeId);
  if (!parsed.success) return { ok: false, message: Object.values(parsed.error.flatten().fieldErrors).flat()[0] ?? 'Datos inválidos' };
  const id = parsed.data;
  try {
    const supabase = await createServerClient();
    const { error } = await supabase.from('nomina_vales').delete().eq('id', id);
    if (error) return { ok: false, message: error.message };
    revalidateAll();
    return { ok: true, message: 'Vale eliminado.' };
  } catch {
    return { ok: false, message: 'Error interno.' };
  }
}

/** Mapea errores de negocio de la RPC `cerrar_nomina_semana` a mensajes UX. */
function mapCierreRpcError(message: string): string {
  if (message.includes('CIERRE_NOMINA:NO_AUTENTICADO')) {
    return 'Sesión no válida. Inicia sesión de nuevo para cerrar la nómina.';
  }
  if (message.includes('CIERRE_NOMINA:SEMANA_EN_CICLO_CERRADO')) {
    return 'Esta semana pertenece a un ciclo ya CERRADO y consolidado. Revierte el ciclo antes de re-cerrarla.';
  }
  if (message.includes('CIERRE_NOMINA:VALES_DESINCRONIZADOS')) {
    return 'Los vales deducidos no coinciden con los vales pendientes en la base. Recarga la pre-nómina e intenta de nuevo.';
  }
  if (message.includes('CIERRE_NOMINA:TOTAL_INCONSISTENTE')) {
    return 'El total de la semana no coincide con la suma de los registros. Recarga la pre-nómina e intenta de nuevo.';
  }
  if (message.includes('CIERRE_NOMINA:PAYLOAD_INVALIDO')) {
    return 'Datos de cierre incompletos. Recarga la pre-nómina e intenta de nuevo.';
  }
  return `Error cierre: ${message}`;
}

async function procesarCierreHistoricoManualV3(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  userId: string,
  data: CierreNominaV3Parsed,
  periodoManual: ManualPeriodoCierreRef,
): Promise<ActionResult> {
  const { area, inicio, fin, rows, distribucion } = data;
  const origenRegistro = 'ajuste_manual';
  const totalNomina = rows.reduce((s, r) => s + r.total, 0);

  const periodoRes = await ensureManualVistaPeriodoId(supabase, {
    periodo: periodoManual,
    area,
    userId,
  });
  if ('error' in periodoRes) {
    return { ok: false, message: `Error periodo: ${periodoRes.error}` };
  }
  const periodoId = periodoRes.periodoId;

  const semanaRes = await findOrCreateNominaSemanaForCierre(supabase, {
    semanaInicio: inicio,
    semanaFin: fin,
    area,
    totalTrabajadores: rows.length,
    totalPagado: totalNomina,
    registradoPor: userId,
    origen: origenRegistro,
    periodoId,
  });
  if ('error' in semanaRes) {
    return { ok: false, message: `Error semana: ${semanaRes.error}` };
  }
  const semanaId = semanaRes.semanaId;
  await linkSemanaToPeriodo(supabase, periodoId, semanaId);
  await supabase.from('nomina_registros').delete().eq('semana_id', semanaId);

  const personalIds = rows.map((r) => r.personalId);
  const { data: personalRows, error: personalError } = await supabase
    .from('personal')
    .select(
      'id, cedula, nombre_completo, cargo, area, area_detalle, salario_base, salario_libre, bono_transporte, esquema_rotacion, rotacion_inicio_fecha',
    )
    .in('id', personalIds);
  if (personalError) {
    return { ok: false, message: `Error al cargar trabajadores: ${personalError.message}` };
  }
  const personalById = new Map((personalRows ?? []).map((p) => [p.id, p as Personal]));

  const registros = rows.map((r) => {
    const personal = personalById.get(r.personalId);
    if (!personal) {
      throw new Error(`Trabajador ${r.personalId} no encontrado`);
    }
    const esSemanaLibre = r.esSemanaLibre ?? r.estadoAsistencia === 'libre';
    const pagoUnicoNovedad = reposoPagoUnicoMontoFromRow({
      novedadTurno: r.novedadTurno as NominaNovedadTurno,
      reposoCondicion: r.reposoCondicion as ReposoModoSueldoSemana | null,
      reposoCompensacionMonto: r.reposoCompensacionMonto,
    });
    const bonificacionesRegistro = (Number(r.bonificaciones) || 0) + pagoUnicoNovedad;
    return {
      semana_id: semanaId,
      personal_id: r.personalId,
      monto_pagado: r.total,
      es_semana_libre: esSemanaLibre,
      bono_transporte_pagado: r.bonoTransporte,
      estado_asistencia: r.estadoAsistencia,
      dias_trabajados: r.diasTrabajados,
      salario_base_calculado: r.salarioBaseCalculado ?? null,
      novedad_turno: r.novedadTurno ?? 'ACTIVO',
      novedad_turno_obs: formatNovedadTurnoObsForSave(
        (r.novedadTurno ?? 'ACTIVO') as NominaNovedadTurno,
        r.novedadTurnoObs ?? '',
        r.reposoCondicion as ReposoModoSueldoSemana | null,
        {
          reposoDiasPagados: r.reposoDiasPagados,
          reposoCompensacionMonto: r.reposoCompensacionMonto,
        },
      ).trim(),
      bonificaciones: bonificacionesRegistro,
      total_vales: Number(r.totalVales) || 0,
      personal_snapshot: buildPersonalSnapshot(personal),
      origen: origenRegistro,
      periodo_id: periodoId,
    };
  });
  const { error: regError } = await supabase.from('nomina_registros').insert(registros);
  if (regError) return { ok: false, message: `Error registros: ${regError.message}` };

  const cierrePayload = distribucionToCierrePayload(totalNomina, distribucion);
  const cierreRes = await upsertNominaCierreForSemana(supabase, semanaId, {
    total_nomina_usd: totalNomina,
    pct_pedro: cierrePayload.pct_pedro,
    pct_darinel: cierrePayload.pct_darinel,
    pct_la_fe: cierrePayload.pct_la_fe,
    monto_pedro: cierrePayload.monto_pedro,
    monto_darinel: cierrePayload.monto_darinel,
    monto_la_fe: cierrePayload.monto_la_fe,
    distribucion: cierrePayload.distribucion,
  });
  if (cierreRes.error) return { ok: false, message: `Error cierre: ${cierreRes.error}` };

  await refreshPeriodoTotalUsd(supabase, periodoId);
  await registrarAuditAction(
    'CIERRE_NOMINA_MANUAL_HISTORICO',
    'nomina_semanas',
    semanaId,
    `Cierre manual histórico ${area.toUpperCase()} ${inicio}–${fin}. Total: $${totalNomina.toFixed(2)}`,
    userId,
  );

  revalidateAll();
  return {
    ok: true,
    message: `Semana histórica cerrada manualmente — $${totalNomina.toFixed(2)} (${rows.length} trabajadores).`,
    data: { semanaId, periodoId, totalNomina, distribucion: cierrePayload.lineas },
  };
}

/** Crea o reutiliza nomina_periodos para un ciclo manual (aisla cierres por ciclo). */
export async function ensureManualPeriodoVistaAction(input: {
  area: string;
  label: string;
  rangeStart: string;
  rangeEnd: string;
  plantillaId?: string;
}): Promise<ActionResult> {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return { ok: false, message: 'Debe iniciar sesión.' };
    }

    const periodoRes = await ensureManualVistaPeriodoId(supabase, {
      periodo: {
        label: input.label.trim(),
        rangeStart: input.rangeStart,
        rangeEnd: input.rangeEnd,
        plantillaId: input.plantillaId,
      },
      area: input.area,
      userId: user.id,
    });
    if ('error' in periodoRes) {
      return { ok: false, message: periodoRes.error };
    }
    return { ok: true, message: 'Periodo listo.', data: { periodoId: periodoRes.periodoId } };
  } catch (err) {
    console.error('[ensureManualPeriodoVistaAction]', err);
    return { ok: false, message: 'No se pudo preparar el periodo manual.' };
  }
}

// ── CIERRE DE NÓMINA V3 (con vales y ajustes de socios) ──────
// Blindado (Fase 1): Zod estricto + identidad real (auth.getUser) +
// recálculo server-side de montos + transacción atómica vía RPC.
export async function procesarCierreNominaV3Action(
  payload: CierreNominaV3Input,
): Promise<ActionResult> {
  // 1. Validación estricta de forma e invariantes (sin userId del cliente)
  const parsed = CierreNominaV3Schema.safeParse(payload);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, message: issue?.message ?? 'Datos de cierre inválidos.' };
  }
  const { area, inicio, fin, rows, distribucion, modoCierre, periodoManual } = parsed.data;
  const esHistoricoManual = modoCierre === 'historico_manual';

  const distCheck = validateDistribucion(distribucion);
  if (!distCheck.ok) {
    return { ok: false, message: distCheck.message ?? 'Distribución inválida.' };
  }

  try {
    const supabase = await createServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return { ok: false, message: 'Sesión no válida. Inicia sesión de nuevo para cerrar la nómina.' };
    }
    const userId = user.id;

    if (esHistoricoManual) {
      if (!periodoManual) {
        return {
          ok: false,
          message: 'Falta el periodo manual para cerrar esta semana histórica.',
        };
      }
      return procesarCierreHistoricoManualV3(supabase, userId, parsed.data, periodoManual);
    }

    const rotacionRows = rows.map((r) => ({
      personalId: r.personalId,
      total: r.total,
      bonoTransporte: r.bonoTransporte,
      diasTrabajados: r.diasTrabajados,
    }));
    const valRot = await validarCierreRotacionSemanalAction({
      area,
      semanaInicio: inicio,
      semanaFin: fin,
      rows: rotacionRows,
    });
    if (!valRot.ok) return { ok: false, message: valRot.message };

    // 3. Datos maestros desde BD (no se confía en el `personal` del cliente)
    const personalIds = rows.map((r) => r.personalId);
    const { data: personalRows, error: personalError } = await supabase
      .from('personal')
      .select(
        'id, cedula, nombre_completo, cargo, area, area_detalle, salario_base, salario_libre, bono_transporte, esquema_rotacion, rotacion_inicio_fecha',
      )
      .in('id', personalIds);

    if (personalError) {
      return { ok: false, message: `Error al cargar trabajadores: ${personalError.message}` };
    }

    // 4. Checksum financiero: recálculo con reglas de ciclo (perfil-ciclo-reglas)
    const checksum = verificarTotalesCierre(
      rows,
      (personalRows ?? []) as PersonalCierre[],
      inicio,
    );
    if (!checksum.ok) {
      return { ok: false, message: checksum.message };
    }

    const totalNomina = checksum.totalNomina;
    const cierrePayload = distribucionToCierrePayload(totalNomina, distribucion);

    // 5. Cierre atómico delegado a Postgres (advisory lock + transacción)
    const rpcPayload = {
      area,
      inicio,
      fin,
      total_pagado: totalNomina,
      registros: checksum.registros.map((r) => ({
        personal_id: r.personal.id,
        monto_pagado: r.montoPagado,
        es_semana_libre: r.esSemanaLibre,
        bono_transporte_pagado: r.input.bonoTransporte,
        estado_asistencia: r.input.estadoAsistencia,
        dias_trabajados: r.input.diasTrabajados,
        salario_base_calculado: r.salarioBaseCalculado,
        novedad_turno: r.input.novedadTurno ?? 'ACTIVO',
        novedad_turno_obs: (r.input.novedadTurnoObs ?? '').trim(),
        bonificaciones: r.input.bonificaciones,
        total_vales: r.input.totalVales,
        personal_snapshot: buildPersonalSnapshot(r.personal as Personal),
      })),
      cierre: {
        pct_pedro: cierrePayload.pct_pedro,
        pct_darinel: cierrePayload.pct_darinel,
        pct_la_fe: cierrePayload.pct_la_fe,
        monto_pedro: cierrePayload.monto_pedro,
        monto_darinel: cierrePayload.monto_darinel,
        monto_la_fe: cierrePayload.monto_la_fe,
        distribucion: cierrePayload.distribucion,
      },
      gasto: {
        descripcion: `Nómina ${area.toUpperCase()} ${inicio} al ${fin} — ${rows.length} trabajadores`,
        notas: `Cierre V3: ${cierrePayload.lineas.map((l) => `${l.nombre} ${l.porcentaje}% ($${l.neto})`).join(' · ')}`,
      },
    };

    const { data: rpcData, error: rpcError } = await supabase.rpc('cerrar_nomina_semana', {
      p_payload: rpcPayload,
    });

    if (rpcError) {
      return { ok: false, message: mapCierreRpcError(rpcError.message) };
    }

    const semanaId = String((rpcData as { semana_id?: string } | null)?.semana_id ?? '');
    if (!semanaId) {
      return { ok: false, message: 'El cierre no devolvió la semana procesada.' };
    }

    // 6. Auditar ajustes manuales aceptados por el checksum (si los hubo)
    for (const ajuste of checksum.ajustes) {
      await registrarAuditAction(
        'AJUSTE_MANUAL_CIERRE',
        'nomina_registros',
        ajuste.personalId,
        `Ajuste manual en cierre ${area.toUpperCase()} ${inicio}: ${ajuste.nombre} — calculado $${ajuste.totalRecalculado.toFixed(2)}, pagado $${ajuste.totalCliente.toFixed(2)}. Motivo: ${ajuste.motivo}`,
        userId,
      );
    }

    const rotacionRes = await procesarCierreRotacionNominaAction({
      area,
      semanaId,
      semanaInicio: inicio,
      semanaFin: fin,
      rows: rotacionRows,
      userId,
    });
    if (!rotacionRes.ok) return { ok: false, message: rotacionRes.message };

    // ── FASE 4: Automatización de Ciclos ─────────────────────────────────
    // Vincular semana a ciclos automáticamente (crea o vincula a ciclo existente)
    const vinculoResult = await vincularSemanaACicloAction({
      semanaId,
      semanaInicio: inicio,
      area,
      personalIds,
      userId,
    });

    if (vinculoResult.ok && vinculoResult.data) {
      const { ciclosCreados, ciclosVinculados } = vinculoResult.data;
      if (ciclosCreados > 0 || ciclosVinculados > 0) {
        await registrarAuditAction(
          'CICLO_AUTOMATIZADO',
          'nomina_ciclos',
          semanaId,
          `Ciclos procesados: ${ciclosCreados} creados, ${ciclosVinculados} vinculados`,
          userId
        );
      }
    }

    // Intentar cerrar ciclo si es la última semana
    const cierreCicloResult = await cerrarCicloAutomaticoAction({
      semanaId,
      userId,
    });

    if (cierreCicloResult.ok && cierreCicloResult.data) {
      const { cicloId, totalCiclo } = cierreCicloResult.data;
      await registrarAuditAction(
        'CICLO_CERRADO',
        'nomina_ciclos',
        cicloId,
        `Ciclo cerrado automáticamente. Total consolidado: $${totalCiclo.toFixed(2)}`,
        userId
      );
    }
    // ── FIN FASE 4 ───────────────────────────────────────────────────────

    revalidateAll();
    return {
      ok: true,
      message: `Nómina cerrada — $${totalNomina.toFixed(2)} para ${rows.length} trabajadores. Vales liquidados.`,
      data: { semanaId, totalNomina, distribucion: cierrePayload.lineas },
    };
  } catch (err) {
    console.error('[Action] procesarCierreNominaV3:', err);
    return { ok: false, message: 'Error interno del servidor.' };
  }
}

// ── Cierre de semana (reparto de socios / beneficiarios) ─────
export async function getSemanaCierreAction(semanaId: string): Promise<{
  ok: boolean;
  data?: {
    total_nomina_usd: number;
    pct_pedro: number;
    pct_darinel: number;
    pct_la_fe: number;
    monto_pedro: number;
    monto_darinel: number;
    monto_la_fe: number;
    distribucion?: DistribucionParte[] | null;
  };
  message?: string;
}> {
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from('nomina_cierres')
      .select(
        'total_nomina_usd, pct_pedro, pct_darinel, pct_la_fe, monto_pedro, monto_darinel, monto_la_fe, distribucion',
      )
      .eq('semana_id', semanaId)
      .maybeSingle();

    if (error) return { ok: false, message: error.message };
    if (!data) return { ok: true, data: undefined };
    return { ok: true, data: data as NonNullable<typeof data> };
  } catch {
    return { ok: false, message: 'Error al cargar cierre.' };
  }
}

// ── HISTORIAL DE PAGOS POR TRABAJADOR ────────────────────────
export async function getHistorialPagosAction(personalId: string, limit = 10): Promise<{
  ok: boolean;
  data?: HistorialPagoRow[];
  message?: string;
}> {
  try {
    const supabase = await createServerClient();
    // Direct query (works without RPC)
    const { data: rawData, error } = await supabase
      .from('nomina_registros')
      .select(`
        semana_id,
        monto_pagado,
        es_semana_libre,
        bono_transporte_pagado,
        created_at,
        nomina_semanas!inner (id, semana_inicio, semana_fin, area)
      `)
      .eq('personal_id', personalId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) return { ok: false, message: error.message };
    const rows: HistorialPagoRow[] = (rawData ?? []).map((r: any) => ({
      semana_id: r.semana_id,
      semana_inicio: r.nomina_semanas?.semana_inicio || '',
      semana_fin: r.nomina_semanas?.semana_fin || '',
      area: r.nomina_semanas?.area || '',
      monto_pagado: r.monto_pagado,
      es_semana_libre: r.es_semana_libre,
      bono_transporte_pagado: r.bono_transporte_pagado,
      created_at: r.created_at,
    }));
    return { ok: true, data: rows };
  } catch {
    return { ok: false, message: 'Error interno.' };
  }
}

// ── TENDENCIA SEMANAL (para sparklines) ──────────────────────
export async function getTendenciaSemanalAction(area: string, limit = 8): Promise<{
  ok: boolean;
  data?: TendenciaSemanalRow[];
  message?: string;
}> {
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from('nomina_semanas')
      .select('semana_inicio, total_pagado, total_trabajadores')
      .eq('area', area)
      .order('semana_inicio', { ascending: false })
      .limit(limit);

    if (error) return { ok: false, message: error.message };
    return { ok: true, data: (data ?? []) as TendenciaSemanalRow[] };
  } catch {
    return { ok: false, message: 'Error interno.' };
  }
}

// ── AUDIT LOG ────────────────────────────────────────────────
export async function registrarAuditAction(
  accion: string,
  entidad: string,
  entidadId: string,
  detalle: string,
  userId?: string,
  userName?: string
): Promise<void> {
  try {
    const supabase = await createServerClient();
    await supabase.from('nomina_audit_log').insert({
      accion,
      entidad,
      entidad_id: entidadId,
      detalle,
      usuario_id: userId || null,
      usuario_nombre: userName || null,
    });
  } catch {
    // Silent — audit logging should never break the app
    console.error('[Audit] Failed to log:', accion, entidad);
  }
}

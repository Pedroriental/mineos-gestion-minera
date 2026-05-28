'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase-server';
import { normalizeAreaDetalle, PERSONAL_SYNC_PATHS } from '@/lib/personal-master';
import { loadBibliotecaAppSnapshot } from '@/lib/biblioteca-catalog';
import { AUTO_ROTACION_OBS, tieneEsquemaConRotacion } from '@/lib/rotacion-personal';
import {
  distribucionToCierrePayload,
  validateDistribucion,
  type DistribucionParte,
} from '@/lib/nomina-distribucion';
import type { NominaVale, PreNominaRow, HistorialPagoRow, TendenciaSemanalRow } from '@/lib/types';

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
  salario_base: number;
  salario_libre: number;
  bono_transporte: number;
  telefono: string;
  notas: string;
  fecha_ingreso: string;
  esquema_rotacion: string;
  rotacion_inicio_fecha: string;
}): Promise<ActionResult> {
  try {
    const supabase = await createServerClient();
    const areaDetalle = normalizeAreaDetalle(raw.area_detalle || '', raw.area);

    const { data: existingByCedula } = await supabase
      .from('personal')
      .select(
        'id, estado_laboral, observacion_estado, despido_fecha, despido_causa, reenganche_fecha, reenganche_cargo, reenganche_observacion',
      )
      .eq('cedula', raw.cedula)
      .maybeSingle();

    const targetId = raw.id || existingByCedula?.id;
    const estadoActual = (existingByCedula?.estado_laboral || 'ACTIVO') as string;

    const payload: Record<string, unknown> = {
      cedula: raw.cedula,
      nombre_completo: raw.nombre_completo,
      cargo: raw.cargo,
      area: raw.area,
      area_detalle: areaDetalle,
      salario_base: raw.salario_base,
      salario_libre: raw.salario_libre,
      bono_transporte: raw.bono_transporte,
      telefono: raw.telefono,
      notas: raw.notas,
      fecha_ingreso: raw.fecha_ingreso,
      esquema_rotacion: raw.esquema_rotacion || 'FIJO_SEMANAL',
      rotacion_inicio_fecha: raw.rotacion_inicio_fecha || null,
    };

    if (estadoActual === 'DESPEDIDO') {
      payload.estado_laboral = 'REENGANCHADO';
      payload.reenganche_fecha = new Date().toISOString().split('T')[0];
      payload.reenganche_cargo = raw.cargo;
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
    return { ok: true, message: raw.id ? 'Trabajador actualizado.' : 'Trabajador registrado.' };
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
  try {
    const supabase = await createServerClient();
    const { data: row, error: fetchError } = await supabase
      .from('personal')
      .select('*')
      .eq('id', input.personalId)
      .maybeSingle();

    if (fetchError) return { ok: false, message: fetchError.message };
    if (!row) return { ok: false, message: 'Trabajador no encontrado en la base.' };

    const areaDetalle = normalizeAreaDetalle(
      input.areaDetalle || String(row.area_detalle || ''),
      input.targetArea,
    );
    const estadoActual = String(row.estado_laboral || 'ACTIVO');

    const payload: Record<string, unknown> = {
      area: input.targetArea,
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

    const biblioteca = await loadBibliotecaAppSnapshot();
    const esquemaActual = String(row.esquema_rotacion || '');
    const esquemaDefault =
      biblioteca.esquemaDefaultPorArea[input.targetArea] || ('FIJO_SEMANAL' as const);
    if (!esquemaActual || esquemaActual === 'FIJO_SEMANAL') {
      payload.esquema_rotacion = esquemaDefault;
    }
    const esquemaFinal = String(payload.esquema_rotacion || esquemaActual);
    if (tieneEsquemaConRotacion(esquemaFinal) && !row.rotacion_inicio_fecha) {
      payload.rotacion_inicio_fecha = new Date().toISOString().split('T')[0];
    }

    const { error } = await supabase.from('personal').update(payload).eq('id', input.personalId);
    if (error) return { ok: false, message: error.message };

    revalidateAll();
    return { ok: true, message: `${row.nombre_completo} asignado a esta nómina.` };
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
  try {
    const supabase = await createServerClient();
    const { error } = await supabase.from('nomina_vales').insert({
      personal_id: personalId,
      monto,
      motivo: motivo || 'Adelanto de caja',
      fecha: fecha || new Date().toISOString().split('T')[0],
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
  try {
    const supabase = await createServerClient();
    const { error } = await supabase.from('nomina_vales').delete().eq('id', valeId);
    if (error) return { ok: false, message: error.message };
    revalidateAll();
    return { ok: true, message: 'Vale eliminado.' };
  } catch {
    return { ok: false, message: 'Error interno.' };
  }
}

// ── CIERRE DE NÓMINA V3 (con vales y ajustes de socios) ──────
export async function procesarCierreNominaV3Action(payload: {
  userId: string;
  area: string;
  inicio: string;
  fin: string;
  rows: PreNominaRow[];
  distribucion: DistribucionParte[];
}): Promise<ActionResult> {
  const { userId, area, inicio, fin, rows, distribucion } = payload;

  const distCheck = validateDistribucion(distribucion);
  if (!distCheck.ok) {
    return { ok: false, message: distCheck.message ?? 'Distribución inválida.' };
  }

  try {
    const supabase = await createServerClient();
    const fechaHoy = new Date().toISOString().split('T')[0];
    const totalNomina = rows.reduce((s, r) => s + r.total, 0);

    // 1. Upsert nomina_semanas
    const { data: semanaRow, error: semanaError } = await supabase
      .from('nomina_semanas')
      .upsert({
        semana_inicio: inicio,
        semana_fin: fin,
        area,
        total_trabajadores: rows.length,
        total_pagado: totalNomina,
        registrado_por: userId || null,
      }, { onConflict: 'semana_inicio,area' })
      .select('id')
      .maybeSingle();

    if (semanaError) return { ok: false, message: `Error semana: ${semanaError.message}` };
    const semanaId = semanaRow?.id;
    if (!semanaId) return { ok: false, message: 'No se pudo obtener el ID de la semana.' };

    // 2. Eliminar registros anteriores
    await supabase.from('nomina_registros').delete().eq('semana_id', semanaId);

    // 3. Insertar registros individuales
    const registros = rows.map((r) => {
      const estado =
        r.estadoAsistencia ?? (r.esSemanaLibre ? 'libre' : 'trabajada');
      const dias =
        r.diasTrabajados ?? (estado === 'no_laborado' ? 0 : 7);
      return {
        semana_id: semanaId,
        personal_id: r.personal.id,
        monto_pagado: r.total,
        es_semana_libre: r.esSemanaLibre,
        bono_transporte_pagado: r.bonoTransporte,
        estado_asistencia: estado,
        dias_trabajados: dias,
        salario_base_calculado: r.salarioBaseCalculado ?? null,
        novedad_turno: r.novedadTurno ?? 'ACTIVO',
        novedad_turno_obs: (r.novedadTurnoObs ?? '').trim(),
      };
    });
    const { error: regError } = await supabase.from('nomina_registros').insert(registros);
    if (regError) return { ok: false, message: `Error registros: ${regError.message}` };

    const cierrePayload = distribucionToCierrePayload(totalNomina, distribucion);

    // 4. Upsert cierre (columnas legacy + JSON flexible)
    const { error: cierreError } = await supabase
      .from('nomina_cierres')
      .upsert({
        semana_id: semanaId,
        total_nomina_usd: totalNomina,
        pct_pedro: cierrePayload.pct_pedro,
        pct_darinel: cierrePayload.pct_darinel,
        pct_la_fe: cierrePayload.pct_la_fe,
        monto_pedro: cierrePayload.monto_pedro,
        monto_darinel: cierrePayload.monto_darinel,
        monto_la_fe: cierrePayload.monto_la_fe,
        distribucion: cierrePayload.distribucion,
      }, { onConflict: 'semana_id' });

    if (cierreError) return { ok: false, message: `Error cierre: ${cierreError.message}` };

    // 6. Marcar todos los vales pendientes como COBRADOS
    const personalIds = rows.map(r => r.personal.id);
    await supabase
      .from('nomina_vales')
      .update({ estado: 'COBRADO' })
      .in('personal_id', personalIds)
      .eq('estado', 'PENDIENTE');

    // 7. Registrar en gastos
    const { data: catRow } = await supabase
      .from('categorias_gasto')
      .select('id')
      .ilike('nombre', '%nomina%')
      .limit(1)
      .maybeSingle();

    if (catRow) {
      await supabase.from('gastos').insert({
        fecha: fechaHoy,
        categoria_id: catRow.id,
        descripcion: `Nómina ${area.toUpperCase()} ${inicio} al ${fin} — ${rows.length} trabajadores`,
        monto: totalNomina,
        proveedor: 'Nómina interna',
        notas: `Cierre V3: ${cierrePayload.lineas.map((l) => `${l.nombre} ${l.porcentaje}% ($${l.neto})`).join(' · ')}`,
        registrado_por: userId || null,
      });
    }

    // Registrar auditoría de cierre
    await registrarAuditAction(
      'CIERRE_NOMINA_V3',
      'nomina_semanas',
      semanaId,
      `Cierre Nómina V3 de ${area.toUpperCase()} del ${inicio} al ${fin}. Total: $${totalNomina.toFixed(2)} for ${rows.length} trabajadores.`,
      userId
    );

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

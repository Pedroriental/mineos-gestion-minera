'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase-server';
import { PERSONAL_SYNC_PATHS } from '@/lib/personal-master';
import {
  findOrCreateNominaSemanaForCierre,
} from '@/lib/nomina/cierre-semana-db';
import type { NominaRegistro, Personal, PreNominaRow } from '@/lib/types';
import { registrarAuditAction } from './nomina-v3';
import {
  CierreNominaV2Schema,
  PersonalEstatusUpdateSchema,
} from '@/lib/validations/nomina-v2';

export type ActionResult =
  | { ok: true; message: string; data?: unknown }
  | { ok: false; message: string };

function revalidateAll() {
  try {
    revalidatePath('/admin/trabajadores');
  } catch (err) {
    console.warn('[nomina-v2] revalidate path error:', err);
  }
}

// ── Actualizar estado de trabajador ─────────────────────────
export async function updatePersonalEstatusAction(
  id: string,
  estatus: 'ACTIVO' | 'LIQUIDADO' | 'INACTIVO'
): Promise<ActionResult> {
  const parsed = PersonalEstatusUpdateSchema.safeParse({ id, estatus });
  if (!parsed.success) {
    const msg = Object.values(parsed.error.flatten().fieldErrors).flat()[0] ?? 'Datos inválidos';
    return { ok: false, message: msg };
  }

  try {
    const supabase = await createServerClient();
    const { id: validId, estatus: validEstatus } = parsed.data;
    const activo = validEstatus === 'ACTIVO';
    const patch: Record<string, unknown> = { estatus: validEstatus, activo };
    if (validEstatus === 'ACTIVO') {
      patch.estado_laboral = 'ACTIVO';
      patch.despido_fecha = null;
      patch.despido_causa = null;
    } else if (validEstatus === 'LIQUIDADO') {
      patch.estado_laboral = 'DESPEDIDO';
      patch.despido_fecha = new Date().toISOString().split('T')[0];
    }

    const { error } = await supabase.from('personal').update(patch).eq('id', validId);

    if (error) return { ok: false, message: error.message };
    revalidateAll();
    return { ok: true, message: `Trabajador marcado como ${validEstatus}.` };
  } catch {
    return { ok: false, message: 'Error interno del servidor.' };
  }
}

// ── Crear/Actualizar trabajador con nuevos campos V2 ─────────
export async function upsertPersonalV2Action(raw: {
  id?: string;
  cedula: string;
  nombre_completo: string;
  cargo: string;
  area: string;
  area_detalle: string;
  salario_base: number;
  salario_libre: number;
  bono_transporte: number;
  fecha_ingreso: string;
}): Promise<ActionResult> {
  void raw;
  return {
    ok: false,
    message:
      'Flujo V2 deshabilitado. Usa Base de Trabajadores o asignación V3 para conservar perfil, rotación y auditoría.',
  };
}

// ── Procesar cierre de nómina con aportes de socios ─────────
export async function procesarCierreNominaV2Action(payload: {
  userId: string;
  area: string;
  inicio: string;
  fin: string;
  rows: PreNominaRow[];
  pctPedro: number;
  pctDarinel: number;
  pctLaFe: number;
}): Promise<ActionResult> {
  const parsed = CierreNominaV2Schema.safeParse(payload);
  if (!parsed.success) {
    const msg = Object.values(parsed.error.flatten().fieldErrors).flat()[0] ?? 'Datos inválidos';
    return { ok: false, message: msg };
  }

  const { userId, area, inicio, fin, rows, pctPedro, pctDarinel, pctLaFe } = parsed.data;

  if (Math.abs(pctPedro + pctDarinel + pctLaFe - 100) > 0.01) {
    return { ok: false, message: 'Los porcentajes deben sumar exactamente 100%.' };
  }

  try {
    const supabase = await createServerClient();
    const fechaHoy = new Date().toISOString().split('T')[0];

    const totalNomina = rows.reduce((s, r) => s + r.total, 0);

    const semanaRes = await findOrCreateNominaSemanaForCierre(supabase, {
      semanaInicio: inicio,
      semanaFin: fin,
      area,
      totalTrabajadores: rows.length,
      totalPagado: totalNomina,
      registradoPor: userId || null,
      origen: 'cierre_v3',
      periodoId: null,
    });
    if ('error' in semanaRes) return { ok: false, message: `Error semana: ${semanaRes.error}` };
    const semanaId = semanaRes.semanaId;

    await supabase.from('nomina_registros').delete().eq('semana_id', semanaId);

    const registros = rows.map((r) => ({
      semana_id: semanaId,
      personal_id: r.personal.id,
      monto_pagado: r.total,
      es_semana_libre: r.esSemanaLibre,
      bono_transporte_pagado: r.bonoTransporte,
    }));

    const { error: regError } = await supabase.from('nomina_registros').insert(registros);
    if (regError) return { ok: false, message: `Error registros: ${regError.message}` };

    const montoPedro = parseFloat(((pctPedro / 100) * totalNomina).toFixed(2));
    const montoDarinel = parseFloat(((pctDarinel / 100) * totalNomina).toFixed(2));
    const montoLaFe = parseFloat(((pctLaFe / 100) * totalNomina).toFixed(2));

    const { error: cierreError } = await supabase
      .from('nomina_cierres')
      .upsert({
        semana_id: semanaId,
        total_nomina_usd: totalNomina,
        pct_pedro: pctPedro,
        pct_darinel: pctDarinel,
        pct_la_fe: pctLaFe,
        monto_pedro: montoPedro,
        monto_darinel: montoDarinel,
        monto_la_fe: montoLaFe,
      }, { onConflict: 'semana_id' });

    if (cierreError) return { ok: false, message: `Error cierre: ${cierreError.message}` };

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
        notas: `Cierre: Pedro ${pctPedro}% / Darinel ${pctDarinel}% / La Fe ${pctLaFe}%`,
        registrado_por: userId || null,
      });
    }

    await registrarAuditAction(
      'CIERRE_NOMINA_V2',
      'nomina_semanas',
      semanaId,
      `Cierre Nómina V2 de ${area.toUpperCase()} del ${inicio} al ${fin}. Total: $${totalNomina.toFixed(2)} for ${rows.length} trabajadores.`,
      userId
    );

    revalidateAll();
    return {
      ok: true,
      message: `Nómina cerrada — $${totalNomina.toFixed(2)} para ${rows.length} trabajadores.`,
      data: { semanaId, totalNomina, montoPedro, montoDarinel, montoLaFe },
    };
  } catch (err) {
    console.error('[Action] procesarCierreNominaV2:', err);
    return { ok: false, message: 'Error interno del servidor.' };
  }
}

// ── Obtener registros detallados de una semana ───────────────
export async function getSemanaRegistrosAction(semanaId: string): Promise<{
  ok: boolean;
  data?: NominaRegistro[];
  message?: string;
}> {
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from('nomina_registros')
      .select('*, personal(*)')
      .eq('semana_id', semanaId)
      .order('created_at');

    if (error) return { ok: false, message: error.message };
    return { ok: true, data: (data ?? []) as NominaRegistro[] };
  } catch {
    return { ok: false, message: 'Error interno.' };
  }
}

export type GrupoMixtoHistoryWeekActionRow = {
  id: string;
  semana_inicio: string;
  registros: Array<{
    personal_id: string;
    monto_pagado: number;
    estado_asistencia: NominaRegistro['estado_asistencia'];
    personal?: Pick<Personal, 'id' | 'area_detalle' | 'area' | 'cargo'> | null;
  }>;
};

type GrupoMixtoRegistroDb = {
  semana_id: string;
  personal_id: string;
  monto_pagado: number | string | null;
  estado_asistencia: NominaRegistro['estado_asistencia'];
  personal:
    | Pick<Personal, 'id' | 'area_detalle' | 'area' | 'cargo'>
    | Array<Pick<Personal, 'id' | 'area_detalle' | 'area' | 'cargo'>>
    | null;
};

// Historial reducido para proyectar cuadrillas de Grupo Mixto sin disparar N Server Actions.
export async function getGrupoMixtoHistoryWeeksAction(
  area: string,
  beforeWeekStart: string,
  limit = 12,
): Promise<{
  ok: boolean;
  data?: GrupoMixtoHistoryWeekActionRow[];
  message?: string;
}> {
  try {
    const supabase = await createServerClient();
    const { data: semanas, error: semanasError } = await supabase
      .from('nomina_semanas')
      .select('id, semana_inicio')
      .eq('area', area)
      .lt('semana_inicio', beforeWeekStart)
      .order('semana_inicio', { ascending: false })
      .limit(limit);

    if (semanasError) return { ok: false, message: semanasError.message };
    if (!semanas?.length) return { ok: true, data: [] };

    const semanaIds = semanas.map((sem) => sem.id);
    const { data: registros, error: registrosError } = await supabase
      .from('nomina_registros')
      .select(
        'semana_id, personal_id, monto_pagado, estado_asistencia, personal(id, area_detalle, area, cargo)',
      )
      .in('semana_id', semanaIds)
      .order('created_at');

    if (registrosError) return { ok: false, message: registrosError.message };

    const registrosBySemana = new Map<string, GrupoMixtoHistoryWeekActionRow['registros']>();
    for (const reg of ((registros ?? []) as GrupoMixtoRegistroDb[])) {
      const semanaId = String(reg.semana_id);
      const bucket = registrosBySemana.get(semanaId) ?? [];
      bucket.push({
        personal_id: String(reg.personal_id),
        monto_pagado: Number(reg.monto_pagado) || 0,
        estado_asistencia: reg.estado_asistencia,
        personal: Array.isArray(reg.personal) ? (reg.personal[0] ?? null) : (reg.personal ?? null),
      });
      registrosBySemana.set(semanaId, bucket);
    }

    return {
      ok: true,
      data: semanas.map((sem) => ({
        id: sem.id,
        semana_inicio: sem.semana_inicio,
        registros: registrosBySemana.get(sem.id) ?? [],
      })),
    };
  } catch {
    return { ok: false, message: 'Error interno.' };
  }
}

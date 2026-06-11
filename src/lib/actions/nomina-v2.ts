'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase-server';
import { PERSONAL_SYNC_PATHS } from '@/lib/personal-master';
import {
  findOrCreateNominaSemanaForCierre,
} from '@/lib/nomina/cierre-semana-db';
import type { PreNominaRow } from '@/lib/types';
import { registrarAuditAction } from './nomina-v3';
import { z } from 'zod';
import {
  PersonalV2Schema,
  PersonalV2UpdateSchema,
  CierreNominaV2Schema,
  PersonalEstatusUpdateSchema,
} from '@/lib/validations/nomina-v2';

export type ActionResult =
  | { ok: true; message: string; data?: any }
  | { ok: false; message: string };

function revalidateAll() {
  PERSONAL_SYNC_PATHS.forEach((p) => revalidatePath(p));
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
  } catch (e) {
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
  const schema = raw.id ? PersonalV2UpdateSchema : PersonalV2Schema;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const msg = Object.values(parsed.error.flatten().fieldErrors).flat()[0] ?? 'Datos inválidos';
    return { ok: false, message: msg };
  }

  try {
    const supabase = await createServerClient();
    const payload: Record<string, unknown> = {
      ...parsed.data,
      activo: true,
      estatus: 'ACTIVO',
    };

    const parsedId = 'id' in parsed.data ? parsed.data.id : undefined;

    let error;
    if (parsedId) {
      delete payload.id;
      ({ error } = await supabase.from('personal').update(payload).eq('id', parsedId));
    } else {
      delete payload.id;
      ({ error } = await supabase.from('personal').insert(payload));
    }

    if (error) return { ok: false, message: error.message };
    revalidateAll();
    return {
      ok: true,
      message: 'id' in parsed.data ? 'Trabajador actualizado.' : 'Trabajador registrado.',
    };
  } catch (e) {
    return { ok: false, message: 'Error interno del servidor.' };
  }
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
  data?: any[];
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
    return { ok: true, data: data ?? [] };
  } catch (e) {
    return { ok: false, message: 'Error interno.' };
  }
}

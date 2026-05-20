'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase-server';
import type { PreNominaRow } from '@/lib/types';
import { registrarAuditAction } from './nomina-v3';

export type ActionResult =
  | { ok: true;  message: string; data?: any }
  | { ok: false; message: string };

const REVALIDATE_PATHS = [
  '/admin/nomina',
  '/mina/nomina',
  '/planta/nomina',
  '/operaciones/resumen',
  '/dashboard',
] as const;

function revalidateAll() {
  REVALIDATE_PATHS.forEach((p) => revalidatePath(p));
}

// ── Actualizar estado de trabajador ─────────────────────────
export async function updatePersonalEstatusAction(
  id: string,
  estatus: 'ACTIVO' | 'LIQUIDADO' | 'INACTIVO'
): Promise<ActionResult> {
  try {
    const supabase = await createServerClient();
    const activo = estatus === 'ACTIVO';
    const { error } = await supabase
      .from('personal')
      .update({ estatus, activo })
      .eq('id', id);

    if (error) return { ok: false, message: error.message };
    revalidateAll();
    return { ok: true, message: `Trabajador marcado como ${estatus}.` };
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
  try {
    const supabase = await createServerClient();
    const payload = {
      ...raw,
      activo: true,
      estatus: 'ACTIVO' as const,
    };

    let error;
    if (raw.id) {
      const { id, ...data } = payload;
      ({ error } = await supabase.from('personal').update(data).eq('id', raw.id));
    } else {
      const { id, ...data } = payload;
      ({ error } = await supabase.from('personal').insert(data));
    }

    if (error) return { ok: false, message: error.message };
    revalidateAll();
    return { ok: true, message: raw.id ? 'Trabajador actualizado.' : 'Trabajador registrado.' };
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
  const { userId, area, inicio, fin, rows, pctPedro, pctDarinel, pctLaFe } = payload;

  // Validar que sumen 100
  if (Math.abs(pctPedro + pctDarinel + pctLaFe - 100) > 0.01) {
    return { ok: false, message: 'Los porcentajes deben sumar exactamente 100%.' };
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

    // 2. Eliminar registros anteriores de esa semana
    await supabase.from('nomina_registros').delete().eq('semana_id', semanaId);

    // 3. Insertar registros individuales
    const registros = rows.map((r) => ({
      semana_id: semanaId,
      personal_id: r.personal.id,
      monto_pagado: r.total,
      es_semana_libre: r.esSemanaLibre,
      bono_transporte_pagado: r.bonoTransporte,
    }));

    const { error: regError } = await supabase.from('nomina_registros').insert(registros);
    if (regError) return { ok: false, message: `Error registros: ${regError.message}` };

    // 4. Upsert cierre con aportes de socios
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

    // 5. Registrar en gastos para que aparezca en el Resumen Ejecutivo
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

    // Registrar auditoría de cierre V2
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

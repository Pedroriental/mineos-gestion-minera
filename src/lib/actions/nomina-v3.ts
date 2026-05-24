'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase-server';
import type { NominaVale, PreNominaRow, HistorialPagoRow, TendenciaSemanalRow } from '@/lib/types';

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
    const payload = {
      cedula: raw.cedula,
      nombre_completo: raw.nombre_completo,
      cargo: raw.cargo,
      area: raw.area,
      area_detalle: raw.area_detalle || raw.cargo,
      salario_base: raw.salario_base,
      salario_libre: raw.salario_libre,
      bono_transporte: raw.bono_transporte,
      telefono: raw.telefono,
      notas: raw.notas,
      fecha_ingreso: raw.fecha_ingreso,
      esquema_rotacion: raw.esquema_rotacion || 'FIJO_SEMANAL',
      rotacion_inicio_fecha: raw.rotacion_inicio_fecha || null,
      activo: true,
      estatus: 'ACTIVO' as const,
    };

    let error;
    if (raw.id) {
      ({ error } = await supabase.from('personal').update(payload).eq('id', raw.id));
    } else {
      ({ error } = await supabase.from('personal').insert(payload));
    }

    if (error) return { ok: false, message: error.message };
    revalidateAll();
    return { ok: true, message: raw.id ? 'Trabajador actualizado.' : 'Trabajador registrado.' };
  } catch (e) {
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
  pctPedro: number;
  pctDarinel: number;
  pctLaFe: number;
  gastoPedro: number;
  gastoDarinel: number;
  gastoLaFe: number;
}): Promise<ActionResult> {
  const {
    userId, area, inicio, fin, rows,
    pctPedro, pctDarinel, pctLaFe,
    gastoPedro, gastoDarinel, gastoLaFe
  } = payload;

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

    // 2. Eliminar registros anteriores
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

    // 4. Calcular aportes netos de socios (porcentaje - gastos directos)
    const brutoPedro = parseFloat(((pctPedro / 100) * totalNomina).toFixed(2));
    const brutoDarinel = parseFloat(((pctDarinel / 100) * totalNomina).toFixed(2));
    const brutoLaFe = parseFloat(((pctLaFe / 100) * totalNomina).toFixed(2));

    const netoPedro = parseFloat((brutoPedro - gastoPedro).toFixed(2));
    const netoDarinel = parseFloat((brutoDarinel - gastoDarinel).toFixed(2));
    const netoLaFe = parseFloat((brutoLaFe - gastoLaFe).toFixed(2));

    // 5. Upsert cierre
    const { error: cierreError } = await supabase
      .from('nomina_cierres')
      .upsert({
        semana_id: semanaId,
        total_nomina_usd: totalNomina,
        pct_pedro: pctPedro,
        pct_darinel: pctDarinel,
        pct_la_fe: pctLaFe,
        monto_pedro: netoPedro,
        monto_darinel: netoDarinel,
        monto_la_fe: netoLaFe,
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
        notas: `Cierre V3: Pedro ${pctPedro}% ($${netoPedro}) / Darinel ${pctDarinel}% ($${netoDarinel}) / La Fe ${pctLaFe}% ($${netoLaFe})`,
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
      data: { semanaId, totalNomina, netoPedro, netoDarinel, netoLaFe },
    };
  } catch (err) {
    console.error('[Action] procesarCierreNominaV3:', err);
    return { ok: false, message: 'Error interno del servidor.' };
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

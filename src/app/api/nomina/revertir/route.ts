import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { refreshPeriodoTotalUsd } from '@/lib/nomina/cierre-semana-db';
import { revertirCierreRotacionNominaAction } from '@/lib/actions/rotacion-instancias';
import { registrarAuditAction } from '@/lib/actions/nomina-v3';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const semanaId = String(body.semanaId ?? body.id ?? '').trim();
    const area = String(body.area ?? '').trim();
    const semanaInicio = String(body.semana_inicio ?? body.semanaInicio ?? '').trim();
    const gastoId = body.gasto_id ?? body.gastoId ?? null;
    const totalPagado = Number(body.total_pagado ?? body.totalPagado ?? 0);

    if (!semanaId) {
      return NextResponse.json(
        { ok: false, message: 'ID de la semana es obligatorio' },
        { status: 400 },
      );
    }

    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // 1. Restaurar vales asociados
    const { data: valesRows } = await supabase
      .from('nomina_vales')
      .select('id')
      .eq('semana_id', semanaId);

    if (valesRows?.length) {
      await supabase
        .from('nomina_vales')
        .update({ estado: 'PENDIENTE', semana_id: null })
        .eq('semana_id', semanaId);
    } else {
      await supabase.from('nomina_vales').update({ semana_id: null }).eq('semana_id', semanaId);
    }

    // 2. Rescatar registros guardados antes de eliminar la semana para conservar el borrador
    const { data: registrosCerrados } = await supabase
      .from('nomina_registros')
      .select('personal_id, monto_pagado, es_semana_libre, estado_asistencia, dias_trabajados, salario_base_calculado, novedad_turno, novedad_turno_obs')
      .eq('semana_id', semanaId);

    // 3. Limpiar links del periodo consolidado y recalcular total
    const { data: semRow } = await supabase
      .from('nomina_semanas')
      .select('periodo_id')
      .eq('id', semanaId)
      .maybeSingle();

    const { data: periodoLinks } = await supabase
      .from('nomina_periodo_semanas')
      .select('periodo_id')
      .eq('semana_id', semanaId);

    const periodIdsToRefresh = new Set<string>();
    if (semRow?.periodo_id) periodIdsToRefresh.add(semRow.periodo_id);

    if (periodoLinks?.length) {
      await supabase.from('nomina_periodo_semanas').delete().eq('semana_id', semanaId);
      for (const link of periodoLinks) {
        if (link.periodo_id) periodIdsToRefresh.add(link.periodo_id);
      }
    }

    for (const pid of periodIdsToRefresh) {
      try {
        await refreshPeriodoTotalUsd(supabase, pid);
      } catch (pErr) {
        console.warn('[/api/nomina/revertir] Error al refrescar total de periodo:', pErr);
      }
    }

    // 4. Eliminar registros y cierres
    await supabase.from('nomina_registros').delete().eq('semana_id', semanaId);
    await supabase.from('nomina_cierres').delete().eq('semana_id', semanaId);

    // 5. Eliminar gastos si existía
    if (gastoId) {
      await supabase.from('gastos').delete().eq('id', gastoId);
    }

    // 6. Eliminar pagos de nómina por fecha
    if (semanaInicio) {
      await supabase.from('nomina_pagos').delete().eq('periodo_inicio', semanaInicio);
    }

    // 7. Revertir rotación
    try {
      await revertirCierreRotacionNominaAction(semanaId);
    } catch (rotErr) {
      console.warn('[/api/nomina/revertir] Error revirtiendo rotación:', rotErr);
    }
    await supabase.from('rotacion_instancia_semanas').delete().eq('nomina_semana_id', semanaId);

    // 8. Eliminar la semana
    const { error: delError } = await supabase.from('nomina_semanas').delete().eq('id', semanaId);

    if (delError) {
      console.error('[/api/nomina/revertir] Error al eliminar semana de Supabase:', delError.message);
      return NextResponse.json(
        { ok: false, message: `Error al revertir: ${delError.message}` },
        { status: 400 },
      );
    }

    // 9. Registrar auditoría
    try {
      await registrarAuditAction(
        'REVERTIR_NOMINA',
        'nomina_semanas',
        semanaId,
        `Nómina revertida para ${area.toUpperCase() || 'ÁREA'} de la semana ${semanaInicio || semanaId}. Monto eliminado: $${totalPagado.toFixed(2)}.`,
        user?.id,
        user?.email,
      );
    } catch (audErr) {
      console.warn('[/api/nomina/revertir] Error al registrar auditoría:', audErr);
    }

    return NextResponse.json({
      ok: true,
      message: 'Nómina revertida exitosamente.',
      data: { registros: registrosCerrados || [] },
    });
  } catch (err: any) {
    console.error('[/api/nomina/revertir] Error inesperado:', err);
    return NextResponse.json(
      { ok: false, message: err?.message || 'Error interno al revertir la semana' },
      { status: 500 },
    );
  }
}

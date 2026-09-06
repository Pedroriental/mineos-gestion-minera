import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase-server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { refreshPeriodoTotalUsd } from '@/lib/nomina/cierre-semana-db';
import { revertirCierreRotacionNominaAction } from '@/lib/actions/rotacion-instancias';
import { registrarAuditAction } from '@/lib/actions/nomina-v3';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    let semanaId = String(body.semanaId ?? body.id ?? '').trim();
    const area = String(body.area ?? '').trim();
    const semanaInicio = String(body.semana_inicio ?? body.semanaInicio ?? '').trim();
    const gastoId = body.gasto_id ?? body.gastoId ?? null;
    const totalPagado = Number(body.total_pagado ?? body.totalPagado ?? 0);

    const supabase = getSupabaseAdmin() ?? await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // 1. Recopilar todas las semanas objetivo que coincidan por ID o por (semana_inicio, area)
    const targetRowsMap = new Map<string, { id: string; periodo_id?: string | null; gasto_id?: string | null; total_pagado?: number; semana_inicio?: string; area?: string }>();

    if (semanaId) {
      const { data: byId } = await supabase
        .from('nomina_semanas')
        .select('id, periodo_id, gasto_id, total_pagado, semana_inicio, area')
        .eq('id', semanaId);
      if (byId?.length) {
        for (const row of byId) targetRowsMap.set(row.id, row);
      }
    }

    if (semanaInicio && area) {
      const { data: byDate } = await supabase
        .from('nomina_semanas')
        .select('id, periodo_id, gasto_id, total_pagado, semana_inicio, area')
        .eq('semana_inicio', semanaInicio)
        .eq('area', area);
      if (byDate?.length) {
        for (const row of byDate) targetRowsMap.set(row.id, row);
      }
    }

    const allTargetIds = Array.from(targetRowsMap.keys());

    let registrosCerrados: any[] = [];
    const periodIdsToRefresh = new Set<string>();

    if (allTargetIds.length > 0) {
      // 2. Restaurar vales asociados a cualquiera de las semanas eliminadas
      for (const sid of allTargetIds) {
        await supabase
          .from('nomina_vales')
          .update({ estado: 'PENDIENTE', semana_id: null })
          .eq('semana_id', sid);
      }

      // 3. Rescatar registros guardados antes de eliminar para conservar el borrador
      const { data: regs } = await supabase
        .from('nomina_registros')
        .select('personal_id, monto_pagado, es_semana_libre, estado_asistencia, dias_trabajados, salario_base_calculado, novedad_turno, novedad_turno_obs')
        .in('semana_id', allTargetIds);
      if (regs?.length) registrosCerrados = regs;

      // 4. Identificar periodos consolidados vinculados
      for (const row of targetRowsMap.values()) {
        if (row.periodo_id) periodIdsToRefresh.add(row.periodo_id);
      }

      const { data: periodoLinks } = await supabase
        .from('nomina_periodo_semanas')
        .select('periodo_id, semana_id')
        .in('semana_id', allTargetIds);

      if (periodoLinks?.length) {
        for (const link of periodoLinks) {
          if (link.periodo_id) periodIdsToRefresh.add(link.periodo_id);
        }
        await supabase
          .from('nomina_periodo_semanas')
          .delete()
          .in('semana_id', allTargetIds);
      }

      // 5. Eliminar registros, cierres y rotaciones de las semanas
      await supabase.from('nomina_registros').delete().in('semana_id', allTargetIds);
      await supabase.from('nomina_cierres').delete().in('semana_id', allTargetIds);
      await supabase.from('rotacion_instancia_semanas').delete().in('nomina_semana_id', allTargetIds);

      for (const sid of allTargetIds) {
        try {
          await revertirCierreRotacionNominaAction(sid);
        } catch (rotErr) {
          console.warn('[/api/nomina/revertir] Error revirtiendo rotación:', rotErr);
        }
      }

      // 6. Eliminar gastos vinculados
      const gastosToDelete = new Set<string>();
      if (gastoId) gastosToDelete.add(gastoId);
      for (const row of targetRowsMap.values()) {
        if (row.gasto_id) gastosToDelete.add(row.gasto_id);
      }
      for (const gid of gastosToDelete) {
        await supabase.from('gastos').delete().eq('id', gid);
      }

      // 7. Eliminar las filas de nomina_semanas
      const { error: delError } = await supabase
        .from('nomina_semanas')
        .delete()
        .in('id', allTargetIds);

      if (delError) {
        console.error('[/api/nomina/revertir] Error al eliminar semana de Supabase:', delError.message);
        return NextResponse.json(
          { ok: false, message: `Error al revertir: ${delError.message}` },
          { status: 400 },
        );
      }

      // 8. Refrescar totales y metadata de los periodos afectados
      const targetIdsSet = new Set(allTargetIds);
      const { data: allPeriodsWithMeta } = await supabase
        .from('nomina_periodos')
        .select('id, metadata');
      if (allPeriodsWithMeta?.length) {
        for (const p of allPeriodsWithMeta) {
          const meta = (p.metadata as Record<string, any>) || {};
          if (Array.isArray(meta.semana_ids) && meta.semana_ids.some((id: string) => targetIdsSet.has(id))) {
            periodIdsToRefresh.add(p.id);
          }
        }
      }

      for (const pid of periodIdsToRefresh) {
        try {
          await refreshPeriodoTotalUsd(supabase, pid);
          const { data: pRow } = await supabase
            .from('nomina_periodos')
            .select('metadata')
            .eq('id', pid)
            .maybeSingle();
          if (pRow?.metadata && typeof pRow.metadata === 'object') {
            const meta = { ...pRow.metadata } as Record<string, any>;
            if (Array.isArray(meta.semana_ids)) {
              meta.semana_ids = meta.semana_ids.filter((id: string) => !targetIdsSet.has(id));
              await supabase.from('nomina_periodos').update({ metadata: meta }).eq('id', pid);
            }
          }
        } catch (pErr) {
          console.warn('[/api/nomina/revertir] Error al refrescar total de periodo:', pErr);
        }
      }
    }

    // 9. Limpieza preventiva de pagos por fecha
    if (semanaInicio) {
      await supabase.from('nomina_pagos').delete().eq('periodo_inicio', semanaInicio);
    }

    // 10. Revalidar todas las rutas afectadas en Next.js
    try {
      revalidatePath('/mina/nomina');
      revalidatePath('/planta/nomina');
      revalidatePath('/admin/nomina');
      revalidatePath('/operaciones/nomina-vista-previa');
      revalidatePath('/operaciones/nomina-archivo');
      revalidatePath('/reportes-balances');
    } catch (revErr) {
      console.warn('[/api/nomina/revertir] Error al revalidar rutas:', revErr);
    }

    // 11. Registrar auditoría
    try {
      await registrarAuditAction(
        'REVERTIR_NOMINA',
        'nomina_semanas',
        semanaId || semanaInicio,
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
      data: {
        registros: registrosCerrados || [],
        deletedSemanaIds: allTargetIds,
      },
    });
  } catch (err: any) {
    console.error('[/api/nomina/revertir] Error inesperado:', err);
    return NextResponse.json(
      { ok: false, message: err?.message || 'Error interno al revertir la semana' },
      { status: 500 },
    );
  }
}

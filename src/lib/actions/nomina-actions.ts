'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase-server';
import { PERSONAL_SYNC_PATHS } from '@/lib/personal-master';
import { mapPeriodoRow, validateImportTotals } from '@/lib/nomina/archive';
import { buildImportCommitPayload, type ImportCommitPayload } from '@/lib/nomina/import-commit';
import { buildImportFidelityReport } from '@/lib/nomina/import-fidelity';
import type { InferredWorkerProfile, NominaPeriodoSummary, ParsedNominaPeriod } from '@/lib/nomina/types';
import { registrarAuditAction } from '@/lib/actions/nomina-v3';
import { loadBibliotecaCompleta, upsertBibliotecaVariableAction } from '@/lib/actions/biblioteca-variables';
import {
  serializeNominaDivisionesJson,
  validateNominaDivisiones,
  type NominaDivisionParam,
} from '@/lib/nomina/divisiones';
import {
  borrarTodoPersonalArea,
  importarPersonalAction,
  revertirSemanaAction,
} from '@/lib/actions/nomina';
import { getSemanaRegistrosAction, updatePersonalEstatusAction } from '@/lib/actions/nomina-v2';
import { loadNominaVistaPreviaDataAction } from '@/lib/actions/nomina-preview-data';
import {
  crearValeAction,
  eliminarValeAction,
  getHistorialPagosAction,
  getSemanaCierreAction,
  getTendenciaSemanalAction,
  getValesPendientesBulkAction,
  procesarCierreNominaV3Action,
  upsertPersonalV3Action,
} from '@/lib/actions/nomina-v3';

export type ActionResult =
  | { ok: true; message: string; data?: unknown }
  | { ok: false; message: string };

export {
  borrarTodoPersonalArea,
  crearValeAction,
  eliminarValeAction,
  getHistorialPagosAction,
  getSemanaCierreAction,
  getSemanaRegistrosAction,
  getTendenciaSemanalAction,
  getValesPendientesBulkAction,
  importarPersonalAction,
  loadNominaVistaPreviaDataAction,
  procesarCierreNominaV3Action,
  registrarAuditAction,
  revertirSemanaAction,
  updatePersonalEstatusAction,
  upsertPersonalV3Action,
};

function revalidateNominaPaths() {
  for (const p of [
    ...PERSONAL_SYNC_PATHS,
    '/mina/nomina',
    '/planta/nomina',
    '/admin/nomina',
    '/reportes-balances',
  ]) {
    revalidatePath(p);
  }
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
    .replace(/[^a-z0-9]/g, ' ') // Quitar puntuación
    .replace(/\s+/g, ' ') // Quitar espacios extra
    .trim();
}

export async function getPersonalMapAction(): Promise<{ ok: boolean; data?: any[] }> {
  try {
    const supabase = await createServerClient();
    const { data } = await supabase.from('personal').select('id, cedula, nombre_completo, estado_laboral, despido_causa, observacion_estado');
    return { ok: true, data: data || [] };
  } catch {
    return { ok: false, data: [] };
  }
}

export async function importarNominaHistoricaAction(input: {
  period: ParsedNominaPeriod;
  profiles: InferredWorkerProfile[];
  userId?: string;
  label?: string;
  toleranceUsd?: number;
}): Promise<ActionResult> {
  try {
    const supabase = await createServerClient();
    const { period, profiles, userId, label, toleranceUsd = 0.05 } = input;

    const computedTotal = period.grandTotal;
    const validation = validateImportTotals(period.grandTotal, computedTotal, toleranceUsd);
    if (!validation.ok) {
      return { ok: false, message: validation.message ?? 'Totales no cuadran' };
    }

    const { data: personalRows } = await supabase.from('personal').select('*');
    const existingByCedula = new Map(
      (personalRows || []).map((p: any) => [p.cedula, p]),
    );
    const existingByName = new Map(
      (personalRows || []).map((p: any) => [normalizeName(p.nombre_completo), p]),
    );

    const commitPlan = buildImportCommitPayload(period, profiles, {
      label,
      userId,
      existingPersonal: existingByCedula as Map<string, import('@/lib/types').Personal>,
    });

    const newWorkersRegistered: string[] = [];

    for (const p of commitPlan.personal) {
      let existing = existingByCedula.get(p.cedula) as any;
      
      // Búsqueda alternativa por nombre normalizado si no se encuentra por cédula
      if (!existing) {
        existing = existingByName.get(normalizeName(p.nombre_completo));
      }
      
      if (existing?.id) {
        // Si el trabajador ya existe por nombre pero su cédula en la base es distinta (o SC-...),
        // actualizamos la cédula real en la base de datos a la del histórico.
        if (existing.cedula !== p.cedula) {
          await supabase.from('personal').update({ cedula: p.cedula }).eq('id', existing.id);
          existing.cedula = p.cedula;
          existingByCedula.set(p.cedula, existing);
        }
        continue;
      }

      // Si es un trabajador nuevo (no registrado previamente en la base de datos),
      // lo registramos en el maestro de personal para satisfacer la clave foránea del histórico,
      // pero lo registramos con estatus INACTIVO para que nunca aparezca en las nóminas semanales activas.
      const payload = {
        cedula: p.cedula,
        nombre_completo: p.nombre_completo,
        cargo: p.cargo,
        area: p.area,
        area_detalle: p.area_detalle ?? p.cargo ?? null,
        salario_base: p.salario_base,
        salario_libre: p.salario_libre,
        esquema_rotacion: p.esquema_rotacion,
        rotacion_inicio_fecha: p.rotacion_inicio_fecha,
        fecha_ingreso: p.fecha_ingreso,
        bono_transporte: p.bono_transporte ?? 0,
        activo: false,
        estado_laboral: 'HISTORICO', // Registro histórico, no visible en nómina activa
        estatus: 'INACTIVO',
      };

      const { error: insErr } = await supabase.from('personal').insert(payload);
      if (insErr) {
        throw new Error(`Error al registrar nuevo trabajador ${p.nombre_completo}: ${insErr.message}`);
      }
      newWorkersRegistered.push(p.nombre_completo);
    }

    const { data: personalAfter } = await supabase.from('personal').select('id, cedula');
    const idByCedula = new Map(
      (personalAfter || []).map((p: { id: string; cedula: string }) => [p.cedula, p.id]),
    );

    const rpcPayload = buildRpcPayload(commitPlan, idByCedula, userId);

    if (!rpcPayload.semanas.length) {
      return {
        ok: false,
        message:
          'No se detectaron semanas con montos en el archivo. Verifique que sea una planilla matricial (Excel/PDF de nómina).',
      };
    }

    const totalRegistros = rpcPayload.semanas.reduce(
      (n, s) => n + (s.registros?.length ?? 0),
      0,
    );
    if (totalRegistros === 0) {
      return {
        ok: false,
        message:
          'Ningún trabajador pudo vincularse por cédula. Revise que las cédulas del archivo coincidan con la base.',
      };
    }

    const { data: rpcResult, error: rpcError } = await supabase.rpc('import_nomina_historica', {
      payload: rpcPayload,
    });

    if (rpcError) {
      return { ok: false, message: rpcError.message };
    }

    const result = rpcResult as { ok?: boolean; message?: string; periodo_id?: string };
    if (result?.ok === false) {
      return { ok: false, message: result.message ?? 'Error en import RPC' };
    }

    await registrarAuditAction(
      'IMPORT_NOMINA_HISTORICA',
      'nomina_periodos',
      String(result?.periodo_id ?? ''),
      `Import histórico ${commitPlan.range_start} — ${commitPlan.range_end}. Total: $${commitPlan.total_usd.toFixed(2)}`,
      userId,
    );

    revalidateNominaPaths();

    const fidelity = buildImportFidelityReport(period, profiles, {
      existingPersonal: existingByCedula as Map<string, import('@/lib/types').Personal>,
      idByCedula,
    });

    let successMessage = `Archivo importado en Mina: $${fidelity.savedTotal?.toFixed(2) ?? commitPlan.total_usd.toFixed(2)} (${commitPlan.semanas.length} semanas, ${fidelity.workerCountSaved ?? commitPlan.personal.length} trabajadores)`;
    if (newWorkersRegistered.length > 0) {
      successMessage += `\n\n⚠️ ¡Atención! Se registraron automáticamente ${newWorkersRegistered.length} nuevos trabajadores en la base de datos (con estatus Inactivo): ${newWorkersRegistered.join(', ')}.`;
    }

    return {
      ok: true,
      message: successMessage,
      data: {
        ...result,
        rangeStart: commitPlan.range_start,
        rangeEnd: commitPlan.range_end,
        totalUsd: fidelity.savedTotal ?? commitPlan.total_usd,
        semanaCount: commitPlan.semanas.length,
        fidelity,
      },
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : 'Error al importar histórico',
    };
  }
}

function buildRpcPayload(
  plan: ImportCommitPayload,
  idByCedula: Map<string, string>,
  userId?: string,
) {
  return {
    label: plan.label,
    range_start: plan.range_start,
    range_end: plan.range_end,
    total_usd: plan.total_usd,
    origen: plan.origen,
    user_id: userId ?? null,
    metadata: plan.metadata,
    semanas: plan.semanas
      .map((s) => ({
        semana_inicio: s.semana_inicio,
        semana_fin: s.semana_fin,
        area: s.area,
        total_trabajadores: s.total_trabajadores,
        total_pagado: s.total_pagado,
        registros: s.registros
          .map((r) => {
            const personal_id = idByCedula.get(r.cedula);
            if (!personal_id) return null;
            return {
              personal_id,
              monto_pagado: r.monto_pagado,
              es_semana_libre: r.es_semana_libre,
              estado_asistencia: r.estado_asistencia,
              dias_trabajados: r.dias_trabajados,
              salario_base_calculado: r.salario_base_calculado,
              novedad_turno: r.novedad_turno ?? 'ACTIVO',
              novedad_turno_obs: r.novedad_turno_obs ?? '',
              bonificaciones: r.bonificaciones,
              total_vales: r.total_vales,
              personal_snapshot: r.personal_snapshot,
            };
          })
          .filter(Boolean),
      }))
      .filter((s) => s.registros.length > 0),
  };
}

export async function listNominaPeriodosAction(): Promise<{
  ok: boolean;
  periodos: NominaPeriodoSummary[];
  message?: string;
}> {
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from('nomina_periodos')
      .select(
        `
        id, label, range_start, range_end, total_usd, origen, metadata, created_at,
        nomina_periodo_semanas ( semana_id )
      `,
      )
      .order('range_start', { ascending: false });

    if (error) {
      return { ok: false, periodos: [], message: error.message };
    }

    const periodos = (data || []).map(
      (row: {
        id: string;
        label: string;
        range_start: string;
        range_end: string;
        total_usd: number;
        origen: string;
        metadata: Record<string, unknown> | null;
        created_at: string;
        nomina_periodo_semanas?: Array<{ semana_id: string }>;
      }) =>
        mapPeriodoRow({
          ...row,
          semana_count: row.nomina_periodo_semanas?.length ?? 0,
        }),
    );

    return { ok: true, periodos };
  } catch (e) {
    return {
      ok: false,
      periodos: [],
      message: e instanceof Error ? e.message : 'Error al listar periodos',
    };
  }
}

export async function eliminarImportNominaAction(input: {
  periodoId: string;
  userId?: string;
}): Promise<ActionResult> {
  try {
    const supabase = await createServerClient();
    const { periodoId, userId } = input;

    const { data: periodo, error: pErr } = await supabase
      .from('nomina_periodos')
      .select('id, label, range_start, range_end, total_usd, origen')
      .eq('id', periodoId)
      .maybeSingle();

    if (pErr || !periodo) {
      return { ok: false, message: pErr?.message ?? 'Periodo no encontrado' };
    }

    if (periodo.origen !== 'import_historico') {
      return {
        ok: false,
        message:
          'Solo se pueden eliminar imports históricos. Los periodos consolidados manualmente no se borran desde aquí.',
      };
    }

    const { data: links, error: linkErr } = await supabase
      .from('nomina_periodo_semanas')
      .select('semana_id')
      .eq('periodo_id', periodoId);

    if (linkErr) {
      return { ok: false, message: linkErr.message };
    }

    const semanaIds = (links || []).map((l: { semana_id: string }) => l.semana_id);

    if (semanaIds.length) {
      // NOTA: No filtramos por periodo_id porque registros viejos pueden tener
      // periodo_id = NULL aunque pertenezcan al periodo (bug de datos históricos).
      // El filtro por IDs de semana obtenidos desde la join es suficientemente seguro.
      const { error: semErr } = await supabase
        .from('nomina_semanas')
        .delete()
        .in('id', semanaIds)
        .eq('origen', 'import_historico');

      if (semErr) {
        return { ok: false, message: semErr.message };
      }
    }

    const { error: delErr } = await supabase.from('nomina_periodos').delete().eq('id', periodoId);

    if (delErr) {
      return { ok: false, message: delErr.message };
    }

    await registrarAuditAction(
      'DELETE_IMPORT_NOMINA',
      'nomina_periodos',
      periodoId,
      `Eliminado import ${periodo.label} (${periodo.range_start} — ${periodo.range_end}). Total: $${Number(periodo.total_usd).toFixed(2)}`,
      userId,
    );

    revalidateNominaPaths();
    revalidatePath('/operaciones/nomina-archivo');
    revalidatePath('/operaciones/nomina-vista-previa');
    revalidatePath('/operaciones/nomina-importar');

    return {
      ok: true,
      message: `Import eliminado: ${periodo.label}`,
      data: { deletedSemanas: semanaIds.length },
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : 'Error al eliminar import',
    };
  }
}

export async function consolidarNominaPeriodoAction(input: {
  label: string;
  rangeStart: string;
  rangeEnd: string;
  userId?: string;
}): Promise<ActionResult> {
  try {
    const supabase = await createServerClient();
    const { label, rangeStart, rangeEnd, userId } = input;

    const { data: semanas } = await supabase
      .from('nomina_semanas')
      .select('id, total_pagado, semana_inicio, area')
      .gte('semana_inicio', rangeStart)
      .lte('semana_inicio', rangeEnd);

    if (!semanas?.length) {
      return { ok: false, message: 'No hay semanas cerradas en ese rango.' };
    }

    const totalUsd = parseFloat(
      semanas.reduce((s, row) => s + Number(row.total_pagado), 0).toFixed(2),
    );

    const { data: periodo, error: pErr } = await supabase
      .from('nomina_periodos')
      .insert({
        label,
        range_start: rangeStart,
        range_end: rangeEnd,
        total_usd: totalUsd,
        origen: 'consolidacion_manual',
        metadata: { semana_ids: semanas.map((s) => s.id) },
        created_by: userId ?? null,
      })
      .select('id')
      .maybeSingle();

    if (pErr || !periodo?.id) {
      return { ok: false, message: pErr?.message ?? 'No se pudo crear el periodo' };
    }

    await supabase.from('nomina_periodo_semanas').insert(
      semanas.map((s) => ({ periodo_id: periodo.id, semana_id: s.id })),
    );

    await supabase
      .from('nomina_semanas')
      .update({ periodo_id: periodo.id })
      .in(
        'id',
        semanas.map((s) => s.id),
      );

    await registrarAuditAction(
      'CONSOLIDAR_PERIODO',
      'nomina_periodos',
      periodo.id,
      `Periodo ${label}: $${totalUsd.toFixed(2)}`,
      userId,
    );

    revalidateNominaPaths();
    return { ok: true, message: 'Periodo consolidado', data: { periodoId: periodo.id, totalUsd } };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : 'Error al consolidar periodo',
    };
  }
}

export async function saveNominaDivisionesConfigAction(
  divisiones: NominaDivisionParam[],
): Promise<ActionResult> {
  const check = validateNominaDivisiones(divisiones);
  if (divisiones.length && !check.ok) {
    return { ok: false, message: check.message ?? 'Reparto inválido.' };
  }

  try {
    const catalog = await loadBibliotecaCompleta();
    const cat =
      catalog.find((c) => c.slug === 'parametros_balance') ??
      catalog.find((c) => c.variables.some((v) => v.clave === 'nomina_divisiones_json'));
    if (!cat) {
      return { ok: false, message: 'No se encontró la categoría de parámetros de nómina en Biblioteca.' };
    }

    const existing = cat.variables.find((v) => v.clave === 'nomina_divisiones_json');
    const res = await upsertBibliotecaVariableAction({
      id: existing?.id,
      categoria_id: cat.id,
      clave: 'nomina_divisiones_json',
      etiqueta: existing?.etiqueta ?? 'Reparto nómina (JSON)',
      valor: serializeNominaDivisionesJson(divisiones),
      unidad: existing?.unidad ?? '',
      descripcion: existing?.descripcion ?? 'Partes con nombre y % que suman 100',
      orden: existing?.orden ?? 4,
      metadata: existing?.metadata ?? {},
    });
    if (!res.ok) return res;

    revalidateNominaPaths();
    revalidatePath('/plataforma/biblioteca-variables');
    revalidatePath('/reportes-balances');
    return { ok: true, message: 'Reparto guardado en Biblioteca de Variables.' };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : 'No se pudo guardar el reparto.',
    };
  }
}

'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase-server';
import { PERSONAL_SYNC_PATHS } from '@/lib/personal-master';
import { mapPeriodoRow, validateImportTotals } from '@/lib/nomina/archive';
import { stripPeriodoLabelPrefix, manualPeriodoDedupKey } from '@/lib/nomina/manual-period';
import { buildImportCommitPayload, type ImportCommitPayload } from '@/lib/nomina/import-commit';
import { buildImportFidelityReport } from '@/lib/nomina/import-fidelity';
import { inferAllProfiles } from '@/lib/nomina/inference';
import type { InferredWorkerProfile, NominaPeriodoSummary, ParsedNominaPeriod } from '@/lib/nomina/types';
import { applyIdentityResolutions } from '@/lib/nomina/apply-identity-resolutions';
import {
  computeIdentitySummary,
  prepareIdentityImport,
  validateClientIdentityCases,
  type IdentityCase,
  type IdentitySummary,
} from '@/lib/nomina/worker-identity-cases';
import {
  buildIdentityAuditPayload,
  formatIdentityAuditDetail,
} from '@/lib/nomina/identity-audit';
import { applyImportAliases, buildAliasUpsertRows, type ImportAliasRecord } from '@/lib/nomina/worker-alias';
import { normalizeWorkerName } from '@/lib/nomina/worker-match';
import type { Personal } from '@/lib/types';
import { registrarAuditAction } from '@/lib/actions/nomina-v3';
import { refreshPeriodoTotalUsd } from '@/lib/nomina/cierre-semana-db';
import { aggregateNominaSemanas } from '@/lib/nomina/nomina-read-model';
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
import { prepareNominaSemanasForPeriodoDelete } from '@/lib/nomina/cierre-semana-db';
import {
  ORIGEN_CIERRE_MES,
  ORIGENES_CICLO_CONSOLIDABLE,
  periodoArea,
  periodoEsCicloConsolidado,
  periodoEsCierreMes,
  rangoDesdeCiclos,
  semanaCountDesdeCiclos,
  totalUsdDesdeCiclos,
  type NominaMesResumen,
} from '@/lib/nomina/cierre-mes';
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

export async function getPersonalMapAction(): Promise<{ ok: boolean; data?: Pick<Personal, 'id' | 'cedula' | 'nombre_completo' | 'estado_laboral' | 'despido_causa' | 'observacion_estado'>[] }> {
  try {
    const supabase = await createServerClient();
    const { data } = await supabase.from('personal').select('id, cedula, nombre_completo, estado_laboral, despido_causa, observacion_estado');
    return { ok: true, data: data || [] };
  } catch {
    return { ok: false, data: [] };
  }
}

async function loadImportAliases(supabase: Awaited<ReturnType<typeof createServerClient>>) {
  const { data, error } = await supabase
    .from('personal_import_aliases')
    .select('id, alias_nombre_normalizado, alias_cedula_excel, personal_id, source, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    if (error.code === '42P01') return [] as ImportAliasRecord[];
    throw error;
  }

  return (data || []) as ImportAliasRecord[];
}

async function persistImportAliases(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  cases: IdentityCase[],
  userId?: string,
) {
  const rows = buildAliasUpsertRows(cases, userId);
  if (!rows.length) return;

  const { error } = await supabase.from('personal_import_aliases').upsert(rows, {
    onConflict: 'alias_nombre_normalizado,alias_cedula_excel',
  });

  if (error && error.code !== '42P01') {
    throw new Error(`No se pudieron guardar alias de importación: ${error.message}`);
  }
}

export async function getImportAliasesAction(): Promise<{
  ok: boolean;
  data?: ImportAliasRecord[];
  message?: string;
}> {
  try {
    const supabase = await createServerClient();
    const data = await loadImportAliases(supabase);
    return { ok: true, data };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : 'Error al cargar alias',
      data: [],
    };
  }
}

export async function deleteImportAliasAction(id: string): Promise<ActionResult> {
  try {
    const supabase = await createServerClient();
    const { error } = await supabase.from('personal_import_aliases').delete().eq('id', id);
    if (error) throw error;
    return { ok: true, message: 'Alias eliminado' };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : 'Error al eliminar alias',
    };
  }
}

export async function importarNominaHistoricaAction(input: {
  rawPeriod?: ParsedNominaPeriod;
  identityCases?: IdentityCase[];
  period: ParsedNominaPeriod;
  profiles: InferredWorkerProfile[];
  userId?: string;
  label?: string;
  toleranceUsd?: number;
  modoCarga?: 'historico' | 'operativo';
}): Promise<ActionResult> {
  try {
    const supabase = await createServerClient();
    const {
      rawPeriod: rawPeriodInput,
      identityCases = [],
      period: clientPeriod,
      userId,
      label,
      toleranceUsd = 0.05,
      modoCarga = 'historico',
    } = input;
    const rawPeriod = rawPeriodInput ?? clientPeriod;

    const { data: personalRows } = await supabase.from('personal').select('*');
    const workersBase = (personalRows || []).map((p: Personal) => ({
      id: p.id,
      cedula: p.cedula,
      nombre_completo: p.nombre_completo,
    }));

    const importAliases = await loadImportAliases(supabase);
    const identityPrep = prepareIdentityImport(rawPeriod, workersBase, importAliases);
    const serverCases = identityPrep.cases;

    if (serverCases.length > 0) {
      const identityValidation = validateClientIdentityCases(serverCases, identityCases);
      if (!identityValidation.ok) {
        return { ok: false, message: identityValidation.message ?? 'Resoluciones de identidad incompletas.' };
      }
    }

    const workersById = new Map(
      workersBase.filter((w) => w.id).map((w) => [w.id!, w]),
    );
    const period = structuredClone(rawPeriod) as ParsedNominaPeriod;
    if (importAliases.length) {
      applyImportAliases(period, importAliases, workersById);
    }
    if (serverCases.length > 0) {
      applyIdentityResolutions(period, identityCases);
    }

    const identitySummary: IdentitySummary = computeIdentitySummary(
      rawPeriod,
      identityCases,
      identityPrep.aliasApplications.length,
    );

    const weekStarts = period.weekColumns.map((c) => c.weekStart);
    const allRows = period.sections.flatMap((s) => s.rows);
    const profiles = input.profiles.length
      ? input.profiles
      : inferAllProfiles(allRows, weekStarts, period.weekColumns);

    const existingByCedula = new Map(
      (personalRows || []).map((p: Personal) => [p.cedula, p]),
    );
    const existingByName = new Map(
      (personalRows || []).map((p: Personal) => [normalizeWorkerName(p.nombre_completo), p]),
    );

    const identityAudit = buildIdentityAuditPayload(
      identityCases,
      identitySummary,
      identityPrep.aliasApplications,
    );

    const commitPlan = buildImportCommitPayload(period, profiles, {
      label,
      userId,
      existingPersonal: existingByCedula as Map<string, import('@/lib/types').Personal>,
      origen: modoCarga === 'operativo' ? 'import_operativo' : 'import_historico',
      modoCarga,
    });
    commitPlan.metadata = {
      ...commitPlan.metadata,
      identity_audit: identityAudit,
    };

    const computedTotal = commitPlan.semanas.reduce(
      (sum, s) => sum + s.registros.reduce((sub, r) => sub + Number(r.monto_pagado), 0),
      0,
    );
    const validation = validateImportTotals(
      (rawPeriodInput ?? clientPeriod).grandTotal,
      computedTotal,
      toleranceUsd,
    );
    if (!validation.ok) {
      return { ok: false, message: validation.message ?? 'Totales no cuadran' };
    }

    const newWorkersRegistered: string[] = [];

    for (const p of commitPlan.personal) {
      let existing = existingByCedula.get(p.cedula) as any;
      
      // Búsqueda alternativa por nombre normalizado si no se encuentra por cédula
      if (!existing) {
        existing = existingByName.get(normalizeWorkerName(p.nombre_completo));
      }

      if (existing?.id) {
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
      const msg = rpcError.message ?? '';
      if (msg.includes('idx_nomina_registros_semana_personal')) {
        return {
          ok: false,
          message:
            'No se pudo importar: hay dos o más líneas del archivo que corresponden al mismo trabajador en la misma semana (cédula duplicada o ya registrado). Revise cédulas repetidas en el Excel o elimine la importación previa de ese período.',
        };
      }
      return { ok: false, message: msg };
    }

    const result = rpcResult as { ok?: boolean; message?: string; periodo_id?: string };
    if (result?.ok === false) {
      return { ok: false, message: result.message ?? 'Error en import RPC' };
    }

    await registrarAuditAction(
      'IMPORT_NOMINA_HISTORICA',
      'nomina_periodos',
      String(result?.periodo_id ?? ''),
      `Import histórico ${commitPlan.range_start} — ${commitPlan.range_end}. Total: $${commitPlan.total_usd.toFixed(2)}. ${formatIdentityAuditDetail(identityAudit)}`,
      userId,
    );

    await persistImportAliases(supabase, identityCases, userId);

    revalidateNominaPaths();

    const fidelity = buildImportFidelityReport(period, profiles, {
      existingPersonal: existingByCedula as Map<string, import('@/lib/types').Personal>,
      idByCedula,
      identityCases: serverCases.length > 0 ? identityCases : undefined,
      identitySummary: serverCases.length > 0 || identityPrep.aliasApplications.length > 0
        ? identitySummary
        : undefined,
      identityAudit:
        serverCases.length > 0 || identityPrep.aliasApplications.length > 0
          ? identityAudit
          : undefined,
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

async function dedupeConsolidacionManualPeriodosInDb(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
): Promise<void> {
  const { data } = await supabase
    .from('nomina_periodos')
    .select('id, label, range_start, range_end, metadata, created_at')
    .eq('origen', 'consolidacion_manual');

  const groups = new Map<string, NonNullable<typeof data>>();
  for (const row of data ?? []) {
    const area =
      row.metadata && typeof row.metadata === 'object'
        ? String((row.metadata as Record<string, unknown>).area ?? '')
        : '';
    const key = manualPeriodoDedupKey({
      rangeStart: row.range_start,
      rangeEnd: row.range_end,
      area,
      origen: 'consolidacion_manual',
    });
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  for (const rows of groups.values()) {
    if (rows.length <= 1) {
      const only = rows[0];
      if (!only) continue;
      const cleanLabel = stripPeriodoLabelPrefix(only.label);
      if (cleanLabel && cleanLabel !== only.label) {
        await supabase.from('nomina_periodos').update({ label: cleanLabel }).eq('id', only.id);
      }
      continue;
    }

    const canonical = rows.reduce((best, row) =>
      row.created_at > best.created_at ? row : best,
    );
    const cleanLabel = stripPeriodoLabelPrefix(canonical.label);
    if (cleanLabel && cleanLabel !== canonical.label) {
      await supabase.from('nomina_periodos').update({ label: cleanLabel }).eq('id', canonical.id);
    }

    const duplicateIds = rows.map((r) => r.id).filter((id) => id !== canonical.id);
    if (!duplicateIds.length) continue;

    await supabase.from('nomina_periodo_semanas').delete().in('periodo_id', duplicateIds);
    await supabase.from('nomina_periodos').delete().in('id', duplicateIds);
  }
}

/** Recalcula total_usd desde semanas enlazadas (0 si no quedan links válidos). */
async function reconcileConsolidacionManualPeriodTotalsInDb(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
): Promise<void> {
  const { data } = await supabase
    .from('nomina_periodos')
    .select('id')
    .eq('origen', 'consolidacion_manual');

  for (const row of data ?? []) {
    if (row.id) await refreshPeriodoTotalUsd(supabase, row.id);
  }
}

export async function runNominaPeriodosMaintenanceAction(): Promise<ActionResult> {
  try {
    const supabase = await createServerClient();
    await dedupeConsolidacionManualPeriodosInDb(supabase);
    await reconcileConsolidacionManualPeriodTotalsInDb(supabase);
    return { ok: true, message: 'Mantenimiento de periodos completado.' };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : 'Error en mantenimiento de periodos',
    };
  }
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
      }) => {
        const semanaIds = row.nomina_periodo_semanas
          ?.map((link) => link.semana_id)
          .filter((id): id is string => typeof id === 'string') ?? [];
        return mapPeriodoRow({
          ...row,
          semana_count: semanaIds.length,
          semana_ids: semanaIds,
        });
      },
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
  area: 'mina' | 'planta';
  metadata?: Record<string, unknown>;
}): Promise<ActionResult> {
  try {
    const supabase = await createServerClient();
    const { rangeStart, rangeEnd, userId, metadata } = input;
    const label = stripPeriodoLabelPrefix(input.label.trim()) || `Periodo ${rangeStart}`;
    const area = input.area?.trim();

    if (!area || (area !== 'mina' && area !== 'planta')) {
      return {
        ok: false,
        message: 'Debe indicar el área del periodo (mina o planta).',
      };
    }

    const scopedSemanaIds = Array.isArray(metadata?.semana_ids)
      ? metadata.semana_ids.filter((id): id is string => typeof id === 'string')
      : [];

    let query = supabase
      .from('nomina_semanas')
      .select('id, total_pagado, semana_inicio, area')
      .eq('area', area)
      .gte('semana_inicio', rangeStart)
      .lte('semana_inicio', rangeEnd);
    if (scopedSemanaIds.length) query = query.in('id', scopedSemanaIds);

    const { data: semanas } = await query;

    if (!semanas?.length) {
      return { ok: false, message: 'No hay semanas cerradas en ese rango para el área indicada.' };
    }

    const foreignArea = semanas.find((row) => row.area !== area);
    if (foreignArea) {
      return {
        ok: false,
        message: `Hay semanas de otra área en el rango (${foreignArea.area}). Solo se permite ${area}.`,
      };
    }

    const resolvedArea = area;
    const totalUsd = aggregateNominaSemanas(
      semanas.map((row) => ({
        id: row.id,
        semana_inicio: row.semana_inicio,
        semana_fin: row.semana_inicio,
        area: row.area,
        total_pagado: row.total_pagado,
      })),
    ).totalUsd;

    const periodoMetadata = {
      semana_ids: semanas.map((s) => s.id),
      area: resolvedArea,
      ...(metadata ?? {}),
    };

    const { data: existingRows } = await supabase
      .from('nomina_periodos')
      .select('id, created_at, metadata, total_usd')
      .eq('range_start', rangeStart)
      .eq('range_end', rangeEnd)
      .eq('origen', 'consolidacion_manual');

    const sameAreaRows = (existingRows ?? []).filter(
      (row) =>
        row.metadata &&
        typeof row.metadata === 'object' &&
        (row.metadata as Record<string, unknown>).area === resolvedArea,
    );

    const canonical =
      sameAreaRows.length > 0
        ? sameAreaRows.reduce((best, row) =>
            row.created_at > best.created_at ? row : best,
          )
        : null;

    let periodoId: string;
    const previousTotalUsd = canonical?.total_usd ? Number(canonical.total_usd) : 0;
    const isReconsolidation = Boolean(canonical?.id);

    if (canonical?.id) {
      const { error: updErr } = await supabase
        .from('nomina_periodos')
        .update({
          label,
          total_usd: totalUsd,
          metadata: periodoMetadata,
        })
        .eq('id', canonical.id);

      if (updErr) {
        return { ok: false, message: updErr.message };
      }

      periodoId = canonical.id;

      const duplicateIds = sameAreaRows
        .map((r) => r.id)
        .filter((id) => id !== periodoId);
      if (duplicateIds.length) {
        await supabase.from('nomina_semanas').update({ periodo_id: periodoId }).in('periodo_id', duplicateIds);
        await supabase.from('nomina_periodo_semanas').delete().in('periodo_id', duplicateIds);
        await supabase.from('nomina_periodos').delete().in('id', duplicateIds);
      }

      await supabase.from('nomina_periodo_semanas').delete().eq('periodo_id', periodoId);
    } else {
      const { data: periodo, error: pErr } = await supabase
        .from('nomina_periodos')
        .insert({
          label,
          range_start: rangeStart,
          range_end: rangeEnd,
          total_usd: totalUsd,
          origen: 'consolidacion_manual',
          metadata: periodoMetadata,
          created_by: userId ?? null,
        })
        .select('id')
        .maybeSingle();

      if (pErr || !periodo?.id) {
        return { ok: false, message: pErr?.message ?? 'No se pudo crear el periodo' };
      }
      periodoId = periodo.id;
    }

    await supabase.from('nomina_periodo_semanas').insert(
      semanas.map((s) => ({ periodo_id: periodoId, semana_id: s.id })),
    );

    await supabase
      .from('nomina_semanas')
      .update({ periodo_id: periodoId })
      .in(
        'id',
        semanas.map((s) => s.id),
      );

    if (isReconsolidation) {
      await registrarAuditAction(
        'RECONSOLIDAR_PERIODO',
        'nomina_periodos',
        periodoId,
        `Periodo ${label}: $${previousTotalUsd.toFixed(2)} → $${totalUsd.toFixed(2)}`,
        userId,
      );
    } else {
      await registrarAuditAction(
        'CONSOLIDAR_PERIODO',
        'nomina_periodos',
        periodoId,
        `Periodo ${label}: $${totalUsd.toFixed(2)}`,
        userId,
      );
    }

    try {
      revalidateNominaPaths();
    } catch (revErr) {
      console.warn('[consolidarNominaPeriodoAction] Advertencia de revalidación ignorada:', revErr);
    }
    return {
      ok: true,
      message: canonical?.id ? 'Periodo re-consolidado' : 'Periodo consolidado',
      data: { periodoId, totalUsd, reconsolidated: isReconsolidation },
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : 'Error al consolidar periodo',
    };
  }
}

export async function eliminarPeriodoConsolidadoAction(input: {
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

    if (periodo.origen !== 'consolidacion_manual') {
      return {
        ok: false,
        message: 'Solo se pueden eliminar periodos consolidados manualmente desde aquí.',
      };
    }

    const prepare = await prepareNominaSemanasForPeriodoDelete(supabase, periodoId, {
      periodoTotalUsd: Number(periodo.total_usd ?? 0),
    });
    if (prepare.error) {
      return { ok: false, message: prepare.error };
    }

    const { error: unlinkError } = await supabase
      .from('nomina_periodo_semanas')
      .delete()
      .eq('periodo_id', periodoId);
    if (unlinkError) {
      return { ok: false, message: unlinkError.message };
    }

    const { error: delErr } = await supabase.from('nomina_periodos').delete().eq('id', periodoId);

    if (delErr) {
      return { ok: false, message: delErr.message };
    }

    await registrarAuditAction(
      'DELETE_PERIODO_CONSOLIDADO',
      'nomina_periodos',
      periodoId,
      `Eliminado periodo ${periodo.label} (${periodo.range_start} — ${periodo.range_end}). Total: $${Number(periodo.total_usd).toFixed(2)}`,
      userId,
    );

    revalidateNominaPaths();
    revalidatePath('/operaciones/nomina-archivo');
    revalidatePath('/operaciones/nomina-vista-previa');

    return {
      ok: true,
      message: `Periodo eliminado: ${stripPeriodoLabelPrefix(periodo.label)}`,
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : 'Error al eliminar periodo',
    };
  }
}

function filterPeriodosPorArea(
  periodos: NominaPeriodoSummary[],
  area: string,
): NominaPeriodoSummary[] {
  return periodos.filter((p) => {
    const metaArea = periodoArea(p);
    if (metaArea && metaArea !== area) return false;
    return true;
  });
}

function mapMesMigrationError(message: string): string {
  if (
    message.includes('nomina_mes_periodos') ||
    message.includes('cierre_mes') ||
    message.includes('nomina_periodos_origen_check')
  ) {
    return (
      'La base de datos aún no admite cierre de mes. ' +
      'Ejecute supabase/migration_nomina_cierre_mes.sql en Supabase.'
    );
  }
  return message;
}

export type NominaMesPanelData = {
  meses: Array<NominaMesResumen & { ciclos: NominaPeriodoSummary[] }>;
  ciclosDisponibles: NominaPeriodoSummary[];
};

export async function listNominaMesesPanelAction(area: 'mina' | 'planta'): Promise<{
  ok: boolean;
  data: NominaMesPanelData;
  message?: string;
}> {
  const empty: NominaMesPanelData = { meses: [], ciclosDisponibles: [] };
  try {
    const listed = await listNominaPeriodosAction();
    if (!listed.ok) {
      return { ok: false, data: empty, message: listed.message };
    }

    const scoped = filterPeriodosPorArea(listed.periodos, area);
    const byId = new Map(scoped.map((p) => [p.id, p]));

    const supabase = await createServerClient();
    const { data: links, error: linkErr } = await supabase
      .from('nomina_mes_periodos')
      .select('mes_periodo_id, ciclo_periodo_id');

    if (linkErr) {
      if (linkErr.message.includes('nomina_mes_periodos')) {
        const ciclosDisponibles = scoped.filter(periodoEsCicloConsolidado);
        return { ok: true, data: { meses: [], ciclosDisponibles } };
      }
      return { ok: false, data: empty, message: linkErr.message };
    }

    const cicloIdsEnMes = new Set((links ?? []).map((l) => l.ciclo_periodo_id as string));
    const mesIds = new Set(
      scoped.filter(periodoEsCierreMes).map((p) => p.id),
    );

    const ciclosPorMes = new Map<string, NominaPeriodoSummary[]>();
    for (const link of links ?? []) {
      const mesId = link.mes_periodo_id as string;
      const cicloId = link.ciclo_periodo_id as string;
      if (!mesIds.has(mesId)) continue;
      const ciclo = byId.get(cicloId);
      if (!ciclo) continue;
      const list = ciclosPorMes.get(mesId) ?? [];
      list.push(ciclo);
      ciclosPorMes.set(mesId, list);
    }

    const meses = scoped
      .filter(periodoEsCierreMes)
      .map((p) => {
        const ciclos = (ciclosPorMes.get(p.id) ?? []).sort((a, b) =>
          a.rangeStart.localeCompare(b.rangeStart),
        );
        const cicloPeriodoIds = ciclos.map((c) => c.id);
        return {
          id: p.id,
          label: stripPeriodoLabelPrefix(p.label),
          rangeStart: p.rangeStart,
          rangeEnd: p.rangeEnd,
          totalUsd: Number(p.totalUsd),
          createdAt: p.createdAt,
          cicloCount: ciclos.length,
          semanaCount:
            typeof p.metadata?.semana_count === 'number'
              ? Number(p.metadata.semana_count)
              : semanaCountDesdeCiclos(ciclos),
          cicloPeriodoIds,
          ciclos,
        };
      })
      .sort((a, b) => b.rangeStart.localeCompare(a.rangeStart));

    const ciclosDisponibles = scoped
      .filter(
        (p) =>
          periodoEsCicloConsolidado(p) &&
          !cicloIdsEnMes.has(p.id) &&
          p.semanaCount > 0,
      )
      .sort((a, b) => b.rangeStart.localeCompare(a.rangeStart));

    return { ok: true, data: { meses, ciclosDisponibles } };
  } catch (e) {
    return {
      ok: false,
      data: empty,
      message: e instanceof Error ? e.message : 'Error al listar meses',
    };
  }
}

export async function cerrarNominaMesAction(input: {
  label: string;
  area: 'mina' | 'planta';
  periodoIds: string[];
  rangeStart?: string;
  rangeEnd?: string;
  userId?: string;
}): Promise<ActionResult> {
  try {
    const area = input.area?.trim();
    if (area !== 'mina' && area !== 'planta') {
      return { ok: false, message: 'Debe indicar el área (mina o planta).' };
    }

    const periodoIds = [...new Set(input.periodoIds.filter(Boolean))];
    if (!periodoIds.length) {
      return { ok: false, message: 'Seleccione al menos un ciclo consolidado para cerrar el mes.' };
    }

    const label = stripPeriodoLabelPrefix(input.label.trim());
    if (!label) {
      return { ok: false, message: 'Indique un nombre para el mes (ej. Nómina Mayo 2026).' };
    }

    const supabase = await createServerClient();
    const { data: ciclos, error: cErr } = await supabase
      .from('nomina_periodos')
      .select('id, label, range_start, range_end, total_usd, origen, metadata')
      .in('id', periodoIds);

    if (cErr) return { ok: false, message: cErr.message };
    if (!ciclos?.length || ciclos.length !== periodoIds.length) {
      return { ok: false, message: 'Uno o más ciclos seleccionados no existen.' };
    }

    for (const c of ciclos) {
      if (!periodoEsCicloConsolidado({ origen: c.origen })) {
        return {
          ok: false,
          message: `«${c.label}» no es un ciclo consolidado válido para cierre de mes.`,
        };
      }
      const metaArea =
        c.metadata && typeof c.metadata === 'object'
          ? (c.metadata as Record<string, unknown>).area
          : null;
      if (typeof metaArea === 'string' && metaArea !== area) {
        return {
          ok: false,
          message: `El ciclo «${c.label}» pertenece a ${metaArea}, no a ${area}.`,
        };
      }
    }

    const { data: yaEnMes } = await supabase
      .from('nomina_mes_periodos')
      .select('ciclo_periodo_id')
      .in('ciclo_periodo_id', periodoIds);

    if (yaEnMes?.length) {
      return {
        ok: false,
        message: 'Uno o más ciclos ya están incluidos en un mes cerrado.',
      };
    }

    const summaries: NominaPeriodoSummary[] = ciclos.map((c) =>
      mapPeriodoRow({
        id: c.id,
        label: c.label,
        range_start: c.range_start,
        range_end: c.range_end,
        total_usd: Number(c.total_usd),
        origen: c.origen,
        metadata: (c.metadata as Record<string, unknown>) ?? {},
        created_at: new Date().toISOString(),
        semana_count: Array.isArray((c.metadata as Record<string, unknown>)?.semana_ids)
          ? ((c.metadata as Record<string, unknown>).semana_ids as string[]).length
          : 0,
      }),
    );

    const rangoAuto = rangoDesdeCiclos(summaries);
    const rangeStart = input.rangeStart ?? rangoAuto?.rangeStart;
    const rangeEnd = input.rangeEnd ?? rangoAuto?.rangeEnd;
    if (!rangeStart || !rangeEnd) {
      return { ok: false, message: 'No se pudo determinar el rango del mes.' };
    }

    const totalUsd = totalUsdDesdeCiclos(summaries);
    const semanaCount = semanaCountDesdeCiclos(summaries);

    const { data: mesRow, error: insErr } = await supabase
      .from('nomina_periodos')
      .insert({
        label,
        range_start: rangeStart,
        range_end: rangeEnd,
        total_usd: totalUsd,
        origen: ORIGEN_CIERRE_MES,
        metadata: {
          area,
          ciclo_count: summaries.length,
          ciclo_periodo_ids: periodoIds,
          semana_count: semanaCount,
        },
        created_by: input.userId ?? null,
      })
      .select('id')
      .maybeSingle();

    if (insErr || !mesRow?.id) {
      return { ok: false, message: mapMesMigrationError(insErr?.message ?? 'No se pudo crear el mes') };
    }

    const { error: linkErr } = await supabase.from('nomina_mes_periodos').insert(
      periodoIds.map((ciclo_periodo_id) => ({
        mes_periodo_id: mesRow.id,
        ciclo_periodo_id,
      })),
    );

    if (linkErr) {
      await supabase.from('nomina_periodos').delete().eq('id', mesRow.id);
      return { ok: false, message: mapMesMigrationError(linkErr.message) };
    }

    await registrarAuditAction(
      'CERRAR_MES_NOMINA',
      'nomina_periodos',
      mesRow.id,
      `Mes ${label} (${area}): ${summaries.length} ciclo(s), $${totalUsd.toFixed(2)}`,
      input.userId,
    );

    revalidateNominaPaths();
    return {
      ok: true,
      message: `Mes cerrado: ${label} · ${fmtUsdAction(totalUsd)}`,
      data: { periodoId: mesRow.id, totalUsd },
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : 'Error al cerrar mes',
    };
  }
}

function fmtUsdAction(n: number): string {
  return `$${n.toLocaleString('es', { minimumFractionDigits: 2 })}`;
}

export async function eliminarCierreMesAction(input: {
  mesPeriodoId: string;
  userId?: string;
}): Promise<ActionResult> {
  try {
    const supabase = await createServerClient();
    const { data: periodo, error: pErr } = await supabase
      .from('nomina_periodos')
      .select('id, label, range_start, range_end, total_usd, origen')
      .eq('id', input.mesPeriodoId)
      .maybeSingle();

    if (pErr || !periodo) {
      return { ok: false, message: pErr?.message ?? 'Mes no encontrado' };
    }
    if (periodo.origen !== ORIGEN_CIERRE_MES) {
      return { ok: false, message: 'Este registro no es un cierre de mes.' };
    }

    await supabase.from('nomina_mes_periodos').delete().eq('mes_periodo_id', input.mesPeriodoId);

    const { error: delErr } = await supabase
      .from('nomina_periodos')
      .delete()
      .eq('id', input.mesPeriodoId);

    if (delErr) {
      return { ok: false, message: delErr.message };
    }

    await registrarAuditAction(
      'DELETE_CIERRE_MES',
      'nomina_periodos',
      input.mesPeriodoId,
      `Eliminado cierre de mes ${periodo.label}`,
      input.userId,
    );

    revalidateNominaPaths();
    return {
      ok: true,
      message: `Cierre de mes eliminado: ${stripPeriodoLabelPrefix(periodo.label)}`,
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : 'Error al eliminar cierre de mes',
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

/**
 * Busca un período consolidado manual en la DB cuyo rango cubra la semana dada
 * para el área indicada. Devuelve el período más reciente o null.
 *
 * Usado para auto-hidratar la sesión local cuando el localStorage no tiene
 * el período y la vista semanal cae al cálculo legacy individual.
 */
export async function findConsolidatedPeriodForWeekAction(
  area: string,
  weekStart: string,
): Promise<{ ok: boolean; periodo: NominaPeriodoSummary | null; message?: string }> {
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
      .eq('origen', 'consolidacion_manual')
      .lte('range_start', weekStart)
      .gte('range_end', weekStart)
      .order('created_at', { ascending: false });

    if (error) {
      return { ok: false, periodo: null, message: error.message };
    }

    // Filtrar por área en metadata
    const matching = (data ?? []).filter((row) => {
      const meta = row.metadata as Record<string, unknown> | null;
      return meta && meta.area === area;
    });

    if (!matching.length) {
      return { ok: true, periodo: null };
    }

    const best = matching[0];
    const semanaIds = best.nomina_periodo_semanas
      ?.map((link: { semana_id: string }) => link.semana_id)
      .filter((id: string): id is string => typeof id === 'string') ?? [];

    const periodo = mapPeriodoRow({
      ...best,
      metadata: best.metadata as Record<string, unknown> | null,
      semana_count: semanaIds.length,
      semana_ids: semanaIds,
    });

    return { ok: true, periodo };
  } catch (e) {
    return {
      ok: false,
      periodo: null,
      message: e instanceof Error ? e.message : 'Error buscando periodo consolidado',
    };
  }
}

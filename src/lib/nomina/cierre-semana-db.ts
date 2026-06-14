import type { SupabaseClient } from '@supabase/supabase-js';
import { aggregateNominaSemanas } from '@/lib/nomina/nomina-read-model';
import { inferPayrollSectionFromLabel } from '@/lib/nomina/manual-period';

export type ManualPeriodoCierreRef = {
  label: string;
  rangeStart: string;
  rangeEnd: string;
  plantillaId?: string;
};

type SemanaCierreInput = {
  semanaInicio: string;
  semanaFin: string;
  area: string;
  totalTrabajadores: number;
  totalPagado: number;
  registradoPor?: string | null;
  origen: string;
  periodoId?: string | null;
};

function crossAreaNominaMessage(area: string, periodoArea: string, label?: string): string {
  if (area === 'mina' && periodoArea === 'planta') {
    return `Este ciclo (${label ?? 'Molino'}) es de Nómina Molino. Ábrelo y ciérralo desde Planta → Nómina, no desde Mina.`;
  }
  if (area === 'planta' && periodoArea === 'mina') {
    return `Este ciclo (${label ?? 'Mina'}) es de Nómina Mina. Ábrelo y ciérralo desde Mina → Nómina, no desde Molino.`;
  }
  return `No se puede vincular nómina ${area} a un periodo de ${periodoArea}.`;
}

async function verifyPeriodoMatchesNominaArea(
  supabase: SupabaseClient,
  periodoId: string,
  area: string,
): Promise<{ error?: string }> {
  const { data: periodo, error } = await supabase
    .from('nomina_periodos')
    .select('label, metadata, origen')
    .eq('id', periodoId)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!periodo) return { error: 'Periodo de nómina no encontrado.' };

  const metaArea =
    periodo.metadata && typeof periodo.metadata === 'object'
      ? String((periodo.metadata as Record<string, unknown>).area ?? '').trim()
      : '';
  const implied = inferPayrollSectionFromLabel(String(periodo.label ?? ''));
  const periodoArea = metaArea || implied;

  if (periodoArea && periodoArea !== area) {
    return { error: crossAreaNominaMessage(area, periodoArea, periodo.label) };
  }
  return {};
}

/** Busca o crea nomina_semanas sin depender de ON CONFLICT (índices parciales post-V6). */
export async function findOrCreateNominaSemanaForCierre(
  supabase: SupabaseClient,
  input: SemanaCierreInput,
): Promise<{ semanaId: string } | { error: string }> {
  if (input.periodoId) {
    const areaCheck = await verifyPeriodoMatchesNominaArea(supabase, input.periodoId, input.area);
    if (areaCheck.error) return { error: areaCheck.error };
  }
  let lookup = supabase
    .from('nomina_semanas')
    .select('id')
    .eq('semana_inicio', input.semanaInicio)
    .eq('area', input.area);

  lookup =
    input.periodoId != null
      ? lookup.eq('periodo_id', input.periodoId)
      : lookup.is('periodo_id', null);

  const { data: existing, error: lookupError } = await lookup.maybeSingle();
  if (lookupError) return { error: lookupError.message };

  const patch = {
    semana_fin: input.semanaFin,
    area: input.area,
    total_trabajadores: input.totalTrabajadores,
    total_pagado: input.totalPagado,
    registrado_por: input.registradoPor ?? null,
    origen: input.origen,
    periodo_id: input.periodoId ?? null,
  };

  if (existing?.id) {
    const { error: updateError } = await supabase
      .from('nomina_semanas')
      .update(patch)
      .eq('id', existing.id);
    if (updateError) return { error: updateError.message };
    return { semanaId: existing.id };
  }

  const { data: inserted, error: insertError } = await supabase
    .from('nomina_semanas')
    .insert({
      semana_inicio: input.semanaInicio,
      ...patch,
    })
    .select('id')
    .maybeSingle();

  if (insertError) return { error: insertError.message };
  if (!inserted?.id) return { error: 'No se pudo crear la semana de nómina.' };
  return { semanaId: inserted.id };
}

export async function upsertNominaCierreForSemana(
  supabase: SupabaseClient,
  semanaId: string,
  payload: {
    total_nomina_usd: number;
    pct_pedro: number;
    pct_darinel: number;
    pct_la_fe: number;
    monto_pedro: number;
    monto_darinel: number;
    monto_la_fe: number;
    distribucion: unknown;
  },
): Promise<{ error?: string }> {
  const { data: existing } = await supabase
    .from('nomina_cierres')
    .select('id')
    .eq('semana_id', semanaId)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase.from('nomina_cierres').update(payload).eq('id', existing.id);
    return error ? { error: error.message } : {};
  }

  const { error } = await supabase.from('nomina_cierres').insert({ semana_id: semanaId, ...payload });
  return error ? { error: error.message } : {};
}

/** Periodo DB para semanas cerradas desde Vista Semanal (periodo manual local). */
export async function ensureManualVistaPeriodoId(
  supabase: SupabaseClient,
  input: {
    periodo: ManualPeriodoCierreRef;
    area: string;
    userId?: string | null;
  },
): Promise<{ periodoId: string } | { error: string }> {
  const label = input.periodo.label.trim() || `Periodo manual ${input.periodo.rangeStart}`;

  if (inferPayrollSectionFromLabel(label) === 'planta' && input.area === 'mina') {
    return {
      error:
        'Este ciclo es de Molino. Guárdalo desde Planta → Nómina (/planta/nomina), no desde Mina.',
    };
  }
  if (inferPayrollSectionFromLabel(label) === 'mina' && input.area === 'planta') {
    return {
      error:
        'Este ciclo es de Mina. Guárdalo desde Mina → Nómina (/mina/nomina), no desde Molino.',
    };
  }

  const metaFilter = { area: input.area, source: 'vista_manual' };

  const { data: candidates, error: listError } = await supabase
    .from('nomina_periodos')
    .select('id, label, metadata')
    .eq('range_start', input.periodo.rangeStart)
    .eq('range_end', input.periodo.rangeEnd)
    .eq('origen', 'consolidacion_manual');

  if (listError) return { error: listError.message };

  const existing = (candidates ?? []).find((row) => {
    if (!row.metadata || typeof row.metadata !== 'object') return false;
    const meta = row.metadata as Record<string, unknown>;
    return (
      meta.area === input.area &&
      meta.source === 'vista_manual' &&
      String(row.label ?? '').trim() === label
    );
  });

  if (existing?.id) {
    const check = await verifyPeriodoMatchesNominaArea(supabase, existing.id, input.area);
    if (check.error) return { error: check.error };
    return { periodoId: existing.id };
  }

  const { data: created, error: createError } = await supabase
    .from('nomina_periodos')
    .insert({
      label,
      range_start: input.periodo.rangeStart,
      range_end: input.periodo.rangeEnd,
      total_usd: 0,
      origen: 'consolidacion_manual',
      metadata: {
        ...metaFilter,
        plantilla_id: input.periodo.plantillaId ?? null,
        plantillaId: input.periodo.plantillaId ?? null,
      },
      created_by: input.userId ?? null,
    })
    .select('id')
    .maybeSingle();

  if (createError) return { error: createError.message };
  if (!created?.id) return { error: 'No se pudo crear el periodo manual.' };
  return { periodoId: created.id };
}

async function assertPeriodoSemanaSameArea(
  supabase: SupabaseClient,
  periodoId: string,
  semanaId: string,
): Promise<{ error?: string }> {
  const [{ data: periodo, error: periodoError }, { data: semana, error: semanaError }] =
    await Promise.all([
      supabase.from('nomina_periodos').select('origen, metadata').eq('id', periodoId).maybeSingle(),
      supabase.from('nomina_semanas').select('area').eq('id', semanaId).maybeSingle(),
    ]);

  if (periodoError) return { error: periodoError.message };
  if (semanaError) return { error: semanaError.message };
  if (!periodo?.origen) return { error: 'Periodo de nómina no encontrado.' };
  if (!semana?.area) return { error: 'Semana de nómina no encontrada.' };

  if (periodo.origen !== 'consolidacion_manual') return {};

  const periodoArea =
    periodo.metadata && typeof periodo.metadata === 'object'
      ? String((periodo.metadata as Record<string, unknown>).area ?? '').trim()
      : '';
  if (!periodoArea) {
    return { error: 'El periodo manual no tiene área definida (mina o planta).' };
  }
  if (semana.area !== periodoArea) {
    return {
      error: crossAreaNominaMessage(semana.area, periodoArea, undefined),
    };
  }
  return {};
}

export async function linkSemanaToPeriodo(
  supabase: SupabaseClient,
  periodoId: string,
  semanaId: string,
): Promise<{ error?: string }> {
  const areaCheck = await assertPeriodoSemanaSameArea(supabase, periodoId, semanaId);
  if (areaCheck.error) return areaCheck;

  const { error } = await supabase
    .from('nomina_periodo_semanas')
    .upsert({ periodo_id: periodoId, semana_id: semanaId }, { onConflict: 'periodo_id,semana_id' });
  return error ? { error: error.message } : {};
}

export type SemanaPeriodoDetachAction =
  | { action: 'nullify' }
  | { action: 'delete_semana' }
  | { action: 'delete_conflict' }
  | { action: 'blocked'; reason: string };

/** Decide cómo desvincular una semana antes de borrar su periodo (índice parcial sin periodo_id). */
export function resolveSemanaPeriodoDetachAction(input: {
  semanaTotalPagado: number;
  semanaRegistrosCount: number;
  hasNullPeriodConflict: boolean;
  conflictTotalPagado: number;
  conflictRegistrosCount: number;
  periodoTotalUsd?: number;
}): SemanaPeriodoDetachAction {
  if (!input.hasNullPeriodConflict) {
    return { action: 'nullify' };
  }

  // Periodo pendiente ($0): descartar la semana del ciclo y conservar la operativa.
  if (input.periodoTotalUsd !== undefined && input.periodoTotalUsd === 0) {
    return { action: 'delete_semana' };
  }

  const semanaEmpty =
    input.semanaTotalPagado === 0 && input.semanaRegistrosCount === 0;
  const conflictEmpty =
    input.conflictTotalPagado === 0 && input.conflictRegistrosCount === 0;

  if (semanaEmpty) {
    return { action: 'delete_semana' };
  }
  if (conflictEmpty) {
    return { action: 'delete_conflict' };
  }

  return {
    action: 'blocked',
    reason:
      'Hay dos semanas con la misma fecha y área (una operativa y otra del periodo). Resuelva el conflicto antes de eliminar el periodo.',
  };
}

/**
 * Desvincula semanas de un periodo antes de borrarlo, respetando
 * idx_nomina_semanas_sin_periodo_area_inicio (semana_inicio, area) WHERE periodo_id IS NULL.
 */
export async function prepareNominaSemanasForPeriodoDelete(
  supabase: SupabaseClient,
  periodoId: string,
  options?: { periodoTotalUsd?: number },
): Promise<{ error?: string }> {
  const { data: semanas, error: listError } = await supabase
    .from('nomina_semanas')
    .select('id, semana_inicio, area, total_pagado')
    .eq('periodo_id', periodoId);

  if (listError) return { error: listError.message };

  for (const semana of semanas ?? []) {
    const { data: conflict, error: conflictError } = await supabase
      .from('nomina_semanas')
      .select('id, total_pagado')
      .eq('semana_inicio', semana.semana_inicio)
      .eq('area', semana.area)
      .is('periodo_id', null)
      .neq('id', semana.id)
      .maybeSingle();

    if (conflictError) return { error: conflictError.message };

    const { count: semanaRegistrosCount, error: regCountError } = await supabase
      .from('nomina_registros')
      .select('id', { count: 'exact', head: true })
      .eq('semana_id', semana.id);

    if (regCountError) return { error: regCountError.message };

    let conflictRegistrosCount = 0;
    if (conflict?.id) {
      const { count, error: conflictRegError } = await supabase
        .from('nomina_registros')
        .select('id', { count: 'exact', head: true })
        .eq('semana_id', conflict.id);
      if (conflictRegError) return { error: conflictRegError.message };
      conflictRegistrosCount = count ?? 0;
    }

    const decision = resolveSemanaPeriodoDetachAction({
      semanaTotalPagado: Number(semana.total_pagado ?? 0),
      semanaRegistrosCount: semanaRegistrosCount ?? 0,
      hasNullPeriodConflict: Boolean(conflict?.id),
      conflictTotalPagado: Number(conflict?.total_pagado ?? 0),
      conflictRegistrosCount,
      periodoTotalUsd: options?.periodoTotalUsd,
    });

    if (decision.action === 'blocked') {
      return { error: decision.reason };
    }

    if (decision.action === 'delete_conflict' && conflict?.id) {
      const { error: delConflictError } = await supabase
        .from('nomina_semanas')
        .delete()
        .eq('id', conflict.id);
      if (delConflictError) return { error: delConflictError.message };
    }

    if (decision.action === 'delete_semana') {
      const { error: delSemanaError } = await supabase
        .from('nomina_semanas')
        .delete()
        .eq('id', semana.id);
      if (delSemanaError) return { error: delSemanaError.message };
      continue;
    }

    const { error: nullifyError } = await supabase
      .from('nomina_semanas')
      .update({ periodo_id: null })
      .eq('id', semana.id);
    if (nullifyError) return { error: nullifyError.message };
  }

  return {};
}

export async function refreshPeriodoTotalUsd(
  supabase: SupabaseClient,
  periodoId: string,
): Promise<void> {
  const { data: periodo } = await supabase
    .from('nomina_periodos')
    .select('metadata')
    .eq('id', periodoId)
    .maybeSingle();

  const periodoArea =
    periodo?.metadata && typeof periodo.metadata === 'object'
      ? String((periodo.metadata as Record<string, unknown>).area ?? '').trim()
      : '';

  const { data: links } = await supabase
    .from('nomina_periodo_semanas')
    .select('semana_id')
    .eq('periodo_id', periodoId);

  const semanaIds = (links ?? []).map((l) => l.semana_id).filter(Boolean);
  if (!semanaIds.length) {
    await supabase.from('nomina_periodos').update({ total_usd: 0 }).eq('id', periodoId);
    return;
  }

  let semanasQuery = supabase
    .from('nomina_semanas')
    .select('id, semana_inicio, semana_fin, area, total_pagado, periodo_id')
    .in('id', semanaIds);
  if (periodoArea) semanasQuery = semanasQuery.eq('area', periodoArea);

  const { data: semanas } = await semanasQuery;

  const totalUsd = aggregateNominaSemanas(
    (semanas ?? []).map((row) => ({
      id: row.id as string,
      semana_inicio: row.semana_inicio as string,
      semana_fin: (row.semana_fin as string) ?? (row.semana_inicio as string),
      area: row.area as string | null,
      total_pagado: row.total_pagado,
      periodo_id: row.periodo_id as string | null | undefined,
    })),
  ).totalUsd;

  await supabase.from('nomina_periodos').update({ total_usd: totalUsd }).eq('id', periodoId);
}

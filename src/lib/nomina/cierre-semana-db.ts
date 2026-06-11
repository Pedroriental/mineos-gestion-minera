import type { SupabaseClient } from '@supabase/supabase-js';

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

/** Busca o crea nomina_semanas sin depender de ON CONFLICT (índices parciales post-V6). */
export async function findOrCreateNominaSemanaForCierre(
  supabase: SupabaseClient,
  input: SemanaCierreInput,
): Promise<{ semanaId: string } | { error: string }> {
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
  const metaFilter = { area: input.area, source: 'vista_manual' };

  const { data: candidates, error: listError } = await supabase
    .from('nomina_periodos')
    .select('id, metadata')
    .eq('range_start', input.periodo.rangeStart)
    .eq('range_end', input.periodo.rangeEnd)
    .eq('origen', 'consolidacion_manual');

  if (listError) return { error: listError.message };

  const existing = (candidates ?? []).find(
    (row) =>
      row.metadata &&
      typeof row.metadata === 'object' &&
      (row.metadata as Record<string, unknown>).area === input.area &&
      (row.metadata as Record<string, unknown>).source === 'vista_manual',
  );

  if (existing?.id) return { periodoId: existing.id };

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

export async function linkSemanaToPeriodo(
  supabase: SupabaseClient,
  periodoId: string,
  semanaId: string,
): Promise<void> {
  await supabase
    .from('nomina_periodo_semanas')
    .upsert({ periodo_id: periodoId, semana_id: semanaId }, { onConflict: 'periodo_id,semana_id' });
}

export async function refreshPeriodoTotalUsd(
  supabase: SupabaseClient,
  periodoId: string,
): Promise<void> {
  const { data: links } = await supabase
    .from('nomina_periodo_semanas')
    .select('semana_id')
    .eq('periodo_id', periodoId);

  const semanaIds = (links ?? []).map((l) => l.semana_id).filter(Boolean);
  if (!semanaIds.length) return;

  const { data: semanas } = await supabase
    .from('nomina_semanas')
    .select('total_pagado')
    .in('id', semanaIds);

  const totalUsd = parseFloat(
    (semanas ?? []).reduce((s, row) => s + Number(row.total_pagado ?? 0), 0).toFixed(2),
  );

  await supabase.from('nomina_periodos').update({ total_usd: totalUsd }).eq('id', periodoId);
}

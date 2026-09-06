import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { isPersonalVisibleInNomina } from '@/lib/personal-master';
import { dedupeNominaSemanasForAggregation } from '@/lib/nomina/nomina-read-model';
import { mapPeriodoRow } from '@/lib/nomina/archive';
import { nominaPeriodoMatchesArea } from '@/lib/nomina-preview';
import type { NominaPeriodoSummary } from '@/lib/nomina/types';
import type { NominaRegistroCerrado } from '@/lib/nomina-preview';
import type { Personal } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface VistaPreviaParams {
  filterArea?: string;
  periodoId?: string;
  rangeStart?: string;
  rangeEnd?: string;
}

async function handleVistaPrevia(params: VistaPreviaParams) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { ok: false, message: 'Sesión no válida o expirada. Por favor recarga e inicia sesión.' },
        { status: 401 },
      );
    }

    const filterArea = params.filterArea || undefined;

    // 1. Listar períodos archivados para el área
    const { data: periodosData, error: pErr } = await supabase
      .from('nomina_periodos')
      .select(`
        id, label, range_start, range_end, total_usd, origen, metadata, created_at,
        nomina_periodo_semanas ( semana_id )
      `)
      .order('range_start', { ascending: false });

    if (pErr) {
      return NextResponse.json(
        { ok: false, message: `Error consultando períodos: ${pErr.message}` },
        { status: 500 },
      );
    }

    const allPeriodos: NominaPeriodoSummary[] = (periodosData || []).map((row: any) => {
      const semanaIds = row.nomina_periodo_semanas
        ?.map((link: { semana_id: string }) => link.semana_id)
        .filter((id: unknown): id is string => typeof id === 'string') ?? [];
      return mapPeriodoRow({
        ...row,
        semana_count: semanaIds.length,
        semana_ids: semanaIds,
      });
    });

    const scopedPeriodos = filterArea
      ? allPeriodos.filter((p) => nominaPeriodoMatchesArea(p, filterArea))
      : allPeriodos;

    // 2. Resolver el período a cargar
    let resolvedPeriodoId = params.periodoId;

    if (!resolvedPeriodoId && (params.rangeStart || params.rangeEnd)) {
      const start = params.rangeStart;
      const end = params.rangeEnd;

      // Coincidencia exacta
      const exact = scopedPeriodos.find(
        (p) => (!start || p.rangeStart === start) && (!end || p.rangeEnd === end),
      );
      if (exact) {
        resolvedPeriodoId = exact.id;
      } else if (start && end) {
        // Coincidencia de rango contenedor (ej. la semana cae dentro del ciclo de 3 semanas)
        const containing = scopedPeriodos.find(
          (p) => p.rangeStart <= start && p.rangeEnd >= end,
        );
        if (containing) {
          resolvedPeriodoId = containing.id;
        }
      }
    }

    // Si aún no se resuelve período y no hay rango, tomar el período más reciente con datos
    if (!resolvedPeriodoId && !params.rangeStart && !params.rangeEnd) {
      const latestPeriod = scopedPeriodos.find((p) => p.totalUsd > 0 || p.semanaCount > 0);
      if (latestPeriod) {
        resolvedPeriodoId = latestPeriod.id;
      }
    }

    // 3. Consultar semanas
    let semanasQuery = supabase
      .from('nomina_semanas')
      .select('id, semana_inicio, semana_fin, area, periodo_id')
      .order('semana_inicio', { ascending: false });

    if (filterArea) {
      semanasQuery = semanasQuery.eq('area', filterArea);
    }

    if (resolvedPeriodoId) {
      const { data: links } = await supabase
        .from('nomina_periodo_semanas')
        .select('semana_id')
        .eq('periodo_id', resolvedPeriodoId);
      const semanaIds = (links || []).map((l: { semana_id: string }) => l.semana_id);
      if (semanaIds.length > 0) {
        semanasQuery = semanasQuery.in('id', semanaIds);
      } else {
        semanasQuery = semanasQuery.eq('periodo_id', resolvedPeriodoId);
      }
    } else {
      semanasQuery = semanasQuery.neq('origen', 'import_historico');
      if (params.rangeStart) {
        semanasQuery = semanasQuery.gte('semana_inicio', params.rangeStart);
      }
      if (params.rangeEnd) {
        semanasQuery = semanasQuery.lte('semana_inicio', params.rangeEnd);
      }
      // Límite de seguridad para evitar transferir históricos masivos
      semanasQuery = semanasQuery.limit(12);
    }

    const { data: semanasRows, error: sErr } = await semanasQuery;
    if (sErr) {
      return NextResponse.json(
        { ok: false, message: `Error consultando semanas: ${sErr.message}` },
        { status: 500 },
      );
    }

    type SemanaRow = {
      id: string;
      semana_inicio: string;
      semana_fin?: string;
      area: string;
      periodo_id?: string | null;
    };
    const semanasTyped = (semanasRows || []) as SemanaRow[];

    const preferredSemanas = dedupeNominaSemanasForAggregation(semanasTyped, {
      activePeriodoId: resolvedPeriodoId,
    });
    const semanasCerradas = preferredSemanas.map((s) => ({
      semana_inicio: s.semana_inicio,
      semana_fin: s.semana_fin,
    }));

    const { count: totalRegistrosHistoricos } = await supabase
      .from('nomina_registros')
      .select('id', { count: 'exact', head: true });

    const semanaIds = preferredSemanas.map((s) => s.id);
    let registrosCerrados: NominaRegistroCerrado[] = [];
    const personalIdsFromRegistros = new Set<string>();

    if (semanaIds.length > 0) {
      const { data: regRows, error: rErr } = await supabase
        .from('nomina_registros')
        .select(
          'personal_id, monto_pagado, es_semana_libre, estado_asistencia, dias_trabajados, salario_base_calculado, novedad_turno, novedad_turno_obs, personal_snapshot, semana_id, periodo_id',
        )
        .in('semana_id', semanaIds);

      if (rErr) {
        return NextResponse.json(
          { ok: false, message: `Error consultando registros: ${rErr.message}` },
          { status: 500 },
        );
      }

      const semanaById = new Map(preferredSemanas.map((s) => [s.id, s]));

      registrosCerrados = (regRows || [])
        .map((r: any) => {
          personalIdsFromRegistros.add(r.personal_id);
          const sem = semanaById.get(r.semana_id);
          if (!sem) return null;
          return {
            personal_id: r.personal_id,
            semana_inicio: sem.semana_inicio,
            area: sem.area,
            monto_pagado: Number(r.monto_pagado),
            es_semana_libre: !!r.es_semana_libre,
            estado_asistencia: r.estado_asistencia as
              | 'trabajada'
              | 'libre'
              | 'no_laborado'
              | null
              | undefined,
            dias_trabajados: r.dias_trabajados,
            salario_base_calculado: r.salario_base_calculado,
            novedad_turno: r.novedad_turno,
            novedad_turno_obs: r.novedad_turno_obs,
            personal_snapshot: r.personal_snapshot ?? null,
            periodo_id: r.periodo_id ?? null,
          };
        })
        .filter(Boolean) as NominaRegistroCerrado[];

      const dedupMap = new Map<string, NominaRegistroCerrado>();
      const registroScore = (reg: NominaRegistroCerrado) =>
        (resolvedPeriodoId && reg.periodo_id === resolvedPeriodoId ? 8 : 0) +
        (reg.periodo_id ? 4 : 0) +
        (reg.personal_snapshot ? 2 : 0) +
        (Number(reg.monto_pagado) > 0 ? 1 : 0);

      for (const reg of registrosCerrados) {
        const key = `${reg.personal_id}|${reg.semana_inicio}|${reg.area}`;
        const existing = dedupMap.get(key);
        if (!existing || registroScore(reg) > registroScore(existing)) {
          dedupMap.set(key, reg);
        }
      }
      registrosCerrados = [...dedupMap.values()];
    }

    // 4. Personal
    const { data: personalRows, error: persErr } = await supabase
      .from('personal')
      .select('*')
      .in('area', ['mina', 'planta', 'administracion'])
      .order('nombre_completo');

    if (persErr) {
      return NextResponse.json(
        { ok: false, message: `Error consultando personal: ${persErr.message}` },
        { status: 500 },
      );
    }

    const allPersonal = (personalRows as Personal[]) || [];
    const activePersonal = allPersonal.filter((p) => isPersonalVisibleInNomina(p, p.area));

    const activeIds = new Set(activePersonal.map((p) => p.id));
    const missingIds = [...personalIdsFromRegistros].filter((id) => !activeIds.has(id));

    let historicalPersonal: Personal[] = [];
    if (missingIds.length > 0) {
      const { data: histRows } = await supabase
        .from('personal')
        .select('*')
        .in('id', missingIds);
      historicalPersonal = (histRows as Personal[]) || [];
    }

    const personal = [...activePersonal, ...historicalPersonal];

    // 5. Vales pendientes para los trabajadores en la vista previa
    const valesMap: Record<string, number> = {};
    try {
      const allPersonalIds = personal.map((p) => p.id);
      if (allPersonalIds.length > 0) {
        const { data: valesRows } = await supabase
          .from('nomina_vales')
          .select('personal_id, monto')
          .in('personal_id', allPersonalIds)
          .eq('estado', 'PENDIENTE');

        for (const v of valesRows || []) {
          if (v.personal_id) {
            valesMap[v.personal_id] = (valesMap[v.personal_id] || 0) + Number(v.monto || 0);
          }
        }
      }
    } catch (vErr) {
      console.warn('[API /api/nomina/vista-previa] Warning cargando vales:', vErr);
    }

    return NextResponse.json({
      ok: true,
      periodos: scopedPeriodos,
      activePeriodoId: resolvedPeriodoId ?? null,
      personal,
      registrosCerrados,
      semanasCerradas,
      totalRegistrosHistoricos: totalRegistrosHistoricos ?? registrosCerrados.length,
      valesMap,
    });
  } catch (err: any) {
    console.error('[API /api/nomina/vista-previa] Error:', err);
    return NextResponse.json(
      { ok: false, message: err?.message || 'Error interno al cargar la vista previa.' },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filterArea = searchParams.get('filterArea') || searchParams.get('area') || undefined;
  const periodoId = searchParams.get('periodoId') || undefined;
  const rangeStart = searchParams.get('rangeStart') || undefined;
  const rangeEnd = searchParams.get('rangeEnd') || undefined;

  return handleVistaPrevia({ filterArea, periodoId, rangeStart, rangeEnd });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const filterArea = body?.filterArea || body?.area || undefined;
  const periodoId = body?.periodoId || undefined;
  const rangeStart = body?.rangeStart || undefined;
  const rangeEnd = body?.rangeEnd || undefined;

  return handleVistaPrevia({ filterArea, periodoId, rangeStart, rangeEnd });
}

'use server';

import { createServerClient } from '@/lib/supabase-server';
import { isPersonalVisibleInNomina } from '@/lib/personal-master';
import type { NominaRegistroCerrado } from '@/lib/nomina-preview';
import type { Personal } from '@/lib/types';

export async function loadNominaVistaPreviaDataAction(options?: {
  rangeStart?: string;
  rangeEnd?: string;
  periodoId?: string;
}): Promise<{
  ok: boolean;
  personal: Personal[];
  registrosCerrados: NominaRegistroCerrado[];
  semanasCerradas: { semana_inicio: string; semana_fin?: string }[];
  totalRegistrosHistoricos: number;
  message?: string;
}> {
  try {
    const supabase = await createServerClient();

    let semanasQuery = supabase
      .from('nomina_semanas')
      .select('id, semana_inicio, semana_fin, area, periodo_id')
      .order('semana_inicio', { ascending: false });

    if (options?.periodoId) {
      // Filtrar semanas directamente por periodo_id (columna en nomina_semanas)
      // Esto es más eficiente y evita la join intermedia con nomina_periodo_semanas.
      // Fallback: si la semana tiene periodo_id NULL (datos antiguos), usamos la tabla join.
      const { data: links } = await supabase
        .from('nomina_periodo_semanas')
        .select('semana_id')
        .eq('periodo_id', options.periodoId);
      const semanaIds = (links || []).map((l: { semana_id: string }) => l.semana_id);
      if (semanaIds.length > 0) {
        semanasQuery = semanasQuery.in('id', semanaIds);
      } else {
        // Si no hay vínculos en la tabla join, buscamos por periodo_id directo
        semanasQuery = semanasQuery.eq('periodo_id', options.periodoId);
      }
    } else {
      // Modo «Semana en curso»: cargamos ÚNICAMENTE semanas activas (no históricas).
      // Las semanas de imports históricos se excluyen para evitar que se mezclen
      // con los registros activos e inflen los totales cuando el usuario cambia
      // el rango de fechas al de un periodo importado.
      semanasQuery = semanasQuery.neq('origen', 'import_historico');
      if (options?.rangeStart) {
        semanasQuery = semanasQuery.gte('semana_inicio', options.rangeStart);
      }
      if (options?.rangeEnd) {
        semanasQuery = semanasQuery.lte('semana_inicio', options.rangeEnd);
      }
    }

    const { data: semanasRows } = await semanasQuery;

    // Deduplicar semanasCerradas por (semana_inicio, area):
    // Cuando hay múltiples semanas con la misma fecha y área (de distintos periodos),
    // conservamos solo una por clave. Esto evita que la Vista Previa muestre columnas duplicadas.
    const semanasCerradasMap = new Map<string, { semana_inicio: string; semana_fin?: string }>();
    for (const s of (semanasRows || []) as { id: string; semana_inicio: string; semana_fin?: string; area: string }[]) {
      const key = `${s.semana_inicio}|${s.area}`;
      if (!semanasCerradasMap.has(key)) {
        semanasCerradasMap.set(key, { semana_inicio: s.semana_inicio, semana_fin: s.semana_fin });
      }
    }
    const semanasCerradas = [...semanasCerradasMap.values()];

    const { count: totalRegistrosHistoricos } = await supabase
      .from('nomina_registros')
      .select('id', { count: 'exact', head: true });

    const semanaIds = (semanasRows || []).map((s: { id: string }) => s.id);
    let registrosCerrados: NominaRegistroCerrado[] = [];
    const personalIdsFromRegistros = new Set<string>();

    if (semanaIds.length) {
      // IMPORTANTE: Filtramos SOLO por semana_id.
      // No filtramos por periodo_id en nomina_registros porque:
      //   1. El RPC antiguo no propagaba periodo_id a los registros (quedaba NULL).
      //   2. El filtro por semana_id ya garantiza que solo leemos registros del periodo correcto,
      //      porque las semanas ya fueron filtradas por periodo_id arriba.
      const regQuery = supabase
        .from('nomina_registros')
        .select(
          'personal_id, monto_pagado, es_semana_libre, estado_asistencia, dias_trabajados, salario_base_calculado, novedad_turno, novedad_turno_obs, personal_snapshot, semana_id, periodo_id',
        )
        .in('semana_id', semanaIds);

      const { data: regRows } = await regQuery;

      const semanaById = new Map(
        (semanasRows || []).map((s: { id: string; semana_inicio: string; area: string }) => [
          s.id,
          s,
        ]),
      );

      registrosCerrados = (regRows || [])
        .map(
          (r: {
            personal_id: string;
            monto_pagado: number;
            es_semana_libre: boolean;
            estado_asistencia?: string | null;
            dias_trabajados?: number | null;
            salario_base_calculado?: number | null;
            novedad_turno?: string | null;
            novedad_turno_obs?: string | null;
            personal_snapshot?: import('@/lib/nomina/types').PersonalSnapshot | null;
            semana_id: string;
            periodo_id?: string | null;
          }) => {
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
          },
        )
        .filter(Boolean) as NominaRegistroCerrado[];

      // Deduplicar por (personal_id, semana_inicio, area):
      // Si hay múltiples registros para el mismo trabajador + semana (de distintos periodos
      // importados que comparten fechas), conservamos solo uno.
      // Preferimos el que tenga periodo_id definido (import nuevo) sobre el que no tenga (import viejo).
      const dedupMap = new Map<string, NominaRegistroCerrado>();
      for (const reg of registrosCerrados) {
        const key = `${reg.personal_id}|${reg.semana_inicio}|${reg.area}`;
        const existing = dedupMap.get(key);
        if (!existing) {
          dedupMap.set(key, reg);
        } else {
          // Preferir el registro con periodo_id (más reciente / correcto)
          if (reg.periodo_id && !existing.periodo_id) {
            dedupMap.set(key, reg);
          }
        }
      }
      registrosCerrados = [...dedupMap.values()];
    }

    const { data: personalRows, error: pErr } = await supabase
      .from('personal')
      .select('*')
      .in('area', ['mina', 'planta', 'administracion'])
      .order('nombre_completo');

    if (pErr) {
      return {
        ok: false,
        personal: [],
        registrosCerrados: [],
        semanasCerradas: [],
        totalRegistrosHistoricos: 0,
        message: pErr.message,
      };
    }

    const allPersonal = (personalRows as Personal[]) || [];
    const activePersonal = allPersonal.filter((p) => isPersonalVisibleInNomina(p, p.area));

    const activeIds = new Set(activePersonal.map((p) => p.id));
    const missingIds = [...personalIdsFromRegistros].filter((id) => !activeIds.has(id));

    let historicalPersonal: Personal[] = [];
    if (missingIds.length) {
      const { data: histRows } = await supabase
        .from('personal')
        .select('*')
        .in('id', missingIds);
      historicalPersonal = (histRows as Personal[]) || [];
    }

    const personal = [...activePersonal, ...historicalPersonal];

    return {
      ok: true,
      personal,
      registrosCerrados,
      semanasCerradas,
      totalRegistrosHistoricos: totalRegistrosHistoricos ?? registrosCerrados.length,
    };
  } catch (e) {
    return {
      ok: false,
      personal: [],
      registrosCerrados: [],
      semanasCerradas: [],
      totalRegistrosHistoricos: 0,
      message: e instanceof Error ? e.message : 'Error al cargar vista previa',
    };
  }
}

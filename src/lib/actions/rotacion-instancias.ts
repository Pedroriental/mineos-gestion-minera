'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase-server';
import { listRotacionPlantillasAction } from '@/lib/actions/rotacion-plantillas';
import {
  buildInstanciaSnapshot,
  posicionEfectivaCuadrilla,
  posicionInicialCuadrilla,
  semanaAplicaInstanciaRotacion,
  type InstanciaActivaSnapshot,
} from '@/lib/rotacion-plantillas/projection';
import {
  avanzarPosicionCuadrilla,
  buildBalanceExportCuadrilla,
  calcularSubtotalesCuadrilla,
  retrocederPosicionCuadrilla,
  validarCierreRotacionInstancia,
  type CierreRotacionRow,
} from '@/lib/rotacion-plantillas/cierre-rotacion';
import { totalTrabajadoresPlantilla } from '@/lib/rotacion-plantillas/types';
import type { RotacionInstanciaSemana } from '@/lib/rotacion-plantillas/types';
import { periodoOperativoDesdeSemana } from '@/lib/rotacion-plantillas/period-scope';
import { isMissingRotacionTableError } from '@/lib/rotacion-plantillas/db-compat';

export type RotacionInstanciaActionResult =
  | { ok: true; message: string; data?: unknown }
  | { ok: false; message: string };

const REVALIDATE = ['/', '/admin/nomina', '/mina/nomina', '/planta/nomina'] as const;

function revalidateNomina() {
  REVALIDATE.forEach((p) => revalidatePath(p));
}

async function loadInstanciaSnapshotById(instanciaId: string): Promise<InstanciaActivaSnapshot | null> {
  try {
    const supabase = await createServerClient();

    const { data: instancia } = await supabase
      .from('rotacion_plantilla_instancias')
      .select('*')
      .eq('id', instanciaId)
      .maybeSingle();

    if (!instancia) return null;

    const { data: pRow } = await supabase
      .from('rotacion_plantillas')
      .select('area')
      .eq('id', instancia.plantilla_id)
      .maybeSingle();

    const plantillas = await listRotacionPlantillasAction(pRow?.area ?? 'mina');
    const plantilla = plantillas.find((p) => p.id === instancia.plantilla_id);
    if (!plantilla) return null;

    const [{ data: icRows }, { data: cuadrillasDb }] = await Promise.all([
      supabase.from('rotacion_instancia_cuadrillas').select('*').eq('instancia_id', instanciaId),
      supabase.from('rotacion_plantilla_cuadrillas').select('*').eq('plantilla_id', instancia.plantilla_id),
    ]);

    return buildInstanciaSnapshot(instancia, plantilla, icRows ?? [], cuadrillasDb ?? []);
  } catch (err) {
    console.error('[loadInstanciaSnapshotById] error:', err);
    return null;
  }
}

export async function getInstanciaActivaAction(area: string): Promise<InstanciaActivaSnapshot | null> {
  try {
    const supabase = await createServerClient();

    const { data: plantillas, error: pErr } = await supabase
      .from('rotacion_plantillas')
      .select('id')
      .eq('area', area)
      .eq('activo', true);

    if (pErr || !plantillas?.length) return null;

    const plantillaIds = plantillas.map((p) => p.id);

    const { data: instancia, error: iErr } = await supabase
      .from('rotacion_plantilla_instancias')
      .select('*')
      .in('plantilla_id', plantillaIds)
      .eq('estado', 'ACTIVA')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (iErr || !instancia) return null;

    return await loadInstanciaSnapshotById(instancia.id);
  } catch (err) {
    console.error('[getInstanciaActivaAction] error:', err);
    return null;
  }
}

export async function getEstadoCuadrillasAction(instanciaId: string) {
  const snapshot = await loadInstanciaSnapshotById(instanciaId);
  if (!snapshot) return null;

  const supabase = await createServerClient();
  const { data: historial } = await supabase
    .from('rotacion_instancia_semanas')
    .select('cuadrilla_id, orden, estado, semana_inicio, semana_fin, subtotal_usd')
    .eq('instancia_id', instanciaId);

  return {
    snapshot,
    historial: historial ?? [],
  };
}

export async function iniciarInstanciaRotacionAction(input: {
  plantillaId: string;
  fechaInicioCiclo: string;
  userId?: string;
  periodoOperativo?: { label: string; inicio: string; fin: string };
}): Promise<RotacionInstanciaActionResult> {
  const { plantillaId, fechaInicioCiclo, userId } = input;
  const periodo = input.periodoOperativo ?? periodoOperativoDesdeSemana(fechaInicioCiclo);

  const supabase = await createServerClient();

  const { data: plantillaRow } = await supabase
    .from('rotacion_plantillas')
    .select('area')
    .eq('id', plantillaId)
    .eq('activo', true)
    .maybeSingle();

  if (!plantillaRow) return { ok: false, message: 'Plantilla no encontrada.' };

  const plantillas = await listRotacionPlantillasAction(plantillaRow.area);
  const plantilla = plantillas.find((p) => p.id === plantillaId);
  if (!plantilla) return { ok: false, message: 'No se pudo cargar la plantilla.' };

  if (!plantilla.cuadrillas.length) {
    return { ok: false, message: 'La plantilla no tiene cuadrillas definidas.' };
  }

  if (totalTrabajadoresPlantilla(plantilla) === 0) {
    return { ok: false, message: 'Asigne al menos un trabajador a la plantilla antes de iniciar.' };
  }

  const { data: activas } = await supabase
    .from('rotacion_plantilla_instancias')
    .select('id, plantilla_id')
    .eq('estado', 'ACTIVA')
    .in(
      'plantilla_id',
      (await supabase.from('rotacion_plantillas').select('id').eq('area', plantillaRow.area)).data?.map(
        (p) => p.id,
      ) ?? [],
    );

  if (activas?.length) {
    await supabase
      .from('rotacion_plantilla_instancias')
      .update({ estado: 'CANCELADA', updated_at: new Date().toISOString() })
      .in(
        'id',
        activas.map((a) => a.id),
      );
  }

  const { data: instancia, error: instError } = await supabase
    .from('rotacion_plantilla_instancias')
    .insert({
      plantilla_id: plantillaId,
      fecha_inicio_ciclo: fechaInicioCiclo,
      estado: 'ACTIVA',
      semana_activa_orden: 0,
      creado_por: userId ?? null,
      periodo_operativo_label: periodo.label,
      periodo_operativo_inicio: periodo.inicio,
      periodo_operativo_fin: periodo.fin,
    })
    .select('id')
    .single();

  if (instError || !instancia) {
    return { ok: false, message: instError?.message ?? 'No se pudo crear la instancia.' };
  }

  const { data: cuadrillasDb, error: cuadrillasErr } = await supabase
    .from('rotacion_plantilla_cuadrillas')
    .select('id, desfase_inicial, modo_repeticion')
    .eq('plantilla_id', plantillaId)
    .order('orden');

  if (isMissingRotacionTableError(cuadrillasErr)) {
    await supabase.from('rotacion_plantilla_instancias').delete().eq('id', instancia.id);
    return {
      ok: false,
      message:
        'Falta la tabla rotacion_plantilla_cuadrillas. Ejecute: npm run supabase:migrate:rotacion',
    };
  }

  for (const cDb of cuadrillasDb ?? []) {
    const cuadrilla = plantilla.cuadrillas.find((c) => c.id === cDb.id);
    const totalSemanas = cuadrilla?.semanas.length ?? 1;
    const posicion = posicionInicialCuadrilla(cDb.desfase_inicial ?? 0, totalSemanas);

    await supabase.from('rotacion_instancia_cuadrillas').insert({
      instancia_id: instancia.id,
      cuadrilla_id: cDb.id,
      posicion_activa: posicion,
      estado: 'ACTIVA',
      ciclos_completados: 0,
    });
  }

  const personalIds = [...new Set(plantilla.cuadrillas.flatMap((c) => c.filas.map((f) => f.personalId)))];

  if (personalIds.length) {
    await supabase.from('personal').update({ rotacion_plantilla_id: null }).eq('rotacion_plantilla_id', plantillaId);
    await supabase
      .from('personal')
      .update({ rotacion_plantilla_id: plantillaId })
      .in('id', personalIds);
  }

  revalidateNomina();
  return {
    ok: true,
    message: `Ciclo iniciado: "${plantilla.nombre}" (${personalIds.length} trabajadores) · Periodo ${periodo.label}.`,
    data: { instanciaId: instancia.id },
  };
}

export async function cancelarInstanciaAction(
  instanciaId: string,
  limpiarPersonal = true,
): Promise<RotacionInstanciaActionResult> {
  const supabase = await createServerClient();

  const { data: instancia } = await supabase
    .from('rotacion_plantilla_instancias')
    .select('plantilla_id, estado')
    .eq('id', instanciaId)
    .maybeSingle();

  if (!instancia) return { ok: false, message: 'Instancia no encontrada.' };
  if (instancia.estado !== 'ACTIVA') return { ok: false, message: 'La instancia ya no está activa.' };

  await supabase
    .from('rotacion_plantilla_instancias')
    .update({ estado: 'CANCELADA', updated_at: new Date().toISOString() })
    .eq('id', instanciaId);

  if (limpiarPersonal) {
    await supabase
      .from('personal')
      .update({ rotacion_plantilla_id: null })
      .eq('rotacion_plantilla_id', instancia.plantilla_id);
  }

  revalidateNomina();
  return { ok: true, message: 'Instancia cancelada.' };
}

export async function validarCierreRotacionSemanalAction(input: {
  area: string;
  semanaInicio: string;
  semanaFin: string;
  rows: CierreRotacionRow[];
}): Promise<RotacionInstanciaActionResult> {
  const instancia = await getInstanciaActivaAction(input.area);
  if (!instancia) return { ok: true, message: 'Sin instancia de rotación activa.' };

  const supabase = await createServerClient();
  const { data: historial } = await supabase
    .from('rotacion_instancia_semanas')
    .select('instancia_id, cuadrilla_id, orden, estado, semana_inicio, semana_fin')
    .eq('instancia_id', instancia.id);

  const hoy = new Date().toISOString().split('T')[0];
  const v = validarCierreRotacionInstancia({
    instancia,
    rows: input.rows,
    semanaInicio: input.semanaInicio,
    semanaFin: input.semanaFin,
    hoy,
    historialInstancia: historial ?? [],
  });

  if (!v.ok) return { ok: false, message: v.message };

  return { ok: true, message: 'Cierre de rotación válido.' };
}

/** Hook post cierre nómina V3 — persiste auditoría por cuadrilla */
export async function procesarCierreRotacionNominaAction(input: {
  area: string;
  semanaId: string;
  semanaInicio: string;
  semanaFin: string;
  rows: CierreRotacionRow[];
  userId?: string;
}): Promise<RotacionInstanciaActionResult> {
  const instancia = await getInstanciaActivaAction(input.area);
  if (!instancia) return { ok: true, message: 'Sin instancia activa.' };
  if (!semanaAplicaInstanciaRotacion(input.semanaInicio, instancia)) {
    return { ok: true, message: 'Semana fuera del periodo operativo de plantilla.' };
  }

  const supabase = await createServerClient();
  const { data: historial } = await supabase
    .from('rotacion_instancia_semanas')
    .select('instancia_id, cuadrilla_id, orden, estado, semana_inicio, semana_fin')
    .eq('instancia_id', instancia.id);

  const hoy = new Date().toISOString().split('T')[0];
  const v = validarCierreRotacionInstancia({
    instancia,
    rows: input.rows,
    semanaInicio: input.semanaInicio,
    semanaFin: input.semanaFin,
    hoy,
    historialInstancia: historial ?? [],
  });
  if (!v.ok) return { ok: false, message: v.message };

  const personalIds = new Set(input.rows.map((r) => r.personalId));
  const cuadrillasActivas = instancia.cuadrillas.filter(
    (c) => c.estado === 'ACTIVA' && c.filas.some((f) => personalIds.has(f.personalId)),
  );

  for (const cuadrilla of cuadrillasActivas) {
    const posicion = posicionEfectivaCuadrilla(cuadrilla.semanas.length, cuadrilla.posicionActiva);
    const sub = calcularSubtotalesCuadrilla(cuadrilla, input.rows);

    const { data: plantillaSemana } = await supabase
      .from('rotacion_plantilla_semanas')
      .select('id')
      .eq('cuadrilla_id', cuadrilla.cuadrillaId)
      .eq('orden', posicion)
      .maybeSingle();

    if (!plantillaSemana?.id) continue;

    const balancePartial = buildBalanceExportCuadrilla({
      plantillaId: instancia.plantillaId,
      plantillaNombre: instancia.plantillaNombre,
      area: instancia.area,
      cuadrillaNombre: cuadrilla.cuadrillaNombre,
      semanasCerradas: [
        {
          orden: posicion,
          semanaInicio: input.semanaInicio,
          semanaFin: input.semanaFin,
          estado: 'CERRADA_AUDITADA',
          subtotalUsd: sub.subtotalUsd,
          subtotalDias: sub.subtotalDias,
          subtotalBonos: sub.subtotalBonos,
          trabajadoresCount: sub.trabajadoresCount,
          cuadrillaId: cuadrilla.cuadrillaId,
          cuadrillaNombre: cuadrilla.cuadrillaNombre,
        },
      ],
    });

    await supabase.from('rotacion_instancia_semanas').upsert(
      {
        instancia_id: instancia.id,
        cuadrilla_id: cuadrilla.cuadrillaId,
        instancia_cuadrilla_id: cuadrilla.id,
        plantilla_semana_id: plantillaSemana.id,
        nomina_semana_id: input.semanaId,
        orden: posicion,
        semana_inicio: input.semanaInicio,
        semana_fin: input.semanaFin,
        estado: 'CERRADA_AUDITADA',
        subtotal_usd: sub.subtotalUsd,
        subtotal_dias: sub.subtotalDias,
        subtotal_bonos: sub.subtotalBonos,
        trabajadores_count: sub.trabajadoresCount,
        cerrado_por: input.userId ?? null,
        cerrado_at: new Date().toISOString(),
        balance_export: balancePartial,
      },
      { onConflict: 'instancia_id,cuadrilla_id,orden' },
    );

    const { nextPosicion, cicloCompletado } = avanzarPosicionCuadrilla(
      cuadrilla.posicionActiva,
      cuadrilla.semanas.length,
    );

    const updateIc: Record<string, unknown> = {
      posicion_activa: nextPosicion,
      updated_at: new Date().toISOString(),
    };

    if (cicloCompletado) {
      updateIc.ciclos_completados = cuadrilla.ciclosCompletados + 1;
      if (cuadrilla.modoRepeticion === 'pausa') {
        updateIc.estado = 'COMPLETADA';
      }
    }

    await supabase.from('rotacion_instancia_cuadrillas').update(updateIc).eq('id', cuadrilla.id);
  }

  const { data: icEstados } = await supabase
    .from('rotacion_instancia_cuadrillas')
    .select('estado')
    .eq('instancia_id', instancia.id);

  const allDone = (icEstados ?? []).every((c) => c.estado === 'COMPLETADA');
  if (allDone && icEstados?.length) {
    await supabase
      .from('rotacion_plantilla_instancias')
      .update({ estado: 'COMPLETADA', updated_at: new Date().toISOString() })
      .eq('id', instancia.id);
  }

  revalidateNomina();
  return { ok: true, message: 'Rotación auditada por cuadrilla.' };
}

export async function revertirCierreRotacionNominaAction(
  semanaId: string,
): Promise<RotacionInstanciaActionResult> {
  const supabase = await createServerClient();

  const { data: instSemanas } = await supabase
    .from('rotacion_instancia_semanas')
    .select('*, instancia_cuadrilla_id, cuadrilla_id, instancia_id, orden')
    .eq('nomina_semana_id', semanaId)
    .eq('estado', 'CERRADA_AUDITADA');

  if (!instSemanas?.length) return { ok: true, message: 'Sin cierres de rotación vinculados.' };

  for (const is of instSemanas) {
    const { data: ic } = await supabase
      .from('rotacion_instancia_cuadrillas')
      .select('posicion_activa, ciclos_completados')
      .eq('id', is.instancia_cuadrilla_id)
      .maybeSingle();

    if (ic) {
      const { data: cuadrillaDb } = await supabase
        .from('rotacion_plantilla_cuadrillas')
        .select('id')
        .eq('id', is.cuadrilla_id)
        .maybeSingle();

      const { count } = await supabase
        .from('rotacion_plantilla_semanas')
        .select('id', { count: 'exact', head: true })
        .eq('cuadrilla_id', is.cuadrilla_id);

      const totalSemanas = count ?? 1;
      const prevPos = retrocederPosicionCuadrilla(ic.posicion_activa, totalSemanas);

      await supabase
        .from('rotacion_instancia_cuadrillas')
        .update({
          posicion_activa: prevPos,
          estado: 'ACTIVA',
          updated_at: new Date().toISOString(),
        })
        .eq('id', is.instancia_cuadrilla_id);
    }

    await supabase.from('rotacion_instancia_semanas').delete().eq('id', is.id);
  }

  const instanciaIds = [...new Set(instSemanas.map((s) => s.instancia_id))];
  for (const iid of instanciaIds) {
    await supabase
      .from('rotacion_plantilla_instancias')
      .update({ estado: 'ACTIVA', updated_at: new Date().toISOString() })
      .eq('id', iid)
      .eq('estado', 'COMPLETADA');
  }

  revalidateNomina();
  return { ok: true, message: 'Rotación revertida.' };
}

export async function exportarBalanceRotacionAction(
  instanciaId: string,
): Promise<RotacionInstanciaActionResult & { json?: string }> {
  const snapshot = await loadInstanciaSnapshotById(instanciaId);
  if (!snapshot) return { ok: false, message: 'Instancia no encontrada.' };

  const supabase = await createServerClient();
  const { data: semanas } = await supabase
    .from('rotacion_instancia_semanas')
    .select('*')
    .eq('instancia_id', instanciaId)
    .eq('estado', 'CERRADA_AUDITADA');

  const porCuadrilla = snapshot.cuadrillas.map((c) => {
    const cerradas: RotacionInstanciaSemana[] = (semanas ?? [])
      .filter((s) => s.cuadrilla_id === c.cuadrillaId)
      .map((s) => ({
        orden: s.orden,
        semanaInicio: s.semana_inicio,
        semanaFin: s.semana_fin,
        estado: s.estado,
        subtotalUsd: Number(s.subtotal_usd),
        subtotalDias: Number(s.subtotal_dias),
        subtotalBonos: Number(s.subtotal_bonos),
        trabajadoresCount: s.trabajadores_count,
        cuadrillaId: c.cuadrillaId,
        cuadrillaNombre: c.cuadrillaNombre,
      }));

    return buildBalanceExportCuadrilla({
      plantillaId: snapshot.plantillaId,
      plantillaNombre: snapshot.plantillaNombre,
      area: snapshot.area,
      cuadrillaNombre: c.cuadrillaNombre,
      semanasCerradas: cerradas,
    });
  });

  return {
    ok: true,
    message: 'Export generado.',
    json: JSON.stringify(
      {
        instanciaId,
        plantilla: snapshot.plantillaNombre,
        area: snapshot.area,
        cuadrillas: porCuadrilla,
        exportadoAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  };
}

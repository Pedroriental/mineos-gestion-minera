'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase-server';
import { normalizeColumnasVista } from '@/lib/rotacion-plantillas/columnas-vista';
import { validateSandbox, resolveCeldaEstatus, normalizeSandbox } from '@/lib/rotacion-plantillas/sandbox-state';
import type {
  RotacionCuadrilla,
  RotacionPlantillaSandbox,
  RotacionPlantillaRecord,
  RotacionSemanaColumn,
  RotacionTrabajadorFila,
  EstatusRotacionPlantilla,
} from '@/lib/rotacion-plantillas/types';
import { isMissingRotacionTableError } from '@/lib/rotacion-plantillas/db-compat';

export type RotacionPlantillaActionResult =
  | { ok: true; message: string; id?: string }
  | { ok: false; message: string };

const REVALIDATE = ['/', '/admin/nomina', '/mina/nomina', '/planta/nomina'] as const;

function revalidateNomina() {
  REVALIDATE.forEach((p) => revalidatePath(p));
}

function mapSemanaSaveError(message: string): string {
  if (
    message.includes('rotacion_plantilla_semanas_plantilla_id_orden_key') ||
    (message.includes('duplicate key') && message.includes('orden'))
  ) {
    return (
      'No se pudo guardar: la base de datos aún usa un índice antiguo de semanas ' +
      '(solo permite una cuadrilla). Ejecute en su PC: npm run supabase:migrate:rotacion'
    );
  }
  return message;
}

async function deletePlantillaCascade(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  plantillaId: string,
): Promise<void> {
  await supabase.from('rotacion_plantilla_asignaciones').delete().eq('plantilla_id', plantillaId);
  await supabase.from('rotacion_plantilla_semanas').delete().eq('plantilla_id', plantillaId);
  await supabase.from('rotacion_plantilla_cuadrillas').delete().eq('plantilla_id', plantillaId);
  await supabase.from('rotacion_plantillas').delete().eq('id', plantillaId);
}

type DbCuadrilla = {
  id: string;
  plantilla_id: string;
  nombre: string;
  asignacion_key: string | null;
  orden: number;
};

type DbSemana = {
  id: string;
  plantilla_id: string;
  cuadrilla_id: string | null;
  orden: number;
  nombre: string;
  estatus_default: string;
};

type DbAsignacion = {
  plantilla_id: string;
  personal_id: string;
  semana_id: string;
  cuadrilla_id: string | null;
  estatus_override: string | null;
};

function buildCuadrillasFromDb(
  cuadrillas: DbCuadrilla[],
  semanas: DbSemana[],
  asignaciones: DbAsignacion[],
): RotacionCuadrilla[] {
  return cuadrillas
    .sort((a, b) => a.orden - b.orden)
    .map((c) => {
      const pSemanas = semanas
        .filter((s) => s.cuadrilla_id === c.id)
        .sort((a, b) => a.orden - b.orden)
        .map(
          (s): RotacionSemanaColumn => ({
            id: s.id,
            nombre: s.nombre,
            orden: s.orden,
            estatusDefault: s.estatus_default as RotacionSemanaColumn['estatusDefault'],
          }),
        );

      const pAsig = asignaciones.filter((a) => a.cuadrilla_id === c.id);
      const personalIds = [...new Set(pAsig.map((a) => a.personal_id))];

      const filas: RotacionTrabajadorFila[] = personalIds.map((personalId) => {
        const celdas: Record<string, EstatusRotacionPlantilla | null> = {};
        pSemanas.forEach((sem) => {
          const a = pAsig.find((x) => x.personal_id === personalId && x.semana_id === sem.id);
          celdas[sem.id] = (a?.estatus_override as EstatusRotacionPlantilla | null) ?? null;
        });
        return {
          id: `f-${personalId}-${c.id}`,
          personalId,
          celdas,
        };
      });

      return {
        id: c.id,
        nombre: c.nombre,
        asignacionKey: c.asignacion_key ?? '',
        orden: c.orden,
        semanas: pSemanas,
        filas,
      };
    });
}

export type RotacionPlantillaListResult = {
  plantillas: RotacionPlantillaRecord[];
  migrationRequired: boolean;
};

export async function listRotacionPlantillasAction(area: string): Promise<RotacionPlantillaRecord[]> {
  const result = await listRotacionPlantillasWithMetaAction(area);
  return result.plantillas;
}

export async function listRotacionPlantillasWithMetaAction(
  area: string,
): Promise<RotacionPlantillaListResult> {
  const supabase = await createServerClient();
  const { data: plantillas } = await supabase
    .from('rotacion_plantillas')
    .select('*')
    .eq('area', area)
    .eq('activo', true)
    .order('nombre');

  if (!plantillas?.length) return { plantillas: [], migrationRequired: false };

  const ids = plantillas.map((p) => p.id);

  const cuadrillasRes = await supabase
    .from('rotacion_plantilla_cuadrillas')
    .select('*')
    .in('plantilla_id', ids)
    .order('orden');

  const migrationRequired = isMissingRotacionTableError(cuadrillasRes.error);

  const [{ data: semanas }, { data: asignaciones }] = await Promise.all([
    supabase.from('rotacion_plantilla_semanas').select('*').in('plantilla_id', ids).order('orden'),
    supabase.from('rotacion_plantilla_asignaciones').select('*').in('plantilla_id', ids),
  ]);

  const cuadrillas = migrationRequired ? [] : (cuadrillasRes.data ?? []);

  const plantillasBuilt = plantillas.map((p) => {
    const pCuadrillas = (cuadrillas ?? []).filter((c) => c.plantilla_id === p.id) as DbCuadrilla[];
    const pSemanas = (semanas ?? []).filter((s) => s.plantilla_id === p.id) as DbSemana[];
    const pAsig = (asignaciones ?? []).filter((a) => a.plantilla_id === p.id) as DbAsignacion[];

    let cuadrillasBuilt = buildCuadrillasFromDb(pCuadrillas, pSemanas, pAsig);

    // Legacy sin tabla cuadrillas: agrupar todo en General
    if (!cuadrillasBuilt.length && pSemanas.length) {
      cuadrillasBuilt = buildCuadrillasFromDb(
        [
          {
            id: `legacy-${p.id}`,
            plantilla_id: p.id,
            nombre: 'General',
            asignacion_key: null,
            orden: 0,
          },
        ],
        pSemanas.map((s) => ({ ...s, cuadrilla_id: `legacy-${p.id}` })),
        pAsig.map((a) => ({ ...a, cuadrilla_id: `legacy-${p.id}` })),
      );
    }

    return {
      id: p.id,
      nombre: p.nombre,
      descripcion: p.descripcion ?? '',
      area: p.area,
      activo: p.activo,
      created_at: p.created_at,
      updated_at: p.updated_at,
      columnasVista: normalizeColumnasVista(
        (p as { columnas_vista?: unknown }).columnas_vista,
      ),
      cuadrillas: cuadrillasBuilt,
    } as RotacionPlantillaRecord;
  });

  return { plantillas: plantillasBuilt, migrationRequired };
}

export async function saveRotacionPlantillaAction(
  sandboxInput: RotacionPlantillaSandbox,
  plantillaId?: string,
): Promise<RotacionPlantillaActionResult> {
  const sandbox = normalizeSandbox(sandboxInput, sandboxInput.area);
  const err = validateSandbox(sandbox);
  if (err) return { ok: false, message: err };

  const supabase = await createServerClient();
  const userId = (await supabase.auth.getUser()).data.user?.id ?? null;

  const { error: cuadrillasProbe } = await supabase
    .from('rotacion_plantilla_cuadrillas')
    .select('id')
    .limit(1);

  if (isMissingRotacionTableError(cuadrillasProbe)) {
    return {
      ok: false,
      message:
        'Falta la tabla rotacion_plantilla_cuadrillas. Ejecute: npm run supabase:migrate:rotacion',
    };
  }

  let id = plantillaId;
  const isNewPlantilla = !plantillaId;

  if (id) {
    const { data: instanciaActiva } = await supabase
      .from('rotacion_plantilla_instancias')
      .select('id')
      .eq('plantilla_id', id)
      .eq('estado', 'ACTIVA')
      .maybeSingle();

    if (instanciaActiva) {
      return {
        ok: false,
        message:
          'Hay un ciclo activo con esta plantilla. Cancele la instancia antes de modificar cuadrillas o semanas.',
      };
    }

    const { error } = await supabase
      .from('rotacion_plantillas')
      .update({
        nombre: sandbox.nombre.trim(),
        descripcion: sandbox.descripcion.trim() || null,
        columnas_vista: normalizeColumnasVista(sandbox.columnasVista),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (error) {
      if (error.message?.includes('columnas_vista')) {
        const { error: err2 } = await supabase
          .from('rotacion_plantillas')
          .update({
            nombre: sandbox.nombre.trim(),
            descripcion: sandbox.descripcion.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);
        if (err2) return { ok: false, message: err2.message };
      } else return { ok: false, message: error.message };
    }

    await supabase.from('rotacion_plantilla_asignaciones').delete().eq('plantilla_id', id);
    await supabase.from('rotacion_plantilla_semanas').delete().eq('plantilla_id', id);
    await supabase.from('rotacion_plantilla_cuadrillas').delete().eq('plantilla_id', id);
  } else {
    let data: { id: string } | null = null;
    let error: { message: string } | null = null;
    const insertBase = {
      nombre: sandbox.nombre.trim(),
      descripcion: sandbox.descripcion.trim() || null,
      area: sandbox.area,
      activo: true,
      creado_por: userId,
    };
    const withColumnas = await supabase
      .from('rotacion_plantillas')
      .insert({ ...insertBase, columnas_vista: normalizeColumnasVista(sandbox.columnasVista) })
      .select('id')
      .single();
    if (withColumnas.error?.message?.includes('columnas_vista')) {
      const fallback = await supabase.from('rotacion_plantillas').insert(insertBase).select('id').single();
      data = fallback.data;
      error = fallback.error;
    } else {
      data = withColumnas.data;
      error = withColumnas.error;
    }
    if (error || !data) {
      return { ok: false, message: mapSemanaSaveError(error?.message ?? 'No se pudo crear plantilla.') };
    }
    id = data.id;
  }

  for (const cuadrilla of sandbox.cuadrillas) {
    const { data: cuadrillaRow, error: cuadrillaError } = await supabase
      .from('rotacion_plantilla_cuadrillas')
      .insert({
        plantilla_id: id,
        nombre: cuadrilla.nombre.trim(),
        asignacion_key: cuadrilla.asignacionKey.trim() || null,
        orden: cuadrilla.orden,
      })
      .select('id')
      .single();

    if (cuadrillaError || !cuadrillaRow) {
      const message = mapSemanaSaveError(cuadrillaError?.message ?? 'Error guardando cuadrilla.');
      if (isNewPlantilla && id) await deletePlantillaCascade(supabase, id);
      return { ok: false, message };
    }

    const semanaIdMap = new Map<string, string>();

    for (const sem of cuadrilla.semanas) {
      const { data: inserted, error } = await supabase
        .from('rotacion_plantilla_semanas')
        .insert({
          plantilla_id: id,
          cuadrilla_id: cuadrillaRow.id,
          orden: sem.orden,
          nombre: sem.nombre.trim(),
          estatus_default: sem.estatusDefault,
        })
        .select('id')
        .single();
      if (error || !inserted) {
        const msg = mapSemanaSaveError(error?.message ?? 'Error guardando semanas.');
        if (isNewPlantilla && id) await deletePlantillaCascade(supabase, id);
        return { ok: false, message: msg };
      }
      semanaIdMap.set(sem.id, inserted.id);
    }

    const asignaciones: DbAsignacion[] = [];

    for (const fila of cuadrilla.filas) {
      for (const sem of cuadrilla.semanas) {
        const dbSemanaId = semanaIdMap.get(sem.id);
        if (!dbSemanaId) continue;
        const estatus = fila.celdas[sem.id];
        asignaciones.push({
          plantilla_id: id!,
          personal_id: fila.personalId,
          semana_id: dbSemanaId,
          cuadrilla_id: cuadrillaRow.id,
          estatus_override: estatus,
        });
      }
    }

    if (asignaciones.length) {
      const { error } = await supabase.from('rotacion_plantilla_asignaciones').insert(asignaciones);
      if (error) {
        if (isNewPlantilla && id) await deletePlantillaCascade(supabase, id);
        return { ok: false, message: error.message };
      }
    }
  }

  const personalIds = [...new Set(sandbox.cuadrillas.flatMap((c) => c.filas.map((f) => f.personalId)))];
  if (personalIds.length) {
    await supabase.from('personal').update({ rotacion_plantilla_id: null }).eq('rotacion_plantilla_id', id);
    await supabase.from('personal').update({ rotacion_plantilla_id: id }).in('id', personalIds);
  }

  revalidateNomina();
  return { ok: true, message: plantillaId ? 'Plantilla actualizada.' : 'Plantilla creada.', id };
}

export async function deleteRotacionPlantillaAction(id: string): Promise<RotacionPlantillaActionResult> {
  const supabase = await createServerClient();
  const { error } = await supabase.from('rotacion_plantillas').update({ activo: false }).eq('id', id);
  if (error) return { ok: false, message: error.message };
  revalidateNomina();
  return { ok: true, message: 'Plantilla desactivada.' };
}

export async function exportRotacionPlantillaJsonAction(
  sandboxInput: RotacionPlantillaSandbox,
): Promise<{ ok: true; json: string } | { ok: false; message: string }> {
  const sandbox = normalizeSandbox(sandboxInput, sandboxInput.area);
  const err = validateSandbox(sandbox);
  if (err) return { ok: false, message: err };

  const cuadrillas = sandbox.cuadrillas.map((c) => ({
    nombre: c.nombre,
    asignacionKey: c.asignacionKey,
    semanas: c.semanas.map((sem) => ({
      nombre: sem.nombre,
      estatusDefault: sem.estatusDefault,
    })),
    trabajadores: c.filas.map((fila) => ({
      personalId: fila.personalId,
      semanas: c.semanas.map((sem) => ({
        nombre: sem.nombre,
        estatus: resolveCeldaEstatus(fila, sem),
      })),
    })),
  }));

  return {
    ok: true,
    json: JSON.stringify(
      { meta: { nombre: sandbox.nombre, area: sandbox.area }, cuadrillas },
      null,
      2,
    ),
  };
}

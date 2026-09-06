'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase-server';
import {
  columnasVistaForCuadrilla,
  mergeSandboxColumnasVista,
  normalizeColumnasVista,
  type PlantillaColumnaKey,
} from '@/lib/rotacion-plantillas/columnas-vista';
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
export type { RotacionPlantillaListResult } from '@/lib/rotacion-plantillas/rotacion-data.server';
import {
  listRotacionPlantillasWithMetaData,
  listRotacionPlantillasData,
} from '@/lib/rotacion-plantillas/rotacion-data.server';

export type RotacionPlantillaActionResult =
  | { ok: true; message: string; id?: string }
  | { ok: false; message: string };

const REVALIDATE = ['/', '/admin/nomina', '/mina/nomina', '/planta/nomina'] as const;

function revalidateNomina() {
  REVALIDATE.forEach((p) => revalidatePath(p));
}

function mapSemanaSaveError(message: string): string {
  if (
    message.includes('rotacion_plantilla_semanas_estatus_default_check') ||
    message.includes('rotacion_plantilla_asignaciones_estatus_override_check')
  ) {
    return (
      'La base de datos aún no admite el estatus «Bono transporte». ' +
      'Ejecute en Supabase el SQL supabase/migration_rotacion_bono_transporte_estatus.sql ' +
      '(o npm run supabase:migrate:rotacion).'
    );
  }
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
  columnas_vista?: unknown;
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
  plantillaColumnas: PlantillaColumnaKey[],
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
        columnasVista: columnasVistaForCuadrilla(
          {
            columnasVista: Array.isArray(c.columnas_vista)
              ? normalizeColumnasVista(c.columnas_vista)
              : undefined,
          },
          plantillaColumnas,
        ),
      };
    });
}

async function updatePlantillaMeta(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  plantillaId: string,
  sandbox: RotacionPlantillaSandbox,
): Promise<RotacionPlantillaActionResult | null> {
  const plantillaColumnas = mergeSandboxColumnasVista(sandbox.cuadrillas, sandbox.columnasVista);
  const { error } = await supabase
    .from('rotacion_plantillas')
    .update({
      nombre: sandbox.nombre.trim(),
      descripcion: sandbox.descripcion.trim() || null,
      columnas_vista: plantillaColumnas,
      updated_at: new Date().toISOString(),
    })
    .eq('id', plantillaId);

  if (!error) return null;

  if (error.message?.includes('columnas_vista')) {
    const { error: err2 } = await supabase
      .from('rotacion_plantillas')
      .update({
        nombre: sandbox.nombre.trim(),
        descripcion: sandbox.descripcion.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', plantillaId);
    if (err2) return { ok: false, message: err2.message };
    return null;
  }

  return { ok: false, message: error.message };
}

async function updateCuadrillaRow(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  cuadrilla: RotacionCuadrilla,
  plantillaColumnas: PlantillaColumnaKey[],
): Promise<RotacionPlantillaActionResult | null> {
  const columnas = columnasVistaForCuadrilla(cuadrilla, plantillaColumnas);
  const base = {
    nombre: cuadrilla.nombre.trim(),
    asignacion_key: cuadrilla.asignacionKey.trim() || null,
    orden: cuadrilla.orden,
  };
  const { error } = await supabase
    .from('rotacion_plantilla_cuadrillas')
    .update({ ...base, columnas_vista: columnas })
    .eq('id', cuadrilla.id);

  if (!error) return null;

  if (error.message?.includes('columnas_vista')) {
    const { error: err2 } = await supabase
      .from('rotacion_plantilla_cuadrillas')
      .update(base)
      .eq('id', cuadrilla.id);
    if (err2) return { ok: false, message: err2.message };
    return null;
  }

  return { ok: false, message: error.message };
}

/** Actualiza meta/columnas/semanas sin borrar filas (evita 502 y FK RESTRICT). */
async function tryPatchPlantillaInPlace(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  plantillaId: string,
  sandbox: RotacionPlantillaSandbox,
): Promise<RotacionPlantillaActionResult | null> {
  const { data: existingCuadrillas, error: ecErr } = await supabase
    .from('rotacion_plantilla_cuadrillas')
    .select('id, orden')
    .eq('plantilla_id', plantillaId)
    .order('orden');

  if (ecErr || !existingCuadrillas?.length) return null;

  const sortedSandbox = [...sandbox.cuadrillas].sort((a, b) => a.orden - b.orden);
  if (sortedSandbox.length !== existingCuadrillas.length) return null;

  for (let i = 0; i < sortedSandbox.length; i++) {
    const sc = sortedSandbox[i];
    const ec = existingCuadrillas[i];
    if (!ec || sc.id !== ec.id || sc.orden !== ec.orden) return null;
  }

  const { data: existingSemanas, error: esErr } = await supabase
    .from('rotacion_plantilla_semanas')
    .select('id, cuadrilla_id, orden, estatus_default')
    .eq('plantilla_id', plantillaId)
    .order('orden');

  if (esErr) return null;

  for (const sc of sortedSandbox) {
    const sSemanas = [...sc.semanas].sort((a, b) => a.orden - b.orden);
    const eSemanas = (existingSemanas ?? [])
      .filter((s) => s.cuadrilla_id === sc.id)
      .sort((a, b) => a.orden - b.orden);
    if (sSemanas.length !== eSemanas.length) return null;
    for (let j = 0; j < sSemanas.length; j++) {
      if (sSemanas[j].id !== eSemanas[j].id) return null;
    }
  }

  const metaErr = await updatePlantillaMeta(supabase, plantillaId, sandbox);
  if (metaErr) return metaErr;

  const plantillaColumnas = mergeSandboxColumnasVista(sandbox.cuadrillas, sandbox.columnasVista);

  for (const sc of sortedSandbox) {
    const cuadrillaErr = await updateCuadrillaRow(supabase, sc, plantillaColumnas);
    if (cuadrillaErr) return cuadrillaErr;

    for (const sem of sc.semanas) {
      const { error } = await supabase
        .from('rotacion_plantilla_semanas')
        .update({
          nombre: sem.nombre.trim(),
          orden: sem.orden,
          estatus_default: sem.estatusDefault,
        })
        .eq('id', sem.id);
      if (error) return { ok: false, message: mapSemanaSaveError(error.message) };
    }
  }

  revalidateNomina();
  return { ok: true, message: 'Plantilla actualizada.', id: plantillaId };
}

export async function listRotacionPlantillasAction(area: string): Promise<RotacionPlantillaRecord[]> {
  return await listRotacionPlantillasData(area);
}

export async function listRotacionPlantillasWithMetaAction(
  area: string,
): Promise<RotacionPlantillaListResult> {
  return await listRotacionPlantillasWithMetaData(area);
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

    const patched = await tryPatchPlantillaInPlace(supabase, id, sandbox);
    if (patched) return patched;

    const metaErr = await updatePlantillaMeta(supabase, id, sandbox);
    if (metaErr) return metaErr;

    const { error: delAsig } = await supabase
      .from('rotacion_plantilla_asignaciones')
      .delete()
      .eq('plantilla_id', id);
    if (delAsig) return { ok: false, message: delAsig.message };

    const { error: delSem } = await supabase
      .from('rotacion_plantilla_semanas')
      .delete()
      .eq('plantilla_id', id);
    if (delSem) {
      return {
        ok: false,
        message:
          'No se puede reestructurar la plantilla: hay ciclos históricos vinculados a sus semanas. ' +
          'Cancele o archive instancias antes de cambiar cuadrillas o semanas.',
      };
    }

    const { error: delCuad } = await supabase
      .from('rotacion_plantilla_cuadrillas')
      .delete()
      .eq('plantilla_id', id);
    if (delCuad) return { ok: false, message: delCuad.message };
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
    const plantillaColumnas = mergeSandboxColumnasVista(sandbox.cuadrillas, sandbox.columnasVista);
    const withColumnas = await supabase
      .from('rotacion_plantillas')
      .insert({ ...insertBase, columnas_vista: plantillaColumnas })
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

  const plantillaColumnas = mergeSandboxColumnasVista(sandbox.cuadrillas, sandbox.columnasVista);

  for (const cuadrilla of sandbox.cuadrillas) {
    const columnas = columnasVistaForCuadrilla(cuadrilla, plantillaColumnas);
    const cuadrillaBase = {
      plantilla_id: id,
      nombre: cuadrilla.nombre.trim(),
      asignacion_key: cuadrilla.asignacionKey.trim() || null,
      orden: cuadrilla.orden,
    };
    let cuadrillaRow: { id: string } | null = null;
    let cuadrillaError: { message: string } | null = null;

    const withColumnas = await supabase
      .from('rotacion_plantilla_cuadrillas')
      .insert({ ...cuadrillaBase, columnas_vista: columnas })
      .select('id')
      .single();
    if (withColumnas.error?.message?.includes('columnas_vista')) {
      const fallback = await supabase
        .from('rotacion_plantilla_cuadrillas')
        .insert(cuadrillaBase)
        .select('id')
        .single();
      cuadrillaRow = fallback.data;
      cuadrillaError = fallback.error;
    } else {
      cuadrillaRow = withColumnas.data;
      cuadrillaError = withColumnas.error;
    }

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

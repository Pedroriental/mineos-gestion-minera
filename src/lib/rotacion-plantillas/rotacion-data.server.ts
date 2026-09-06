import { createServerClient } from '@/lib/supabase-server';
import {
  columnasVistaForCuadrilla,
  normalizeColumnasVista,
  type PlantillaColumnaKey,
} from '@/lib/rotacion-plantillas/columnas-vista';
import {
  buildInstanciaSnapshot,
  type InstanciaActivaSnapshot,
} from '@/lib/rotacion-plantillas/projection';
import type {
  RotacionCuadrilla,
  RotacionPlantillaRecord,
  RotacionSemanaColumn,
  RotacionTrabajadorFila,
  EstatusRotacionPlantilla,
} from '@/lib/rotacion-plantillas/types';
import { isMissingRotacionTableError } from '@/lib/rotacion-plantillas/db-compat';

export type DbCuadrilla = {
  id: string;
  plantilla_id: string;
  nombre: string;
  asignacion_key: string | null;
  orden: number;
  columnas_vista?: unknown;
};

export type DbSemana = {
  id: string;
  plantilla_id: string;
  cuadrilla_id: string | null;
  nombre: string;
  orden: number;
  estatus_default: string;
};

export type DbAsignacion = {
  plantilla_id: string;
  personal_id: string;
  semana_id: string;
  cuadrilla_id: string | null;
  estatus_override: string | null;
};

export function buildCuadrillasFromDb(
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

export type RotacionPlantillaListResult = {
  plantillas: RotacionPlantillaRecord[];
  migrationRequired: boolean;
};

export async function listRotacionPlantillasWithMetaData(
  area: string,
): Promise<RotacionPlantillaListResult> {
  try {
    const supabase = await createServerClient();
    const { data: plantillas, error: pErr } = await supabase
      .from('rotacion_plantillas')
      .select('*')
      .eq('area', area)
      .eq('activo', true)
      .order('nombre');

    if (pErr || !plantillas?.length) return { plantillas: [], migrationRequired: false };

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

      const plantillaColumnas = normalizeColumnasVista(
        (p as { columnas_vista?: unknown }).columnas_vista,
      );
      let cuadrillasBuilt = buildCuadrillasFromDb(pCuadrillas, pSemanas, pAsig, plantillaColumnas);

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
          plantillaColumnas,
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
  } catch (err) {
    console.error('[listRotacionPlantillasWithMetaData] error:', err);
    return { plantillas: [], migrationRequired: false };
  }
}

export async function listRotacionPlantillasData(area: string): Promise<RotacionPlantillaRecord[]> {
  const res = await listRotacionPlantillasWithMetaData(area);
  return res.plantillas;
}

export async function loadInstanciaSnapshotByIdData(
  instanciaId: string,
): Promise<InstanciaActivaSnapshot | null> {
  try {
    const supabase = await createServerClient();

    const { data: instancia, error: iErr } = await supabase
      .from('rotacion_plantilla_instancias')
      .select('*')
      .eq('id', instanciaId)
      .maybeSingle();

    if (iErr || !instancia) return null;

    const { data: pRow } = await supabase
      .from('rotacion_plantillas')
      .select('area')
      .eq('id', instancia.plantilla_id)
      .maybeSingle();

    const plantillas = await listRotacionPlantillasData(pRow?.area ?? 'mina');
    const plantilla = plantillas.find((p) => p.id === instancia.plantilla_id);
    if (!plantilla) return null;

    const [{ data: icRows }, { data: cuadrillasDb }] = await Promise.all([
      supabase.from('rotacion_instancia_cuadrillas').select('*').eq('instancia_id', instanciaId),
      supabase.from('rotacion_plantilla_cuadrillas').select('*').eq('plantilla_id', instancia.plantilla_id),
    ]);

    return buildInstanciaSnapshot(instancia, plantilla, icRows ?? [], cuadrillasDb ?? []);
  } catch (err) {
    console.error('[loadInstanciaSnapshotByIdData] error:', err);
    return null;
  }
}

export async function getInstanciaActivaData(area: string): Promise<InstanciaActivaSnapshot | null> {
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

    return await loadInstanciaSnapshotByIdData(instancia.id);
  } catch (err) {
    console.error('[getInstanciaActivaData] error:', err);
    return null;
  }
}

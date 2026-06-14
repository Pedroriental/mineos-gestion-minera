'use server';

import { createServerClient } from '@/lib/supabase-server';
import { PERSONAL_SYNC_PATHS } from '@/lib/personal-master';
import {
  AUTO_ROTACION_OBS,
  debeMarcarVacacionesPorRotacion,
  debeQuitarVacacionesAuto,
} from '@/lib/rotacion-personal';
import type { Personal } from '@/lib/types';
import { revalidatePath } from 'next/cache';

export type RotacionSyncResult =
  | { ok: true; message: string; vacaciones: number; reactivados: number }
  | { ok: false; message: string };

function revalidateAll() {
  PERSONAL_SYNC_PATHS.forEach((p) => revalidatePath(p));
}

/** Sincroniza VACACIONES automáticas según rotación y asignación a nómina mina/molino. */
export async function syncRotacionEstadosLaboralesAction(
  weekStart: string,
): Promise<RotacionSyncResult> {
  try {
    const supabase = await createServerClient();
    const { data: rows, error } = await supabase
      .from('personal')
      .select(
        'id, area, estado_laboral, activo, esquema_rotacion, rotacion_inicio_fecha, observacion_estado, estatus',
      );

    if (error) return { ok: false, message: error.message };
    const personal = (rows || []) as Personal[];

    let vacaciones = 0;
    let reactivados = 0;

    for (const p of personal) {
      if (debeMarcarVacacionesPorRotacion(p, weekStart)) {
        const { error: upErr } = await supabase
          .from('personal')
          .update({
            estado_laboral: 'VACACIONES',
            observacion_estado: `${AUTO_ROTACION_OBS} Semana libre de rotación sin asignación en nómina Mina/Molino.`,
            activo: true,
            estatus: 'INACTIVO',
          })
          .eq('id', p.id);
        if (!upErr) vacaciones += 1;
        continue;
      }

      if (debeQuitarVacacionesAuto(p, weekStart)) {
        const { error: upErr } = await supabase
          .from('personal')
          .update({
            estado_laboral: 'ACTIVO',
            observacion_estado: null,
            activo: true,
            estatus: 'ACTIVO',
          })
          .eq('id', p.id);
        if (!upErr) reactivados += 1;
      }
    }

    if (vacaciones > 0 || reactivados > 0) {
      revalidateAll();
    }
    return {
      ok: true,
      message: `Rotación aplicada: ${vacaciones} en vacaciones automáticas, ${reactivados} reactivados.`,
      vacaciones,
      reactivados,
    };
  } catch {
    return { ok: false, message: 'Error al sincronizar rotación.' };
  }
}

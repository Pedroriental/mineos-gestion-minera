'use server';

import { createServerClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { AcarreoSchema, AcarreoUpdateSchema } from '@/lib/validations/acarreo';
import type { ReporteAcarreo } from '@/lib/types';
import { assertBibliotecaValue } from '@/lib/validations/biblioteca';
import { REPORT_PHOTO_MAX_COUNT } from '@/lib/report-photo-constants';
import {
  parsePhotoFiles,
  parsePhotoKeepList,
  saveReportPhotos,
} from '@/lib/report-photo-upload';

const ACARREO_PATH = '/planta/acarreo';

function normalizeLineas(lineas: ReporteAcarreo['lineas']): ReporteAcarreo['lineas'] {
  return lineas.map((linea) => ({
    sacos: linea.sacos,
    vertical: linea.vertical?.trim() || undefined,
    disparo: linea.disparo?.trim() || undefined,
  }));
}

async function resolveFotosFromForm(formData: FormData): Promise<{ ok: true; fotos: string[] } | { ok: false; message: string }> {
  const keep = parsePhotoKeepList(formData.get('fotos_keep'));
  const newFiles = parsePhotoFiles(formData);

  if (keep.length + newFiles.length > REPORT_PHOTO_MAX_COUNT) {
    return { ok: false, message: `Máximo ${REPORT_PHOTO_MAX_COUNT} fotos por informe.` };
  }

  try {
    const uploaded = await saveReportPhotos(newFiles, 'acarreo', 'acarreo');
    return { ok: true, fotos: [...keep, ...uploaded] };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al subir fotos.';
    return { ok: false, message };
  }
}

function parsePayload(formData: FormData) {
  const raw = formData.get('payload');
  if (typeof raw !== 'string') {
    return { ok: false as const, message: 'Datos del formulario inválidos.' };
  }

  try {
    return { ok: true as const, data: JSON.parse(raw) as unknown };
  } catch {
    return { ok: false as const, message: 'Datos del formulario inválidos.' };
  }
}

export async function createAcarreoForm(formData: FormData) {
  try {
    const payloadParsed = parsePayload(formData);
    if (!payloadParsed.ok) return payloadParsed;

    const parsed = AcarreoSchema.safeParse(payloadParsed.data);
    if (!parsed.success) {
      const msg = Object.values(parsed.error.flatten().fieldErrors).flat()[0] ?? 'Datos inválidos';
      return { ok: false, message: msg, error: parsed.error };
    }

    const fotosResolved = await resolveFotosFromForm(formData);
    if (!fotosResolved.ok) return fotosResolved;

    const data = parsed.data;
    let validatedMina = data.mina;
    let validatedMolino = data.molino;
    try {
      validatedMina = await assertBibliotecaValue('minas', data.mina, 'Mina');
      validatedMolino = await assertBibliotecaValue('molinos', data.molino, 'Molino');
    } catch {
      // Permite valores fuera de biblioteca si assert falla en entornos sin catálogo cargado
    }

    const supabase = await createServerClient();
    const { error } = await supabase.from('reportes_acarreo').insert({
      ...data,
      mina: validatedMina,
      molino: validatedMolino,
      lineas: normalizeLineas(data.lineas),
      fotos: fotosResolved.fotos,
    });

    if (error) {
      console.error('Error creating acarreo:', error);
      return { ok: false, message: error.message, error };
    }

    revalidatePath(ACARREO_PATH);
    return { ok: true, message: 'Informe de acarreo registrado' };
  } catch (err) {
    console.error('Exception creating acarreo:', err);
    const message = err instanceof Error ? err.message : 'Error desconocido';
    return { ok: false, message };
  }
}

export async function updateAcarreoForm(formData: FormData) {
  try {
    const payloadParsed = parsePayload(formData);
    if (!payloadParsed.ok) return payloadParsed;

    const parsed = AcarreoUpdateSchema.safeParse(payloadParsed.data);
    if (!parsed.success) {
      const msg = Object.values(parsed.error.flatten().fieldErrors).flat()[0] ?? 'Datos inválidos';
      return { ok: false, message: msg, error: parsed.error };
    }

    const fotosResolved = await resolveFotosFromForm(formData);
    if (!fotosResolved.ok) return fotosResolved;

    const { id, registrado_por, ...rest } = parsed.data;
    let validatedMina = rest.mina;
    let validatedMolino = rest.molino;
    try {
      validatedMina = await assertBibliotecaValue('minas', rest.mina, 'Mina');
      validatedMolino = await assertBibliotecaValue('molinos', rest.molino, 'Molino');
    } catch {
      // keep original values
    }

    const supabase = await createServerClient();
    const { error } = await supabase
      .from('reportes_acarreo')
      .update({
        ...rest,
        mina: validatedMina,
        molino: validatedMolino,
        lineas: normalizeLineas(rest.lineas),
        fotos: fotosResolved.fotos,
      })
      .eq('id', id);

    if (error) {
      console.error('Error updating acarreo:', error);
      return { ok: false, message: error.message, error };
    }

    revalidatePath(ACARREO_PATH);
    return { ok: true, message: 'Informe de acarreo actualizado' };
  } catch (err) {
    console.error('Exception updating acarreo:', err);
    const message = err instanceof Error ? err.message : 'Error desconocido';
    return { ok: false, message };
  }
}

export async function deleteAcarreo(id: string) {
  try {
    const uuidParsed = z.string().uuid('ID inválido').safeParse(id);
    if (!uuidParsed.success) {
      return { ok: false, message: 'ID de reporte inválido' };
    }

    const supabase = await createServerClient();
    const { error } = await supabase.from('reportes_acarreo').delete().eq('id', id);

    if (error) {
      console.error('Error deleting acarreo:', error);
      return { ok: false, message: error.message, error };
    }

    revalidatePath(ACARREO_PATH);
    return { ok: true, message: 'Informe eliminado' };
  } catch (err) {
    console.error('Exception deleting acarreo:', err);
    const message = err instanceof Error ? err.message : 'Error desconocido';
    return { ok: false, message };
  }
}

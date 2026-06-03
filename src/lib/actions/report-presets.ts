'use server';

import { createServerClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';

// ============================================================
// MineOS - Server Actions: Report Presets
// ============================================================

export interface ReportPreset {
  id: string;
  user_id: string;
  name: string;
  description: string;
  payload: Record<string, unknown>;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export type ActionResult =
  | { ok: true; message: string; data?: ReportPreset | ReportPreset[] }
  | { ok: false; message: string };

export async function saveReportPreset(
  name: string,
  description: string,
  payload: Record<string, unknown>,
  isDefault = false,
): Promise<ActionResult> {
  try {
    const supabase = await createServerClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, message: 'No autenticado' };

    if (isDefault) {
      await supabase
        .from('report_presets')
        .update({ is_default: false })
        .eq('user_id', user.id);
    }

    const { data, error } = await supabase
      .from('report_presets')
      .insert({
        user_id: user.id,
        name,
        description,
        payload,
        is_default: isDefault,
      })
      .select()
      .single();

    if (error) throw error;

    revalidatePath('/reportes/constructor');
    return { ok: true, message: 'Preset guardado', data: data as ReportPreset };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al guardar preset';
    return { ok: false, message };
  }
}

export async function updateReportPreset(
  id: string,
  updates: { name?: string; description?: string; payload?: Record<string, unknown>; is_default?: boolean },
): Promise<ActionResult> {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, message: 'No autenticado' };

    if (updates.is_default) {
      await supabase
        .from('report_presets')
        .update({ is_default: false })
        .eq('user_id', user.id)
        .neq('id', id);
    }

    const updateData: Record<string, unknown> = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.payload !== undefined) updateData.payload = updates.payload;
    if (updates.is_default !== undefined) updateData.is_default = updates.is_default;

    const { data, error } = await supabase
      .from('report_presets')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;

    revalidatePath('/reportes/constructor');
    return { ok: true, message: 'Preset actualizado', data: data as ReportPreset };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al actualizar preset';
    return { ok: false, message };
  }
}

export async function loadReportPresets(): Promise<ActionResult> {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, message: 'No autenticado' };

    const { data, error } = await supabase
      .from('report_presets')
      .select('*')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
      .order('updated_at', { ascending: false });

    if (error) throw error;

    return { ok: true, message: 'Presets cargados', data: (data ?? []) as ReportPreset[] };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al cargar presets';
    return { ok: false, message };
  }
}

export async function loadReportPreset(id: string): Promise<ActionResult> {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, message: 'No autenticado' };

    const { data, error } = await supabase
      .from('report_presets')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error) throw error;

    return { ok: true, message: 'Preset cargado', data: data as ReportPreset };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al cargar preset';
    return { ok: false, message };
  }
}

export async function deleteReportPreset(id: string): Promise<ActionResult> {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, message: 'No autenticado' };

    const { error } = await supabase
      .from('report_presets')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;

    revalidatePath('/reportes/constructor');
    return { ok: true, message: 'Preset eliminado' };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al eliminar preset';
    return { ok: false, message };
  }
}

export async function setDefaultPreset(id: string): Promise<ActionResult> {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, message: 'No autenticado' };

    // Desmarcar todos los defaults del usuario
    await supabase
      .from('report_presets')
      .update({ is_default: false })
      .eq('user_id', user.id);

    // Marcar el nuevo default
    const { data, error } = await supabase
      .from('report_presets')
      .update({ is_default: true })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;

    revalidatePath('/reportes/constructor');
    return { ok: true, message: 'Preset por defecto actualizado', data: data as ReportPreset };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al marcar preset por defecto';
    return { ok: false, message };
  }
}

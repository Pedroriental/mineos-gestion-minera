'use server';

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase-server';
import { loadBibliotecaAppSnapshot } from '@/lib/biblioteca-catalog';
import { toUserFriendlyError } from '@/lib/app-toast';
import {
  ASIGNACION_NOMINA_OPCIONES,
  deriveAsignacionNominaFields,
  formatNombrePropio,
  isAsignacionNominaValid,
  PERSONAL_SYNC_PATHS,
} from '@/lib/personal-master';
import { assertBibliotecaValue } from '@/lib/validations/biblioteca';
import { tieneEsquemaConRotacion } from '@/lib/rotacion-personal';

export type RegistryActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

function revalidateAll() {
  PERSONAL_SYNC_PATHS.forEach((p) => revalidatePath(p));
}

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

async function saveOptionalFile(
  file: File | null,
  prefix: string,
): Promise<string | null> {
  if (!file || file.size <= 0) return null;
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`El archivo excede el límite de 5 MB (${(file.size / 1024 / 1024).toFixed(1)} MB).`);
  }
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Error(`Tipo de archivo no permitido: ${file.type || 'desconocido'}. Use imágenes o PDF.`);
  }
  const clean = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const ext = path.extname(clean) || '.bin';
  const fileName = `${prefix}_${randomUUID()}${ext}`;
  const relPath = path.join('uploads', 'personal', fileName);
  const absPath = path.join(process.cwd(), 'public', relPath);
  await mkdir(path.dirname(absPath), { recursive: true });
  const bytes = await file.arrayBuffer();
  await writeFile(absPath, Buffer.from(bytes));
  return `/${relPath.replace(/\\/g, '/')}`;
}

async function registrarTrabajadorAudit(
  accion: string,
  entidadId: string,
  detalle: string,
): Promise<void> {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase.from('nomina_audit_log').insert({
      accion,
      entidad: 'personal',
      entidad_id: entidadId,
      detalle,
      usuario_id: user?.id ?? null,
      usuario_nombre: user?.email ?? null,
    });
  } catch {
    console.error('[trabajadores-registry] audit failed:', accion, entidadId);
  }
}

export async function upsertTrabajadorRegistroAction(formData: FormData): Promise<RegistryActionResult> {
  try {
    const id = String(formData.get('id') ?? '').trim();
    const nombre = formatNombrePropio(String(formData.get('nombre_completo') ?? ''));
    const cedula = String(formData.get('cedula') ?? '').trim();
    const cargo = String(formData.get('cargo') ?? '').trim();
    const areaDetalle = String(formData.get('area_detalle') ?? '').trim();
    const ubicacionRaw = String(formData.get('ubicacion_laboral') ?? '').trim();
    const fechaNacimiento = String(formData.get('fecha_nacimiento') ?? '').trim();
    const fechaIngresoRaw = String(formData.get('fecha_ingreso') ?? '').trim();
    const ajusteAntiguedadRaw = String(formData.get('ajuste_antiguedad_dias') ?? '0').trim();
    const observacion = String(formData.get('notas') ?? '').trim();
    const area = (String(formData.get('area') ?? 'administracion').trim() || 'administracion') as
      | 'mina'
      | 'planta'
      | 'administracion'
      | 'seguridad'
      | 'transporte';
    const estadoLaboral = (String(formData.get('estado_laboral') ?? 'ACTIVO').trim() || 'ACTIVO') as
      | 'ACTIVO'
      | 'DESPEDIDO'
      | 'REPOSO'
      | 'VACACIONES'
      | 'REENGANCHADO';
    const observacionEstado = String(formData.get('observacion_estado') ?? '').trim();
    const estadoInicioFecha = String(formData.get('estado_inicio_fecha') ?? '').trim();
    const estadoFinFecha = String(formData.get('estado_fin_fecha') ?? '').trim();
    const estadoDuracionRaw = String(formData.get('estado_duracion_dias') ?? '').trim();
    const despidoFecha = String(formData.get('despido_fecha') ?? '').trim();
    const despidoCausa = String(formData.get('despido_causa') ?? '').trim();
    const reengancheFecha = String(formData.get('reenganche_fecha') ?? '').trim();
    const reengancheCargo = String(formData.get('reenganche_cargo') ?? '').trim();
    const reengancheObservacion = String(formData.get('reenganche_observacion') ?? '').trim();
    
    // Nuevos campos financieros
    const perfilCompensacionId = String(formData.get('perfil_compensacion_id') ?? '').trim();
    const salarioBaseRaw = String(formData.get('salario_base') ?? '').trim();
    const salarioLibreRaw = String(formData.get('salario_libre') ?? '').trim();
    const bonoTransporteRaw = String(formData.get('bono_transporte') ?? '').trim();
    const rotacionInicioRaw = String(formData.get('rotacion_inicio_fecha') ?? '').trim();

    if (!nombre || !cedula) {
      return { ok: false, message: 'Nombre y cédula son obligatorios.' };
    }

    if (!perfilCompensacionId) {
      return { ok: false, message: 'El perfil de compensación es obligatorio.' };
    }

    const ajusteAntiguedad = Number(ajusteAntiguedadRaw || '0');
    if (!Number.isFinite(ajusteAntiguedad) || ajusteAntiguedad < 0 || ajusteAntiguedad > 36500) {
      return { ok: false, message: 'Ajuste de antiguedad inválido.' };
    }
    const estadoDuracion = estadoDuracionRaw ? Number(estadoDuracionRaw) : null;
    if (estadoDuracion !== null && (!Number.isFinite(estadoDuracion) || estadoDuracion < 0 || estadoDuracion > 3650)) {
      return { ok: false, message: 'Duración de estado inválida.' };
    }
    if (estadoLaboral === 'DESPEDIDO' && !despidoFecha) {
      return { ok: false, message: 'Para despedido debes indicar la fecha de despido.' };
    }
    if (estadoLaboral === 'REENGANCHADO' && (!reengancheFecha || !reengancheCargo)) {
      return { ok: false, message: 'Para reenganchado debes indicar fecha de reintegro y cargo.' };
    }
    
    // Validar salario_base (obligatorio)
    const salarioBase = salarioBaseRaw ? Number(salarioBaseRaw) : null;
    if (salarioBase === null || !Number.isFinite(salarioBase) || salarioBase <= 0) {
      return { ok: false, message: 'El sueldo base semanal es obligatorio y debe ser mayor a 0.' };
    }

    const salarioLibre = salarioLibreRaw ? Number(salarioLibreRaw) : 0;
    if (!Number.isFinite(salarioLibre) || salarioLibre < 0) {
      return { ok: false, message: 'El sueldo libre debe ser un número válido.' };
    }
    
    // Validar bono_transporte (opcional)
    const bonoTransporte = bonoTransporteRaw ? Number(bonoTransporteRaw) : 0;
    if (!Number.isFinite(bonoTransporte) || bonoTransporte < 0) {
      return { ok: false, message: 'El bono de transporte debe ser un número válido.' };
    }

    const biblioteca = await loadBibliotecaAppSnapshot();

    try {
      await assertBibliotecaValue('areas_nomina', area, 'Área', biblioteca);
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : 'Área no válida.' };
    }

    if (areaDetalle && !isAsignacionNominaValid(areaDetalle, biblioteca)) {
      return {
        ok: false,
        message: `Asignación nómina inválida. Opciones: ${ASIGNACION_NOMINA_OPCIONES.join(', ')}.`,
      };
    }

    const supabase = await createServerClient();

    const { data: perfil, error: perfilError } = await supabase
      .from('perfiles_compensacion')
      .select('id, esquema_rotacion_default')
      .eq('id', perfilCompensacionId)
      .eq('activo', true)
      .maybeSingle();

    if (perfilError || !perfil) {
      return { ok: false, message: 'El perfil de compensación seleccionado no es válido.' };
    }

    const { data: existingByCedula } = await supabase
      .from('personal')
      .select('id')
      .eq('cedula', cedula)
      .maybeSingle();

    if (existingByCedula?.id) {
      if (!id) {
        return { ok: false, message: 'Ya existe un trabajador con esa cédula.' };
      }
      if (existingByCedula.id !== id) {
        return { ok: false, message: 'Ya existe otro trabajador con esa cédula.' };
      }
    }

    const targetId = id || undefined;

    let existingDoc: string | null = null;
    let existingFoto: string | null = null;
    let existingIngreso: string | null = null;
    if (targetId) {
      const { data: current } = await supabase
        .from('personal')
        .select('doc_cedula_url, foto_carnet_url, fecha_ingreso')
        .eq('id', targetId)
        .maybeSingle();
      existingDoc = (current?.doc_cedula_url as string | null) ?? null;
      existingFoto = (current?.foto_carnet_url as string | null) ?? null;
      existingIngreso = (current?.fecha_ingreso as string | null) ?? null;
    }

    let docCedulaUrl = existingDoc;
    let fotoCarnetUrl = existingFoto;
    try {
      const docCedulaFile = formData.get('doc_cedula') as File | null;
      const fotoCarnetFile = formData.get('foto_carnet') as File | null;
      docCedulaUrl = (await saveOptionalFile(docCedulaFile, 'cedula')) ?? existingDoc;
      fotoCarnetUrl = (await saveOptionalFile(fotoCarnetFile, 'carnet')) ?? existingFoto;
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : 'Error al subir archivo.' };
    }

    let resolvedAreaDetalle = areaDetalle;
    if (targetId && !resolvedAreaDetalle) {
      const { data: currentArea } = await supabase
        .from('personal')
        .select('area_detalle')
        .eq('id', targetId)
        .maybeSingle();
      resolvedAreaDetalle = String(currentArea?.area_detalle || '').trim();
    }

    const { vertical_asignada: verticalAsignada, grupo_turno: grupoTurno } =
      deriveAsignacionNominaFields(resolvedAreaDetalle);
    const esquemaRotacion = String(perfil.esquema_rotacion_default);
    const rotacionInicio =
      tieneEsquemaConRotacion(esquemaRotacion)
        ? rotacionInicioRaw || fechaIngresoRaw || existingIngreso || new Date().toISOString().split('T')[0]
        : null;

    const payloadBase = {
      cedula,
      nombre_completo: nombre,
      cargo: cargo || '',
      fecha_nacimiento: fechaNacimiento || null,
      area,
      area_detalle: resolvedAreaDetalle || null,
      vertical_asignada: verticalAsignada,
      grupo_turno: grupoTurno,
      ubicacion_laboral: ubicacionRaw || biblioteca.ubicacionDefaultPorArea[area] || null,
      notas: observacion || null,
      estado_laboral: estadoLaboral,
      observacion_estado: observacionEstado || null,
      estado_inicio_fecha: estadoInicioFecha || null,
      estado_fin_fecha: estadoFinFecha || null,
      estado_duracion_dias: estadoDuracion,
      despido_fecha: despidoFecha || null,
      despido_causa: despidoCausa || null,
      reenganche_fecha: reengancheFecha || null,
      reenganche_cargo: reengancheCargo || null,
      reenganche_observacion: reengancheObservacion || null,
      ajuste_antiguedad_dias: Math.floor(ajusteAntiguedad),
      doc_cedula_url: docCedulaUrl,
      foto_carnet_url: fotoCarnetUrl,
      activo: estadoLaboral === 'ACTIVO' || estadoLaboral === 'REENGANCHADO',
      estatus: estadoLaboral === 'DESPEDIDO' ? 'LIQUIDADO' : estadoLaboral === 'ACTIVO' || estadoLaboral === 'REENGANCHADO' ? 'ACTIVO' : 'INACTIVO',
      fecha_ingreso: fechaIngresoRaw || existingIngreso || new Date().toISOString().split('T')[0],
      // Nuevos campos financieros
      perfil_compensacion_id: perfilCompensacionId,
      salario_base: salarioBase,
      salario_libre: salarioLibre,
      bono_transporte: bonoTransporte,
      esquema_rotacion: esquemaRotacion,
      rotacion_inicio_fecha: rotacionInicio,
    };

    let error;
    if (targetId) {
      ({ error } = await supabase.from('personal').update(payloadBase).eq('id', targetId));
    } else {
      ({ error } = await supabase.from('personal').insert(payloadBase));
    }

    if (error) return { ok: false, message: toUserFriendlyError(error.message) };
    await registrarTrabajadorAudit(
      id ? 'EDITAR_TRABAJADOR_REGISTRO' : 'CREAR_TRABAJADOR_REGISTRO',
      targetId || cedula,
      `${nombre} — perfil/asignación/salario sincronizados desde Base de Trabajadores`,
    );
    revalidateAll();
    return { ok: true, message: id ? 'Trabajador actualizado.' : 'Trabajador registrado.' };
  } catch (e) {
    console.error('[trabajadores-registry] upsert error:', e);
    return { ok: false, message: 'No se pudo guardar el trabajador.' };
  }
}

export async function updateTrabajadorEstadoAction(raw: {
  id: string;
  estado_laboral: 'ACTIVO' | 'DESPEDIDO' | 'REPOSO' | 'VACACIONES' | 'REENGANCHADO';
  observacion_estado?: string;
  estado_inicio_fecha?: string;
  estado_fin_fecha?: string;
  estado_duracion_dias?: number | null;
  despido_fecha?: string;
  despido_causa?: string;
  reenganche_fecha?: string;
  reenganche_cargo?: string;
  reenganche_observacion?: string;
}): Promise<RegistryActionResult> {
  try {
    const supabase = await createServerClient();
    const { error } = await supabase
      .from('personal')
      .update({
        estado_laboral: raw.estado_laboral,
        observacion_estado: raw.observacion_estado || null,
        estado_inicio_fecha: raw.estado_inicio_fecha || null,
        estado_fin_fecha: raw.estado_fin_fecha || null,
        estado_duracion_dias: raw.estado_duracion_dias ?? null,
        despido_fecha: raw.estado_laboral === 'DESPEDIDO' ? (raw.despido_fecha || null) : null,
        despido_causa: raw.estado_laboral === 'DESPEDIDO' ? (raw.despido_causa || null) : null,
        reenganche_fecha: raw.estado_laboral === 'REENGANCHADO' ? (raw.reenganche_fecha || null) : null,
        reenganche_cargo: raw.estado_laboral === 'REENGANCHADO' ? (raw.reenganche_cargo || null) : null,
        reenganche_observacion: raw.estado_laboral === 'REENGANCHADO' ? (raw.reenganche_observacion || null) : null,
        activo: raw.estado_laboral === 'ACTIVO' || raw.estado_laboral === 'REENGANCHADO',
        estatus: raw.estado_laboral === 'DESPEDIDO' ? 'LIQUIDADO' : raw.estado_laboral === 'ACTIVO' || raw.estado_laboral === 'REENGANCHADO' ? 'ACTIVO' : 'INACTIVO',
      })
      .eq('id', raw.id);

    if (error) return { ok: false, message: toUserFriendlyError(error.message) };
    revalidateAll();
    return { ok: true, message: 'Estado actualizado.' };
  } catch (e) {
    console.error('[trabajadores-registry] update state error:', e);
    return { ok: false, message: 'No se pudo actualizar el estado.' };
  }
}

export async function bulkDeleteTrabajadoresAction(ids: string[]): Promise<RegistryActionResult> {
  try {
    if (!ids || ids.length === 0) {
      return { ok: false, message: 'No se seleccionaron trabajadores.' };
    }

    const uniqueIds = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
    if (uniqueIds.length === 0) {
      return { ok: false, message: 'No se seleccionaron trabajadores.' };
    }

    const supabase = await createServerClient();

    const { error } = await supabase.from('personal').delete().in('id', uniqueIds);

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('foreign key') || msg.includes('violates')) {
        return {
          ok: false,
          message:
            'No se pueden eliminar trabajadores con registros de nómina asociados. Ejecuta el script de limpieza o elimina sus registros primero.',
        };
      }
      return { ok: false, message: toUserFriendlyError(error.message) };
    }

    revalidateAll();
    return { ok: true, message: `${uniqueIds.length} trabajador(es) eliminado(s).` };
  } catch (e) {
    console.error('[trabajadores-registry] bulk delete error:', e);
    return { ok: false, message: 'No se pudieron eliminar los trabajadores.' };
  }
}

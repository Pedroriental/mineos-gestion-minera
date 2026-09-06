import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { CreateAndAssignPersonalNominaSchema } from '@/lib/validations/nomina-v3';
import { deriveAsignacionNominaFields, isAsignacionNominaValid } from '@/lib/personal-master';
import { loadBibliotecaAppSnapshot } from '@/lib/biblioteca-catalog';
import { tieneEsquemaConRotacion } from '@/lib/rotacion-personal';
import { fechaInicioRotacionDesdeEstadoObservado } from '@/lib/nomina/perfil-ciclo-reglas';
import type { Personal } from '@/lib/types';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = CreateAndAssignPersonalNominaSchema.safeParse(body);
    if (!parsed.success) {
      const errorMsg =
        Object.values(parsed.error.flatten().fieldErrors).flat()[0] ?? 'Datos inválidos';
      return NextResponse.json({ ok: false, message: errorMsg }, { status: 400 });
    }

    const data = parsed.data;
    const areaDetalle = data.areaDetalle.trim();
    const supabase = await createServerClient();
    const hoy = new Date().toISOString().split('T')[0];

    try {
      const biblioteca = await loadBibliotecaAppSnapshot();
      if (!isAsignacionNominaValid(areaDetalle, biblioteca) && areaDetalle.length < 2) {
        return NextResponse.json(
          { ok: false, message: 'La asignación nómina no es válida.' },
          { status: 400 },
        );
      }
    } catch (bibErr) {
      console.warn('[create-worker] biblioteca snapshot warning:', bibErr);
    }

    const { data: perfil, error: perfilError } = await supabase
      .from('perfiles_compensacion')
      .select('esquema_rotacion_default')
      .eq('id', data.perfil_compensacion_id)
      .eq('activo', true)
      .maybeSingle();

    if (perfilError || !perfil) {
      return NextResponse.json(
        { ok: false, message: 'El perfil de compensación seleccionado no es válido.' },
        { status: 400 },
      );
    }

    const esquemaDefault = String(perfil.esquema_rotacion_default);
    const asignacionFields = deriveAsignacionNominaFields(areaDetalle);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    let complexId = (user?.user_metadata?.complex_id as string | null) ?? null;
    if (!complexId && user?.id) {
      const { data: prof } = await supabase
        .from('user_profiles')
        .select('complex_id')
        .eq('id', user.id)
        .maybeSingle();
      complexId = prof?.complex_id ?? null;
    }
    if (!complexId) {
      const { data: c } = await supabase
        .from('complexes')
        .select('id')
        .eq('active', true)
        .limit(1)
        .maybeSingle();
      complexId = c?.id ?? '86ef53c0-25d4-499e-9691-e572693cda74';
    }

    const payload: Record<string, unknown> = {
      complex_id: complexId,
      cedula: data.cedula.trim(),
      nombre_completo: data.nombre_completo.trim(),
      cargo: data.cargo.trim() || 'General',
      area: data.targetArea,
      area_detalle: areaDetalle,
      vertical_asignada: asignacionFields.vertical_asignada,
      grupo_turno: asignacionFields.grupo_turno,
      perfil_compensacion_id: data.perfil_compensacion_id,
      salario_base: data.salario_base,
      salario_libre: data.salario_libre ?? 0,
      bono_transporte: data.bono_transporte ?? 0,
      esquema_rotacion: esquemaDefault,
      estado_laboral: 'ACTIVO',
      activo: true,
      estatus: 'ACTIVO',
      fecha_nacimiento: data.fecha_nacimiento || null,
      fecha_ingreso: data.fecha_ingreso || hoy,
      ajuste_antiguedad_dias: data.ajuste_antiguedad_dias ?? 0,
      ubicacion_laboral: data.ubicacion_laboral?.trim() || null,
      notas: data.notas?.trim() || null,
    };

    if (tieneEsquemaConRotacion(esquemaDefault)) {
      const rotacionInicioDeducida =
        data.rotacion_estado_referencia_semana && data.rotacion_estado_referencia_posicion !== null
          ? fechaInicioRotacionDesdeEstadoObservado(
              data.rotacion_estado_referencia_semana,
              esquemaDefault,
              data.rotacion_estado_referencia_posicion,
            )
          : null;
      payload.rotacion_inicio_fecha = rotacionInicioDeducida || data.rotacion_inicio_fecha || hoy;
    }

    const { data: inserted, error: insertError } = await supabase
      .from('personal')
      .insert(payload)
      .select('id')
      .single();

    if (insertError) {
      console.error('[create-worker] insert error:', insertError);
      return NextResponse.json({ ok: false, message: insertError.message }, { status: 400 });
    }

    const createdPersonal: Personal = {
      id: inserted.id,
      complex_id: complexId,
      ...payload,
    } as Personal;

    return NextResponse.json({
      ok: true,
      message: `${data.nombre_completo.trim()} registrado y asignado a esta nómina.`,
      personalId: inserted.id,
      data: { personalId: inserted.id, personal: createdPersonal },
    });
  } catch (error: any) {
    console.error('[create-worker] fatal error:', error);
    return NextResponse.json(
      { ok: false, message: error?.message || 'Error interno del servidor al crear trabajador.' },
      { status: 500 },
    );
  }
}

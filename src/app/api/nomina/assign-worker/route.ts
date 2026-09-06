import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { AssignToNominaAreaSchema } from '@/lib/validations/nomina-v3';
import { deriveAsignacionNominaFields, isAsignacionNominaValid } from '@/lib/personal-master';
import { loadBibliotecaAppSnapshot } from '@/lib/biblioteca-catalog';
import { AUTO_ROTACION_OBS, tieneEsquemaConRotacion } from '@/lib/rotacion-personal';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = AssignToNominaAreaSchema.safeParse(body);
    if (!parsed.success) {
      const errorMsg =
        Object.values(parsed.error.flatten().fieldErrors).flat()[0] ?? 'Datos inválidos';
      return NextResponse.json({ ok: false, message: errorMsg }, { status: 400 });
    }

    const data = parsed.data;
    const supabase = await createServerClient();

    const { data: row, error: fetchError } = await supabase
      .from('personal')
      .select('*')
      .eq('id', data.personalId)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json({ ok: false, message: fetchError.message }, { status: 400 });
    }
    if (!row) {
      return NextResponse.json(
        { ok: false, message: 'Trabajador no encontrado en la base.' },
        { status: 404 },
      );
    }

    const rawDetalle = (data.areaDetalle || String(row.area_detalle || '')).trim();
    if (!rawDetalle) {
      return NextResponse.json(
        { ok: false, message: 'La asignación nómina es obligatoria.' },
        { status: 400 },
      );
    }

    try {
      const biblioteca = await loadBibliotecaAppSnapshot();
      if (!isAsignacionNominaValid(rawDetalle, biblioteca) && rawDetalle.length < 2) {
        return NextResponse.json(
          { ok: false, message: 'La asignación nómina no es válida.' },
          { status: 400 },
        );
      }
    } catch (bibErr) {
      console.warn('[assign-worker] biblioteca snapshot warning:', bibErr);
    }

    const areaDetalle = rawDetalle;
    const estadoActual = String(row.estado_laboral || 'ACTIVO');
    const asignacionFields = deriveAsignacionNominaFields(areaDetalle);

    const payload: Record<string, unknown> = {
      area: data.targetArea,
      area_detalle: areaDetalle,
      vertical_asignada: asignacionFields.vertical_asignada,
      grupo_turno: asignacionFields.grupo_turno,
      activo: true,
      estatus: 'ACTIVO',
    };

    if (estadoActual === 'DESPEDIDO') {
      payload.estado_laboral = 'REENGANCHADO';
      payload.reenganche_fecha = new Date().toISOString().split('T')[0];
      payload.reenganche_cargo = row.cargo;
      payload.reenganche_observacion = 'Reasignado desde nómina.';
      payload.despido_fecha = null;
      payload.despido_causa = null;
    } else if (
      estadoActual === 'VACACIONES' &&
      String(row.observacion_estado || '').startsWith(AUTO_ROTACION_OBS)
    ) {
      payload.estado_laboral = 'ACTIVO';
      payload.observacion_estado = null;
    } else if (estadoActual === 'INACTIVO' || estadoActual === 'VACACIONES') {
      payload.estado_laboral = 'ACTIVO';
      if (String(row.observacion_estado || '').startsWith(AUTO_ROTACION_OBS)) {
        payload.observacion_estado = null;
      }
    } else if (estadoActual === 'ACTIVO' || estadoActual === 'REENGANCHADO') {
      payload.estado_laboral = estadoActual;
    }

    const esquemaActual = String(row.esquema_rotacion || '');
    let esquemaFinal = esquemaActual;
    if (row.perfil_compensacion_id) {
      const { data: perfil } = await supabase
        .from('perfiles_compensacion')
        .select('esquema_rotacion_default')
        .eq('id', row.perfil_compensacion_id)
        .eq('activo', true)
        .maybeSingle();
      if (perfil?.esquema_rotacion_default) {
        esquemaFinal = String(perfil.esquema_rotacion_default);
        if (esquemaFinal !== esquemaActual) {
          payload.esquema_rotacion = esquemaFinal;
        }
      }
    }
    if (!esquemaFinal) {
      esquemaFinal = 'MINA_2X1';
      payload.esquema_rotacion = esquemaFinal;
    }
    if (tieneEsquemaConRotacion(esquemaFinal) && !row.rotacion_inicio_fecha) {
      payload.rotacion_inicio_fecha = new Date().toISOString().split('T')[0];
    }
    if (!tieneEsquemaConRotacion(esquemaFinal) && row.rotacion_inicio_fecha) {
      payload.rotacion_inicio_fecha = null;
    }

    const { error: updateError } = await supabase
      .from('personal')
      .update(payload)
      .eq('id', data.personalId);

    if (updateError) {
      console.error('[assign-worker] update error:', updateError);
      return NextResponse.json({ ok: false, message: updateError.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      message: `${row.nombre_completo} asignado a esta nómina.`,
    });
  } catch (error: any) {
    console.error('[assign-worker] fatal error:', error);
    return NextResponse.json(
      { ok: false, message: error?.message || 'Error interno del servidor al asignar trabajador.' },
      { status: 500 },
    );
  }
}

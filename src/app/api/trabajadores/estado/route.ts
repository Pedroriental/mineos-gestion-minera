import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export async function POST(req: Request) {
  try {
    const raw = await req.json();
    const id = String(raw.id ?? '').trim();
    if (!id) {
      return NextResponse.json({ ok: false, message: 'ID de trabajador requerido.' }, { status: 400 });
    }

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
      .eq('id', id);

    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('nomina_audit_log').insert({
        accion: 'ACTUALIZAR_ESTADO_TRABAJADOR',
        entidad: 'personal',
        entidad_id: id,
        detalle: `Estado cambiado a ${raw.estado_laboral}`,
        usuario_id: user?.id ?? null,
        usuario_nombre: user?.email ?? null,
      });
    } catch {}

    return NextResponse.json({ ok: true, message: 'Estado actualizado exitosamente.' });
  } catch (err: any) {
    console.error('[/api/trabajadores/estado] Error:', err);
    return NextResponse.json({ ok: false, message: err?.message || 'Error al actualizar estado' }, { status: 500 });
  }
}

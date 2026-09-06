import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { loadBibliotecaAppSnapshot } from '@/lib/biblioteca-catalog';
import {
  ASIGNACION_NOMINA_OPCIONES,
  deriveAsignacionNominaFields,
  formatNombrePropio,
  isAsignacionNominaValid,
} from '@/lib/personal-master';
import { assertBibliotecaValue } from '@/lib/validations/biblioteca';
import { tieneEsquemaConRotacion } from '@/lib/rotacion-personal';
import { fechaInicioRotacionDesdeEstadoObservado } from '@/lib/nomina/perfil-ciclo-reglas';
import { normalizeCuadrilla } from '@/lib/validations/trabajadores-cuadrilla';

export async function POST(req: Request) {
  try {
    let data: Record<string, any> = {};
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      formData.forEach((value, key) => {
        data[key] = value;
      });
    } else {
      data = await req.json();
    }

    const id = String(data.id ?? '').trim();
    const nombre = formatNombrePropio(String(data.nombre_completo ?? ''));
    const cedula = String(data.cedula ?? '').trim();
    const cargo = String(data.cargo ?? '').trim();
    const areaDetalle = String(data.area_detalle ?? '').trim();
    const ubicacionRaw = String(data.ubicacion_laboral ?? '').trim();
    const fechaNacimiento = String(data.fecha_nacimiento ?? '').trim();
    const fechaIngresoRaw = String(data.fecha_ingreso ?? '').trim();
    const ajusteAntiguedadRaw = String(data.ajuste_antiguedad_dias ?? '0').trim();
    const observacion = String(data.notas ?? '').trim();
    const area = (String(data.area ?? 'administracion').trim() || 'administracion') as
      | 'mina'
      | 'planta'
      | 'administracion'
      | 'seguridad'
      | 'transporte';
    const estadoLaboral = (String(data.estado_laboral ?? 'ACTIVO').trim() || 'ACTIVO');
    const observacionEstado = String(data.observacion_estado ?? '').trim();
    const estadoInicioFecha = String(data.estado_inicio_fecha ?? '').trim();
    const estadoFinFecha = String(data.estado_fin_fecha ?? '').trim();
    const estadoDuracionRaw = String(data.estado_duracion_dias ?? '').trim();
    const despidoFecha = String(data.despido_fecha ?? '').trim();
    const despidoCausa = String(data.despido_causa ?? '').trim();
    const reengancheFecha = String(data.reenganche_fecha ?? '').trim();
    const reengancheCargo = String(data.reenganche_cargo ?? '').trim();
    const reengancheObservacion = String(data.reenganche_observacion ?? '').trim();

    // Campos financieros
    const perfilCompensacionId = String(data.perfil_compensacion_id ?? '').trim();
    const salarioBaseRaw = String(data.salario_base ?? '').trim();
    const salarioLibreRaw = String(data.salario_libre ?? '').trim();
    const bonoTransporteRaw = String(data.bono_transporte ?? '').trim();
    const rotacionInicioRaw = String(data.rotacion_inicio_fecha ?? '').trim();
    const rotacionReferenciaSemana = String(data.rotacion_estado_referencia_semana ?? '').trim();
    const rotacionReferenciaPosicionRaw = String(data.rotacion_estado_referencia_posicion ?? '').trim();

    if (!nombre || !cedula) {
      return NextResponse.json({ ok: false, message: 'Nombre y cédula son obligatorios.' }, { status: 400 });
    }

    if (!perfilCompensacionId) {
      return NextResponse.json({ ok: false, message: 'El perfil de compensación es obligatorio.' }, { status: 400 });
    }

    const ajusteAntiguedad = Number(ajusteAntiguedadRaw || '0');
    if (!Number.isFinite(ajusteAntiguedad) || ajusteAntiguedad < 0 || ajusteAntiguedad > 36500) {
      return NextResponse.json({ ok: false, message: 'Ajuste de antigüedad inválido.' }, { status: 400 });
    }

    const estadoDuracion = estadoDuracionRaw ? Number(estadoDuracionRaw) : null;
    if (estadoLaboral === 'DESPEDIDO' && !despidoFecha) {
      return NextResponse.json({ ok: false, message: 'Para despedido debes indicar la fecha de despido.' }, { status: 400 });
    }
    if (estadoLaboral === 'REENGANCHADO' && (!reengancheFecha || !reengancheCargo)) {
      return NextResponse.json({ ok: false, message: 'Para reenganchado debes indicar fecha de reintegro y cargo.' }, { status: 400 });
    }

    const salarioBase = salarioBaseRaw ? Number(salarioBaseRaw) : null;
    if (salarioBase === null || !Number.isFinite(salarioBase) || salarioBase <= 0) {
      return NextResponse.json({ ok: false, message: 'El sueldo base semanal es obligatorio y debe ser mayor a 0.' }, { status: 400 });
    }

    const salarioLibre = salarioLibreRaw ? Number(salarioLibreRaw) : 0;
    const bonoTransporte = bonoTransporteRaw ? Number(bonoTransporteRaw) : 0;

    const biblioteca = await loadBibliotecaAppSnapshot();

    try {
      await assertBibliotecaValue('areas_nomina', area, 'Área', biblioteca);
    } catch (e) {
      return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : 'Área no válida.' }, { status: 400 });
    }

    if (areaDetalle && !isAsignacionNominaValid(areaDetalle, biblioteca)) {
      return NextResponse.json({
        ok: false,
        message: `Asignación nómina inválida. Opciones: ${ASIGNACION_NOMINA_OPCIONES.join(', ')}.`,
      }, { status: 400 });
    }

    const supabase = await createServerClient();

    const { data: { user } } = await supabase.auth.getUser();
    let complexId = (user?.user_metadata?.complex_id as string | null) ?? null;
    if (!complexId && user?.id) {
      const { data: prof } = await supabase.from('user_profiles').select('complex_id').eq('id', user.id).maybeSingle();
      complexId = prof?.complex_id ?? null;
    }
    if (!complexId) {
      const { data: c } = await supabase.from('complexes').select('id').eq('active', true).limit(1).maybeSingle();
      complexId = c?.id ?? '86ef53c0-25d4-499e-9691-e572693cda74';
    }

    const { data: perfil, error: perfilError } = await supabase
      .from('perfiles_compensacion')
      .select('id, esquema_rotacion_default')
      .eq('id', perfilCompensacionId)
      .eq('activo', true)
      .maybeSingle();

    if (perfilError || !perfil) {
      return NextResponse.json({ ok: false, message: 'El perfil de compensación seleccionado no es válido.' }, { status: 400 });
    }

    const { data: existingByCedula } = await supabase
      .from('personal')
      .select('id')
      .eq('cedula', cedula)
      .maybeSingle();

    if (existingByCedula?.id) {
      if (!id) {
        return NextResponse.json({ ok: false, message: 'Ya existe un trabajador con esa cédula.' }, { status: 400 });
      }
      if (existingByCedula.id !== id) {
        return NextResponse.json({ ok: false, message: 'Ya existe otro trabajador con esa cédula.' }, { status: 400 });
      }
    }

    const targetId = id || undefined;

    let existingIngreso: string | null = null;
    if (targetId) {
      const { data: current } = await supabase
        .from('personal')
        .select('fecha_ingreso')
        .eq('id', targetId)
        .maybeSingle();
      existingIngreso = (current?.fecha_ingreso as string | null) ?? null;
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
    const rotacionReferenciaPosicion =
      rotacionReferenciaPosicionRaw === '' ? null : Number(rotacionReferenciaPosicionRaw);

    const rotacionInicioDeducida =
      rotacionReferenciaSemana && rotacionReferenciaPosicion !== null
        ? fechaInicioRotacionDesdeEstadoObservado(
            rotacionReferenciaSemana,
            esquemaRotacion,
            rotacionReferenciaPosicion,
          )
        : null;
    const rotacionInicio =
      tieneEsquemaConRotacion(esquemaRotacion)
        ? rotacionInicioDeducida || rotacionInicioRaw || fechaIngresoRaw || existingIngreso || new Date().toISOString().split('T')[0]
        : null;

    const cuadrillaRaw = String(data.cuadrilla ?? '').trim();
    const cuadrilla = normalizeCuadrilla(cuadrillaRaw);

    const payloadBase: Record<string, any> = {
      complex_id: complexId,
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
      activo: estadoLaboral === 'ACTIVO' || estadoLaboral === 'REENGANCHADO',
      estatus: estadoLaboral === 'DESPEDIDO' ? 'LIQUIDADO' : estadoLaboral === 'ACTIVO' || estadoLaboral === 'REENGANCHADO' ? 'ACTIVO' : 'INACTIVO',
      fecha_ingreso: fechaIngresoRaw || existingIngreso || new Date().toISOString().split('T')[0],
      perfil_compensacion_id: perfilCompensacionId,
      salario_base: salarioBase,
      salario_libre: salarioLibre,
      bono_transporte: bonoTransporte,
      esquema_rotacion: esquemaRotacion,
      rotacion_inicio_fecha: rotacionInicio,
      cuadrilla,
    };

    let resultData: any = null;
    if (targetId) {
      const { data: updated, error } = await supabase
        .from('personal')
        .update(payloadBase)
        .eq('id', targetId)
        .select('*')
        .maybeSingle();
      if (error) {
        return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
      }
      resultData = updated;
    } else {
      const { data: inserted, error } = await supabase
        .from('personal')
        .insert(payloadBase)
        .select('*')
        .maybeSingle();
      if (error) {
        return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
      }
      resultData = inserted;
    }

    try {
      await supabase.from('nomina_audit_log').insert({
        accion: id ? 'EDITAR_TRABAJADOR_REGISTRO' : 'CREAR_TRABAJADOR_REGISTRO',
        entidad: 'personal',
        entidad_id: targetId || cedula,
        detalle: `${nombre} — perfil/asignación/salario sincronizados desde Base de Trabajadores`,
        usuario_id: user?.id ?? null,
        usuario_nombre: user?.email ?? null,
      });
    } catch {}

    return NextResponse.json({
      ok: true,
      data: resultData,
      message: id ? 'Trabajador actualizado.' : 'Trabajador registrado.',
    });
  } catch (err: any) {
    console.error('[/api/trabajadores/upsert] Error:', err);
    return NextResponse.json({ ok: false, message: err?.message || 'Error al procesar trabajador' }, { status: 500 });
  }
}

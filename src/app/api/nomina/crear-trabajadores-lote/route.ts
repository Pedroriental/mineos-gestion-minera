import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { deriveAsignacionNominaFields, formatNombrePropio } from '@/lib/personal-master';
import type { Personal } from '@/lib/types';

export const dynamic = 'force-dynamic';

export type CrearTrabajadorLoteInput = {
  tempKey: string | number;
  nombre_completo: string;
  cedula: string;
  cargo: string;
  area: 'mina' | 'planta' | 'administracion' | 'seguridad' | 'transporte';
  area_detalle: string;
  salario_base: number;
  salario_libre?: number;
  bono_transporte?: number;
  fecha_ingreso?: string;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const workersInput: CrearTrabajadorLoteInput[] = Array.isArray(body?.workers)
      ? body.workers
      : [];

    if (workersInput.length === 0) {
      return NextResponse.json(
        { ok: false, message: 'No se enviaron trabajadores para registrar.' },
        { status: 400 },
      );
    }

    const supabase = await createServerClient();
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

    const { data: perfiles } = await supabase
      .from('perfiles_compensacion')
      .select('id, nombre, esquema_rotacion_default')
      .eq('activo', true);

    const perfilMina =
      perfiles?.find((p) => p.esquema_rotacion_default === 'MINA_2X1') ?? perfiles?.[0];
    const perfilMolino =
      perfiles?.find(
        (p) =>
          p.esquema_rotacion_default === 'MOLINO_ROTATIVO' ||
          p.esquema_rotacion_default === 'MOLINO_2X2',
      ) ??
      perfiles?.find((p) => p.esquema_rotacion_default === 'FIJO_SEMANAL') ??
      perfiles?.[0];
    const perfilFijo =
      perfiles?.find((p) => p.esquema_rotacion_default === 'FIJO_SEMANAL') ?? perfiles?.[0];

    const { data: existingRows } = await supabase
      .from('personal')
      .select('*');

    const existingByDigits = new Map<string, any>();
    for (const r of existingRows || []) {
      const digits = String(r.cedula || '').replace(/\D/g, '');
      if (digits.length >= 5) {
        existingByDigits.set(digits, r);
      }
    }

    const hoy = new Date().toISOString().split('T')[0];
    const createdResults: Array<{ tempKey: string | number; personal: Personal; wasUpdated?: boolean }> = [];
    const errors: string[] = [];

    for (const item of workersInput) {
      const nombre = formatNombrePropio(String(item.nombre_completo || '').trim());
      if (!nombre) {
        errors.push(`Fila #${item.tempKey}: Falta el nombre del trabajador.`);
        continue;
      }

      const rawCedula = String(item.cedula || '').trim();
      const digits = rawCedula.replace(/\D/g, '');
      const finalCedula =
        rawCedula || `TEMP-${Date.now().toString().slice(-6)}-${item.tempKey}`;

      const area = item.area || 'mina';
      const areaDetalle =
        String(item.area_detalle || '').trim() ||
        (area === 'planta' ? 'Molinos La Fé - Guardia' : 'Vertical 1PD');
      const cargo = String(item.cargo || '').trim() || (area === 'planta' ? 'Molinero' : 'Recortero');
      const salarioBase = Math.max(1, Number(item.salario_base) || 100);
      const salarioLibre =
        item.salario_libre !== undefined ? Math.max(0, Number(item.salario_libre)) : salarioBase;
      const bonoTransporte =
        item.bono_transporte !== undefined
          ? Math.max(0, Number(item.bono_transporte))
          : area === 'planta'
            ? 30
            : 0;
      const fechaIngreso = item.fecha_ingreso || hoy;

      const selectedPerfil =
        area === 'mina' ? perfilMina : area === 'planta' ? perfilMolino : perfilFijo;
      const esquema = selectedPerfil?.esquema_rotacion_default || (area === 'mina' ? 'MINA_2X1' : 'FIJO_SEMANAL');
      const { vertical_asignada, grupo_turno } = deriveAsignacionNominaFields(areaDetalle);

      const existing = digits.length >= 5 ? existingByDigits.get(digits) : null;

      if (existing) {
        // Si la cédula ya existía en BD (ej. estaba inactivo o con otro sueldo), lo reactivamos y actualizamos
        const updatePayload: Record<string, unknown> = {
          nombre_completo: nombre,
          cargo,
          area,
          area_detalle: areaDetalle,
          vertical_asignada,
          grupo_turno,
          salario_base: salarioBase,
          salario_libre: salarioLibre,
          bono_transporte: bonoTransporte,
          activo: true,
          estado_laboral: 'ACTIVO',
          estatus: 'ACTIVO',
        };
        const { data: updated, error: updErr } = await supabase
          .from('personal')
          .update(updatePayload)
          .eq('id', existing.id)
          .select('*')
          .single();

        if (updErr || !updated) {
          errors.push(`${nombre}: ${updErr?.message || 'No se pudo actualizar.'}`);
          continue;
        }
        createdResults.push({
          tempKey: item.tempKey,
          personal: updated as Personal,
          wasUpdated: true,
        });
      } else {
        const insertPayload: Record<string, unknown> = {
          complex_id: complexId,
          cedula: finalCedula,
          nombre_completo: nombre,
          cargo,
          area,
          area_detalle: areaDetalle,
          vertical_asignada,
          grupo_turno,
          ubicacion_laboral: area === 'planta' ? 'Planta' : 'Mina',
          perfil_compensacion_id: selectedPerfil?.id ?? null,
          salario_base: salarioBase,
          salario_libre: salarioLibre,
          bono_transporte: bonoTransporte,
          esquema_rotacion: esquema,
          rotacion_inicio_fecha: fechaIngreso,
          fecha_ingreso: fechaIngreso,
          ajuste_antiguedad_dias: 0,
          activo: true,
          estado_laboral: 'ACTIVO',
          estatus: 'ACTIVO',
          cuadrilla: areaDetalle,
          notas: 'Registrado desde lista/foto de supervisor en Nómina',
        };

        const { data: inserted, error: insErr } = await supabase
          .from('personal')
          .insert(insertPayload)
          .select('*')
          .single();

        if (insErr || !inserted) {
          errors.push(`${nombre} (${finalCedula}): ${insErr?.message || 'Error al insertar.'}`);
          continue;
        }
        if (digits.length >= 5) {
          existingByDigits.set(digits, inserted);
        }
        createdResults.push({
          tempKey: item.tempKey,
          personal: inserted as Personal,
        });
      }
    }

    if (createdResults.length > 0) {
      try {
        await supabase.from('nomina_audit_log').insert({
          accion: 'CREAR_TRABAJADORES_DESDE_LISTA_SUPERVISOR',
          entidad: 'personal',
          entidad_id: createdResults[0].personal.id,
          detalle: `Registrados/activados ${createdResults.length} trabajador(es) desde lista/foto de supervisor: ${createdResults.map((c) => c.personal.nombre_completo).join(', ')}`,
          usuario_id: user?.id ?? null,
          usuario_nombre: user?.email ?? null,
        });
      } catch {}
    }

    if (createdResults.length === 0 && errors.length > 0) {
      return NextResponse.json(
        { ok: false, message: errors.join(' · '), errors },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      message: `${createdResults.length} trabajador(es) guardados en el Registro de Trabajadores.`,
      created: createdResults,
      errors,
    });
  } catch (err: any) {
    console.error('[/api/nomina/crear-trabajadores-lote] Error:', err);
    return NextResponse.json(
      { ok: false, message: err?.message || 'Error interno al crear trabajadores.' },
      { status: 500 },
    );
  }
}

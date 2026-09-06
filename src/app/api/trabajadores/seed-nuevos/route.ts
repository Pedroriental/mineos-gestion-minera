import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { formatNombrePropio } from '@/lib/personal-master';

export const dynamic = 'force-dynamic';

const TRABAJADORES_LISTA = [
  // --- VERTICAL 1 (Nuevos indicados en la lista) ---
  {
    cedula: '28.701.245',
    nombre_completo: 'Reinaldo Guerra',
    cargo: 'Recortero',
    seccion: 'Vertical 1PD',
    fecha_ingreso: '2026-09-04',
    salario_base: 100,
    salario_libre: 0,
    es_nuevo: true,
    esquema: 'MINA_2X1',
  },
  {
    cedula: '31.042.398',
    nombre_completo: 'Jorge Mejia',
    cargo: 'Recortero',
    seccion: 'Vertical 1PD',
    fecha_ingreso: '2026-08-28',
    salario_base: 100,
    salario_libre: 0,
    es_nuevo: true,
    esquema: 'MINA_2X1',
  },
  {
    cedula: '31.615.769',
    nombre_completo: 'Abrahan Ramos',
    cargo: 'Recortero',
    seccion: 'Vertical 1PD',
    fecha_ingreso: '2026-08-28',
    salario_base: 100,
    salario_libre: 0,
    es_nuevo: true,
    esquema: 'MINA_2X1',
  },
  {
    cedula: '16.389.451',
    nombre_completo: 'Tomas Lares',
    cargo: 'Recortero',
    seccion: 'Vertical 1PD',
    fecha_ingreso: '2026-08-25',
    salario_base: 100,
    salario_libre: 0,
    es_nuevo: true,
    esquema: 'MINA_2X1',
  },
  {
    cedula: '16.143.148',
    nombre_completo: 'José Luis Reyes',
    cargo: 'Recortero',
    seccion: 'Vertical 1PD',
    fecha_ingreso: '2026-09-04',
    salario_base: 100,
    salario_libre: 0,
    es_nuevo: true,
    esquema: 'MINA_2X1',
  },

  // --- VERTICAL 1 (Habituales de la lista) ---
  {
    cedula: '24.117.273',
    nombre_completo: 'Diego Bonalde',
    cargo: 'Recortero',
    seccion: 'Vertical 1PD',
    fecha_ingreso: '2026-06-23',
    salario_base: 100,
    salario_libre: 0,
    es_nuevo: false,
    esquema: 'MINA_2X1',
  },
  {
    cedula: '14.635.716',
    nombre_completo: 'José Frontado',
    cargo: 'Recortero',
    seccion: 'Vertical 1PD',
    fecha_ingreso: '2026-06-23',
    salario_base: 100,
    salario_libre: 0,
    es_nuevo: false,
    esquema: 'MINA_2X1',
  },
  {
    cedula: '23.924.471',
    nombre_completo: 'Manuel Bermudez',
    cargo: 'Recortero',
    seccion: 'Vertical 1PD',
    fecha_ingreso: '2026-06-23',
    salario_base: 100,
    salario_libre: 0,
    es_nuevo: false,
    esquema: 'MINA_2X1',
  },
  {
    cedula: '30.501.769',
    nombre_completo: 'Jhoan Perdomo',
    cargo: 'Supervisor',
    seccion: 'Mina Belén - Administración Mina',
    fecha_ingreso: '2026-08-02',
    salario_base: 175,
    salario_libre: 125,
    es_nuevo: false,
    esquema: 'MINA_2X1',
  },
  {
    cedula: '21.340.181',
    nombre_completo: 'Octavio Ramos',
    cargo: 'Ayudante Barrenador',
    seccion: 'Vertical 1PD',
    fecha_ingreso: '2026-06-23',
    salario_base: 150,
    salario_libre: 0,
    es_nuevo: false,
    esquema: 'MINA_2X1',
  },
  {
    cedula: '17.318.344',
    nombre_completo: 'Yelitza Del Valle García',
    cargo: 'Cocinera',
    seccion: 'Mina Belén - Cocina Mina',
    fecha_ingreso: '2026-06-23',
    salario_base: 100,
    salario_libre: 0,
    es_nuevo: false,
    esquema: 'MINA_2X1',
  },
  {
    cedula: '6.094.476',
    nombre_completo: 'Richard Torrez',
    cargo: 'Operador de Compresor',
    seccion: 'Mina Belén - Compresoristas',
    fecha_ingreso: '2026-06-23',
    salario_base: 100,
    salario_libre: 0,
    es_nuevo: false,
    esquema: 'MINA_2X1',
  },

  // --- VERTICAL 2 (Lista) ---
  {
    cedula: '28.699.749',
    nombre_completo: 'Luis Rodriguez',
    cargo: 'Winchero',
    seccion: 'Vertical 2PD',
    fecha_ingreso: '2026-06-23',
    salario_base: 100,
    salario_libre: 0,
    es_nuevo: false,
    esquema: 'MINA_2X1',
  },
  {
    cedula: '31.293.912',
    nombre_completo: 'Antonio Urbaneja',
    cargo: 'Recortero',
    seccion: 'Vertical 2PD',
    fecha_ingreso: '2026-06-23',
    salario_base: 100,
    salario_libre: 0,
    es_nuevo: false,
    esquema: 'MINA_2X1',
  },
  {
    cedula: '24.117.274',
    nombre_completo: 'Carlos Lopez',
    cargo: 'Recortero',
    seccion: 'Vertical 2PD',
    fecha_ingreso: '2026-06-23',
    salario_base: 100,
    salario_libre: 0,
    es_nuevo: false,
    esquema: 'MINA_2X1',
  },
  {
    cedula: '32.015.780',
    nombre_completo: 'David Vargas',
    cargo: 'Recortero',
    seccion: 'Vertical 2PD',
    fecha_ingreso: '2026-06-23',
    salario_base: 100,
    salario_libre: 0,
    es_nuevo: false,
    esquema: 'MINA_2X1',
  },
  {
    cedula: '18.169.943',
    nombre_completo: 'Neptalí Carpintero',
    cargo: 'Martillero',
    seccion: 'Vertical 2PD',
    fecha_ingreso: '2026-06-23',
    salario_base: 150,
    salario_libre: 0,
    es_nuevo: false,
    esquema: 'MINA_2X1',
  },
  {
    cedula: '30.578.944',
    nombre_completo: 'Pedro Camaray',
    cargo: 'Recortero',
    seccion: 'Vertical 2PD',
    fecha_ingreso: '2026-06-23',
    salario_base: 100,
    salario_libre: 0,
    es_nuevo: false,
    esquema: 'MINA_2X1',
  },
  {
    cedula: '25.378.668',
    nombre_completo: 'Yilber Mata',
    cargo: 'Recortero',
    seccion: 'Vertical 2PD',
    fecha_ingreso: '2026-06-23',
    salario_base: 100,
    salario_libre: 0,
    es_nuevo: false,
    esquema: 'MINA_2X1',
  },
  {
    cedula: '28.126.820',
    nombre_completo: 'Yomber Mata',
    cargo: 'Recortero',
    seccion: 'Vertical 2PD',
    fecha_ingreso: '2026-06-23',
    salario_base: 100,
    salario_libre: 0,
    es_nuevo: false,
    esquema: 'MINA_2X1',
  },

  // --- NÓMINA EXTRAORDINARIA (03/09/2026) ---
  {
    cedula: '25.552.939',
    nombre_completo: 'Alexander Díaz',
    cargo: 'Ayudante Barrenador',
    seccion: 'Vertical 1PD',
    fecha_ingreso: '2026-09-03',
    salario_base: 150,
    salario_libre: 0,
    es_nuevo: true,
    esquema: 'MINA_2X1',
  },
  {
    cedula: '32.031.920',
    nombre_completo: 'Angelo Ojeda',
    cargo: 'Recortero',
    seccion: 'Vertical 1PD',
    fecha_ingreso: '2026-09-03',
    salario_base: 100,
    salario_libre: 0,
    es_nuevo: true,
    esquema: 'MINA_2X1',
  },
  {
    cedula: '25.393.733',
    nombre_completo: 'Ronny Marquez',
    cargo: 'Recortero',
    seccion: 'Vertical 1PD',
    fecha_ingreso: '2026-09-03',
    salario_base: 100,
    salario_libre: 0,
    es_nuevo: true,
    esquema: 'MINA_2X1',
  },
  {
    cedula: '30.120.288',
    nombre_completo: 'Luis Gil',
    cargo: 'Recortero',
    seccion: 'Vertical 1PD',
    fecha_ingreso: '2026-09-03',
    salario_base: 100,
    salario_libre: 0,
    es_nuevo: true,
    esquema: 'MINA_2X1',
  },
  {
    cedula: '28.376.476',
    nombre_completo: 'Jonayker Rodríguez',
    cargo: 'Martillero',
    seccion: 'Vertical 1PD',
    fecha_ingreso: '2026-09-03',
    salario_base: 150,
    salario_libre: 0,
    es_nuevo: true,
    esquema: 'MINA_2X1',
  },

  // --- RETIRADOS (Laboraron 4 días posterior a la semana libre) ---
  {
    cedula: '28.726.852',
    nombre_completo: 'José Marquez',
    cargo: 'Recortero',
    seccion: 'Vertical 2PD',
    fecha_ingreso: '2026-06-23',
    salario_base: 100,
    salario_libre: 0,
    es_nuevo: false,
    esquema: 'MINA_2X1',
    estado_laboral: 'DESPEDIDO',
    activo: false,
    notas: 'Laboraron 4 dias posterior a la semana libre, se retiraron',
  },
  {
    cedula: '30.456.332',
    nombre_completo: 'Angel Farias',
    cargo: 'Recortero',
    seccion: 'Vertical 2PD',
    fecha_ingreso: '2026-06-23',
    salario_base: 100,
    salario_libre: 0,
    es_nuevo: false,
    esquema: 'MINA_2X1',
    estado_laboral: 'DESPEDIDO',
    activo: false,
    notas: 'Laboraron 4 dias posterior a la semana libre, se retiraron',
  },

  // --- SUPERVISOR FIJO ---
  {
    cedula: '18.538.740',
    nombre_completo: 'Alexander Cedeño',
    cargo: 'Supervisor',
    seccion: 'Mina Belén - Administración Mina',
    fecha_ingreso: '2026-01-01',
    salario_base: 125,
    salario_libre: 0,
    es_nuevo: false,
    esquema: 'FIJO_SEMANAL',
    estado_laboral: 'ACTIVO',
    activo: true,
  },
];

export async function GET(req: Request) {
  return handleSeed(req);
}

export async function POST(req: Request) {
  return handleSeed(req);
}

async function handleSeed(req: Request) {
  try {
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

    // Obtener perfiles
    const { data: perfiles } = await supabase.from('perfiles_compensacion').select('id, nombre, esquema_rotacion_default').eq('activo', true);
    const perfilMina = perfiles?.find(p => p.esquema_rotacion_default === 'MINA_2X1') || perfiles?.[0];
    const perfilFijo = perfiles?.find(p => p.esquema_rotacion_default === 'FIJO_SEMANAL') || perfiles?.[0];

    // Consultar todos los existentes
    const { data: existingRows } = await supabase.from('personal').select('id, cedula, nombre_completo, salario_base, salario_libre, activo, estado_laboral');
    const existingMap = new Map<string, any>();
    (existingRows || []).forEach(r => {
      existingMap.set(r.cedula.replace(/\D/g, ''), r);
    });

    const insertados: any[] = [];
    const actualizados: any[] = [];
    const yaExistentes: any[] = [];

    for (const w of TRABAJADORES_LISTA) {
      const cleanCedula = w.cedula.replace(/\D/g, '');
      const existing = existingMap.get(cleanCedula);
      const perfilId = w.esquema === 'FIJO_SEMANAL' ? perfilFijo?.id : perfilMina?.id;

      if (!existing) {
        // INSERTAR NUEVO
        const payload: any = {
          complex_id: complexId,
          cedula: w.cedula,
          nombre_completo: formatNombrePropio(w.nombre_completo),
          cargo: w.cargo,
          area: 'mina',
          area_detalle: w.seccion,
          vertical_asignada: w.seccion,
          grupo_turno: 'GRUPO_1',
          ubicacion_laboral: 'Mina',
          salario_base: w.salario_base,
          salario_libre: w.salario_libre,
          bono_transporte: 0,
          esquema_rotacion: w.esquema,
          rotacion_inicio_fecha: w.fecha_ingreso,
          fecha_ingreso: w.fecha_ingreso,
          activo: (w as any).activo ?? true,
          estado_laboral: (w as any).estado_laboral ?? 'ACTIVO',
          estatus: (w as any).estado_laboral === 'DESPEDIDO' ? 'LIQUIDADO' : 'ACTIVO',
          cuadrilla: w.seccion,
          perfil_compensacion_id: perfilId,
          notas: (w as any).notas ?? null,
        };

        const { data: inserted, error: insErr } = await supabase
          .from('personal')
          .insert(payload)
          .select('id, cedula, nombre_completo, cargo, area_detalle')
          .maybeSingle();

        if (!insErr && inserted) {
          insertados.push(inserted);
          existingMap.set(cleanCedula, inserted);
        } else if (insErr) {
          console.error(`[seed-nuevos] Error insertando ${w.nombre_completo}:`, insErr.message);
        }
      } else {
        // EVALUAR ACTUALIZACIÓN
        const needsUpdate =
          (w.salario_base !== undefined && Number(existing.salario_base) !== Number(w.salario_base)) ||
          (w.salario_libre !== undefined && Number(existing.salario_libre) !== Number(w.salario_libre)) ||
          ((w as any).estado_laboral !== undefined && existing.estado_laboral !== (w as any).estado_laboral) ||
          ((w as any).activo !== undefined && existing.activo !== (w as any).activo);

        if (needsUpdate) {
          const updatePayload: any = {
            salario_base: w.salario_base,
            salario_libre: w.salario_libre,
            esquema_rotacion: w.esquema,
            perfil_compensacion_id: perfilId,
          };
          if ((w as any).estado_laboral) {
            updatePayload.estado_laboral = (w as any).estado_laboral;
            updatePayload.estatus = (w as any).estado_laboral === 'DESPEDIDO' ? 'LIQUIDADO' : 'ACTIVO';
          }
          if ((w as any).activo !== undefined) updatePayload.activo = (w as any).activo;
          if ((w as any).notas) updatePayload.notas = (w as any).notas;

          const { data: upd, error: updErr } = await supabase
            .from('personal')
            .update(updatePayload)
            .eq('id', existing.id)
            .select('id, cedula, nombre_completo, cargo')
            .maybeSingle();

          if (!updErr && upd) {
            actualizados.push(upd);
          } else if (updErr) {
            console.error(`[seed-nuevos] Error actualizando ${w.nombre_completo}:`, updErr.message);
          }
        } else {
          yaExistentes.push({ nombre: w.nombre_completo, cedula: w.cedula });
        }
      }
    }

    if (insertados.length > 0 || actualizados.length > 0) {
      try {
        await supabase.from('nomina_audit_log').insert({
          accion: 'SINCRONIZAR_TRABAJADORES_LISTA',
          entidad: 'personal',
          entidad_id: insertados[0]?.id || actualizados[0]?.id,
          detalle: `Sincronización lista Mina: ${insertados.length} insertados, ${actualizados.length} actualizados.`,
          usuario_id: user?.id ?? null,
          usuario_nombre: user?.email ?? null,
        });
      } catch {}
    }

    return NextResponse.json({
      ok: true,
      message: `Proceso completado: ${insertados.length} registrados, ${actualizados.length} actualizados, ${yaExistentes.length} ya existentes sin cambios.`,
      insertadosCount: insertados.length,
      insertados,
      actualizadosCount: actualizados.length,
      actualizados,
      yaExistianCount: yaExistentes.length,
      yaExistian: yaExistentes,
    });
  } catch (err: any) {
    console.error('[/api/trabajadores/seed-nuevos] Error:', err);
    return NextResponse.json({ ok: false, message: err?.message || 'Error al procesar' }, { status: 500 });
  }
}

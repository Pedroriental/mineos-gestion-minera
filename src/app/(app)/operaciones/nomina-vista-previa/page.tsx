import NominaVistaPreviaClient from '@/components/nomina/NominaVistaPreviaClient';
import { createServerClient } from '@/lib/supabase-server';
import { isPersonalVisibleInNomina } from '@/lib/personal-master';
import type { NominaRegistroCerrado } from '@/lib/nomina-preview';
import type { Personal } from '@/lib/types';

export const metadata = {
  title: 'Vista previa Nómina (propuesta) - MineOS',
};

export default async function NominaVistaPreviaPage() {
  const supabase = await createServerClient();

  const { data: personalRows } = await supabase
    .from('personal')
    .select('*')
    .in('area', ['mina', 'planta', 'administracion'])
    .order('nombre_completo');

  const allPersonal = (personalRows as Personal[]) || [];
  const personal = allPersonal.filter((p) => isPersonalVisibleInNomina(p, p.area));

  const { data: semanasRows } = await supabase
    .from('nomina_semanas')
    .select('id, semana_inicio, area')
    .order('semana_inicio', { ascending: false })
    .limit(120);

  const semanaIds = (semanasRows || []).map((s: { id: string }) => s.id);
  let registrosCerrados: NominaRegistroCerrado[] = [];

  if (semanaIds.length) {
    const { data: regRows } = await supabase
      .from('nomina_registros')
      .select(
        'personal_id, monto_pagado, es_semana_libre, semana_id, estado_asistencia, dias_trabajados, salario_base_calculado, novedad_turno, novedad_turno_obs',
      )
      .in('semana_id', semanaIds);

    const semanaById = new Map(
      (semanasRows || []).map((s: { id: string; semana_inicio: string; area: string }) => [
        s.id,
        s,
      ]),
    );

    registrosCerrados = (regRows || [])
      .map(
        (r: {
          personal_id: string;
          monto_pagado: number;
          es_semana_libre: boolean;
          semana_id: string;
          estado_asistencia?: string | null;
          dias_trabajados?: number | null;
          salario_base_calculado?: number | null;
          novedad_turno?: string | null;
          novedad_turno_obs?: string | null;
        }) => {
        const sem = semanaById.get(r.semana_id);
        if (!sem) return null;
        return {
          personal_id: r.personal_id,
          semana_inicio: sem.semana_inicio,
          area: sem.area,
          monto_pagado: Number(r.monto_pagado),
          es_semana_libre: !!r.es_semana_libre,
          estado_asistencia: r.estado_asistencia as NominaRegistroCerrado['estado_asistencia'],
          dias_trabajados: r.dias_trabajados,
          salario_base_calculado: r.salario_base_calculado,
          novedad_turno: r.novedad_turno,
          novedad_turno_obs: r.novedad_turno_obs,
        };
      },
      )
      .filter(Boolean) as NominaRegistroCerrado[];
  }

  return (
    <NominaVistaPreviaClient personal={personal} registrosCerrados={registrosCerrados} />
  );
}

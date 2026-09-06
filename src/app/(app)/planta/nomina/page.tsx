import { createServerClient } from '@/lib/supabase-server';
import NominaWorkspace from '@/components/nomina/NominaWorkspace';
import { isPersonalVisibleInNomina } from '@/lib/personal-master';
import { loadNominaRotacionContext } from '@/lib/nomina/load-rotacion-context';
import type { PerfilCompensacion, Personal, NominaSemana } from '@/lib/types';

export const metadata = {
  title: 'Nómina Molino - MineOS',
};

export const dynamic = 'force-dynamic';

export default async function PlantaNominaPage() {
  const area = 'planta';

  try {
    const supabase = await createServerClient();
    const [
      personalRes,
      masterRes,
      perfilesRes,
      semanasRes,
      rotacionCtx,
    ] = await Promise.all([
      supabase
        .from('personal')
        .select('*')
        .eq('area', area)
        .order('nombre_completo')
        .limit(500),
      supabase.from('personal').select('*').order('nombre_completo').limit(700),
      supabase.from('perfiles_compensacion').select('*').eq('activo', true).order('nombre'),
      supabase
        .from('nomina_semanas')
        .select('*')
        .eq('area', area)
        .order('semana_inicio', { ascending: false })
        .limit(200),
      loadNominaRotacionContext(area).catch((err) => {
        console.error('[PlantaNominaPage] loadNominaRotacionContext error:', err);
        return { instanciaActiva: null, rotacionPlantillas: [], rotacionMigrationRequired: false };
      }),
    ]);

    const personalRows = ((personalRes?.data || []) as Personal[]);
    const masterRows = ((masterRes?.data || []) as Personal[]);
    const perfiles = ((perfilesRes?.data || []) as PerfilCompensacion[]);
    const semanas = ((semanasRes?.data || []) as NominaSemana[]);

    const personal = personalRows.filter((p) =>
      isPersonalVisibleInNomina(p, area),
    );

    const { instanciaActiva, rotacionPlantillas, rotacionMigrationRequired } = rotacionCtx ?? {
      instanciaActiva: null,
      rotacionPlantillas: [],
      rotacionMigrationRequired: false,
    };

    const safeData = JSON.parse(JSON.stringify(personal));
    const safeMaster = JSON.parse(JSON.stringify(masterRows.length ? masterRows : personalRows));
    const safePerfiles = JSON.parse(JSON.stringify(perfiles));
    const safeSemanas = JSON.parse(JSON.stringify(semanas));
    const safeInstancia = instanciaActiva ? JSON.parse(JSON.stringify(instanciaActiva)) : null;
    const safePlantillas = JSON.parse(JSON.stringify(rotacionPlantillas));

    return (
      <NominaWorkspace
        area={area}
        data={safeData}
        masterCatalog={safeMaster}
        perfilesCompensacion={safePerfiles}
        semanas={safeSemanas}
        instanciaActiva={safeInstancia}
        rotacionPlantillas={safePlantillas}
        rotacionMigrationRequired={Boolean(rotacionMigrationRequired)}
      />
    );
  } catch (err: any) {
    console.error('[PlantaNominaPage] Server render error:', err);
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-red-200">
          <h2 className="text-lg font-bold text-red-300">Error al cargar la nómina de Molino</h2>
          <p className="text-sm mt-1 text-red-200/90">{err?.message || 'Error inesperado en el servidor'}</p>
          {err?.stack && (
            <pre className="mt-3 p-3 bg-black/50 rounded text-xs text-red-300 font-mono overflow-auto max-h-48 whitespace-pre-wrap">
              {err.stack}
            </pre>
          )}
          <div className="mt-4 flex gap-3">
            <a
              href="/planta/nomina"
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Reintentar
            </a>
            <a
              href="/planta"
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-sm font-semibold rounded-lg transition-colors"
            >
              Ir a Planta
            </a>
          </div>
        </div>
      </div>
    );
  }
}

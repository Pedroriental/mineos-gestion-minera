import { createServerClient } from '@/lib/supabase-server';
import type { PerfilCompensacion, Personal } from '@/lib/types';
import TrabajadoresWorkspace from '@/components/nomina/TrabajadoresWorkspace';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Base de Trabajadores - MineOS',
};

export default async function AdminTrabajadoresPage() {
  try {
    const supabase = await createServerClient();

    const [trabajadoresRes, perfilesRes] = await Promise.all([
      supabase
        .from('personal')
        .select('*')
        .order('nombre_completo')
        .limit(1000)
        .catch((err) => {
          console.error('[AdminTrabajadoresPage] personal query catch error:', err);
          return { data: null, error: err };
        }),
      supabase
        .from('perfiles_compensacion')
        .select('*')
        .eq('activo', true)
        .order('nombre')
        .catch((err) => {
          console.error('[AdminTrabajadoresPage] perfiles query catch error:', err);
          return { data: null, error: err };
        }),
    ]);

    let rawTrabajadores = trabajadoresRes?.data;
    if (!rawTrabajadores && !trabajadoresRes?.error) {
      rawTrabajadores = [];
    }

    // Fallback if ordering failed
    if (trabajadoresRes?.error) {
      console.warn('[AdminTrabajadoresPage] Fallback query for personal without order');
      const fallbackRes = await supabase
        .from('personal')
        .select('*')
        .limit(1000)
        .catch(() => ({ data: [], error: null }));
      rawTrabajadores = fallbackRes?.data || [];
    }

    let rawPerfiles = perfilesRes?.data;
    if (perfilesRes?.error) {
      console.warn('[AdminTrabajadoresPage] Fallback query for perfiles_compensacion');
      const fallbackPerfiles = await supabase
        .from('perfiles_compensacion')
        .select('*')
        .limit(100)
        .catch(() => ({ data: [], error: null }));
      rawPerfiles = fallbackPerfiles?.data || [];
    }

    const trabajadores = ((rawTrabajadores || []) as Personal[]).filter(Boolean);
    const perfiles = ((rawPerfiles || []) as PerfilCompensacion[]).filter(Boolean);

    const safeTrabajadores = JSON.parse(JSON.stringify(trabajadores));
    const safePerfiles = JSON.parse(JSON.stringify(perfiles));

    return (
      <TrabajadoresWorkspace
        trabajadores={safeTrabajadores}
        perfilesCompensacion={safePerfiles}
      />
    );
  } catch (err) {
    console.error('[AdminTrabajadoresPage] Fatal error rendering trabajadores page:', err);
    return (
      <TrabajadoresWorkspace
        trabajadores={[]}
        perfilesCompensacion={[]}
      />
    );
  }
}

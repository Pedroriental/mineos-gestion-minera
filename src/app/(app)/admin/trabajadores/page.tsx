import { createServerClient } from '@/lib/supabase-server';
import type { PerfilCompensacion, Personal } from '@/lib/types';
import TrabajadoresRegistryClient from '@/components/nomina/TrabajadoresRegistryClient';

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
        .limit(1000),
      supabase
        .from('perfiles_compensacion')
        .select('*')
        .eq('activo', true)
        .order('nombre'),
    ]);

    let rawTrabajadores = trabajadoresRes?.data;
    if (trabajadoresRes?.error) {
      console.warn('[AdminTrabajadoresPage] Fallback query for personal without order:', trabajadoresRes.error);
      const fallbackRes = await supabase
        .from('personal')
        .select('*')
        .limit(1000);
      rawTrabajadores = fallbackRes?.data || [];
    }

    let rawPerfiles = perfilesRes?.data;
    if (perfilesRes?.error) {
      console.warn('[AdminTrabajadoresPage] Fallback query for perfiles_compensacion:', perfilesRes.error);
      const fallbackPerfiles = await supabase
        .from('perfiles_compensacion')
        .select('*')
        .limit(100);
      rawPerfiles = fallbackPerfiles?.data || [];
    }

    const trabajadores = ((rawTrabajadores || []) as Personal[]).filter(Boolean);
    const perfiles = ((rawPerfiles || []) as PerfilCompensacion[]).filter(Boolean);

    const safeTrabajadores = JSON.parse(JSON.stringify(trabajadores));
    const safePerfiles = JSON.parse(JSON.stringify(perfiles));

    return (
      <TrabajadoresRegistryClient
        trabajadores={safeTrabajadores}
        perfilesCompensacion={safePerfiles}
      />
    );
  } catch (err: any) {
    console.error('[AdminTrabajadoresPage] Server render error:', err);
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-red-200">
          <h2 className="text-lg font-bold text-red-300">Error al cargar la base de trabajadores</h2>
          <p className="text-sm mt-1 text-red-200/90">{err?.message || 'Error inesperado en el servidor'}</p>
          <div className="mt-4 flex gap-3">
            <a
              href="/admin/trabajadores"
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Reintentar
            </a>
            <a
              href="/dashboard"
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-sm font-semibold rounded-lg transition-colors"
            >
              Ir al Dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }
}

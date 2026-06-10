import { createServerClient } from '@/lib/supabase-server';
import type { PerfilCompensacion, Personal } from '@/lib/types';
import TrabajadoresRegistryClient from '@/components/nomina/TrabajadoresRegistryClient';

export const metadata = {
  title: 'Base de Trabajadores - MineOS',
};

export default async function AdminTrabajadoresPage() {
  const supabase = await createServerClient();
  const [{ data: trabajadores }, { data: perfiles }] = await Promise.all([
    supabase.from('personal').select('*').order('created_at', { ascending: false }),
    supabase
      .from('perfiles_compensacion')
      .select('*')
      .eq('activo', true)
      .order('nombre'),
  ]);

  return (
    <TrabajadoresRegistryClient
      trabajadores={(trabajadores as Personal[]) || []}
      perfilesCompensacion={(perfiles as PerfilCompensacion[]) || []}
    />
  );
}

import { createServerClient } from '@/lib/supabase-server';
import type { Personal } from '@/lib/types';
import TrabajadoresRegistryClient from '@/components/nomina/TrabajadoresRegistryClient';

export const metadata = {
  title: 'Base de Trabajadores - MineOS',
};

export default async function AdminTrabajadoresPage() {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from('personal')
    .select('*')
    .order('created_at', { ascending: false });

  return <TrabajadoresRegistryClient trabajadores={(data as Personal[]) || []} />;
}

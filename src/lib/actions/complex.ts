'use server';

import { createServerClient } from '@/lib/supabase-server';

export async function getComplexNameById(id: string): Promise<string | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('complexes')
    .select('name')
    .eq('id', id)
    .single();
  if (error || !data) return null;
  return data.name;
}

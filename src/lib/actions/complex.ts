'use server';

import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function getComplexNameById(id: string): Promise<string | null> {
  // Fallback: usar service role (bypassa RLS y cookies — siempre funciona)
  const { data, error } = await supabaseAdmin
    .from('complexes')
    .select('name')
    .eq('id', id)
    .single();
  if (error) console.warn('[getComplexNameById]', error.message);
  return data?.name ?? null;
}

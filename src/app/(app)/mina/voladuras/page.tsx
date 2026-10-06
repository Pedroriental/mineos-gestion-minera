/**
 * Voladuras — Server Component (async)
 *
 * Arquitectura Enterprise:
 *   page.tsx (Server)  → fetch server-side con createServerClient()
 *                      → pasa data como prop al Client Component
 *   VoladurasClient    → TanStack Table + modal + Server Actions
 *
 * Cuando un Server Action llama revalidatePath('/mina/voladuras'),
 * Next.js re-ejecuta este Server Component y envía el nuevo
 * RSC payload al cliente — sin reload, sin useEffect, sin loadData.
 */

import { createServerClient } from '@/lib/supabase-server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import VoladurasClient from './VoladurasClient';
import type { ReporteVoladura } from '@/lib/types';
import { hasGlobalDateRange, type GlobalDateSearchParams } from '@/lib/global-date-range';

export default async function VoladurasPage(props?: {
  searchParams?: Promise<GlobalDateSearchParams>;
}) {
  const searchParams = props?.searchParams ? (await props.searchParams) ?? {} : {};
  const hasParams = hasGlobalDateRange(searchParams);
  const supabase = await createServerClient();
  const db = getSupabaseAdmin() ?? supabase;

  let query = db.from('reportes_voladuras').select('*');

  if (hasParams && searchParams.desde && searchParams.hasta) {
    query = query
      .gte('fecha', searchParams.desde)
      .lte('fecha', searchParams.hasta)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false });
  } else {
    query = query
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(500);
  }

  const { data } = await query;

  const reportes: ReporteVoladura[] = (data as ReporteVoladura[]) ?? [];

  return <VoladurasClient data={reportes} />;
}

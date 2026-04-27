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
import VoladurasClient from './VoladurasClient';
import type { ReporteVoladura } from '@/lib/types';

export default async function VoladurasPage() {
  const supabase = await createServerClient();

  const { data } = await supabase
    .from('reportes_voladuras')
    .select('*')
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(500);

  const reportes: ReporteVoladura[] = (data as ReporteVoladura[]) ?? [];

  return <VoladurasClient data={reportes} />;
}

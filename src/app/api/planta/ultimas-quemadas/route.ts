import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limitParam = Number(searchParams.get('limit')) || 2;
    const limit = Math.max(1, Math.min(limitParam, 10));

    const supabase = await createServerClient();
    const db = getSupabaseAdmin() ?? supabase;

    const { data, error } = await db
      .from('reportes_quemado')
      .select('total_oro_g, fecha')
      .order('fecha', { ascending: false })
      .limit(limit);

    if (error) {
      console.warn('[/api/planta/ultimas-quemadas] error:', error.message);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data: data ?? [] });
  } catch (err) {
    console.error('[/api/planta/ultimas-quemadas] exception:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error desconocido' },
      { status: 500 }
    );
  }
}

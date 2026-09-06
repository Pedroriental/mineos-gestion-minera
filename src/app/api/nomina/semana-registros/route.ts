import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const semanaId = searchParams.get('semanaId')?.trim();

    if (!semanaId) {
      return NextResponse.json(
        { ok: false, message: 'semanaId es obligatorio' },
        { status: 400 },
      );
    }

    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from('nomina_registros')
      .select('*, personal(*)')
      .eq('semana_id', semanaId)
      .order('created_at');

    if (error) {
      console.error('[/api/nomina/semana-registros] Supabase error:', error.message);
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      data: data ?? [],
    });
  } catch (err: any) {
    console.error('[/api/nomina/semana-registros] Unexpected error:', err);
    return NextResponse.json(
      { ok: false, message: err?.message || 'Error interno al cargar registros' },
      { status: 500 },
    );
  }
}

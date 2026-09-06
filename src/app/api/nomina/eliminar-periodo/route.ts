import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { eliminarPeriodoConsolidadoAction } from '@/lib/actions/nomina-actions';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const periodoId = String(body?.periodoId ?? body?.id ?? '').trim();
    const force = Boolean(body?.force ?? true);

    if (!periodoId) {
      return NextResponse.json(
        { ok: false, message: 'ID del periodo es obligatorio.' },
        { status: 400 },
      );
    }

    const supabase = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { ok: false, message: 'Sesión no válida. Inicia sesión nuevamente.' },
        { status: 401 },
      );
    }

    const result = await eliminarPeriodoConsolidadoAction({
      periodoId,
      userId: user.id,
      force,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[API /api/nomina/eliminar-periodo] Error:', err);
    return NextResponse.json(
      { ok: false, message: err?.message || 'Error interno al eliminar el periodo.' },
      { status: 500 },
    );
  }
}

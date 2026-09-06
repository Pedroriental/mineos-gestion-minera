import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { consolidarNominaPeriodoAction } from '@/lib/actions/nomina-actions';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { label, rangeStart, rangeEnd, area, metadata } = body ?? {};

    if (!label || !rangeStart || !rangeEnd || !area) {
      return NextResponse.json(
        { ok: false, message: 'Faltan parámetros requeridos para consolidar el periodo.' },
        { status: 400 },
      );
    }

    if (area !== 'mina' && area !== 'planta') {
      return NextResponse.json(
        { ok: false, message: 'Área no válida. Debe ser mina o planta.' },
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

    const result = await consolidarNominaPeriodoAction({
      label,
      rangeStart,
      rangeEnd,
      area,
      userId: user.id,
      metadata,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[API /api/nomina/consolidar-periodo] Error:', err);
    return NextResponse.json(
      { ok: false, message: err?.message || 'Error interno al consolidar el periodo.' },
      { status: 500 },
    );
  }
}

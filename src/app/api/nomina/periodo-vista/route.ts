import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { ensureManualVistaPeriodoId } from '@/lib/nomina/cierre-semana-db';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { area, label, rangeStart, rangeEnd, plantillaId } = body ?? {};

    if (!area || !rangeStart || !rangeEnd) {
      return NextResponse.json(
        { ok: false, message: 'Faltan parámetros requeridos (area, rangeStart, rangeEnd).' },
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
        { ok: false, message: 'Debe iniciar sesión.' },
        { status: 401 },
      );
    }

    const periodoRes = await ensureManualVistaPeriodoId(supabase, {
      periodo: {
        label: String(label ?? '').trim() || `Periodo manual ${rangeStart}`,
        rangeStart: String(rangeStart),
        rangeEnd: String(rangeEnd),
        plantillaId: plantillaId ? String(plantillaId) : undefined,
      },
      area: String(area),
      userId: user.id,
    });

    if ('error' in periodoRes) {
      return NextResponse.json(
        { ok: false, message: periodoRes.error },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      message: 'Periodo listo.',
      data: { periodoId: periodoRes.periodoId },
    });
  } catch (err: any) {
    console.error('[API /api/nomina/periodo-vista] Error:', err);
    return NextResponse.json(
      { ok: false, message: err?.message || 'No se pudo preparar el periodo manual.' },
      { status: 500 },
    );
  }
}

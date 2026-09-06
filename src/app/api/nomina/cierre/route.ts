import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { CierreNominaV3Schema } from '@/lib/validations/nomina-cierre';
import { validateDistribucion } from '@/lib/nomina-distribucion';
import { procesarCierreHistoricoManualV3, procesarCierreOperativoV3 } from '@/lib/actions/nomina-v3';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Normalizar plantillaId y cuadrillaId vacios o falsy a undefined
    if (body && typeof body === 'object') {
      if (body.periodoManual && !body.periodoManual.plantillaId) {
        delete body.periodoManual.plantillaId;
      }
      if (Array.isArray(body.rows)) {
        for (const row of body.rows) {
          if (row && !row.cuadrillaId) {
            delete row.cuadrillaId;
          }
        }
      }
    }

    const parsed = CierreNominaV3Schema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return NextResponse.json(
        { ok: false, message: issue?.message ?? 'Datos de cierre invalidos.' },
        { status: 400 },
      );
    }

    const distCheck = validateDistribucion(parsed.data.distribucion);
    if (!distCheck.ok) {
      return NextResponse.json(
        { ok: false, message: distCheck.message ?? 'Distribucion invalida.' },
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
        { ok: false, message: 'Sesion no valida. Inicia sesion de nuevo para cerrar la nomina.' },
        { status: 401 },
      );
    }

    const { modoCierre, periodoManual } = parsed.data;
    let result;

    if (modoCierre === 'historico_manual') {
      if (!periodoManual) {
        return NextResponse.json(
          { ok: false, message: 'Falta el periodo manual para cerrar esta semana historica.' },
          { status: 400 },
        );
      }
      result = await procesarCierreHistoricoManualV3(supabase, user.id, parsed.data, periodoManual);
    } else {
      result = await procesarCierreOperativoV3(supabase, user.id, parsed.data);
    }

    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    console.error('[api/nomina/cierre] Error inesperado al cerrar nomina:', err);
    return NextResponse.json(
      { ok: false, message: err?.message || 'Error inesperado al procesar el cierre.' },
      { status: 500 },
    );
  }
}

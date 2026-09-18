import { NextResponse } from 'next/server';
import { listRotacionPlantillasData } from '@/lib/rotacion-plantillas/rotacion-data.server';
import {
  saveRotacionPlantillaAction,
  deleteRotacionPlantillaAction,
} from '@/lib/actions/rotacion-plantillas';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const area = searchParams.get('area')?.trim() || 'planta';

    const plantillas = await listRotacionPlantillasData(area);
    return NextResponse.json({
      ok: true,
      plantillas: plantillas || [],
    });
  } catch (err: any) {
    console.error('[/api/nomina/plantillas GET] Error:', err);
    return NextResponse.json(
      { ok: false, message: err?.message || 'Error cargando plantillas', plantillas: [] },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { sandbox, plantillaId } = body || {};

    if (!sandbox || typeof sandbox !== 'object') {
      return NextResponse.json(
        { ok: false, message: 'Faltan datos de la plantilla' },
        { status: 400 },
      );
    }

    const res = await saveRotacionPlantillaAction(sandbox, plantillaId);
    return NextResponse.json(res, { status: res.ok ? 200 : 400 });
  } catch (err: any) {
    console.error('[/api/nomina/plantillas POST] Error:', err);
    return NextResponse.json(
      { ok: false, message: err?.message || 'Error guardando plantilla' },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id')?.trim();

    if (!id) {
      return NextResponse.json(
        { ok: false, message: 'ID de plantilla es obligatorio' },
        { status: 400 },
      );
    }

    const res = await deleteRotacionPlantillaAction(id);
    return NextResponse.json(res, { status: res.ok ? 200 : 400 });
  } catch (err: any) {
    console.error('[/api/nomina/plantillas DELETE] Error:', err);
    return NextResponse.json(
      { ok: false, message: err?.message || 'Error eliminando plantilla' },
      { status: 500 },
    );
  }
}

import { NextResponse } from 'next/server';
import {
  listEmpresasInversorasAction,
  createEmpresaInversoraAction,
  updateEmpresaInversoraAction,
  deleteEmpresaInversoraAction,
} from '@/lib/actions/empresas-inversoras';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const res = await listEmpresasInversorasAction();
    return NextResponse.json(res);
  } catch (err: any) {
    console.error('[/api/admin/empresas-inversoras GET] Error:', err);
    return NextResponse.json(
      { ok: false, message: err?.message || 'Error listando empresas' },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const res = await createEmpresaInversoraAction(body);
    return NextResponse.json(res, { status: res.ok ? 200 : 400 });
  } catch (err: any) {
    console.error('[/api/admin/empresas-inversoras POST] Error:', err);
    return NextResponse.json(
      { ok: false, message: err?.message || 'Error creando empresa' },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, ...payload } = body;
    if (!id) {
      return NextResponse.json({ ok: false, message: 'ID es requerido' }, { status: 400 });
    }
    const res = await updateEmpresaInversoraAction(id, payload);
    return NextResponse.json(res, { status: res.ok ? 200 : 400 });
  } catch (err: any) {
    console.error('[/api/admin/empresas-inversoras PUT] Error:', err);
    return NextResponse.json(
      { ok: false, message: err?.message || 'Error actualizando empresa' },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ ok: false, message: 'ID es requerido' }, { status: 400 });
    }
    const res = await deleteEmpresaInversoraAction(id);
    return NextResponse.json(res, { status: res.ok ? 200 : 400 });
  } catch (err: any) {
    console.error('[/api/admin/empresas-inversoras DELETE] Error:', err);
    return NextResponse.json(
      { ok: false, message: err?.message || 'Error eliminando empresa' },
      { status: 500 },
    );
  }
}

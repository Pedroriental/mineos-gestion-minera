import { NextResponse } from 'next/server';
import { generarCompensacionGastosAction } from '@/lib/actions/compensacion-gastos';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const mes = searchParams.get('mes') || '';
    const dia = searchParams.get('dia') || null;

    if (!mes) {
      return NextResponse.json({ ok: false, message: 'Mes es requerido' }, { status: 400 });
    }

    const res = await generarCompensacionGastosAction(mes, dia);
    return NextResponse.json(res, { status: res.ok ? 200 : 400 });
  } catch (err: any) {
    console.error('[/api/admin/compensacion-gastos GET] Error:', err);
    return NextResponse.json(
      { ok: false, message: err?.message || 'Error calculando compensación' },
      { status: 500 },
    );
  }
}

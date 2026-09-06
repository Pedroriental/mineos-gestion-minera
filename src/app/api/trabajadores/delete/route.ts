import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export async function POST(req: Request) {
  try {
    const { ids } = await req.json();
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ ok: false, message: 'No se seleccionaron trabajadores.' }, { status: 400 });
    }

    const uniqueIds = [...new Set(ids.map((id: string) => String(id).trim()).filter(Boolean))];
    if (uniqueIds.length === 0) {
      return NextResponse.json({ ok: false, message: 'No se seleccionaron trabajadores.' }, { status: 400 });
    }

    const supabase = await createServerClient();
    const { error } = await supabase.from('personal').delete().in('id', uniqueIds);

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('foreign key') || msg.includes('violates')) {
        return NextResponse.json({
          ok: false,
          message:
            'No se pueden eliminar trabajadores con registros de nómina asociados. Elimina sus registros de nómina primero.',
        }, { status: 400 });
      }
      return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      message: `${uniqueIds.length} trabajador(es) eliminado(s).`,
    });
  } catch (err: any) {
    console.error('[/api/trabajadores/delete] Error:', err);
    return NextResponse.json({ ok: false, message: err?.message || 'Error al eliminar trabajadores' }, { status: 500 });
  }
}

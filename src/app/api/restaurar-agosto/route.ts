import { NextResponse } from 'next/server';
import { restaurarGastosAgosto2026Action } from '@/lib/actions/gastos';

export const dynamic = 'force-dynamic';

export async function GET() {
  const result = await restaurarGastosAgosto2026Action();
  return NextResponse.json(result);
}

export async function POST() {
  const result = await restaurarGastosAgosto2026Action();
  return NextResponse.json(result);
}

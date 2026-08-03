import { NextResponse } from 'next/server';
import { restaurarGastosJulio2026Action } from '@/lib/actions/gastos';

export async function GET() {
  const result = await restaurarGastosJulio2026Action();
  return NextResponse.json(result);
}

export async function POST() {
  const result = await restaurarGastosJulio2026Action();
  return NextResponse.json(result);
}

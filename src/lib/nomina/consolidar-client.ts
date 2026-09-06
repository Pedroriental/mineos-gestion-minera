export async function consolidarPeriodoClient(payload: {
  label: string;
  rangeStart: string;
  rangeEnd: string;
  area: 'mina' | 'planta';
  metadata?: Record<string, unknown>;
}): Promise<{ ok: boolean; message: string; data?: any }> {
  try {
    const res = await fetch('/api/nomina/consolidar-periodo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    return {
      ok: false,
      message: err?.message || 'Error de conexión al consolidar el periodo.',
    };
  }
}

/** Detecta error PostgREST/Postgres por tabla inexistente (migración pendiente). */
export function isMissingRotacionTableError(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message ?? '').toLowerCase();
  return (
    error.code === 'PGRST205' ||
    error.code === '42P01' ||
    msg.includes('schema cache') ||
    msg.includes('does not exist') ||
    msg.includes('rotacion_plantilla_cuadrillas')
  );
}

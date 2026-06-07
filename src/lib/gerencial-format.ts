export const fmtGerencialNum = (n: number | null | undefined, maximumFractionDigits = 4) => {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits }).format(Number(n));
};

export const fmtGerencialDate = (fecha?: string | null) => {
  if (!fecha) return '—';
  return new Date(fecha + 'T12:00:00').toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export const fmtGerencialDateTime = (iso?: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const turnoLabel = (turno?: string | null) => {
  if (turno === 'dia') return '☀ Día';
  if (turno === 'noche') return '🌙 Noche';
  if (turno === 'completo') return '🔄 Completo';
  return turno || '—';
};

export const formatOptionalText = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : '—';
};

export const formatOptionalNumber = (value?: number | null, maximumFractionDigits = 4) => {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return fmtGerencialNum(value, maximumFractionDigits);
};

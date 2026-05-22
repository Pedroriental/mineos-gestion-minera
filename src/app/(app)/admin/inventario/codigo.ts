export const CODIGO_SIN_DATOS = 'Sin Datos';

export function digitsOnlyCodigo(value: string) {
  return value.replace(/\D/g, '');
}

export function codigoDisplay(value?: string | null) {
  const digits = digitsOnlyCodigo(value || '');
  return digits || CODIGO_SIN_DATOS;
}

/** Códigos con letras u otros caracteres (registros antiguos) → vacío en BD. */
export function needsCodigoReset(value?: string | null) {
  if (!value?.trim()) return false;
  return digitsOnlyCodigo(value) !== value.trim();
}

export function codigoForSave(formValue: string) {
  return digitsOnlyCodigo(formValue);
}

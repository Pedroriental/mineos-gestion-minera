import { toast } from 'sonner';

const DEFAULT_ERROR =
  'No se pudo completar la operación. Revisa los datos e intenta de nuevo.';

/** Etiquetas legibles para columnas que a veces aparecen en errores de base de datos. */
const COLUMN_LABELS: Record<string, string> = {
  area_detalle: 'Asignación Nómina',
  nombre_completo: 'Nombre y Apellido',
  cedula: 'Cédula',
  cargo: 'Cargo',
  fecha_ingreso: 'Fecha de Ingreso',
  fecha_nacimiento: 'Fecha de Nacimiento',
  area: 'Nómina (módulo)',
  ubicacion_laboral: 'Área / Sitio laboral',
  estado_laboral: 'Estado',
  despido_fecha: 'Fecha de despido',
  reenganche_fecha: 'Fecha de reenganche',
  reenganche_cargo: 'Cargo de reenganche',
};

const TECHNICAL_PATTERN =
  /null value|not-null constraint|duplicate key|unique constraint|violates|relation "|column "|foreign key|row-level security|permission denied|syntax error|invalid input|json|postgres|rpc error|pgrst|JWT|fetch failed|ECONNREFUSED|ETIMEDOUT|network error/i;

function columnLabel(column: string): string {
  return COLUMN_LABELS[column] ?? column.replace(/_/g, ' ');
}

function extractQuotedColumn(message: string): string | null {
  const match = message.match(/column "([^"]+)"/i);
  return match?.[1] ?? null;
}

/**
 * Convierte mensajes técnicos (SQL, red, etc.) en textos claros para usuarios no técnicos.
 * Los mensajes que ya vienen en español desde validaciones de la app se dejan igual.
 */
export function toUserFriendlyError(raw: string | undefined | null): string {
  const message = (raw ?? '').trim();
  if (!message) return DEFAULT_ERROR;

  // Mensajes generados por nuestras acciones de dominio. Aunque contengan
  // palabras técnicas como "json" o "foreign key", ya son el diagnóstico útil.
  if (message.startsWith('Error cierre:') || message.includes('CIERRE_NOMINA:')) {
    return message;
  }

  if (!TECHNICAL_PATTERN.test(message)) {
    return message;
  }

  const column = extractQuotedColumn(message);
  if (/null value|not-null constraint/i.test(message)) {
    if (column) {
      return `Falta completar el campo «${columnLabel(column)}».`;
    }
    return 'Faltan datos obligatorios. Completa los campos marcados con *.';
  }

  if (/duplicate key|unique constraint/i.test(message)) {
    if (/cedula/i.test(message)) {
      return 'Ya existe un trabajador con esa cédula.';
    }
    return 'Ya existe un registro con esos datos.';
  }

  if (/foreign key/i.test(message)) {
    return 'Hay datos relacionados que no coinciden. Revisa la información ingresada.';
  }

  if (/row-level security|permission denied|JWT|not authorized/i.test(message)) {
    return 'No tienes permiso para realizar esta acción. Vuelve a iniciar sesión si el problema continúa.';
  }

  if (/invalid input|syntax error|value too long/i.test(message)) {
    if (column) {
      return `El valor del campo «${columnLabel(column)}» no es válido.`;
    }
    return 'Algunos datos tienen un formato incorrecto. Revísalos e intenta de nuevo.';
  }

  if (/fetch failed|ECONNREFUSED|ETIMEDOUT|network error/i.test(message)) {
    return 'Error de conexión. Verifica tu internet e intenta de nuevo.';
  }

  return DEFAULT_ERROR;
}

/** Toast de error con mensaje amigable para el usuario final. */
export function toastError(raw: string | undefined | null): void {
  toast.error(toUserFriendlyError(raw));
}

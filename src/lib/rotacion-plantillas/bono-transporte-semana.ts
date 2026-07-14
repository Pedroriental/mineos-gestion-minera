import type { EsquemaRotacion } from '@/lib/types';
import type { EstatusRotacionPlantilla, RotacionSemanaColumn } from '@/lib/rotacion-plantillas/types';

/** Índice de columna (0-based) donde el esquema paga bono transporte, o null si es manual/aparte. */
export function posicionColumnaBonoTransporteEsquema(
  esquema: EsquemaRotacion | string | null | undefined,
): number | null {
  switch (esquema) {
    case 'MOLINO_15X15':
    case 'MOLINO_14X14':
      return 1;
    default:
      return null;
  }
}

export function esEstatusSemanaBonoTransporte(estatus: EstatusRotacionPlantilla): boolean {
  return estatus === 'bono_transporte_paga';
}

/** Sugiere estatus al añadir una columna de semana según esquema y posición en el ciclo. */
export function sugerirEstatusDefaultSemana(
  ordenColumna: number,
  esquema?: EsquemaRotacion | string | null,
): EstatusRotacionPlantilla {
  const bonoIdx = posicionColumnaBonoTransporteEsquema(esquema);
  if (bonoIdx !== null && ordenColumna === bonoIdx) {
    return 'bono_transporte_paga';
  }
  if (ordenColumna === 0) return 'libre_paga';
  return 'trabajada_paga';
}

/** Aplica predicción de columna bono a semanas existentes (no destructivo). */
export function aplicarPrediccionBonoColumnas(
  semanas: RotacionSemanaColumn[],
  esquema?: EsquemaRotacion | string | null,
): RotacionSemanaColumn[] {
  const bonoIdx = posicionColumnaBonoTransporteEsquema(esquema);
  if (bonoIdx === null || bonoIdx >= semanas.length) return semanas;
  return semanas.map((s, i) =>
    i === bonoIdx && s.estatusDefault !== 'bono_transporte_paga'
      ? { ...s, nombre: s.nombre.trim() || 'Bono transporte', estatusDefault: 'bono_transporte_paga' }
      : s,
  );
}

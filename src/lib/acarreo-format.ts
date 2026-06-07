import type { LineaAcarreo } from '@/lib/types';

export function sumLineasAcarreo(lineas: LineaAcarreo[]) {
  return lineas.reduce((sum, linea) => sum + (Number(linea.sacos) || 0), 0);
}

/** Texto operativo como en los informes de campo. */
export function formatLineaAcarreo(linea: LineaAcarreo): string {
  const sacos = Number(linea.sacos) || 0;
  const vertical = linea.vertical?.trim();
  const disparo = linea.disparo?.trim();

  if (vertical && disparo) {
    return `${sacos} sacos de material del vertical ${vertical} del disparo ${disparo}`;
  }
  if (vertical) {
    return `${sacos} sacos de material del vertical ${vertical}`;
  }
  if (disparo) {
    return `${sacos} sacos del disparo ${disparo}`;
  }
  return `${sacos} sacos de material`;
}

export function formatInformeAcarreoTitulo(molino: string) {
  const destino = molino.trim() || 'molino';
  return `Informe de Acarreo de material para molinos ${destino}`;
}

export function formatServicioTurno(turno: string) {
  if (turno === 'dia') return 'Servicio diurno';
  if (turno === 'noche') return 'Servicio nocturno';
  return 'Servicio completo';
}

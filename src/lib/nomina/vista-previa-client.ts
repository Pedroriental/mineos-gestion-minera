import type { NominaPeriodoSummary } from '@/lib/nomina/types';
import type { NominaRegistroCerrado } from '@/lib/nomina-preview';
import type { Personal } from '@/lib/types';

export interface VistaPreviaClientResponse {
  ok: boolean;
  periodos: NominaPeriodoSummary[];
  activePeriodoId: string | null;
  personal: Personal[];
  registrosCerrados: NominaRegistroCerrado[];
  semanasCerradas: { semana_inicio: string; semana_fin?: string }[];
  totalRegistrosHistoricos: number;
  message?: string;
}

export interface FetchVistaPreviaOptions {
  filterArea?: string;
  periodoId?: string;
  rangeStart?: string;
  rangeEnd?: string;
}

/**
 * Consulta la data necesaria para la Vista Previa / Previsualización de Nómina
 * a través del endpoint REST `/api/nomina/vista-previa`.
 *
 * Evita el protocolo RSC Flight de Server Actions, eliminando problemas de
 * límites de payload, timeouts y errores genéricos "An error occurred in the Server Components render".
 */
export async function fetchNominaVistaPreviaClient(
  options: FetchVistaPreviaOptions = {},
): Promise<VistaPreviaClientResponse> {
  const params = new URLSearchParams();
  if (options.filterArea) params.set('filterArea', options.filterArea);
  if (options.periodoId) params.set('periodoId', options.periodoId);
  if (options.rangeStart) params.set('rangeStart', options.rangeStart);
  if (options.rangeEnd) params.set('rangeEnd', options.rangeEnd);

  const url = `/api/nomina/vista-previa?${params.toString()}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    let errorMsg = `Error del servidor (${res.status})`;
    try {
      const errJson = await res.json();
      if (errJson?.message) {
        errorMsg = errJson.message;
      }
    } catch {
      // Ignorar fallo de parseo JSON en error
    }
    throw new Error(errorMsg);
  }

  const data: VistaPreviaClientResponse = await res.json();
  return data;
}

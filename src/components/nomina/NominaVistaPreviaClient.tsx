'use client';

import NominaVistaPreviaContent from '@/components/nomina/NominaVistaPreviaContent';
import type { NominaRegistroCerrado } from '@/lib/nomina-preview';
import type { Personal } from '@/lib/types';

type Props = {
  personal: Personal[];
  registrosCerrados: NominaRegistroCerrado[];
};

/** Página dedicada (opcional); la UX principal es el modal desde Nómina. */
export default function NominaVistaPreviaClient({ personal, registrosCerrados }: Props) {
  return (
    <div className="nomina-vista-previa-page flex min-h-[80dvh] flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-lg">
      <NominaVistaPreviaContent
        personal={personal}
        registrosCerrados={registrosCerrados}
        variant="page"
      />
    </div>
  );
}

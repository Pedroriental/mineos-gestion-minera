'use client';

import { useState, useTransition } from 'react';
import { Loader2, RefreshCw, RotateCcw } from 'lucide-react';
import { syncRotacionEstadosLaboralesAction } from '@/lib/actions/rotacion-sync';
import { useBiblioteca } from '@/contexts/biblioteca-context';

type Props = {
  area: 'mina' | 'planta' | 'administracion' | 'seguridad' | 'transporte';
  weekStart: string;
  onSynced?: () => void;
};

export function NominaRotacionPanel({ area, weekStart, onSynced }: Props) {
  const biblioteca = useBiblioteca();
  const [msg, setMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (area !== 'mina' && area !== 'planta') return null;

  const esquemaDefault = biblioteca.esquemaDefaultPorArea[area];
  const opciones = biblioteca.esquemasPorArea[area] || [];

  function sync() {
    setMsg(null);
    startTransition(async () => {
      const res = await syncRotacionEstadosLaboralesAction(weekStart);
      if (res.ok) {
        setMsg(res.message);
        onSynced?.();
      } else {
        setMsg(res.message);
      }
    });
  }

  return (
    <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3">
      <div className="mb-2 flex items-center gap-2">
        <RotateCcw className="h-4 w-4 text-cyan-400" />
        <p className="text-[11px] font-bold uppercase tracking-wider text-cyan-300/90">Rotación</p>
      </div>
      <p className="mb-2 text-[11px] leading-relaxed text-white/45">
        Semana libre sin estar en nómina Mina/Molino → <span className="text-cyan-300">Vacaciones</span> en la base.
      </p>
      <p className="mb-3 text-[10px] text-white/35">
        Esquema sugerido al asignar:{' '}
        <span className="text-white/60">{biblioteca.esquemaLabels[esquemaDefault] || esquemaDefault}</span>
      </p>
      <ul className="mb-3 space-y-0.5 text-[10px] text-white/40">
        {opciones.map((e) => (
          <li key={e}>· {biblioteca.esquemaLabels[e] || e}</li>
        ))}
      </ul>
      <button
        type="button"
        onClick={sync}
        disabled={isPending}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 py-2 text-[11px] font-bold text-cyan-300 hover:bg-cyan-500/20 disabled:opacity-50"
      >
        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        Sincronizar con base
      </button>
      {msg && <p className="mt-2 text-[10px] text-white/50">{msg}</p>}
    </div>
  );
}

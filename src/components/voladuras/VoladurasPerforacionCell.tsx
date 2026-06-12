'use client';

import type { ReporteVoladura } from '@/lib/types';
import {
  getChupisTableDisplay,
  getHuecosTableDisplay,
} from '@/lib/voladuras-huecos-chupis';

type PerforacionTone = 'general' | 'amber';

function PerforacionCell({
  total,
  lineas,
  tone,
}: {
  total: number;
  lineas: string[];
  tone: PerforacionTone;
}) {
  if (total <= 0 && lineas.length === 0) {
    return <span className="text-white/30">—</span>;
  }

  const toneClass = tone === 'amber' ? 'text-amber-400' : 'mineos-cell-general';

  if (lineas.length === 1) {
    return <span className={`font-semibold tabular-nums ${toneClass}`}>{lineas[0]}</span>;
  }

  return (
    <div className="max-w-[10rem] whitespace-normal text-left">
      <div className={`font-semibold tabular-nums ${toneClass}`}>{total}</div>
      <div className="mt-0.5 space-y-0.5 text-[10px] leading-snug text-white/45">
        {lineas.map((linea, index) => (
          <div key={index}>{linea}</div>
        ))}
      </div>
    </div>
  );
}

export function VoladurasHuecosCell({ record }: { record: ReporteVoladura }) {
  const display = getHuecosTableDisplay(record);
  return <PerforacionCell total={display.total} lineas={display.lineas} tone="general" />;
}

export function VoladurasChupisCell({ record }: { record: ReporteVoladura }) {
  const display = getChupisTableDisplay(record);
  return <PerforacionCell total={display.total} lineas={display.lineas} tone="amber" />;
}

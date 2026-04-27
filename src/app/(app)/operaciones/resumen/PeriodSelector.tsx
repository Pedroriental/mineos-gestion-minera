'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { Loader2, Printer } from 'lucide-react';

const PERIODS = [
  { value: '7',  label: '7d'  },
  { value: '15', label: '15d' },
  { value: '30', label: '30d' },
  { value: '90', label: '90d' },
] as const;

interface PeriodSelectorProps {
  currentPeriod: string;
}

export default function PeriodSelector({ currentPeriod }: PeriodSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const changePeriod = (dias: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('period', dias);
    startTransition(() => {
      router.push(`?${params.toString()}`, { scroll: false });
    });
  };

  return (
    <div className="flex items-center gap-2 print:hidden">
      {/* Period pills */}
      <div className="flex bg-white/[0.06] border border-white/[0.08] rounded-xl p-1 gap-0.5">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            onClick={() => changePeriod(p.value)}
            disabled={isPending}
            className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap flex-shrink-0 ${
              currentPeriod === p.value
                ? 'bg-amber-500/25 text-amber-300 border border-amber-400/30'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Loading spinner while server re-fetches */}
      {isPending && <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />}

      <button
        onClick={() => window.print()}
        className="btn-secondary !py-2 !px-3 gap-1.5 text-xs hidden sm:inline-flex"
      >
        <Printer className="w-3.5 h-3.5" /> Imprimir
      </button>
    </div>
  );
}

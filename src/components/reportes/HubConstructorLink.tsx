'use client';

import Link from 'next/link';
import { FileSearch } from 'lucide-react';
import { buildConstructorUrl } from '@/lib/reports/report-deep-link';
import type { ReportPayload } from '@/lib/reports/report-types';

export function HubConstructorLink({ payload }: { payload: Partial<ReportPayload> }) {
  return (
    <Link
      href={buildConstructorUrl(payload)}
      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-transparent px-2.5 py-1.5 text-[11px] font-medium text-zinc-400 transition-colors hover:border-amber-500/30 hover:text-amber-300"
    >
      <FileSearch className="h-3.5 w-3.5 shrink-0" aria-hidden />
      Abrir en constructor
    </Link>
  );
}

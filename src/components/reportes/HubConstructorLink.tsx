'use client';

import Link from 'next/link';
import { FileSearch } from 'lucide-react';
import { buildConstructorUrl } from '@/lib/reports/report-deep-link';
import type { ReportPayload } from '@/lib/reports/report-types';
import { reportesUi as ui } from '@/components/reportes/reportes-ui';
import { cn } from '@/lib/utils';

type Props = {
  payload: Partial<ReportPayload>;
  /** Ejecutar automáticamente al abrir el constructor (desde hub). */
  autoRun?: boolean;
  className?: string;
};

export function HubConstructorLink({ payload, autoRun = true, className }: Props) {
  return (
    <Link
      href={buildConstructorUrl(payload, { autoRun })}
      className={cn(ui.linkSubtle, className)}
    >
      <FileSearch className="h-3.5 w-3.5 shrink-0" aria-hidden />
      Abrir en constructor
    </Link>
  );
}

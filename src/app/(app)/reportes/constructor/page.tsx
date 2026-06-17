import { Suspense } from 'react';
import { ReportBuilder } from '@/components/reportes/ReportBuilder';
import { reportesUi as ui } from '@/components/reportes/reportes-ui';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Constructor de Reportes - MineOS' };

function ConstructorFallback() {
  return (
    <div className={cn(ui.emptyState, 'min-h-[320px]')}>
      <p className={ui.metaText}>Cargando constructor…</p>
    </div>
  );
}

export default function ConstructorPage() {
  return (
    <div className="reportes-balances-page flex min-h-0 w-full flex-1 flex-col overflow-hidden p-0">
      <Suspense fallback={<ConstructorFallback />}>
        <ReportBuilder />
      </Suspense>
    </div>
  );
}

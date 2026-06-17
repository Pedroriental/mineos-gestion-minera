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
      <header className="reportes-constructor-page__head shrink-0 px-4 pt-3 lg:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className={ui.previewTitle}>Constructor de Reportes</h1>
          <span className="rounded-full border border-[color-mix(in_srgb,var(--mineos-general)_32%,var(--dashboard-border))] bg-[color-mix(in_srgb,var(--mineos-general-soft)_45%,var(--dashboard-card-muted))] px-2 py-0.5 text-[10px] font-medium text-[var(--mineos-general-bright)]">
            Universal
          </span>
        </div>
        <p className="mt-1 text-[12px] text-[var(--dashboard-text-muted)]">
          Reportes cruzados multi-módulo con filtros dinámicos
        </p>
      </header>
      <Suspense fallback={<ConstructorFallback />}>
        <ReportBuilder />
      </Suspense>
    </div>
  );
}

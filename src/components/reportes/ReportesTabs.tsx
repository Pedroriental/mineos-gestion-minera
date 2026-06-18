'use client';

import type { ReportModule } from '@/lib/reports/report-types';
import { REPORTES_TABS } from '@/components/reportes/reportes-constants';
import { cn } from '@/lib/utils';

export function ReportesTabs({
  activeTab,
  onTabChange,
}: {
  activeTab: ReportModule;
  onTabChange: (tab: ReportModule) => void;
}) {
  return (
    <div className="reportes-tabs-scroll">
      <div
        className="reportes-tabs flex flex-nowrap gap-0.5 overflow-x-auto pb-0 scrollbar-thin md:overflow-visible md:border-b md:border-[var(--dashboard-border)]"
        role="tablist"
        aria-label="Módulos de reportes"
      >
        {REPORTES_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'reportes-tabs__btn flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-medium transition-colors border border-transparent',
              activeTab === tab.id
                ? 'reportes-tabs__btn--active md:font-semibold md:shadow-none'
                : '',
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}

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
    <div className="flex flex-nowrap gap-1 overflow-x-auto border-b border-white/5 pb-2 scrollbar-thin">
      {REPORTES_TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onTabChange(tab.id)}
          className={cn(
            'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
            activeTab === tab.id
              ? 'bg-zinc-800/80 text-zinc-100 border border-zinc-600/40'
              : 'text-zinc-500 border border-transparent hover:text-zinc-300 hover:bg-white/[0.03]',
          )}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
}

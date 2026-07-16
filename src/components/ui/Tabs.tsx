'use client';

import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Tab = {
  key: string;
  label: string;
  icon?: ReactNode;
};

type TabsProps = {
  tabs: Tab[];
  defaultTab?: string;
  className?: string;
  children: (activeTab: string) => ReactNode;
};

export function Tabs({ tabs, defaultTab, className, children }: TabsProps) {
  const [active, setActive] = useState<string>(defaultTab ?? tabs[0]?.key ?? '');

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <div className="flex items-center gap-1 border-b border-white/10 px-2">
        {tabs.map((tab) => {
          const isActive = active === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActive(tab.key)}
              className={cn(
                'flex items-center gap-1.5 border-b-2 px-3 py-2 text-[11px] font-bold uppercase tracking-wider transition-colors',
                isActive
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-[var(--dashboard-text-muted)] hover:text-[var(--dashboard-text)]',
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className="flex min-h-0 flex-1 flex-col">{children(active)}</div>
    </div>
  );
}

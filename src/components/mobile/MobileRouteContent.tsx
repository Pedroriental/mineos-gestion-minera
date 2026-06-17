'use client';

import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { AppSectionMeta } from '@/lib/app-section-meta';
import { MobileSectionLead } from './MobileSectionLead';

type MobileRouteContentProps = {
  children: ReactNode;
  className?: string;
  sectionMeta?: AppSectionMeta | null;
  pathname?: string;
  flush?: boolean;
  dense?: boolean;
  hideSectionLead?: boolean;
};

export function MobileRouteContent({
  children,
  className,
  sectionMeta,
  pathname,
  flush,
  dense,
  hideSectionLead,
}: MobileRouteContentProps) {
  const isDashboard = pathname === '/dashboard' || pathname?.startsWith('/dashboard/');
  const isReportes =
    pathname?.startsWith('/reportes-balances') || pathname?.startsWith('/reportes/constructor');
  const isResumen = pathname?.startsWith('/operaciones/resumen');
  const isHotbarPrimary = isDashboard || isReportes;
  const showLead = sectionMeta && !hideSectionLead && !isHotbarPrimary;
  const contentFlush = flush && !showLead;

  let titleOverride: string | undefined;
  if (isReportes) titleOverride = 'Reportes y balances';

  return (
    <div
        className={cn(
        'mobile-route-content w-full min-h-0 min-w-0 max-w-full pb-1.5 pt-0.5',
        isReportes ? 'mobile-route-content--flush overflow-x-visible' : 'overflow-x-clip',
        contentFlush && !isReportes && 'mobile-route-content--flush',
        dense && !contentFlush && !isReportes && 'mobile-route-content--dense',
        className,
      )}
    >
      {showLead ? (
        <MobileSectionLead
          meta={sectionMeta}
          titleOverride={titleOverride}
          className={cn(flush && 'px-2')}
        />
      ) : null}
      {children}
    </div>
  );
}

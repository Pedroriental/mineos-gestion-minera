import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';

type CrudPageSkeletonProps = {
  className?: string;
  /** Filas de tabla / tarjetas móviles */
  rows?: number;
  showToolbar?: boolean;
  showKpis?: boolean;
  kpiCount?: number;
};

/**
 * Placeholder de carga para páginas CRUD (toolbar + tabla/tarjetas).
 */
export function CrudPageSkeleton({
  className,
  rows = 6,
  showToolbar = true,
  showKpis = false,
  kpiCount = 3,
}: CrudPageSkeletonProps) {
  return (
    <div className={cn('space-y-6 animate-pulse', className)} aria-hidden>
      {showToolbar ? (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-10 w-36 rounded-xl" />
        </div>
      ) : null}

      {showKpis ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: kpiCount }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : null}

      <div className="hidden md:block app-surface-card overflow-hidden p-0">
        <div className="flex gap-8 border-b border-[var(--dashboard-border)] px-4 py-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-16" />
          ))}
        </div>
        <div className="divide-y divide-[var(--dashboard-border)]">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3.5">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 flex-1 max-w-xs" />
              <Skeleton className="h-4 w-14" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        {Array.from({ length: Math.min(rows, 4) }).map((_, i) => (
          <Skeleton key={i} className="h-36 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

/**
 * loading.tsx — Next.js Route Segment Loading UI
 */
import { Skeleton } from '@/components/ui/Skeleton';

export default function ResumenLoading() {
  return (
    <div className="resumen-ejecutivo-page flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="resumen-ejecutivo-page__body min-h-0 flex-1 overflow-hidden">
        <div className="resumen-ejecutivo-page__content flex min-h-0 flex-1 flex-col gap-2">
          <Skeleton className="h-[5.25rem] w-full shrink-0 rounded-2xl" />

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="grid grid-cols-2 grid-rows-3 gap-2 self-start">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-[4.25rem] rounded-lg" />
              ))}
            </div>
            <div className="flex min-h-0 flex-col gap-3">
              <Skeleton className="min-h-0 flex-1 rounded-xl" />
              <Skeleton className="h-36 shrink-0 rounded-xl" />
            </div>
          </div>
        </div>

        <div className="resumen-ejecutivo-page__summary-row shrink-0 grid grid-cols-1 gap-2.5 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card-glass rounded-xl p-4">
              <Skeleton className="mb-2 h-3 w-32" />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {Array.from({ length: 4 }).map((_, j) => (
                  <Skeleton key={j} className="h-8 w-full" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

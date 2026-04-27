/**
 * loading.tsx — Next.js Route Segment Loading UI
 * Se muestra automáticamente mientras page.tsx (async Server Component) resuelve.
 * Simula la forma exacta de las secciones del Resumen Ejecutivo.
 */
import { Skeleton } from '@/components/ui/Skeleton';

export default function ResumenLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-56 rounded-xl" />
      </div>

      {/* Gold banner */}
      <div className="card-glass rounded-2xl p-5 flex items-center gap-5 border-l-4 border-l-white/[0.06]">
        <Skeleton className="w-12 h-12 rounded-xl flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-12 w-28 hidden sm:block" />
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card-glass rounded-xl p-3 sm:p-4 space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-3 w-14" />
          </div>
        ))}
      </div>

      {/* Chart + Costs row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3 card-glass rounded-xl p-5 space-y-4">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-[160px] w-full rounded-lg" />
        </div>
        <div className="lg:col-span-2 card-glass rounded-xl p-5 space-y-4">
          <Skeleton className="h-4 w-36" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-1.5 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>

      {/* Bottom 4-card row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card-glass rounded-xl p-5 space-y-3">
            <Skeleton className="h-3 w-36" />
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="flex justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

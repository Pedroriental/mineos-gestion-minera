import { Loader2 } from 'lucide-react';

export default function GlobalLoading() {
  return (
    <div className="space-y-6 animate-pulse p-4 md:p-8 w-full max-w-[1500px] mx-auto min-h-[80vh]">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="h-8 w-64 bg-zinc-800/60 rounded-lg mb-2"></div>
          <div className="h-4 w-32 bg-zinc-800/40 rounded-md"></div>
        </div>
        <div className="h-10 w-32 bg-zinc-800/60 rounded-xl"></div>
      </div>

      {/* KPI Row Skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 bg-zinc-900/50 border border-zinc-800/50 rounded-xl"></div>
        ))}
      </div>

      {/* Main Table / Content Skeleton */}
      <div className="h-[400px] bg-zinc-900/50 border border-zinc-800/50 rounded-xl flex items-center justify-center">
         <Loader2 className="w-8 h-8 text-amber-500/30 animate-spin" />
      </div>
    </div>
  );
}

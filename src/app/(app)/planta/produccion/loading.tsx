import { Loader2 } from 'lucide-react';

export default function ProduccionLoading() {
  return (
    <div className="space-y-6 animate-pulse p-4 md:p-8 w-full max-w-[1500px] mx-auto min-h-[80vh]">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="h-8 w-64 bg-zinc-800/60 rounded-lg mb-2"></div>
          <div className="h-4 w-48 bg-zinc-800/40 rounded-md"></div>
        </div>
        <div className="flex gap-2">
           <div className="h-10 w-32 bg-zinc-800/60 rounded-xl"></div>
           <div className="h-10 w-32 bg-zinc-800/60 rounded-xl"></div>
        </div>
      </div>

      {/* KPI Cards Skeleton (4 cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 bg-zinc-900/50 border border-zinc-800/50 rounded-xl"></div>
        ))}
      </div>

      {/* Main Charts Skeleton */}
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="h-[400px] flex-1 bg-zinc-900/50 border border-zinc-800/50 rounded-xl flex items-center justify-center">
           <Loader2 className="w-8 h-8 text-amber-500/30 animate-spin" />
        </div>
        <div className="h-[400px] w-full lg:w-80 bg-zinc-900/50 border border-zinc-800/50 rounded-xl flex items-center justify-center">
           <div className="w-32 h-32 rounded-full border-4 border-zinc-800/50"></div>
        </div>
      </div>

      {/* Table Skeleton */}
      <div className="h-[300px] bg-zinc-900/50 border border-zinc-800/50 rounded-xl flex items-center justify-center"></div>
    </div>
  );
}

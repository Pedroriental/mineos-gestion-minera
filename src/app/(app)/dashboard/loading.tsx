import { BarChart3 } from 'lucide-react';

export default function DashboardLoading() {
  return (
    <div className="p-4 md:p-8 w-full max-w-[1500px] mx-auto min-h-screen">
      <div className="flex flex-col lg:flex-row gap-6">
        
        {/* Left / Main Area */}
        <div className="flex-1 flex flex-col gap-6">
          {/* Header Skeleton */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3 animate-pulse">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-amber-500/50" />
              </div>
              <div className="h-6 w-32 bg-zinc-800/60 rounded-md"></div>
            </div>
            <div className="h-4 w-24 bg-zinc-800/40 rounded-md animate-pulse"></div>
          </div>

          {/* Top KPIs Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-zinc-900/50 border border-zinc-800/50 rounded-xl animate-pulse"></div>
            ))}
          </div>

          {/* Main Chart Skeleton */}
          <div className="h-[400px] bg-zinc-900/50 border border-zinc-800/50 rounded-xl animate-pulse p-6 flex flex-col">
            <div className="h-8 w-48 bg-zinc-800/50 rounded-md mb-4"></div>
            <div className="flex-1 border-b border-l border-zinc-800/50 relative"></div>
          </div>

          {/* Mini KPIs Skeleton */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 bg-zinc-900/50 border border-zinc-800/50 rounded-xl animate-pulse"></div>
            ))}
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="w-full lg:w-80 xl:w-96 flex flex-col gap-6 shrink-0">
          {/* LiveClock Skeleton */}
          <div className="h-32 bg-zinc-900/50 border border-zinc-800/50 rounded-xl animate-pulse"></div>
          
          {/* Quick Stats Skeleton */}
          <div className="grid grid-cols-2 gap-3">
            <div className="h-24 bg-zinc-900/50 border border-zinc-800/50 rounded-xl animate-pulse"></div>
            <div className="h-24 bg-zinc-900/50 border border-zinc-800/50 rounded-xl animate-pulse"></div>
          </div>

          {/* Notifications Skeleton */}
          <div className="flex-1 min-h-[400px] bg-zinc-900/50 border border-zinc-800/50 rounded-xl animate-pulse p-5">
            <div className="h-5 w-24 bg-zinc-800/60 rounded-md mb-6"></div>
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-zinc-800/80 mt-1.5"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-zinc-800/60 rounded w-3/4"></div>
                    <div className="h-3 bg-zinc-800/40 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

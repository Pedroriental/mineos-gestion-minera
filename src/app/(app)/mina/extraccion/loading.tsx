import { Skeleton } from '@/components/ui/Skeleton';

export default function ExtraccionLoading() {
  return (
    <div className="flex min-h-[70vh] flex-col gap-4 p-1">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-12">
        <Skeleton className="min-h-[220px] rounded-xl lg:col-span-4" />
        <div className="flex flex-col gap-3 lg:col-span-8">
          <Skeleton className="h-10 w-full rounded-xl" />
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
          <Skeleton className="min-h-[280px] flex-1 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

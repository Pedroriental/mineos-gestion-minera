import { Skeleton } from '@/components/ui/Skeleton';

export default function ProduccionLoading() {
  return (
    <div className="produccion-page flex min-h-[70vh] flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
      <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-[1fr_20rem]">
        <Skeleton className="min-h-[400px] rounded-xl" />
        <Skeleton className="min-h-[400px] rounded-xl lg:min-h-0" />
      </div>
      <Skeleton className="h-[300px] rounded-xl" />
    </div>
  );
}

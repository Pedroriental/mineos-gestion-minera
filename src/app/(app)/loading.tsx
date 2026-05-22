import { CrudPageSkeleton } from '@/components/app/CrudPageSkeleton';

export default function GlobalLoading() {
  return (
    <div className="mx-auto w-full max-w-[1500px] p-4 md:p-8">
      <CrudPageSkeleton showKpis kpiCount={4} rows={8} />
    </div>
  );
}

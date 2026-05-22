import { CrudPageSkeleton } from '@/components/app/CrudPageSkeleton';
export default function Loading() {
  return <CrudPageSkeleton showKpis kpiCount={4} rows={4} />;
}

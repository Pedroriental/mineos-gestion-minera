/**
 * Skeleton — placeholder con tokens del dashboard (día/noche).
 */
import { cn } from '@/lib/utils';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-lg bg-[var(--dashboard-card-muted)]',
        className,
      )}
      {...props}
    />
  );
}

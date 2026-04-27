/**
 * Skeleton — animated placeholder compatible con el tema oscuro de MineOS.
 * API idéntica a Shadcn/ui Skeleton para fácil migración futura.
 */
import { cn } from '@/lib/utils';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-lg bg-white/[0.06]',
        className,
      )}
      {...props}
    />
  );
}

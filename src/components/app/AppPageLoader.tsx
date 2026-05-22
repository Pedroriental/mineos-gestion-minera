import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type AppPageLoaderProps = {
  className?: string;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
};

const sizeMap = {
  sm: 'h-5 w-5',
  md: 'h-7 w-7',
  lg: 'h-9 w-9',
} as const;

/** Spinner centrado con tokens del dashboard (día/noche). */
export function AppPageLoader({ className, label, size = 'md' }: AppPageLoaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 py-16',
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2
        className={cn('animate-spin text-[var(--dashboard-accent)]', sizeMap[size])}
      />
      {label ? (
        <p className="text-sm font-medium text-[var(--dashboard-text-muted)]">{label}</p>
      ) : null}
    </div>
  );
}

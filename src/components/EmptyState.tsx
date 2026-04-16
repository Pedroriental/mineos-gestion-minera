'use client';

import { cn } from '@/lib/utils';

interface EmptyStateProps {
  /** Icon element (from lucide-react, sized ~w-8 h-8 is ideal) */
  icon: React.ReactNode;
  /** Bold heading */
  title: string;
  /** Secondary descriptive text */
  description?: string;
  /** Primary CTA button */
  action?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  };
  /** Optional secondary link/action */
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 px-6 text-center',
        className,
      )}
    >
      {/* Icon container */}
      <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-5 text-zinc-500">
        {icon}
      </div>

      {/* Title */}
      <h3 className="text-[15px] font-semibold text-white/70 mb-1.5 tracking-tight">
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p className="text-sm text-zinc-500 max-w-xs leading-relaxed mb-6">
          {description}
        </p>
      )}

      {/* Actions */}
      {(action || secondaryAction) && (
        <div className="flex items-center gap-3 flex-wrap justify-center">
          {action && (
            <button
              onClick={action.onClick}
              disabled={action.disabled}
              className="btn-primary text-sm"
            >
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors font-medium"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default EmptyState;

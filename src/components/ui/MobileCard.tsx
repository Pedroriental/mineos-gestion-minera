'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Detail = {
  label: string;
  value: ReactNode;
  spanFull?: boolean;
};

type MobileCardProps = {
  children?: ReactNode;
  /** Color de la barra izquierda (ej. 'border-l-purple-500') */
  accent?: string;
  /** Encabezado: título + metadata */
  header?: ReactNode;
  /** Grilla de detalles: label-value pairs en 2 columnas */
  details?: Detail[];
  /** Acciones al pie */
  actions?: ReactNode;
  className?: string;
};

export function MobileCard({
  children,
  accent,
  header,
  details,
  actions,
  className,
}: MobileCardProps) {
  return (
    <div
      className={cn(
        'mobile-card card-glass p-5',
        accent && `border-l-4 ${accent}`,
        className,
      )}
    >
      {header && (
        <div className="mobile-card__header mb-4">{header}</div>
      )}

      {details && details.length > 0 && (
        <div className="mobile-card__details grid grid-cols-2 gap-3 rounded-lg border border-white/[0.07] bg-white/[0.05] p-3">
          {details.map((d, i) => (
            <div key={i} className={d.spanFull ? 'col-span-2' : undefined}>
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-white/35">
                {d.label}
              </span>
              {typeof d.value === 'string' || typeof d.value === 'number' ? (
                <span className="font-semibold text-white/70">{d.value}</span>
              ) : (
                d.value
              )}
            </div>
          ))}
        </div>
      )}

      {children}

      {actions && (
        <div className="mobile-card__actions mt-4 flex justify-end gap-2 border-t border-white/[0.07] pt-4">
          {actions}
        </div>
      )}
    </div>
  );
}

type MobileCardActionProps = {
  onClick: () => void;
  label: string;
  icon?: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
};

export function MobileCardAction({
  onClick,
  label,
  icon,
  variant = 'secondary',
}: MobileCardActionProps) {
  const base =
    'flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors active:scale-95';
  const variants = {
    primary: 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20',
    secondary: 'bg-white/[0.05] text-white/50 hover:bg-white/[0.09]',
    danger: 'bg-red-500/10 text-red-400 hover:bg-red-500/20',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(base, variants[variant])}
    >
      {icon}
      {label}
    </button>
  );
}

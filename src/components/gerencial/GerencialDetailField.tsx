'use client';

import type { ReactNode } from 'react';

export function GerencialDetailField({
  label,
  value,
  mono,
  highlight,
  className,
  children,
}: {
  label: string;
  value?: string;
  mono?: boolean;
  highlight?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={`min-w-0 ${className ?? ''}`}>
      <p className="gastos-detail-label mb-0.5 text-[9px] font-bold uppercase tracking-wider">{label}</p>
      {children ?? (
        <p
          className={`text-[11px] leading-snug break-words ${
            highlight
              ? 'gastos-amount text-[11px]'
              : mono
                ? 'gastos-detail-value--mono'
                : 'gastos-detail-value'
          }`}
        >
          {value || '—'}
        </p>
      )}
    </div>
  );
}

export function GerencialDetailSection({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <h3 className="gastos-detail-label mb-2 text-[10px] font-bold uppercase tracking-wider">{title}</h3>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">{children}</div>
    </section>
  );
}

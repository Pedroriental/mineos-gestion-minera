import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Fila de acciones bajo el topbar (sin título duplicado). */
export function AppPageToolbar({
  children,
  className,
  lead,
}: {
  children?: ReactNode;
  className?: string;
  /** Texto auxiliar opcional (ej. conteo de registros). */
  lead?: ReactNode;
}) {
  return (
    <div
      className={cn(
        'app-page-toolbar mb-4 flex flex-shrink-0 flex-col gap-3 sm:flex-row sm:items-center',
        lead ? 'sm:justify-between' : 'sm:justify-end',
        className,
      )}
    >
      {lead ? <div className="app-page-toolbar__lead min-w-0">{lead}</div> : null}
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}

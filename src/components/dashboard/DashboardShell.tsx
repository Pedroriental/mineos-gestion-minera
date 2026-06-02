'use client';

import { memo, type ReactNode } from 'react';

/**
 * Contenedor de scroll del dashboard (el encabezado vive en el topbar global).
 */
export const DashboardShell = memo(function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <div className="dashboard-shell flex min-h-0 flex-1 flex-col">
      <div className="dashboard-scroll" role="region" aria-label="Contenido del dashboard">
        <div className="dashboard-scroll__inner dashboard-scroll__inner--command">{children}</div>
      </div>
    </div>
  );
});

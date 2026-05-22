import { Loader2 } from 'lucide-react';

/** Skeleton alineado con DashboardShell (evita layout viejo en recarga). */
export default function DashboardLoading() {
  return (
    <div className="dashboard-shell">
      <div className="dashboard-scroll" aria-busy="true" aria-label="Cargando dashboard">
        <div className="dashboard-scroll__inner flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--dashboard-accent)]" />
        </div>
      </div>
    </div>
  );
}

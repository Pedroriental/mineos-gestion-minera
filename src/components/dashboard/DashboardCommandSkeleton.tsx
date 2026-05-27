/** Skeleton ligero mientras carga el bundle del Command Center (sin JS pesado). */
export function DashboardCommandSkeleton() {
  return (
    <div className="dashboard-shell flex min-h-0 flex-1 flex-col">
      <div className="dashboard-scroll" aria-busy="true" aria-label="Cargando dashboard">
        <div className="dashboard-scroll__inner dashboard-scroll__inner--command">
          <div className="dashboard-command-layout">
            <div className="dashboard-alerts-compact h-10 animate-pulse rounded-lg bg-[var(--dashboard-card-muted)]" />
            <div className="dashboard-command-main">
              <div className="dashboard-card dashboard-nodes-card--fill min-h-0 animate-pulse bg-[var(--dashboard-card-muted)]" />
              <div className="dashboard-metrics-rail min-h-0 animate-pulse bg-[var(--dashboard-card-muted)]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

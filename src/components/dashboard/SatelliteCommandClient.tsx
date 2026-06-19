'use client';

import { useMemo, useState } from 'react';
import { DashboardShell } from './DashboardShell';
import { DashboardCommandHeader } from './DashboardCommandHeader';
import { DashboardMetricsRail } from './DashboardMetricsRail';
import { NodeTacticalPanel } from './NodeTacticalPanel';
import { NodesOperationsMap } from './NodesOperationsMap';
import { ActiveSupervisorsPanel } from './ActiveSupervisorsPanel';
import type { GlobalData, LocationData } from './types';

export type { GlobalData, LocationData } from './types';

/**
 * Command Center — una sola vista sin scroll: alertas + mapa + rail (KPIs o nodo).
 */
export default function SatelliteCommandClient({
  locations,
  globalData,
  role,
}: {
  locations: LocationData[];
  globalData: GlobalData;
  role?: string;
}) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const isMiningSupervisor = role === 'mining_supervisor';
  const isMillSupervisor = role === 'mill_supervisor';
  const isSupervisor = isMiningSupervisor || isMillSupervisor;

  const selectedNode = useMemo(
    () => locations.find((l) => l.id === selectedNodeId) ?? null,
    [locations, selectedNodeId],
  );

  const activeNodes = locations.filter((l) => l.status === 'Activo').length;

  return (
    <DashboardShell>
      <div className="dashboard-command-layout">
        {isSupervisor && (
          <div className="flex items-center gap-2 border-b border-[var(--dashboard-border)] bg-[var(--dashboard-card-muted)] px-4 py-1.5">
            <span className="inline-flex items-center rounded-full bg-[var(--dashboard-accent)]/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--dashboard-accent)]">
              {isMiningSupervisor ? 'Mina' : 'Molino'}
            </span>
            <span className="text-[11px] text-[var(--dashboard-text-muted)]">
              Vista filtrada — solo datos de tu área
            </span>
          </div>
        )}
        <DashboardCommandHeader
          globalData={globalData}
          activeNodes={activeNodes}
          totalNodes={locations.length}
        />

        <div className="dashboard-command-main">
          <NodesOperationsMap
            locations={locations}
            selectedId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
          />

          <div className="dashboard-command-rail">
            {selectedNode ? (
              <NodeTacticalPanel
                loc={selectedNode}
                allLocations={locations}
                onClose={() => setSelectedNodeId(null)}
              />
            ) : (
              <div className="flex flex-col gap-3">
                <DashboardMetricsRail globalData={globalData} activeNodes={activeNodes} />
                {!isSupervisor && <ActiveSupervisorsPanel />}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

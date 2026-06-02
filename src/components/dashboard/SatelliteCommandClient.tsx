'use client';

import { useMemo, useState } from 'react';
import { DashboardShell } from './DashboardShell';
import { DashboardCommandHeader } from './DashboardCommandHeader';
import { DashboardMetricsRail } from './DashboardMetricsRail';
import { NodeTacticalPanel } from './NodeTacticalPanel';
import { NodesOperationsMap } from './NodesOperationsMap';
import type { GlobalData, LocationData } from './types';

export type { GlobalData, LocationData } from './types';

/**
 * Command Center — una sola vista sin scroll: alertas + mapa + rail (KPIs o nodo).
 */
export default function SatelliteCommandClient({
  locations,
  globalData,
}: {
  locations: LocationData[];
  globalData: GlobalData;
}) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const selectedNode = useMemo(
    () => locations.find((l) => l.id === selectedNodeId) ?? null,
    [locations, selectedNodeId],
  );

  const activeNodes = locations.filter((l) => l.status === 'Activo').length;

  return (
    <DashboardShell>
      <div className="dashboard-command-layout">
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
              <DashboardMetricsRail globalData={globalData} activeNodes={activeNodes} />
            )}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

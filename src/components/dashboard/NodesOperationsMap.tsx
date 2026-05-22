'use client';

import { useCallback, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { deriveNodeConnectionPairs } from '@/lib/dashboard-node-connections';
import type { LocationData } from './types';

const GRID_TICKS = [25, 50, 75];

/** Colocación de etiqueta por nodo para evitar solapamientos en el plano */
const NODE_LABEL_PLACEMENT: Record<string, 'top' | 'bottom' | 'left' | 'right'> = {
  Mantenimiento: 'bottom',
  'Molino 1': 'top',
  'Molino 1-2': 'top',
  'Molino 1-3': 'right',
  'Molino 2': 'top',
  'Molino 2-3': 'right',
  'Molino 3': 'bottom',
  'Molino Continuo': 'left',
  'Molino 1-2-3': 'right',
};

function getLabelPlacement(name: string, x: number, y: number): 'top' | 'bottom' | 'left' | 'right' {
  const fixed = NODE_LABEL_PLACEMENT[name];
  if (fixed) return fixed;
  if (x < 30) return 'right';
  if (x > 70) return 'left';
  if (y < 30) return 'bottom';
  if (y > 70) return 'top';
  return x < 50 ? 'right' : 'left';
}

function statusDotClass(status: LocationData['status']) {
  if (status === 'Activo') return 'dashboard-node-dot--active';
  if (status === 'Mantenimiento') return 'dashboard-node-dot--maint';
  return 'dashboard-node-dot--idle';
}

function getNeighborNames(nodeName: string, connectionPairs: [string, string][]): string[] {
  const neighbors = new Set<string>();
  for (const [a, b] of connectionPairs) {
    if (a === nodeName) neighbors.add(b);
    if (b === nodeName) neighbors.add(a);
  }
  return [...neighbors];
}

function CoordinateGrid() {
  return (
    <svg className="dashboard-nodes-grid" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
      <rect x="0" y="0" width="100" height="100" className="dashboard-nodes-grid__frame" />
      {GRID_TICKS.map((v) => (
        <g key={v}>
          <line x1={v} y1={0} x2={v} y2={100} className="dashboard-nodes-grid__line" />
          <line x1={0} y1={v} x2={100} y2={v} className="dashboard-nodes-grid__line" />
        </g>
      ))}
    </svg>
  );
}

type NodesOperationsMapProps = {
  locations: LocationData[];
  selectedId: string | null;
  onSelectNode: (id: string | null) => void;
};

/**
 * Mapa de nodos — clic en un molino abre el panel en la columna derecha.
 */
export function NodesOperationsMap({ locations, selectedId, onSelectNode }: NodesOperationsMapProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = useMemo(
    () => locations.filter((l) => l.name.toLowerCase().includes(searchQuery.toLowerCase().trim())),
    [locations, searchQuery],
  );

  const connectionPairs = useMemo(
    () => deriveNodeConnectionPairs(locations),
    [locations],
  );

  const focusNode = useMemo(
    () => locations.find((l) => l.id === selectedId) ?? null,
    [locations, selectedId],
  );

  const focusNeighborNames = useMemo(
    () =>
      focusNode ? new Set(getNeighborNames(focusNode.name, connectionPairs)) : new Set<string>(),
    [focusNode, connectionPairs],
  );

  const byName = useMemo(() => new Map(locations.map((l) => [l.name, l])), [locations]);

  const allConnectors = useMemo(() => {
    const edges: { x1: number; y1: number; x2: number; y2: number; key: string }[] = [];
    for (const [a, b] of connectionPairs) {
      const na = byName.get(a);
      const nb = byName.get(b);
      if (!na || !nb) continue;
      edges.push({
        key: [a, b].sort().join('|'),
        x1: na.coordinates.x,
        y1: na.coordinates.y,
        x2: nb.coordinates.x,
        y2: nb.coordinates.y,
      });
    }
    return edges;
  }, [connectionPairs, byName]);

  const activeConnectorKeys = useMemo(() => {
    if (!focusNode || focusNeighborNames.size === 0) return new Set<string>();
    const keys = new Set<string>();
    for (const neighborName of focusNeighborNames) {
      keys.add([focusNode.name, neighborName].sort().join('|'));
    }
    return keys;
  }, [focusNode, focusNeighborNames]);

  const handleMarkerClick = useCallback(
    (id: string) => {
      onSelectNode(selectedId === id ? null : id);
    },
    [onSelectNode, selectedId],
  );

  const getMarkerRole = useCallback(
    (loc: LocationData): 'focus' | 'linked' | 'dimmed' | 'visible' | 'hidden' => {
      const inFilter = filtered.some((f) => f.id === loc.id);
      if (!inFilter) return 'hidden';

      if (!focusNode) return 'visible';

      if (loc.id === focusNode.id) return 'focus';
      if (focusNeighborNames.has(loc.name)) return 'linked';
      return 'dimmed';
    },
    [filtered, focusNode, focusNeighborNames],
  );

  return (
    <section className="dashboard-card dashboard-nodes-card dashboard-nodes-card--fill">
      <div className="dashboard-nodes-card__header">
        <div className="dashboard-nodes-card__intro">
          <h2 className="dashboard-section-title dashboard-nodes-card__title">Mapa de nodos operacionales</h2>
          <p className="dashboard-section-desc dashboard-nodes-card__desc">
            Molinos, fusión y mantenimiento del complejo en tiempo real.
          </p>
        </div>
        <div className="dashboard-nodes-search">
          <Search className="h-4 w-4 shrink-0" aria-hidden />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar nodo..."
            className="dashboard-nodes-search__input"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="dashboard-nodes-search__clear"
              aria-label="Limpiar búsqueda"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="dashboard-nodes-canvas-wrap">
        <div className="dashboard-nodes-canvas">
          <CoordinateGrid />

          <svg
            className="dashboard-nodes-connectors"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden
          >
            {allConnectors.map((e) => {
              const active = activeConnectorKeys.has(e.key);
              return (
                <line
                  key={e.key}
                  x1={e.x1}
                  y1={e.y1}
                  x2={e.x2}
                  y2={e.y2}
                  className={
                    active
                      ? 'dashboard-nodes-connectors__line dashboard-nodes-connectors__line--active'
                      : 'dashboard-nodes-connectors__line dashboard-nodes-connectors__line--idle'
                  }
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
          </svg>

          {locations.map((loc) => {
            const role = getMarkerRole(loc);
            if (role === 'hidden') return null;

            const labelSide = getLabelPlacement(loc.name, loc.coordinates.x, loc.coordinates.y);
            return (
              <button
                key={loc.id}
                type="button"
                className={[
                  'dashboard-node-marker',
                  role === 'focus' ? 'dashboard-node-marker--focus' : '',
                  role === 'linked' ? 'dashboard-node-marker--linked' : '',
                  role === 'dimmed' ? 'dashboard-node-marker--dimmed' : '',
                  selectedId === loc.id ? 'dashboard-node-marker--selected' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={{
                  top: `${loc.coordinates.y}%`,
                  left: `${loc.coordinates.x}%`,
                }}
                onClick={() => handleMarkerClick(loc.id)}
              >
                <span className="dashboard-node-marker__anchor">
                  <span className={`dashboard-node-dot ${statusDotClass(loc.status)}`} aria-hidden />
                  <span className={`dashboard-node-marker__label dashboard-node-marker__label--${labelSide}`}>
                    {loc.name}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

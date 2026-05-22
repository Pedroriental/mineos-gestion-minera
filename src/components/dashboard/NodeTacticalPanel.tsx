'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, X } from 'lucide-react';
import type { LocationData } from './types';
import { SimpleSparkline } from './SimpleSparkline';

function statusBadgeClass(status: LocationData['status']) {
  if (status === 'Activo') return 'dashboard-node-badge--active';
  if (status === 'Mantenimiento') return 'dashboard-node-badge--maint';
  return 'dashboard-node-badge--idle';
}

type NodeTacticalPanelProps = {
  loc: LocationData;
  allLocations: LocationData[];
  onClose: () => void;
};

/** Panel contextual del nodo seleccionado en el mapa operacional. */
export function NodeTacticalPanel({ loc, allLocations, onClose }: NodeTacticalPanelProps) {
  const chartValues = useMemo(() => {
    const base = loc.kpis.produccion;
    return Array.from({ length: 12 }, (_, i) =>
      Math.max(0, base * (0.55 + ((i * 17 + loc.id.length * 3) % 40) / 100)));
  }, [loc.id, loc.kpis.produccion]);

  const fuseMatch = loc.name.match(/^Molino\s+([\d][-\d]+)$/i);
  const fuseNumbers = fuseMatch ? fuseMatch[1].split('-') : [];
  const fusedBases =
    fuseNumbers.length >= 2
      ? (fuseNumbers
          .map((n) => allLocations.find((l) => l.name === `Molino ${n}`))
          .filter(Boolean) as LocationData[])
      : [];
  const isFused = fusedBases.length >= 2;

  return (
    <aside className="dashboard-card dashboard-node-panel dashboard-node-panel--rail">
      <div className="dashboard-node-panel__header">
        <div>
          <p className="dashboard-node-panel__eyebrow">Nodo operacional</p>
          <h3 className="dashboard-node-panel__title">{loc.name}</h3>
        </div>
        <div className="dashboard-node-panel__actions">
          <span className={`dashboard-node-badge ${statusBadgeClass(loc.status)}`}>{loc.status}</span>
          <button type="button" onClick={onClose} className="dashboard-node-panel__close" aria-label="Cerrar">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="dashboard-node-panel__kpis">
        {isFused ? (
          <>
            <Row label="Au total (combinado)" value={loc.kpis.produccion.toLocaleString()} unit="g" />
            <Row label="Tenor promedio" value={loc.kpis.tenor} unit="g/t" />
            <Row label="Merma" value={`${loc.kpis.merma}%`} alert={loc.kpis.merma > 60} />
            {fusedBases.map((base) => (
              <div key={base.id} className="dashboard-node-panel__sub">
                <p className="dashboard-node-panel__sub-title">{base.name}</p>
                <Row label="Au" value={base.kpis.produccion.toLocaleString()} unit="g" />
                <Row label="Tenor" value={base.kpis.tenor} unit="g/t" />
                <Row label="Merma" value={`${base.kpis.merma}%`} alert={base.kpis.merma > 60} />
              </div>
            ))}
          </>
        ) : (
          <>
            <Row label="Au total" value={loc.kpis.produccion.toLocaleString()} unit="g" />
            <Row label="Tenor" value={loc.kpis.tenor} unit="g/t" />
            <Row label="Merma" value={`${loc.kpis.merma}%`} alert={loc.kpis.merma > 60} />
          </>
        )}
      </div>

      <div className="dashboard-node-panel__chart">
        <SimpleSparkline values={chartValues} />
      </div>

      {((loc.materiales?.length ?? 0) > 0 || (loc.origenes?.length ?? 0) > 0) && (
        <div className="dashboard-node-panel__meta">
          {(loc.materiales?.length ?? 0) > 0 && (
            <p>
              <span>Materiales:</span> {loc.materiales!.join(' · ')}
            </p>
          )}
          {(loc.origenes?.length ?? 0) > 0 && (
            <p>
              <span>Orígenes:</span> {loc.origenes!.join(' · ')}
            </p>
          )}
        </div>
      )}

      <Link href="/planta/produccion" className="dashboard-node-panel__link">
        Ver detalles técnicos
        <ArrowRight className="h-4 w-4" />
      </Link>
    </aside>
  );
}

function Row({
  label,
  value,
  unit,
  alert,
}: {
  label: string;
  value: string | number;
  unit?: string;
  alert?: boolean;
}) {
  return (
    <div className="dashboard-node-panel__row">
      <span>{label}</span>
      <span className={alert ? 'dashboard-node-panel__row--alert' : ''}>
        {value}
        {unit ? <small>{unit}</small> : null}
        {alert ? <AlertTriangle className="inline h-3.5 w-3.5 ml-1" /> : null}
      </span>
    </div>
  );
}

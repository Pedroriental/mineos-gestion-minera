'use client';

/**
 * Estratos solo en la zona inferior del panel (viewBox recortado).
 * Fronteras paralelas para que no se crucen al estirar.
 */
const B1 = 'M0,48 Q600,34 1200,42';
const B2 = 'M0,118 Q600,104 1200,112';
const B3 = 'M0,188 Q600,174 1200,182';
const B4 = 'M0,258 Q600,244 1200,252';

const STRATA_LAYERS = [
  { className: 'stratum-1', d: `${B1} L1200,400 L0,400 Z` },
  { className: 'stratum-2', d: `${B2} L1200,400 L0,400 Z` },
  { className: 'stratum-3', d: `${B3} L1200,400 L0,400 Z` },
  { className: 'stratum-4', d: `${B4} L1200,400 L0,400 Z` },
] as const;

export function GeologyStrataPanel() {
  return (
    <div className="geology-container" aria-hidden>
      <svg
        className="geology-static"
        viewBox="0 0 1200 400"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {STRATA_LAYERS.map((layer) => (
          <path key={layer.className} className={layer.className} d={layer.d} />
        ))}
      </svg>
    </div>
  );
}

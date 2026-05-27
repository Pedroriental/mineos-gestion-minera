'use client';

/**
 * Estratos en la zona inferior del login.
 * Tres franjas de altura uniforme + base gruesa; bordes horizontales.
 */
const VIEW_H = 400;
const BAND_H = 86;
const B1 = 1;
const B2 = BAND_H;
const B3 = BAND_H * 2;
const B4 = BAND_H * 3;

const STRATA_LAYERS = [
  { className: 'stratum-1', d: `M0,${B1} L1200,${B1} L1200,${VIEW_H} L0,${VIEW_H} Z` },
  { className: 'stratum-2', d: `M0,${B2} L1200,${B2} L1200,${VIEW_H} L0,${VIEW_H} Z` },
  { className: 'stratum-3', d: `M0,${B3} L1200,${B3} L1200,${VIEW_H} L0,${VIEW_H} Z` },
  { className: 'stratum-4', d: `M0,${B4} L1200,${B4} L1200,${VIEW_H} L0,${VIEW_H} Z` },
] as const;

export function GeologyStrataPanel() {
  return (
    <div className="geology-container" aria-hidden>
      <svg
        className="geology-static"
        viewBox={`0 0 1200 ${VIEW_H}`}
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

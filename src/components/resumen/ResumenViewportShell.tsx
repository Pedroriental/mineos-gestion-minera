'use client';

import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

/** Proporciones de referencia para zoom en pantallas ultra grandes (TV / 4K). */
const DESIGN_W = 1152;
const DESIGN_H = 720;
const MAX_ZOOM = 1.85;

type ViewportMode = 'compact' | 'fluid' | 'wide' | 'zoom';

type ViewportState = {
  mode: ViewportMode;
  scale: number;
  stageW: number;
  stageH: number;
};

function resolveViewport(availW: number, availH: number): ViewportState {
  if (availW < 1024) {
    return { mode: 'compact', scale: 1, stageW: availW, stageH: availH };
  }

  const rawScale = Math.min(availW / DESIGN_W, availH / DESIGN_H);
  const isUltra =
    availW >= 2400 ||
    availH >= 1400 ||
    (availW >= 2000 && availH >= 1100 && rawScale > 1.12);

  if (isUltra && rawScale > 1.05) {
    const scale = Math.min(MAX_ZOOM, rawScale);
    return {
      mode: 'zoom',
      scale,
      stageW: DESIGN_W * scale,
      stageH: DESIGN_H * scale,
    };
  }

  if (availW >= 1536) {
    return { mode: 'wide', scale: 1, stageW: availW, stageH: availH };
  }

  return { mode: 'fluid', scale: 1, stageW: availW, stageH: availH };
}

export function ResumenViewportShell({ children }: { children: React.ReactNode }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<ViewportState>({
    mode: 'fluid',
    scale: 1,
    stageW: DESIGN_W,
    stageH: DESIGN_H,
  });

  const measure = useCallback(() => {
    const host = hostRef.current;
    if (!host) return;

    const availW = host.clientWidth;
    const availH = host.clientHeight;
    if (availW <= 0 || availH <= 0) return;

    setViewport(resolveViewport(availW, availH));
  }, []);

  useLayoutEffect(() => {
    measure();

    const host = hostRef.current;
    if (!host) return;

    const ro = new ResizeObserver(measure);
    ro.observe(host);
    window.addEventListener('resize', measure);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [measure]);

  const isZoom = viewport.mode === 'zoom';

  return (
    <div
      ref={hostRef}
      className="resumen-ejecutivo-page__viewport-host"
      data-resumen-viewport={viewport.mode}
      data-resumen-scale={isZoom ? viewport.scale.toFixed(3) : undefined}
      style={
        isZoom
          ? ({ '--resumen-scale': viewport.scale } as CSSProperties)
          : undefined
      }
    >
      {isZoom ? (
        <div
          className="resumen-ejecutivo-page__scale-stage"
          style={{ width: viewport.stageW, height: viewport.stageH }}
        >
          <div
            className="resumen-ejecutivo-page__scale-inner"
            style={{
              width: DESIGN_W,
              height: DESIGN_H,
              transform: `scale(${viewport.scale})`,
            }}
          >
            {children}
          </div>
        </div>
      ) : (
        children
      )}
    </div>
  );
}

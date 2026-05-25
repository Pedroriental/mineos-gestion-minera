'use client';

import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

/** Lienzo de referencia (proporciones laptop); se escala para llenar el viewport. */
const DESIGN_W = 1152;
const DESIGN_H = 720;
const MIN_SCALE = 0.82;
/** Tope para 4K / TV ~40" (evita pixelado extremo en 8K). */
const MAX_SCALE = 3.25;
const SCALE_PAD_PX = 12;

type ScaleLayout = {
  scale: number;
  stageW: number;
  stageH: number;
};

function computeScale(availW: number, availH: number): number {
  const innerW = Math.max(0, availW - SCALE_PAD_PX * 2);
  const innerH = Math.max(0, availH - SCALE_PAD_PX * 2);
  const raw = Math.min(innerW / DESIGN_W, innerH / DESIGN_H);
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, raw));
}

export function ResumenScaleShell({ children }: { children: React.ReactNode }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [layout, setLayout] = useState<ScaleLayout>({
    scale: 1,
    stageW: DESIGN_W,
    stageH: DESIGN_H,
  });

  const measure = useCallback(() => {
    const host = hostRef.current;
    if (!host) return;

    const wideEnough = window.matchMedia('(min-width: 1024px)').matches;
    setActive(wideEnough);
    if (!wideEnough) return;

    const availW = host.clientWidth;
    const availH = host.clientHeight;
    if (availW <= 0 || availH <= 0) return;

    const scale = computeScale(availW, availH);

    setLayout({
      scale,
      stageW: DESIGN_W * scale,
      stageH: DESIGN_H * scale,
    });
  }, []);

  useLayoutEffect(() => {
    measure();

    const host = hostRef.current;
    if (!host) return;

    const ro = new ResizeObserver(measure);
    ro.observe(host);

    const mq = window.matchMedia('(min-width: 1024px)');
    mq.addEventListener('change', measure);
    window.addEventListener('resize', measure);

    return () => {
      ro.disconnect();
      mq.removeEventListener('change', measure);
      window.removeEventListener('resize', measure);
    };
  }, [measure]);

  return (
    <div
      ref={hostRef}
      className="resumen-ejecutivo-page__scale-host"
      data-resumen-scale={active ? layout.scale.toFixed(3) : undefined}
      style={
        active
          ? ({ '--resumen-scale': layout.scale } as CSSProperties)
          : undefined
      }
    >
      {active ? (
        <div
          className="resumen-ejecutivo-page__scale-stage"
          style={{ width: layout.stageW, height: layout.stageH }}
        >
          <div
            className="resumen-ejecutivo-page__scale-inner"
            style={{
              width: DESIGN_W,
              height: DESIGN_H,
              transform: `scale(${layout.scale})`,
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

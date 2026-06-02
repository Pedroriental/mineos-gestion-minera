'use client';

import { memo } from 'react';

type SimpleSparklineProps = {
  values: number[];
  variant?: 'accent' | 'danger' | 'neutral';
};

/** Sparkline SVG ultra-ligero (sin dependencias de gráficos). */
export const SimpleSparkline = memo(function SimpleSparkline({ values, variant = 'accent' }: SimpleSparklineProps) {
  const w = 120;
  const h = 36;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;

  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return `${x},${y}`;
    })
    .join(' ');

  const stroke =
    variant === 'danger'
      ? 'var(--dashboard-danger)'
      : variant === 'neutral'
        ? 'var(--dashboard-text-muted)'
        : 'var(--dashboard-accent)';

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="dashboard-sparkline"
      preserveAspectRatio="none"
      aria-hidden
    >
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
});

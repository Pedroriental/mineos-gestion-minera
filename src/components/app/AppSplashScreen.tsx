'use client';

import { useEffect, useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/lib/theme-context';

type AppSplashScreenProps = {
  onFinish?: () => void;
  minDuration?: number;
};

export function AppSplashScreen({ onFinish, minDuration = 1200 }: AppSplashScreenProps) {
  const [phase, setPhase] = useState<'enter' | 'visible' | 'exit' | 'hidden'>('enter');
  const { theme } = useTheme();
  const startTime = useRef(Date.now());
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  // Read actual theme from localStorage synchronously to avoid flash
  const isDark = (() => {
    try { return localStorage.getItem('mineos-theme') === 'dark'; } catch { return false; }
  })();

  useEffect(() => {
    const elapsed = Date.now() - startTime.current;
    const remain = Math.max(0, minDuration - elapsed);

    setPhase('visible');

    const timer = setTimeout(() => {
      setPhase('exit');
      setTimeout(() => {
        setPhase('hidden');
        onFinishRef.current?.();
      }, 500);
    }, remain);

    return () => clearTimeout(timer);
  }, [minDuration]);

  if (phase === 'hidden') return null;

  const logoSrc = isDark
    ? '/brand/mineos-logotipo-dark.svg?v=11'
    : '/brand/mineos-logotipo-light.svg?v=11';

  return (
    <div
      className={cn(
        'fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[var(--app-chrome-bg)] transition-opacity duration-500',
        phase === 'exit' ? 'opacity-0' : 'opacity-100',
      )}
    >
      <div className="flex flex-col items-center gap-8 px-6">
        <img
          src={logoSrc}
          alt="MineOS"
          className="h-auto w-auto max-h-[120px] max-w-[220px] object-contain"
          decoding="async"
        />

        <p
          className={cn(
            "text-center text-sm font-semibold leading-relaxed font-display",
            isDark ? "text-white/70" : "text-[var(--dashboard-text-muted)]"
          )}
        >
          Sistema de Gestión Minera
        </p>

        <div className="flex items-center justify-center">
          <span className="splash-spinner h-6 w-6 rounded-full border-2 border-[var(--dashboard-border)] border-t-[var(--dashboard-accent)]" />
        </div>
      </div>
    </div>
  );
}

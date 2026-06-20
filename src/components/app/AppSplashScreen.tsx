'use client';

import { useEffect, useState, useRef } from 'react';
import { cn } from '@/lib/utils';

type AppSplashScreenProps = {
  onFinish?: () => void;
  minDuration?: number;
};

export function AppSplashScreen({ onFinish, minDuration = 1200 }: AppSplashScreenProps) {
  const [phase, setPhase] = useState<'enter' | 'visible' | 'exit' | 'hidden'>('enter');
  const [isDark, setIsDark] = useState(false);
  const startTime = useRef(Date.now());
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  // Detect theme after mount only (avoids SSR mismatch)
  useEffect(() => {
    try {
      const attr = document.documentElement.getAttribute('data-theme');
      if (attr) { setIsDark(attr === 'dark'); return; }
    } catch { /* ignore */ }
    try {
      setIsDark(localStorage.getItem('mineos-theme') === 'dark');
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const elapsed = Date.now() - startTime.current;
    const remain = Math.max(0, minDuration - elapsed);
    setPhase('visible');
    const timer = setTimeout(() => {
      setPhase('exit');
      setTimeout(() => { setPhase('hidden'); onFinishRef.current?.(); }, 500);
    }, remain);
    return () => clearTimeout(timer);
  }, [minDuration]);

  if (phase === 'hidden') return null;

  const logoSrc = isDark
    ? '/brand/mineos-logotipo-light.svg?v=12'
    : '/brand/mineos-logotipo-dark.svg?v=12';

  return (
    <div
      className={cn(
        'fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-opacity duration-500',
        isDark ? 'bg-[#0a0a0a]' : 'bg-[var(--app-chrome-bg,#fafafa)]',
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
            'text-center text-sm font-semibold leading-relaxed font-display',
            isDark ? 'text-white/60' : 'text-gray-500',
          )}
        >
          Sistema de Gestión Minera
        </p>
        <div className="flex items-center justify-center">
          <span
            className={cn(
              'splash-spinner h-6 w-6 rounded-full border-2',
              isDark ? 'border-white/10 border-t-amber-400' : 'border-gray-200 border-t-amber-500',
            )}
          />
        </div>
      </div>
    </div>
  );
}

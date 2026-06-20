'use client';

import { useEffect, useState, useRef } from 'react';
import { cn } from '@/lib/utils';

type AppSplashScreenProps = {
  onFinish?: () => void;
  minDuration?: number;
};

function readIsDark(): boolean {
  try {
    const attr = document.documentElement.getAttribute('data-theme');
    if (attr) return attr === 'dark';
  } catch { /* ignore */ }
  try {
    return localStorage.getItem('mineos-theme') === 'dark';
  } catch { /* ignore */ }
  return false;
}

export function AppSplashScreen({ onFinish, minDuration = 1200 }: AppSplashScreenProps) {
  const [phase, setPhase] = useState<'enter' | 'visible' | 'exit' | 'hidden'>('enter');
  const [isDark, setIsDark] = useState(false);
  const startTime = useRef(Date.now());
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  // Detect theme + listen for changes via MutationObserver
  useEffect(() => {
    setIsDark(readIsDark());

    const observer = new MutationObserver(() => {
      setIsDark(readIsDark());
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => observer.disconnect();
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
    ? '/brand/mineos-logotipo-dark.svg?v=14'
    : '/brand/mineos-logotipo-light.svg?v=14';

  return (
    <div
      className={cn(
        'fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-all duration-300',
        isDark ? 'bg-[#0a0a0a]' : 'bg-[var(--app-chrome-bg,#fafafa)]',
        phase === 'exit' ? 'opacity-0' : 'opacity-100',
      )}
    >
      <div className="flex flex-col items-center gap-8 px-6">
        <img
          key={isDark ? 'dark' : 'light'}
          src={logoSrc}
          alt="MineOS"
          className="h-auto w-auto max-h-[120px] max-w-[220px] object-contain transition-opacity duration-200"
          decoding="async"
        />
        <p
          className={cn(
            'text-center text-sm font-semibold leading-relaxed font-display transition-colors duration-300',
            isDark ? 'text-white/60' : 'text-gray-500',
          )}
        >
          Sistema de Gestión Minera
        </p>
        <div className="flex items-center justify-center">
          <span
            className={cn(
              'splash-spinner h-6 w-6 rounded-full border-2 transition-colors duration-300',
              isDark ? 'border-white/10 border-t-amber-400' : 'border-gray-200 border-t-amber-500',
            )}
          />
        </div>
      </div>
    </div>
  );
}

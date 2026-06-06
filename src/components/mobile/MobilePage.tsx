'use client';

import {
  type ReactNode,
  useRef,
  useCallback,
  useState,
  useEffect,
} from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useMobileShell } from './MobileShell';

type MobilePageProps = {
  title: string;
  children: ReactNode;
  onBack?: () => void;
  fab?: ReactNode;
  onRefresh?: () => Promise<void>;
  className?: string;
};

export function MobilePage({
  title,
  children,
  onBack,
  fab,
  onRefresh,
  className = '',
}: MobilePageProps) {
  const { pushView, popView } = useMobileShell();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [refreshing, setRefreshing] = useState(false);

  const handleBack = useCallback(() => {
    if (onBack) onBack();
    else popView();
  }, [onBack, popView]);

  const touchStartY = useRef(0);
  const [pullDistance, setPullDistance] = useState(0);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!onRefresh) return;
      if ((scrollRef.current?.scrollTop ?? 0) > 0) return;
      touchStartY.current = e.touches[0].clientY;
    },
    [onRefresh],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!onRefresh) return;
      if ((scrollRef.current?.scrollTop ?? 0) > 0) return;
      const dy = e.touches[0].clientY - touchStartY.current;
      if (dy > 0) setPullDistance(Math.min(dy * 0.4, 80));
    },
    [onRefresh],
  );

  const handleTouchEnd = useCallback(async () => {
    if (!onRefresh || pullDistance < 50) {
      setPullDistance(0);
      return;
    }
    setRefreshing(true);
    setPullDistance(0);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh, pullDistance]);

  useEffect(() => {
    pushView('current', title);
  }, [title, pushView]);

  return (
    <div className="mobile-page flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-x-clip">
      <div className="mobile-page__header flex shrink-0 items-center gap-3 border-b px-4 py-3 backdrop-blur-xl">
        {onBack && (
          <button
            onClick={handleBack}
            className="mobile-shell__icon-btn flex h-9 w-9 items-center justify-center rounded-xl"
            aria-label="Atrás"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <h1 className="mobile-shell__title flex-1 truncate text-base font-bold tracking-tight">
          {title}
        </h1>
        {refreshing && (
          <RefreshCw className="h-4 w-4 animate-spin text-amber-400" />
        )}
      </div>

      {/* Content */}
      <div
        ref={scrollRef}
        className={`mobile-page__body min-h-0 min-w-0 max-w-full flex-1 overflow-x-clip overflow-y-auto overscroll-contain overscroll-x-none pb-[calc(72px+env(safe-area-inset-bottom))] ${className}`}
        style={{ WebkitOverflowScrolling: 'touch' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {pullDistance > 0 && (
          <div
            className="flex items-center justify-center transition-all"
            style={{ height: pullDistance }}
          >
            <div
              className="h-1 w-8 rounded-full bg-zinc-700"
              style={{
                opacity: pullDistance / 80,
                transform: `rotate(${pullDistance * 2}deg)`,
              }}
            />
          </div>
        )}

        <div className="px-4">
          {children}
        </div>
      </div>

      {fab && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-50 flex justify-center">
          <div className="pointer-events-auto">{fab}</div>
        </div>
      )}
    </div>
  );
}

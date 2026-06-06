'use client';

import { BellRing, Menu, Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MineosLogo } from '@/components/brand/MineosLogo';

type MobileAppHeaderProps = {
  onMenuPress: () => void;
  onBellPress: () => void;
  bellActive?: boolean;
  alertCount?: number;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
};

export function MobileAppHeader({
  onMenuPress,
  onBellPress,
  bellActive,
  alertCount = 0,
  theme,
  onToggleTheme,
}: MobileAppHeaderProps) {
  return (
    <header className="mobile-shell__header shrink-0">
      <div className="mobile-shell__header-inner">
        <button
          type="button"
          onClick={onMenuPress}
          className="mobile-shell__icon-btn flex h-8 w-8 items-center justify-center rounded-lg"
          aria-label="Menú completo"
        >
          <Menu className="h-4 w-4" strokeWidth={2} />
        </button>

        <div className="mobile-shell__brand">
          <MineosLogo variant="logotipo" className="mobile-shell__logo" alt="MineOS" />
        </div>

        <div className="mobile-shell__header-actions flex items-center justify-end">
          <button
            type="button"
            onClick={onToggleTheme}
            className="mobile-shell__icon-btn mobile-shell__icon-btn--ghost flex h-8 w-8 items-center justify-center rounded-lg"
            aria-label={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          >
            {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={onBellPress}
            className={cn(
              'mobile-shell__icon-btn relative flex h-8 w-8 items-center justify-center rounded-lg',
              bellActive && 'mobile-shell__icon-btn--active',
            )}
            aria-label="Notificaciones"
          >
            <BellRing className="h-3.5 w-3.5" />
            {alertCount > 0 ? (
              <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-[var(--mineos-expense)] ring-2 ring-[var(--dashboard-bg)]" />
            ) : null}
          </button>
        </div>
      </div>
    </header>
  );
}

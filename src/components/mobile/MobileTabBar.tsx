'use client';

import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutGrid,
  Factory,
  Pickaxe,
  UserCircle,
  MoreHorizontal,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type MobileTabBarProps = {
  onMorePress?: () => void;
};

type TabDef = {
  label: string;
  icon: LucideIcon;
  href: string;
  matchPrefix: string;
  badge?: number;
};

const MOBILE_TABS: TabDef[] = [
  { label: 'Panel', icon: LayoutGrid, href: '/dashboard', matchPrefix: '/dashboard' },
  { label: 'Planta', icon: Factory, href: '/planta/produccion', matchPrefix: '/planta' },
  { label: 'Mina', icon: Pickaxe, href: '/mina/voladuras', matchPrefix: '/mina' },
  { label: 'Admin', icon: UserCircle, href: '/admin/gastos', matchPrefix: '/admin' },
  { label: 'Más', icon: MoreHorizontal, href: '#more', matchPrefix: '' },
];

export function MobileTabBar({ onMorePress }: MobileTabBarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const activeIdx = MOBILE_TABS.findIndex(
    (t) => t.matchPrefix && pathname.startsWith(t.matchPrefix),
  );

  return (
    <nav
      className="mobile-tab-bar flex shrink-0 items-stretch border-t backdrop-blur-2xl"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {MOBILE_TABS.map((tab, i) => {
        const Icon = tab.icon;
        const active = i === activeIdx;
        const isMore = tab.href === '#more';

        return (
          <button
            key={i}
            onClick={() => {
              if (isMore) {
                onMorePress?.();
              } else {
                router.push(tab.href);
              }
            }}
            className="flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 outline-none transition-all active:scale-90"
            style={{ WebkitTapHighlightColor: 'transparent' }}
            aria-label={tab.label}
          >
            {active && (
              <span className="mobile-tab-bar__indicator absolute top-0 h-[2px] w-8 rounded-b-full" />
            )}
            <div className="relative">
              <Icon
                className={cn(
                  'h-5 w-5 transition-colors',
                  active ? 'mobile-tab-bar__icon--active' : 'mobile-tab-bar__icon',
                )}
              />
              {tab.badge != null && tab.badge > 0 && (
                <span className="absolute -right-1.5 -top-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-red-500 px-[3px] text-[8px] font-bold text-white">
                  {tab.badge > 9 ? '9+' : tab.badge}
                </span>
              )}
            </div>
            <span
              className={cn(
                'mobile-tab-bar__label text-[9px] font-bold uppercase tracking-widest transition-colors',
                active && 'mobile-tab-bar__label--active',
              )}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

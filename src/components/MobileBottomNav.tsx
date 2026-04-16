'use client';

import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Factory, Pickaxe, BookOpen, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

// Only the 4 most critical routes stay in the bottom bar.
// Everything else goes into the Sidebar drawer (opened via the ⋯ button).
interface Tab {
  label: string;
  icon: React.ReactNode;
  href: string;
  matchPrefix: string;
}

const TABS: Tab[] = [
  {
    label: 'Dashboard',
    icon: <LayoutDashboard className="w-5 h-5" />,
    href: '/dashboard',
    matchPrefix: '/dashboard',
  },
  {
    label: 'Planta',
    icon: <Factory className="w-5 h-5" />,
    href: '/planta/produccion',
    matchPrefix: '/planta',
  },
  {
    label: 'Mina',
    icon: <Pickaxe className="w-5 h-5" />,
    href: '/mina/voladuras',
    matchPrefix: '/mina',
  },
  {
    label: 'Ops',
    icon: <BookOpen className="w-5 h-5" />,
    href: '/operaciones/resumen',
    matchPrefix: '/operaciones',
  },
];

interface MobileBottomNavProps {
  /** Called when the ⋯ button is pressed — opens the Sidebar drawer */
  onMorePress: () => void;
}

export default function MobileBottomNav({ onMorePress }: MobileBottomNavProps) {
  const pathname = usePathname();
  const router   = useRouter();

  const isActive = (tab: Tab) => pathname.startsWith(tab.matchPrefix);

  return (
    <nav
      className={cn(
        'md:hidden fixed bottom-0 inset-x-0 z-40',
        'flex items-stretch',
        'bg-zinc-950/95 border-t border-zinc-800/60',
        'backdrop-blur-xl',
        // iOS safe-area bottom padding
      )}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {TABS.map((tab) => {
        const active = isActive(tab);
        return (
          <button
            key={tab.href}
            onClick={() => router.push(tab.href)}
            className={cn(
              'flex-1 flex flex-col items-center justify-center gap-0.5',
              'pt-2 pb-1.5 min-h-[52px] relative',
              'transition-all duration-150 active:scale-95',
              // Prevent iOS highlight
              'outline-none',
            )}
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            {/* Active indicator — top border line, no glow */}
            {active && (
              <span
                className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-8 rounded-b-full bg-amber-500"
                aria-hidden="true"
              />
            )}

            {/* Icon */}
            <span
              className={cn(
                'transition-colors duration-150',
                active ? 'text-amber-400' : 'text-zinc-600',
              )}
            >
              {tab.icon}
            </span>

            {/* Label */}
            <span
              className={cn(
                'text-[9px] font-bold uppercase tracking-wider transition-colors duration-150',
                active ? 'text-amber-400' : 'text-zinc-600',
              )}
            >
              {tab.label}
            </span>
          </button>
        );
      })}

      {/* ⋯ More — opens the full sidebar drawer */}
      <button
        onClick={onMorePress}
        className={cn(
          'flex-1 flex flex-col items-center justify-center gap-0.5',
          'pt-2 pb-1.5 min-h-[52px] outline-none',
          'transition-all duration-150 active:scale-95',
          'text-zinc-600 hover:text-zinc-400',
        )}
        style={{ WebkitTapHighlightColor: 'transparent' }}
        aria-label="Más módulos"
      >
        <MoreHorizontal className="w-5 h-5" />
        <span className="text-[9px] font-bold uppercase tracking-wider">Más</span>
      </button>
    </nav>
  );
}

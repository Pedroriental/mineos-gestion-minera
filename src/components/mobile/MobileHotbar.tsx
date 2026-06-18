'use client';

import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { getActiveMobileHotbarId, MOBILE_HOTBAR } from '@/lib/mobile-nav';

export function MobileHotbar() {
  const pathname = usePathname();
  const router = useRouter();
  const activeId = getActiveMobileHotbarId(pathname);

  return (
    <nav
      className="mobile-hotbar shrink-0"
      aria-label="Navegación principal"
    >
      <div className="mobile-hotbar__dock grid grid-cols-3 gap-px p-px">
        {MOBILE_HOTBAR.map((item) => {
          const Icon = item.Icon;
          const active = activeId === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => router.push(item.href)}
              aria-current={active ? 'page' : undefined}
              aria-label={item.label}
              className={cn(
                'mobile-hotbar__item relative flex flex-col items-center justify-center gap-px rounded-[0.55rem] py-px outline-none transition-all active:scale-[0.97]',
                active && 'mobile-hotbar__item--active',
              )}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <span className="mobile-hotbar__icon-wrap flex items-center justify-center transition-[color,filter,box-shadow] duration-200">
                <Icon className="h-4 w-4" strokeWidth={2.25} />
              </span>
              <span className="mobile-hotbar__label max-w-full truncate px-0.5 text-[10px] font-semibold">
                {item.shortLabel}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

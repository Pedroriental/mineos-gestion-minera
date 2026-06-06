'use client';

import { ChevronRight, type LucideIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

type MobileQuickTileProps = {
  label: string;
  href: string;
  Icon?: LucideIcon;
  tone?: 'general' | 'benefit' | 'expense' | 'neutral';
};

export function MobileQuickTile({ label, href, Icon, tone = 'general' }: MobileQuickTileProps) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.push(href)}
      className={cn('mobile-quick-tile', `mobile-quick-tile--${tone}`)}
    >
      {Icon ? (
        <span className="mobile-quick-tile__icon">
          <Icon className="h-4 w-4" strokeWidth={2} />
        </span>
      ) : null}
      <span className="mobile-quick-tile__label">{label}</span>
      <ChevronRight className="mobile-quick-tile__chevron ml-auto h-3.5 w-3.5 shrink-0 opacity-40" />
    </button>
  );
}

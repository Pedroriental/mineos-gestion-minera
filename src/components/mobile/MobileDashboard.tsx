'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Gem,
  Receipt,
  AlertTriangle,
  Flame,
  Users,
  Timer,
  Factory,
  HardHat,
  Wallet,
  Package,
} from 'lucide-react';
import { fontDisplay } from '@/lib/fonts';
import { cn } from '@/lib/utils';
import { MOBILE_HOME_SHORTCUTS } from '@/lib/mobile-nav';
import { MobileSection, MobileKpi } from './MobileSection';
import { MobileListItem } from './MobileListItem';
import { MobileQuickTile } from './MobileQuickTile';
import type { GlobalData, LocationData } from '@/components/dashboard/types';

const SHORTCUT_ICONS = {
  Voladuras: HardHat,
  Extracción: HardHat,
  Producción: Factory,
  Gastos: Wallet,
  'Nómina Mina': Users,
  Inventario: Package,
} as const;

type MobileDashboardProps = {
  locations: LocationData[];
  globalData: GlobalData;
};

export function MobileDashboard({ locations, globalData }: MobileDashboardProps) {
  const router = useRouter();

  const activeNodes = useMemo(
    () => locations.filter((l) => l.status === 'Activo').length,
    [locations],
  );

  const criticalItems = useMemo(() => {
    const items: { label: string; value: string; href: string }[] = [];
    if (globalData.criticalInventory > 0) {
      items.push({
        label: 'Inventario crítico',
        value: `${globalData.criticalInventory} ítems`,
        href: '/admin/inventario',
      });
    }
    return items;
  }, [globalData.criticalInventory]);

  const oroFormatted = globalData.totalGrams.toLocaleString('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  return (
    <div className="mobile-home flex flex-col gap-2.5 px-2 pb-1">
      <header className="mobile-section-lead mobile-section-lead--inline">
        <h1 className={cn('mobile-section-lead__title font-display', fontDisplay.className)}>
          Command Center
        </h1>
      </header>

      <div className="mobile-hero-card relative overflow-hidden rounded-2xl border p-3.5">
        <div className="mobile-hero-card__glow" aria-hidden />
        <p className="mobile-hero-card__eyebrow text-[10px] font-bold uppercase tracking-[0.16em]">
          Oro del periodo
        </p>
        <div className="mt-1 flex items-end gap-2">
          <span className="mobile-hero-card__value text-3xl font-black tabular-nums tracking-tight">
            {oroFormatted}
          </span>
          <span className="mobile-hero-card__unit pb-1 text-sm font-semibold">g</span>
        </div>
        <p className="mobile-hero-card__hint mt-2 text-[11px] leading-snug">
          Gastos hoy{' '}
          <strong className="font-semibold tabular-nums">
            ${globalData.todayExpenses.toLocaleString()}
          </strong>
          {' · '}
          Personal{' '}
          <strong className="font-semibold tabular-nums">{globalData.activePersonnel}</strong>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <MobileKpi
          label="Gastos mes"
          value={`$${globalData.monthlyExpenses.toLocaleString()}`}
          icon={<Receipt className="h-3.5 w-3.5" />}
          compact
        />
        <MobileKpi
          label="Nodos activos"
          value={String(activeNodes)}
          unit={`/ ${locations.length}`}
          icon={<Timer className="h-3.5 w-3.5" />}
          compact
        />
        <MobileKpi
          label="Inventario"
          value={String(globalData.criticalInventory)}
          unit="crít."
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
          tone={globalData.criticalInventory > 0 ? 'expense' : 'neutral'}
          compact
        />
        <MobileKpi
          label="Oro total"
          value={oroFormatted}
          unit="g"
          icon={<Gem className="h-3.5 w-3.5" />}
          tone="benefit"
          compact
        />
      </div>

      <MobileSection title="Acceso rápido" tight>
        <div className="mobile-quick-grid grid grid-cols-2 gap-px p-px">
          {MOBILE_HOME_SHORTCUTS.map((item) => {
            const Icon = SHORTCUT_ICONS[item.label as keyof typeof SHORTCUT_ICONS];
            return (
              <MobileQuickTile
                key={item.href}
                label={item.label}
                href={item.href}
                Icon={Icon}
                tone={item.tone}
              />
            );
          })}
        </div>
      </MobileSection>

      { (globalData.balancesPlanchas ?? []).length > 0 && (
        <MobileSection title="Planchas" tight>
          {globalData.balancesPlanchas.map((p) => (
            <MobileListItem
              key={p.id}
              label={p.label}
              value={`${p.grams.toFixed(1)} g`}
              icon={<Flame className="h-4 w-4" />}
              compact
            />
          ))}
        </MobileSection>
      )}

      {criticalItems.length > 0 && (
        <MobileSection title="Atención" tight>
          {criticalItems.map((item, i) => (
            <MobileListItem
              key={i}
              label={item.label}
              value={item.value}
              dot="bg-[var(--mineos-expense)]"
              onClick={() => router.push(item.href)}
              compact
            />
          ))}
        </MobileSection>
      )}
    </div>
  );
}

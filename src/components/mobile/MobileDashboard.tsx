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
  Pickaxe,
  Wrench,
  Truck,
  Activity,
} from 'lucide-react';
import { fontDisplay } from '@/lib/fonts';
import { cn } from '@/lib/utils';
import { safeMap } from '@/lib/safe-map';
import { getMobileHomeShortcuts } from '@/lib/mobile-nav';
import { useAuth } from '@/lib/auth-context';
import { MobileSection, MobileKpi } from './MobileSection';
import { MobileListItem } from './MobileListItem';
import { MobileQuickTile } from './MobileQuickTile';
import { ActiveSupervisorsPanel } from '@/components/dashboard/ActiveSupervisorsPanel';
import type { GlobalData, LocationData } from '@/components/dashboard/types';

const SHORTCUT_ICONS = {
  Voladuras: HardHat,
  Extracción: HardHat,
  'Extracción Mina': Pickaxe,
  'Visitantes': Users,
  'Notificaciones': AlertTriangle,
  'Reportes': AlertTriangle,
  'Reporte Diario': AlertTriangle,
  Producción: Factory,
  Gastos: Wallet,
  'Nómina Mina': Users,
  Inventario: Package,
} as const;

type MobileDashboardProps = {
  locations: LocationData[];
  globalData: GlobalData;
  role?: string;
};

export function MobileDashboard({ locations, globalData, role }: MobileDashboardProps) {
  const router = useRouter();
  const { role: authRole } = useAuth();
  const effectiveRole = role ?? authRole;
  const isMiningSupervisor = effectiveRole === 'mining_supervisor';
  const isMillSupervisor = effectiveRole === 'mill_supervisor';
  const isSupervisor = isMiningSupervisor || isMillSupervisor;
  const shortcuts = getMobileHomeShortcuts(authRole);

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
    if (isMiningSupervisor && (globalData.voladurasConNovedad ?? 0) > 0) {
      items.push({
        label: 'Voladuras con novedad',
        value: `${globalData.voladurasConNovedad} voladuras`,
        href: '/mina/voladuras',
      });
    }
    return items;
  }, [globalData.criticalInventory, isMiningSupervisor, globalData.voladurasConNovedad]);

  const oroFormatted = globalData.totalGrams.toLocaleString('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  const roleTitle = isMiningSupervisor ? 'Supervisor de Mina' : isMillSupervisor ? 'Supervisor de Molino' : 'Centro de Comando';

  return (
    <div className="mobile-home flex flex-col gap-2.5 px-2 pb-1">
      <header className="mobile-section-lead mobile-section-lead--inline">
        <h1 className={cn('mobile-section-lead__title font-display', fontDisplay.className)}>
          {roleTitle}
        </h1>
        {isSupervisor && (
          <p className="text-[11px] font-medium text-[var(--dashboard-text-muted)]">
            {isMiningSupervisor ? 'Vista: Mina' : 'Vista: Molino'}
          </p>
        )}
      </header>

      {isMiningSupervisor ? (
        <>
          {/* ── Mining Hero Card ── */}
          <div className="mobile-hero-card relative overflow-hidden rounded-2xl border p-3.5">
            <div className="mobile-hero-card__glow" aria-hidden />
            <p className="mobile-hero-card__eyebrow text-[10px] font-bold uppercase tracking-[0.16em]">
              Extracción del periodo
            </p>
            <div className="mt-1 flex items-end gap-2">
              <span className="mobile-hero-card__value text-3xl font-black tabular-nums tracking-tight">
                {(globalData.sacosExtraidosPeriodo ?? 0).toLocaleString('en-US')}
              </span>
              <span className="mobile-hero-card__unit pb-1 text-sm font-semibold">sacos</span>
            </div>
            <p className="mobile-hero-card__hint mt-2 text-[11px] leading-snug">
              Hoy{' '}
              <strong className="font-semibold tabular-nums">{globalData.sacosExtraidosHoy ?? 0}</strong> sacos
              {' · '}Personal{' '}
              <strong className="font-semibold tabular-nums">{globalData.activePersonnel}</strong>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <MobileKpi
              label="Voladuras"
              value={String(globalData.voladurasPeriodo ?? 0)}
              unit="periodo"
              icon={<HardHat className="h-3.5 w-3.5" />}
              compact
            />
            <MobileKpi
              label="c/ Novedad"
              value={String(globalData.voladurasConNovedad ?? 0)}
              unit="atender"
              icon={<AlertTriangle className="h-3.5 w-3.5" />}
              tone={(globalData.voladurasConNovedad ?? 0) > 0 ? 'expense' : 'neutral'}
              compact
            />
            <MobileKpi
              label="Equipos"
              value={String(globalData.equiposOperativos ?? 0)}
              unit={`/ ${globalData.eqTotal ?? 0} oper.`}
              icon={<Wrench className="h-3.5 w-3.5" />}
              compact
            />
            <MobileKpi
              label="Extracciones"
              value={String(globalData.extraccionesPeriodo ?? 0)}
              unit="informes"
              icon={<Pickaxe className="h-3.5 w-3.5" />}
              tone="benefit"
              compact
            />
          </div>
        </>
      ) : isMillSupervisor ? (
        <>
          {/* ── Mill Hero Card ── */}
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
              Quemado{' '}
              <strong className="font-semibold tabular-nums">
                {(globalData.oroQuemadoPeriodo ?? 0).toFixed(1)} g
              </strong>
              {' · '}Personal{' '}
              <strong className="font-semibold tabular-nums">{globalData.activePersonnel}</strong>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <MobileKpi
              label="Oro total"
              value={oroFormatted}
              unit="g"
              icon={<Gem className="h-3.5 w-3.5" />}
              tone="benefit"
              compact
            />
            <MobileKpi
              label="Acarreo"
              value={`${(globalData.cargaAcarreadaPeriodo ?? 0).toLocaleString('en-US')}`}
              unit="ton"
              icon={<Truck className="h-3.5 w-3.5" />}
              compact
            />
            <MobileKpi
              label="Molinos"
              value={String(activeNodes)}
              unit={`/ ${locations.length} act.`}
              icon={<Factory className="h-3.5 w-3.5" />}
              compact
            />
            <MobileKpi
              label="Producción"
              value={String(globalData.produccionesPeriodo ?? 0)}
              unit="informes"
              icon={<Activity className="h-3.5 w-3.5" />}
              compact
            />
          </div>
        </>
      ) : (
        <>
          {/* ── Original Admin Hero Card ── */}
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
        </>
      )}

      <MobileSection title="Acceso rápido" tight>
        <div className="mobile-quick-grid grid grid-cols-2 gap-px p-px">
          {shortcuts.map((item) => {
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

      { !isMiningSupervisor && (globalData.balancesPlanchas ?? []).length > 0 && (
        <MobileSection title="Planchas" tight>
          {safeMap(globalData.balancesPlanchas, (p) => (
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

      {!isSupervisor && (
        <ActiveSupervisorsPanel />
      )}
    </div>
  );
}

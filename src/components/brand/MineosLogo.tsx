'use client';

import { useTheme } from '@/lib/theme-context';
import { cn } from '@/lib/utils';

/** Incrementar al cambiar SVG en /public/brand (evita caché del navegador) */
const BRAND_ASSET_VERSION = '9';

const BRAND = {
  logotipo: {
    light: `/brand/mineos-logotipo-light.svg?v=${BRAND_ASSET_VERSION}`,
    dark: `/brand/mineos-logotipo-dark.svg?v=${BRAND_ASSET_VERSION}`,
  },
  icon: {
    light: `/brand/mineos-icon-light.svg?v=${BRAND_ASSET_VERSION}`,
    dark: `/brand/mineos-icon-dark.svg?v=${BRAND_ASSET_VERSION}`,
  },
} as const;

export type MineosLogoVariant = keyof typeof BRAND;

/** Fondo donde se muestra el logo: claro → trazo oscuro; oscuro → trazo claro */
export type BrandSurface = 'light' | 'dark';

type MineosLogoProps = {
  variant: MineosLogoVariant;
  /** Si no se indica, sigue el tema de la app (login, etc.) */
  surface?: BrandSurface;
  className?: string;
  alt?: string;
};

export function MineosLogo({
  variant,
  surface,
  className,
  alt = 'MineOS',
}: MineosLogoProps) {
  const { theme } = useTheme();
  const resolved: BrandSurface =
    surface ?? (theme === 'dark' ? 'dark' : 'light');
  const src = BRAND[variant][resolved];

  return (
    <img
      src={src}
      alt={alt}
      decoding="async"
      className={cn(
        'block min-h-0 min-w-0 object-contain',
        variant === 'logotipo'
          ? 'h-full w-auto max-w-full object-left'
          : 'h-full w-full object-center',
        className,
      )}
    />
  );
}

/** Isotipo claro u oscuro según fondo del sidebar (dashboard + tema) */
export function sidebarIconSurface(
  variant: 'default' | 'dashboard',
  theme: 'light' | 'dark',
): BrandSurface {
  if (variant === 'default') return 'dark';
  return theme === 'dark' ? 'dark' : 'light';
}

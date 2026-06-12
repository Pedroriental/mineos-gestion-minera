'use client';

import { useTheme } from '@/lib/theme-context';
import { cn } from '@/lib/utils';

/** Incrementar al cambiar SVG en /public/brand (evita caché del navegador) */
const BRAND_ASSET_VERSION = '11';

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
        'mineos-logo block shrink-0 object-contain object-center',
        variant === 'logotipo' && 'mineos-logo--logotipo h-7 w-auto max-h-7 max-w-[9.5rem]',
        variant === 'icon' && 'mineos-logo--icon h-10 w-10 max-h-12 max-w-12',
        className,
      )}
    />
  );
}

export function sidebarIconSurface(theme: 'light' | 'dark'): BrandSurface {
  return theme === 'dark' ? 'dark' : 'light';
}

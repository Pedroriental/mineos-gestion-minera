const MOBILE_BREAKPOINT = 768;

export function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < MOBILE_BREAKPOINT;
}

function mobileBottomGutter(gutter: number): number {
  if (!isMobileViewport()) return gutter;
  return gutter + 28;
}

type FixedMenuPosition = {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
  dropUp: boolean;
};

export function computeFixedMenuPosition({
  anchorRect,
  menuWidth,
  estimatedHeight,
  maxHeightCap,
  gutter = 12,
  centerOnMobile = true,
  preferDropUp = false,
  centerHorizontally = false,
}: {
  anchorRect: DOMRect;
  menuWidth: number;
  estimatedHeight: number;
  maxHeightCap: number;
  gutter?: number;
  centerOnMobile?: boolean;
  preferDropUp?: boolean;
  centerHorizontally?: boolean;
}): FixedMenuPosition {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const mobile = centerOnMobile && isMobileViewport();

  if (mobile) {
    const width = Math.min(menuWidth, vw - gutter * 2);
    const left = Math.max(gutter, (vw - width) / 2);
    const maxHeight = Math.min(maxHeightCap, vh - gutter * 2);
    const height = Math.min(estimatedHeight, maxHeight);
    const top = Math.max(gutter, (vh - height) / 2);
    return { left, width, maxHeight, dropUp: false, top };
  }

  if (centerHorizontally) {
    const width = Math.min(Math.max(anchorRect.width, menuWidth), vw - gutter * 2);
    const left = Math.max(gutter, (vw - width) / 2);
    const maxHeight = Math.min(maxHeightCap, vh - gutter * 2);
    const height = Math.min(estimatedHeight, maxHeight);
    const top = Math.max(gutter, (vh - height) / 2);
    return { left, width, maxHeight, dropUp: false, top };
  }

  const width = Math.min(Math.max(anchorRect.width, menuWidth), vw - gutter * 2);
  let left = anchorRect.left;
  left = Math.max(gutter, Math.min(left, vw - width - gutter));

  const bottomGutter = mobileBottomGutter(gutter);
  const spaceBelow = vh - anchorRect.bottom - bottomGutter;
  const spaceAbove = anchorRect.top - gutter;
  const minMenu = Math.min(estimatedHeight, maxHeightCap);
  const needsDropUp = spaceBelow < minMenu + 8;
  const canDropUp = spaceAbove >= Math.min(minMenu, 72);
  const isMobile = isMobileViewport();
  const dropUp =
    (preferDropUp && canDropUp) ||
    (needsDropUp && canDropUp && spaceAbove >= spaceBelow) ||
    (isMobile && preferDropUp && anchorRect.bottom > vh * 0.28 && canDropUp);

  const maxHeight = Math.min(
    maxHeightCap,
    Math.max(96, dropUp ? spaceAbove - 8 : spaceBelow - 8),
  );

  return {
    left,
    width,
    maxHeight,
    dropUp,
    ...(dropUp
      ? { bottom: vh - anchorRect.top + 6 }
      : { top: anchorRect.bottom + 6 }),
  };
}

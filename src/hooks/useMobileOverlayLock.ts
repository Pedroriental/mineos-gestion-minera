'use client';

import { useEffect } from 'react';

export function useMobileOverlayLock(open: boolean, enabled = true) {
  useEffect(() => {
    if (!open || !enabled) return;
    document.body.setAttribute('data-mobile-overlay-open', '');
    return () => document.body.removeAttribute('data-mobile-overlay-open');
  }, [open, enabled]);
}

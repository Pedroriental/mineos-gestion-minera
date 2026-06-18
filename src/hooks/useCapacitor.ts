'use client';

import { useEffect } from 'react';

export function useCapacitor() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isCapacitor = !!(window as any).Capacitor?.isNativePlatform();
    if (!isCapacitor) return;

    document.body.setAttribute('data-capacitor', '');

    (async () => {
      try {
        const { StatusBar, Style } = await import('@capacitor/status-bar');
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setOverlaysWebView({ overlay: false });
      } catch {}

      try {
        const { SplashScreen } = await import('@capacitor/splash-screen');
        await SplashScreen.hide();
      } catch {}

      try {
        const { App } = await import('@capacitor/app');
        await App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) {
            window.location.reload();
          }
        });
      } catch {}
    })();
  }, []);
}

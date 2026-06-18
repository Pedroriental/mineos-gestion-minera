import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.mineos.app',
  appName: 'MineOS',
  webDir: 'out',
  server: {
    url: 'https://mineos.me',
    androidScheme: 'https',
    allowNavigation: [
      'mineos.me',
      '*.supabase.co',
      '*.google.com'
    ]
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 3000,
      backgroundColor: '#09090b',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      overlaysWebView: false,
    },
  },
  android: {
    backgroundColor: '#09090b',
    allowMixedContent: true,
    captureInput: true
  }
};

export default config;

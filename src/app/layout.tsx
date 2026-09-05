import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { fontDisplay, fontMono, fontSans } from "@/lib/fonts";

export const metadata: Metadata = {
  title: "MineOS — Sistema de Gestión Minera",
  description: "Sistema integral de gestión de producción y finanzas para minas de oro",
  manifest: "/manifest.json",
  applicationName: "MineOS",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MineOS",
  },
  formatDetection: {
    telephone: false,    // Prevent iOS from auto-linking numbers
    email: false,
    address: false,
  },
  icons: {
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: [{ url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" }],
  },
  other: {
    // iOS splash screens (most common device sizes)
    "apple-mobile-web-app-capable": "yes",
    "mobile-web-app-capable": "yes",       // Android Chrome
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,           // Allow user zoom (accessibility)
  userScalable: true,
  viewportFit: "cover",      // Required for iOS notch / Dynamic Island
  themeColor: [
    { media: "(prefers-color-scheme: dark)",  color: "#09090b" },
    { media: "(prefers-color-scheme: light)", color: "#F59E0B" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://api.fontshare.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://api.fontshare.com" />
        <link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=satoshi@700,500,400&display=swap" />
        {/* Tema antes del paint — debe coincidir con theme-context (default: light) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('mineos-theme');var th=t==='dark'?'dark':'light';document.documentElement.setAttribute('data-theme',th);document.documentElement.classList.toggle('dark-mode',th==='dark');}catch(e){}`,
          }}
        />
        {/* Service Worker: solo producción; en localhost se desregistra para no romper HMR */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){if(!('serviceWorker' in navigator))return;var h=location.hostname;var dev=h==='localhost'||h==='127.0.0.1'||h==='[::1]';function clearSw(){navigator.serviceWorker.getRegistrations().then(function(regs){regs.forEach(function(r){r.unregister()})});if('caches' in window){caches.keys().then(function(keys){keys.forEach(function(k){caches.delete(k)})})}}if(dev){clearSw();return}function isChunkMsg(m){return m&&(m.indexOf('ChunkLoadError')>=0||m.indexOf('Loading chunk')>=0||m.indexOf('Failed to load chunk')>=0)}function reloadAfterChunkError(){var k='mineos-chunk-reload';var n=Number(sessionStorage.getItem(k)||'0');if(n>=3)return;sessionStorage.setItem(k,String(n+1));clearSw().finally(function(){location.reload()})}window.addEventListener('unhandledrejection',function(ev){var r=ev&&ev.reason;var msg=(r&&r.message)||String(r||'');if(!isChunkMsg(msg))return;reloadAfterChunkError()});window.addEventListener('load',function(){sessionStorage.removeItem('mineos-chunk-reload');navigator.serviceWorker.register('/sw.js?v=15').then(function(r){r.update();console.log('SW v15 registered',r.scope)}).catch(function(e){console.warn('SW failed:',e)})})})();`,
          }}
        />
      </head>
      <body className={`${fontSans.variable} ${fontDisplay.variable} ${fontMono.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

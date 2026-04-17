import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";

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
      { url: "/icons/apple-touch-icon.png", sizes: "180x180" },
    ],
    icon: [
      { url: "/icons/icon-128.png", sizes: "128x128", type: "image/png" },
      { url: "/icons/icon-256.png", sizes: "256x256", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
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
    <html lang="es">
      <head>
        {/* Theme detection — runs before paint to avoid flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('mineos-theme');document.documentElement.setAttribute('data-theme',t==='light'?'light':'dark');}catch(e){}`,
          }}
        />
        {/* Service Worker registration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').then(function(r){console.log('SW registered',r.scope)}).catch(function(e){console.warn('SW failed:',e)})})}`,
          }}
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

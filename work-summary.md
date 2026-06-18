# Resumen de sesión

## Cambios realizados

### Adaptación Capacitor
- **`src/hooks/useCapacitor.ts`** — Hook que detecta Capacitor WebView, aplica `data-capacitor` al `<body>`, configura `StatusBar` (oscuro, sin overlay) y oculta `SplashScreen` tras cargar.
- **`src/app/(app)/AppLayoutClient.tsx`** — Integración del hook `useCapacitor()`.
- **`src/app/globals.css`** — Reglas CSS para Capacitor:
  - Safe areas con `env(safe-area-inset-top)` en el body y header.
  - Bloqueo de selección de texto (excepto inputs/editables).
  - **Tablets (600–1024px)**: centrado horizontal con `max-width: 520px` y sombra.
  - Touch targets mínimos de 44px en hotbar y botones del shell.

### Aumento de hotbar ~10%
- **`MobileHotbar.tsx`**: iconos de `h-3.5 w-3.5` → `h-4 w-4` (~14% más grandes), label con `text-[10px]`.
- **`globals.css`** (`.mobile-hotbar`):
  - `--icon-wrap`: `1.3125rem→1.5rem` → `1.5rem→1.75rem` (+14%)
  - Label font: `0.5rem→0.625rem` → `0.5625rem→0.6875rem` (+10%)
  - Min-height dock/item: `2.375rem→2.875rem` → `2.75rem→3.25rem` (+13%)
  - Padding-block en items: `0.3125rem` → `0.375rem`.

### Setup Capacitor Android
- **`capacitor.config.ts`** — Config con comentarios para cambiar URL fácilmente:
  - **Desarrollo (emulador):** `http://10.0.2.2:3000`
  - **Producción (VPS):** `http://24.144.116.215:3000`
  - `SplashScreen`, `StatusBar`, plugins todos configurados.
- **`package.json`** — Scripts actualizados: `capacitor:sync`, `capacitor:open:android`, `capacitor:build:android`, `capacitor:dev`.
- `npx cap sync android` ejecutado — Android project sincronizado.

### Nota importante
El app usa **28 Server Actions** (`'use server'`) + `cookies()` + ISR. **No se puede exportar estáticamente.** Capacitor carga la URL del servidor VPS en su WebView. La app sigue corriendo en el servidor con PM2, Capacitor es solo el contenedor nativo.

### MobileTabBar (obsoleto)
- Se actualizaron tamaños internos para coincidir (~10% más grandes), pero el componente ya no se importa en la app; `MobileHotbar` lo reemplazó.

### Splash Screen personalizado
- **`src/components/app/AppSplashScreen.tsx`** — Nueva pantalla de carga con:
  - Logotipo vertical (tema claro/oscuro según `useTheme`)
  - Tagline "Sistema de Gestión Minera" en `font-display`
  - Spinner animado elegante (anillo delgado)
  - Fondo `var(--app-chrome-bg)` que respeta el tema
  - Animación de entrada/salida con fade (opacity transition 500ms)
  - Mínimo 1200ms de duración para evitar parpadeos
- **`src/app/(app)/AppLayoutClient.tsx`** — Integrado reemplazando el viejo `Loader2` genérico.
- **`src/hooks/useCapacitor.ts`** — Oculta el splash nativo de Capacitor cuando el WebView carga (vía `SplashScreen.hide()`).
- **`src/app/globals.css`** — Animación `splash-spin` para el spinner.
- **Flujo completo:**
  1. Capacitor nativo muestra fondo oscuro (`#09090b`) inmediatamente
  2. WebView carga → splash web aparece con logo + spinner
  3. Hook Capacitor oculta splash nativo → web splash es visible
  4. Auth se resuelve → splash espera mínimo 1.2s → fade out
  5. App principal se muestra (o redirige a login si no hay sesión)

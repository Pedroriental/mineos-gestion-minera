# Plan — Rediseño del Sidebar MineOS

> **Tipo de documento:** planificación ejecutable para un agente IA (o dev).
> **Alcance:** solo el sidebar de la app (`src/components/Sidebar.tsx`) y sus puntos de integración. **No** tocar topbar, contenido, ni `MobileBottomNav` salvo lo indicado.
> **Regla de oro:** leer y aplicar la skill `mineos-visual-tokens` (`.agents/skills/mineos-visual-tokens/SKILL.md`) antes de escribir una sola clase CSS.

---

## 1. Contexto y archivos clave

| Archivo | Rol |
|---|---|
| `src/components/Sidebar.tsx` | Componente completo (~710 líneas): nav data, tooltip portal, item, submenú, sección, shell desktop + drawer móvil. |
| `src/app/(app)/AppLayoutClient.tsx` | Monta `<Sidebar variant="dashboard">`, persiste `mineos-sidebar-expanded` en localStorage, ya tiene `AppSearchModal` con atajo ⌘K y `alerts: DashboardAlert[]`. |
| `src/app/globals.css` | Tokens: `--dashboard-*`, `--sidebar-bg/-text/-active`, `--mineos-general-*`, clases `.sidebar-nav-scroll`, `.scroll-y-fade`, reglas `[data-sidebar]` (print, light-mode). |
| `src/lib/mineos-visual.ts` | Helpers de clases por tono. Si un patrón nuevo se repite ≥2 veces, va aquí. |
| `src/components/brand/MineosLogo.tsx` | Logo + `sidebarIconSurface()`. |
| `src/lib/app-section-meta.ts` | Metadatos de sección por ruta (icono/título del topbar) — reutilizable para badges/contexto. |

Datos del estado actual que condicionan el diseño:

- Anchos: expandido `240px`, colapsado `68px` (exportados como `EXPANDED_W` / `COLLAPSED_W` y consumidos por el layout — mantener export).
- Estructura de navegación: 3 ítems standalone (Dashboard, Reporte y Balances, Constructor de Reportes) + 3 secciones (`Administración`, `Mina`, `Molino`); 3 grupos con submenú (Gastos, Nómina de Personal, Datos de Plataforma).
- `framer-motion@12` **ya está instalado** — usarlo, no añadir librerías nuevas.
- Tema claro/oscuro vía `html[data-theme="light"]`; el sidebar usa tokens `--dashboard-*` que cambian por tema.
- `buildNavHref()` propaga `?desde&hasta` (rango de fechas global) en cada link — **preservar este comportamiento intacto**.

---

## 2. Auditoría del sidebar actual (qué está mal o es mejorable)

### 2.1 Deuda contra el design system (corregir sí o sí)

| Ubicación (`Sidebar.tsx`) | Problema | Fix |
|---|---|---|
| `activeClass` (l.111) | `bg-amber-500/15 text-amber-400 border-amber-500/20` hardcodeado | Tokens: `color-mix(in srgb, var(--dashboard-accent) 12%, transparent)` + `var(--dashboard-accent)`; idealmente clase CSS `.sidebar-item--active` en `globals.css` |
| `activeSubClass` (l.114) | `text-amber-400` | `text-[var(--dashboard-accent)]` o clase CSS |
| Chevron submenú (l.284) | `text-amber-500/80` | token de acento |
| Marca "MineOS" (l.550) | `text-amber-400/70` | token |
| Avatar footer (l.614, 631) | `bg-amber-500/20 border-amber-500/30 text-amber-300` | tokens (`--dashboard-accent-soft`, etc.) |
| Tooltip (l.168) | `border-white/10 bg-zinc-900 text-white` fijo — en tema claro queda bien por contraste, pero es ad-hoc | clase CSS `.sidebar-tooltip` con tokens (puede mantenerse oscuro en ambos temas, pero declarado en CSS) |
| Logout hover (l.624) | `text-zinc-500 hover:text-red-400 hover:bg-red-500/10` | `--dashboard-danger` / `--dashboard-danger-soft` |
| Toggle colapso (l.663) | `text-zinc-500 hover:text-zinc-300` | `--dashboard-text-muted` / `--dashboard-text` |

### 2.2 UX / arquitectura

1. **Doble acordeón ruidoso**: las secciones (`Administración`, `Mina`, `Molino`) son colapsables **y** los grupos internos también. Plegar una sección entera casi nunca aporta y añade chevrones por todas partes.
2. **Modo colapsado pierde funcionalidad**: un grupo con submenú (ej. Gastos con 3 subpáginas) al clicarse navega directo al primer subitem (`handleCollapsedSectionItemClick`). No hay forma de llegar a "Catálogo" sin expandir el sidebar.
3. **Sin indicador activo persistente**: el activo es solo un cambio de fondo; las apps modernas usan una barra/indicador que "viaja" entre ítems.
4. **Footer de usuario plano**: email truncado + rol hardcodeado `"Operaciones"` + botón de logout directamente clicable (riesgo de clic accidental). Sin menú.
5. **Toggle de colapso al fondo** con texto "Plegar menú": consume una fila entera y está lejos del header donde el ojo lo busca (patrón Notion/Linear: en el header, o un handle en el borde).
6. **Búsqueda invisible desde el sidebar**: existe `AppSearchModal` con ⌘K pero el sidebar no lo expone.
7. **Acordeón de sección con hack** `style={{ maxHeight: open ? '600px' : '0px' }}` — se romperá si la sección crece; el submenú ya usa el truco moderno `grid-rows-[0fr→1fr]` (ese patrón es el bueno).
8. **Accesibilidad**: no hay `aria-current="page"` en el ítem activo; los tooltips usan `role="tooltip"` pero sin `aria-describedby`; los botones de sección no tienen `aria-controls`.
9. **Variante muerta**: `variant: 'default'` (shell `rounded-[2rem] bg-zinc-900/40…`) no se usa en ningún sitio — solo se monta `variant="dashboard"`. Eliminarla simplifica `sidebarIconSurface` y el shell.
10. **`standaloneItems` renderizado a mano por índice** (l.568–588): triplicación de `<NavItem>`; debería ser un `.map()`.
11. **Alertas desaprovechadas**: `AppLayoutClient` ya tiene `alerts: DashboardAlert[]` pero el sidebar no muestra ningún badge.

### 2.3 Lo que ya está bien (no romper)

- Persistencia del estado expandido/colapsado en localStorage.
- Animación de ancho con `cubic-bezier(0.16,1,0.3,1)` (spring-like, está bien).
- Drawer móvil con backdrop blur y safe offsets.
- Propagación del rango de fechas en los href.
- Auto-apertura de la sección/submenú que contiene la ruta activa.
- Ocultamiento en print (`@media print [data-sidebar]`).

---

## 3. Referencias de mercado (de dónde tomar cada patrón)

| Patrón | App de referencia | Qué copiar |
|---|---|---|
| Indicador activo animado que "viaja" entre ítems | **Linear** | Pastilla/barra con `framer-motion` `layoutId` compartido; transición `spring` corta (~250ms, damping alto) |
| Flyout de submenú en modo colapsado | **Supabase Studio / VS Code activity bar** | Click (o hover) en icono de grupo → popover anclado a la derecha con los subitems; mismo estilo que `.app-popover` existente |
| Botón de búsqueda con kbd hint | **Notion / Raycast / Linear** | Fila "Buscar" bajo el header con `⌘K` en un `<kbd>` alineado a la derecha; abre el `AppSearchModal` existente |
| Footer = menú de cuenta | **Vercel / Linear** | Avatar + email → popover hacia arriba con: email completo, toggle de tema, "Cerrar sesión". El logout deja de ser un botón directo |
| Toggle de colapso en el header | **Notion / Slack (nuevo)** | Icono `PanelLeftClose` junto al logo, visible on-hover del header; abajo solo queda el footer de usuario |
| Labels de sección sin acordeón | **Stripe Dashboard** | Microlabel uppercase fijo (10px, tracking ancho, muted); sin chevron ni líneas dobles — la jerarquía la da el espaciado |
| Badge de notificación en ítem | **Slack / Height** | Punto o contador `--dashboard-danger` a la derecha del label (ej. "Integridad Financiera" cuando hay alertas) |
| Hover-peek opcional (fase 2) | **Notion** | Sidebar colapsado se expande como overlay al hacer hover sostenido en el rail; al salir, vuelve a rail |

---

## 4. Diseño propuesto (especificación por zonas)

### 4.1 Header

- Logo + "La Fe / MineOS" como hasta ahora, **pero** el subtítulo "MineOS" usa token de acento, no `amber-400/70`.
- A la derecha del header (solo desktop): botón icono `PanelLeftClose` / `PanelLeft` para colapsar/expandir. Aparece con `opacity-0 group-hover:opacity-100` sobre el header expandido; en modo colapsado, el botón de expandir reemplaza temporalmente al logo on-hover (patrón Notion) **o** se muestra debajo del logo — elegir lo más simple de implementar primero (botón fijo bajo el logo es aceptable).
- Eliminar la fila "Plegar menú" del fondo.

### 4.2 Búsqueda

- Nueva fila bajo el header, antes de los standalone items:
  - Expandido: `[🔍 Buscar…        ⌘K]` — estilo `.app-search-field` ya existente (reutilizar clase), altura ~32px, `<kbd>` con borde sutil.
  - Colapsado: solo icono lupa con tooltip "Buscar (⌘K)".
- Acción: disparar el mismo estado `searchOpen` de `AppLayoutClient`. **Integración necesaria:** pasar prop `onSearchOpen?: () => void` a `Sidebar` desde `AppLayoutClient`.

### 4.3 Navegación

- **Secciones**: quitar el acordeón de sección (estado `open` de `Section`). El título queda como microlabel estático estilo Stripe: `text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--dashboard-text-muted)]`, sin líneas decorativas ni chevron. En modo colapsado, separar secciones con un divisor de 16px de ancho centrado.
- **Ítems**: mantener altura compacta (~32–34px), `rounded-lg`.
  - Activo: fondo `color-mix(in srgb, var(--dashboard-accent) 10%, transparent)` + texto `var(--dashboard-accent)` + **barra indicadora** de 2.5px × 16px, `rounded-full`, color `var(--dashboard-accent)`, pegada al borde izquierdo del ítem.
  - La barra se anima entre ítems con `motion.span layoutId="sidebar-active-indicator"` (un solo `LayoutGroup` por sidebar). Respetar `prefers-reduced-motion` (framer-motion lo respeta con `MotionConfig reducedMotion="user"` — envolver el nav).
  - Idle/hover: como hoy (tokens, no `black/[0.04]` a pelo si se puede expresar con token; aceptable mantener).
- **Submenús (expandido)**: conservar el patrón `grid-rows-[0fr→1fr]`. Mejoras:
  - Subitem activo: además del color de acento, un dot de 4px sobre la línea guía vertical (la `border-l-2` actual) a la altura del subitem, para anclar visualmente.
  - El grupo padre con subitem activo muestra el label en `--dashboard-text` (no acento completo, para no competir con el subitem).
- **Submenús (colapsado) — flyout**: clic en el icono del grupo abre un popover (portal, como `NavTooltip` pero interactivo):
  - Contenedor: reutilizar `.app-popover` + `.app-popover-item` de `globals.css`.
  - Cabecera del popover: label del grupo en microlabel uppercase.
  - Posición: `left = rect.right + 8`, alineado al top del icono; cerrar con click-fuera y `Escape`.
  - Los ítems del flyout son `<Link>` reales con `getNavHref()`.
  - Esto **reemplaza** `handleCollapsedSectionItemClick` (eliminar ese callback).
- **Badges**: prop opcional `alertCount?: number` por ítem. Cablear desde `AppLayoutClient`: si `alerts.length > 0`, el ítem "Integridad Financiera" (o el href que indiquen las alerts) muestra contador `min(count, 9)` con estilo `bg-[var(--dashboard-danger-soft)] text-[var(--dashboard-danger)] text-[10px] rounded-full px-1.5`. En colapsado: dot de 6px en la esquina del icono.

### 4.4 Acordeón de sección — eliminación del hack

- Al quitar el acordeón de secciones, el hack `maxHeight: 600px` desaparece solo. Si se decidiera conservar secciones plegables, migrar al patrón `grid-rows`.

### 4.5 Footer de cuenta

- Expandido: misma tarjeta visual, pero **todo el bloque es un botón** que abre popover hacia arriba (`bottom = rect.height + 8`):
  - Email completo (sin truncar) + rol.
  - Item "Tema claro/oscuro" (reusar `toggleTheme` — requiere prop o usar `useTheme()` que ya está importado).
  - Separador + "Cerrar sesión" en tono danger.
- Colapsado: solo el avatar, mismo popover.
- Eliminar el botón `LogOut` inline.
- El rol "Operaciones" hardcodeado: dejarlo como constante por ahora pero extraído a una const con `TODO` (fuera de alcance resolver roles reales).

### 4.6 Móvil (drawer)

- Sin cambios estructurales; hereda automáticamente las mejoras de contenido (secciones sin acordeón, footer-menú, badges).
- El flyout colapsado no aplica (el drawer siempre va expandido).
- Verificar que el popover de cuenta cabe en viewport móvil (max-height + scroll).

### 4.7 Limpieza técnica

- Eliminar `variant: 'default'` y todo su CSS inline (`rounded-[2rem] bg-zinc-900/40…`); simplificar `sidebarIconSurface` en `MineosLogo.tsx` a `(theme) => theme === 'dark' ? 'dark' : 'light'` (mantener la firma exportada si otros la usan — grep antes).
- `standaloneItems`: renderizar con `.map()` + función `isActive(href, pathname)` única (hoy la lógica de matching está repetida 4 veces).
- Mover `activeClass`/`idleClass`/etc. a clases CSS en `globals.css` (`.sidebar-item`, `.sidebar-item--active`, `.sidebar-sublink`, `.sidebar-tooltip`, `.sidebar-flyout`) — sigue la convención del repo de estilos canónicos en CSS (ver sección "Controles de formulario" de la skill).
- Añadir `aria-current="page"` al link activo; `aria-haspopup`/`aria-expanded` en footer y flyouts.

---

## 5. Tokens / CSS nuevos (en `globals.css`)

Añadir junto al bloque de tokens existente (validar en **ambos** temas):

```css
/* ── Sidebar v2 ── */
.sidebar-item { /* base: layout + idle, usa --dashboard-text-muted */ }
.sidebar-item--active {
  color: var(--dashboard-accent);
  background: color-mix(in srgb, var(--dashboard-accent) 10%, transparent);
}
.sidebar-item__indicator { background: var(--dashboard-accent); }
.sidebar-section-label { /* microlabel uppercase */ }
.sidebar-tooltip { /* tokens, reemplaza clases inline del portal */ }
.sidebar-flyout { /* hereda .app-popover; ancho ~200px */ }
.sidebar-badge { color: var(--dashboard-danger); background: var(--dashboard-danger-soft); }
.sidebar-kbd { /* kbd ⌘K: borde --dashboard-border, texto muted */ }
```

No introducir hex nuevos. Si hace falta un matiz, derivarlo con `color-mix` de tokens existentes.

---

## 6. Plan de implementación por fases (PRs pequeños, en orden)

> Cada fase compila (`npx tsc --noEmit`), pasa `npm run lint`, y se verifica visualmente en light + dark antes de la siguiente.

### Fase 1 — Saneamiento de tokens (sin cambio visual perceptible)
1. Crear clases `.sidebar-*` en `globals.css` con los valores equivalentes a los actuales pero vía tokens.
2. Reemplazar en `Sidebar.tsx` todos los hardcodes de la tabla §2.1.
3. Eliminar `variant: 'default'` + simplificar `sidebarIconSurface`.
4. Refactor `standaloneItems` a `.map()` + helper `isActive()` único.
- **Resultado esperado:** mismo aspecto, cero ámbar/zinc hardcodeado, menos líneas.

### Fase 2 — Estructura: secciones planas + toggle al header
1. Quitar acordeón de secciones (labels estáticos estilo Stripe) y el hack `maxHeight`.
2. Mover el toggle de colapso al header; eliminar la fila "Plegar menú".
3. Añadir fila de búsqueda (prop `onSearchOpen` desde `AppLayoutClient`).
- **Resultado esperado:** sidebar más silencioso, búsqueda visible, toggle donde se espera.

### Fase 3 — Indicador activo animado + microinteracciones
1. `LayoutGroup` + `motion.span layoutId="sidebar-active-indicator"` en ítems de primer nivel.
2. Dot en subitem activo sobre la línea guía.
3. `MotionConfig reducedMotion="user"` envolviendo el nav.
- **Resultado esperado:** el activo "viaja" con spring entre rutas; sin animación si el SO pide reduced motion.

### Fase 4 — Flyout en modo colapsado
1. Componente `SidebarFlyout` (portal interactivo, base `NavTooltip` + `.app-popover`).
2. Click en grupo colapsado → flyout con subitems navegables; `Escape` + click-fuera cierran.
3. Eliminar `handleCollapsedSectionItemClick`.
- **Resultado esperado:** toda la navegación accesible sin expandir el sidebar.

### Fase 5 — Footer de cuenta + badges
1. Footer → popover de cuenta (email, toggle tema, logout danger).
2. Badges de alertas cableados desde `AppLayoutClient` (`alerts`).
- **Resultado esperado:** sin logout accidental; alertas visibles desde el nav.

### Fase 6 (opcional, decisión de producto) — Hover-peek estilo Notion
- Colapsado + hover sostenido (~300ms) sobre el rail → overlay expandido (no empuja contenido, `position: absolute` + sombra); al salir, colapsa. Persistencia del estado real intacta.
- Solo abordarla si las fases 1–5 quedaron estables.

---

## 7. Criterios de aceptación / QA

- ✅ `npx tsc --noEmit` y `npm run lint` limpios.
- ✅ Cero `amber-*`, `zinc-*` de color semántico, o hex sueltos en `Sidebar.tsx` (auditar con `/mineos-visual-tokens src/components/Sidebar.tsx`).
- ✅ Light **y** dark verificados en: expandido, colapsado, drawer móvil, flyout, popover de cuenta, tooltip.
- ✅ El rango `?desde&hasta` se sigue propagando en todos los links (probar navegando con un rango activo).
- ✅ `mineos-sidebar-expanded` persiste tras recargar.
- ✅ Ítem activo correcto en rutas profundas (ej. `/admin/gastos/conceptos` marca "Catálogo" y su grupo "Gastos").
- ✅ Teclado: `Tab` recorre ítems, `Enter` navega, `Escape` cierra flyout/popover, ⌘K abre búsqueda; `aria-current="page"` presente.
- ✅ Reduced motion: sin animación del indicador.
- ✅ Print: sidebar sigue oculto.
- ✅ Probar manualmente con `computerUse`/navegador y adjuntar capturas/video de: estado expandido, colapsado + flyout, popover de cuenta, tema claro.

## 8. Fuera de alcance (explícito)

- `MobileBottomNav`, topbar, `AppSearchModal` (solo se dispara, no se modifica).
- Roles de usuario reales en el footer (queda el placeholder).
- Reordenar o renombrar la información de navegación (`navigation`/`standaloneItems` se mantienen tal cual en contenido).
- Cambios de layout del shell (`app-main-panel`, paddings de `data-app-shell`).

## 9. Gotchas para la IA implementadora

- `EXPANDED_W`/`COLLAPSED_W` se exportan al final de `Sidebar.tsx`; si algo los consume, mantener valores o actualizar a la vez.
- El tooltip actual usa `createPortal` a `document.body` con `z-[250]`; los nuevos flyouts deben quedar **por encima** del `app-main-panel` pero por debajo de modales (`z-[9000]` es el rango de la campana — usar `z-[300]` aprox. y verificar).
- `Suspense`: `Sidebar` usa `useSearchParams()` — ya está montado dentro de un árbol cliente; no introducir lecturas de searchParams en nuevos subcomponentes server.
- El drawer móvil renderiza `dockContent(true, onMobileClose)` — cualquier estado nuevo (flyout, popover) debe cerrarse en `handleNav`/cambio de ruta, igual que hace `AppLayoutClient` con `setMobileMenuOpen(false)` en el efecto de `pathname`.
- En tema claro el sidebar usa los mismos tokens `--dashboard-*` (no es el rail oscuro de `[data-sidebar-rail]`, esa regla es de otro contexto) — no asumir fondo oscuro fijo en los nuevos estilos.
- No usar `pkill`; no commitear `.env`; seguir `cursor-buenas-practicas` para commits/PR.

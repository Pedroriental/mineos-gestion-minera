---
name: cursor-buenas-practicas
description: Buenas prácticas de trabajo con Cursor para proyectos Manano (MineOS, Doojo). Usar al iniciar sesión, antes de commits/PR, al pedir deploy, o cuando el usuario diga "buenas prácticas", "cómo trabajamos", o quiera alinear al agente al flujo del equipo.
---

# Buenas prácticas — Cursor (equipo)

## Antes de tocar código

1. Lee `AGENTS.md`, `.cursor/rules` y skills del proyecto en `.agents/skills/`.
2. Para UI: invoca o aplica `mineos-visual-tokens` (MineOS) o `doojo-visual-tokens` (Doojo) **antes** de escribir clases o colores.
3. `git status` + rama actual. No mezcles cambios no relacionados.
4. Plan corto (3–6 pasos) y alcance explícito de lo que queda fuera.

## Durante la iteración (vibecoding)

- **Alcance mínimo**: el diff más pequeño que resuelva el problema.
- **Convenciones del repo** primero; no introduzcas librerías ni patrones nuevos sin pedirlo.
- **Reutiliza** helpers existentes (`mineos-visual.ts`, `appUi.ts`, componentes en `src/components/ui/`).
- **No commits** salvo que el usuario lo pida explícitamente.
- **No push/deploy** salvo petición explícita.
- **Secrets**: nunca commitear `.env`, claves ni tokens.

## Skills — cuándo usar cada una

| Momento | Skill |
|---------|--------|
| Arranque de sesión | `vibe-session-start` o esta skill |
| Explorar código desconocido | `explore-codebase` |
| Bug con síntomas confusos | `debug-methodical` o `systematic-debugging` |
| React/Next performance | `vercel-react-best-practices` |
| Supabase / SQL / RLS | `supabase`, `supabase-postgres-best-practices` |
| Uniformidad visual / tokens | `mineos-visual-tokens`, `baseline-ui`, `design-tokens` |
| Tests nuevos o regresiones | `tdd` |
| Cierre de sesión | `vibe-session-end` |
| **Antes de PR/commit grande** | `thermo-nuclear-code-quality-review`, `deslop`, `make-pr-easy-to-review` |

`thermo-nuclear-code-quality-review` es **estricta** — úsala con scope acotado (ej. "solo `src/app/(app)/mina/`"), no en cada cambio pequeño.

## MineOS — recordatorios

- Stack: Next.js App Router, Supabase SSR, Tailwind 4, tokens en `src/app/globals.css`.
- Deploy habitual: rama `release/diseno-sin-nomina` → servidor VPS (`/var/www/mineos`, PM2).
- Migraciones: scripts `npm run supabase:migrate:*` y SQL en `supabase/`.
- Formato hora en UI: 12h AM/PM; persistencia BD: `HH:mm`.

## Doojo — recordatorios

- Stack: Vite + React, shadcn/Radix, tokens HSL en `src/index.css`, patrones en `src/lib/appUi.ts`.
- Iconos: Coolicons vía shim Lucide; no mezclar sistemas de iconos en la misma vista.

## Calidad antes de entregar

- `npx tsc --noEmit` o `npm run lint` cuando el cambio toque tipos o muchos archivos.
- Si tocaste UI: revisar light + dark (`data-theme` en MineOS; `.dark` en Doojo).
- Describe al usuario qué cambió, por qué, y cómo probarlo — sin engagement bait.

## Salida al invocar esta skill

Breve checklist: **rama · objetivo · archivos clave · skills aplicables · riesgos** — luego pregunta si procedes.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Agent skills (equipo)

Skills compartidas en `.agents/skills/` (ver `skills-lock.json` para las de skills.sh).

**Antes de UI:** leer/aplicar `mineos-visual-tokens` — tokens en `src/app/globals.css`, helpers en `src/lib/mineos-visual.ts`.

**Flujo Cursor:** `cursor-buenas-practicas` · uniformidad extra: `baseline-ui`, `design-tokens`, `design-consistency-auditor`.

Restaurar en máquina nueva: clonar repo (las skills ya vienen) o `npx skills experimental_install` desde `skills-lock.json`.

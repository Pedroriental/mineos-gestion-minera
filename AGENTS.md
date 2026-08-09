<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Agent skills (equipo)

Skills compartidas en `.agents/skills/` (ver `skills-lock.json` para las de skills.sh).

**Antes de UI:** leer/aplicar `mineos-visual-tokens` — tokens en `src/app/globals.css`, helpers en `src/lib/mineos-visual.ts`.

**Flujo Cursor:** `cursor-buenas-practicas` · uniformidad extra: `baseline-ui`, `design-tokens`, `design-consistency-auditor`.

Restaurar en máquina nueva: clonar repo (las skills ya vienen) o `npx skills experimental_install` desde `skills-lock.json`.

## Cursor Cloud specific instructions

### Rama y repositorio

- **Rama activa de trabajo:** `release/diseno-sin-nomina` (rediseño UI; sin cambios de nómina en UI).
- **Ignorar `main`:** contiene un export estático antiguo de Netlify que ya no se usa.
- **Código fuente:** Next.js 16 en `src/`; ver `package.json` y `docs/DEPLOY-SERVIDOR.md`.

### Producción (Digital Ocean)

- **URL:** https://mineos.me
- **Servidor:** Droplet Ubuntu (`24.144.116.215`), nginx → Next.js en puerto 3000 vía **PM2** (`mineos`).
- **Deploy:** desde el servidor, en la carpeta `exec cwd` de PM2 (suele ser `/var/www/mineos`):

```bash
bash scripts/deploy-server-remote.sh release/diseno-sin-nomina
```

Manual: `git pull origin release/diseno-sin-nomina && npm ci && npm run build && pm2 restart mineos`.

PM2 debe ejecutar `next start`, **nunca** `next dev --turbopack` en producción (ver troubleshooting en `docs/DEPLOY-SERVIDOR.md`).

### Desarrollo local (Cloud Agent / VM)

1. `git checkout release/diseno-sin-nomina`
2. Crear `.env.local` (no está en git) con al menos:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_GUEST_EMAIL` / `NEXT_PUBLIC_GUEST_PASSWORD` (cuenta observador en Supabase)
3. `npm ci` → `npm run dev` (Turbopack) o `npm run dev:classic`
4. Para validar producción, probar **https://mineos.me** (no localhost como referencia de deploy).

### Comandos habituales

| Acción | Comando |
|--------|---------|
| Dev server | `npm run dev` |
| Build | `npm run build` |
| Producción local | `npm run start` (tras build) |
| Lint | `npm run lint` (muchas reglas preexistentes) |
| Tests nómina | `npm run test:nomina` |
| Tests conciliación | `npm run test:reconciliation` |
| Migraciones DB | Supabase CLI desde tu máquina; ver `docs/DEPLOY-SERVIDOR.md` §4 |

### Dependencias externas

- **Supabase** (Auth + Postgres): proyecto `abhfedunawgzfnzeazgb` — requerido para datos y login.
- **Sin Docker** en este repo para desarrollo diario.
- Migraciones: scripts en `scripts/supabase-apply-*.ps1` (PowerShell); en Linux usar `supabase db query --linked` directamente.

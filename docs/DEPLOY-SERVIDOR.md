# Despliegue en servidor (sin cambios de Nómina)

## Rama para tu socio

- **Rama:** `release/diseno-sin-nomina`
- **Incluye:** rediseño UI (dashboard, gastos, voladuras, extracción, producción, modales, tema, etc.)
- **Excluye:** `NominaClient.tsx`, `columns.tsx` de nómina y `loading.tsx` de rutas `/mina/nomina`, `/planta/nomina`, `/admin/nomina`

## 1. Subir al repo de GitHub

En tu PC (ya con la rama creada):

```bash
git push -u origin release/diseno-sin-nomina
```

Tu socio en GitHub puede abrir un PR hacia `master` o desplegar directamente esa rama.

## 2. Actualizar el servidor (SSH)

Conéctate (usa llave SSH si es posible; evita pegar la contraseña en scripts):

```bash
ssh root@24.144.116.215
```

### Encontrar la carpeta real del proyecto

En muchos servidores **no** está en `/var/www/mineos-gestion-minera`. Usa la ruta que PM2 ya tiene configurada:

```bash
pm2 show mineos | grep -E "exec cwd|script path"
# o:
pm2 describe mineos | grep -E "cwd|script path"
```

Copia la ruta de **`exec cwd`** (carpeta del proyecto) y entra ahí:

```bash
cd "$(pm2 show mineos 2>/dev/null | awk -F'│' '/exec cwd/ { gsub(/ /,""); print $3; exit }')"
pwd
git rev-parse --is-inside-work-tree   # debe imprimir: true
```

Si no es un repo git, busca clones:

```bash
find /root /home /var/www /opt -maxdepth 4 -name package.json 2>/dev/null | xargs grep -l '"name": "mineos-app"' 2>/dev/null
```

### Desplegar (desde la carpeta correcta)

Opción rápida (script en el repo, tras `git pull`):

```bash
cd <RUTA_DEL_PROYECTO>
bash scripts/deploy-server-remote.sh release/diseno-sin-nomina
```

Manual:

```bash
cd <RUTA_DEL_PROYECTO>   # la de exec cwd, no /var/www/... si no existe
git fetch origin
git checkout release/diseno-sin-nomina
git pull origin release/diseno-sin-nomina
npm ci
npm run build
pm2 restart mineos
git log -1 --oneline
```

Si no usan PM2, suele ser:

```bash
npm run build
npm run start
# o reiniciar el servicio que tengan (Docker, systemd, etc.)
```

## 3. Cuando Nómina esté probada

En tu máquina, en `master` o una rama `release/nomina`:

```bash
git checkout master
# fusionar solo los archivos de nómina desde tu trabajo local
git push origin master
```

En el servidor:

```bash
git checkout master   # o la rama acordada
git pull
npm ci && npm run build && pm2 restart mineos
```

## Seguridad

- No compartas la contraseña de `root` por chat; cámbiala si ya se expuso.
- Crea un usuario deploy con llave SSH y sin login por contraseña para `root`.

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

Ruta típica del proyecto (ajústala si en el servidor está en otra carpeta):

```bash
cd /var/www/mineos-gestion-minera   # o la ruta real del clone
git fetch origin
git checkout release/diseno-sin-nomina
git pull origin release/diseno-sin-nomina
npm ci
npm run build
pm2 restart mineos   # o: systemctl restart mineos — según cómo esté configurado
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

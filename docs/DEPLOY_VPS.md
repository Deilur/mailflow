# MailFlow — VPS Deploy Guide

Cómo llevar MailFlow a producción en el mismo VPS donde corre ListMonk.

---

## Pre-requisitos

| Herramienta | Versión mínima | Cómo verificar |
|---|---|---|
| Node.js | 20 LTS | `node -v` |
| npm | 9+ | `npm -v` |
| PM2 | cualquiera | `pm2 -v` |
| Nginx | 1.18+ | `nginx -v` |
| PostgreSQL | 14+ (el de ListMonk) | `psql --version` |

```bash
# Instalar Node 20 (si no lo tienes)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Instalar PM2 globalmente
sudo npm install -g pm2

# Instalar Nginx
sudo apt-get install -y nginx
```

---

## Paso 1 — Subir el código al VPS

**Opción A: Git (recomendada)**

```bash
# En tu máquina local, inicializa el repositorio
cd /ruta/a/listmonk-app
git init
git add .
git commit -m "MailFlow initial"

# En el VPS
git clone <tu-repo-url> /opt/mailflow
# o si ya existe:
cd /opt/mailflow && git pull
```

**Opción B: rsync (copia directa)**

```bash
rsync -avz --exclude=node_modules --exclude=dist \
  ./listmonk-app/ usuario@tu-vps:/opt/mailflow/
```

---

## Paso 2 — Variables de entorno

En el VPS, crea `/opt/mailflow/.env` (nunca en el repositorio):

```bash
sudo nano /opt/mailflow/.env
```

Contenido (ajusta los valores):

```env
# ── ListMonk ──────────────────────────────────────────────────
LISTMONK_URL=http://localhost:9000
LISTMONK_USERNAME=admin
LISTMONK_PASSWORD=TU_PASSWORD_DE_LISTMONK

# ── PostgreSQL (el DB interno de ListMonk) ────────────────────
# Encuéntralo en: /etc/listmonk/config.toml  →  sección [db]
# o en:          /opt/listmonk/.env
DATABASE_URL=postgresql://listmonk:TU_DB_PASS@localhost:5432/listmonk

# ── Backend ───────────────────────────────────────────────────
PORT=5000
NODE_ENV=production
```

> **¿Dónde está el password de la DB?**
> ```bash
> # Si listmonk usa config.toml
> grep -E "password|pass" /etc/listmonk/config.toml
> # Si listmonk usa variables de entorno
> grep -E "password|pass" /opt/listmonk/.env
> ```

Permisos seguros:

```bash
chmod 600 /opt/mailflow/.env
```

---

## Paso 3 — Crear el schema `mailflow` en PostgreSQL

```bash
# Obtén las credenciales del DB de ListMonk
DB_USER=listmonk
DB_PASS=TU_DB_PASS
DB_NAME=listmonk

# Ejecuta el schema
psql -U $DB_USER -d $DB_NAME -h localhost \
     -f /opt/mailflow/infra/001_mailflow_schema.sql

# Cuando pida password, ingresa el de la DB
```

Verifica que las tablas se crearon:

```bash
psql -U $DB_USER -d $DB_NAME -h localhost -c "\dt mailflow.*"
```

Debes ver:
```
                  List of relations
  Schema  |          Name           | Type  |  Owner
----------+-------------------------+-------+---------
 mailflow | newsletter_settings     | table | listmonk
 mailflow | funnels                 | table | listmonk
 mailflow | funnel_steps            | table | listmonk
 mailflow | funnel_enrollments      | table | listmonk
 mailflow | funnel_execution_logs   | table | listmonk
```

---

## Paso 4 — Instalar dependencias y compilar

```bash
cd /opt/mailflow

# Instalar paquetes
npm install

# Compilar (frontend + backend)
npm run build
```

Resultado:
```
dist/
  index.cjs        ← backend Express
  public/           ← frontend React (archivos estáticos)
    index.html
    assets/
```

---

## Paso 5 — Instalar dotenv como dependencia de producción

El `ecosystem.config.cjs` usa `--require dotenv/config` para cargar `.env`.

```bash
cd /opt/mailflow
npm install dotenv
```

---

## Paso 6 — Iniciar con PM2

```bash
cd /opt/mailflow

# Editar el cwd en ecosystem.config.cjs si es necesario
# cwd: "/opt/mailflow"  ← debe coincidir con tu ruta

# Crear directorio de logs
sudo mkdir -p /var/log/mailflow
sudo chown $USER /var/log/mailflow

# Arrancar
pm2 start ecosystem.config.cjs --env production

# Verificar que está corriendo
pm2 status
pm2 logs mailflow --lines 20
```

Prueba rápida:
```bash
curl http://localhost:5000/api/listmonk/lists
# Debe devolver tus listas de ListMonk en JSON
```

---

## Paso 7 — Configurar Nginx

```bash
# Copiar config
sudo cp /opt/mailflow/infra/nginx.conf /etc/nginx/sites-available/mailflow

# Editar dominio/ruta
sudo nano /etc/nginx/sites-available/mailflow
# Cambia: mail.tudominio.com  y  /opt/mailflow

# Habilitar site
sudo ln -s /etc/nginx/sites-available/mailflow \
           /etc/nginx/sites-enabled/mailflow

# Deshabilitar default (opcional)
sudo rm -f /etc/nginx/sites-enabled/default

# Test de configuración
sudo nginx -t

# Recargar
sudo systemctl reload nginx
```

Accede a `http://mail.tudominio.com` (o la IP del VPS) — debes ver el dashboard.

---

## Paso 8 — TLS con Let's Encrypt (HTTPS)

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d mail.tudominio.com

# Auto-renovación (cron ya viene incluido con certbot)
sudo certbot renew --dry-run
```

---

## Paso 9 — Persistencia después de reboot

```bash
# Guardar la lista de procesos de PM2
pm2 save

# Generar el script de startup
pm2 startup
# Copia y ejecuta el comando que te muestre
```

---

## Actualizaciones posteriores

Cuando hagas cambios en el código:

```bash
cd /opt/mailflow

# Traer cambios (si usas git)
git pull

# Recompilar
npm run build

# Recargar sin downtime
pm2 reload mailflow
```

---

## Troubleshooting

### "No se puede conectar a ListMonk"

```bash
# Verificar que ListMonk está corriendo
curl http://localhost:9000/api/health

# Verificar credenciales
curl -u admin:TU_PASSWORD http://localhost:9000/api/lists
```

### Error de PostgreSQL

```bash
# Ver logs de MailFlow
pm2 logs mailflow --lines 50

# Verificar conexión a DB
psql "$DATABASE_URL" -c "SELECT 1"
```

### Puerto 5000 ocupado

```bash
# Ver qué usa el puerto
sudo lsof -i :5000

# Matar el proceso si es necesario
sudo kill -9 <PID>

# Reiniciar mailflow
pm2 restart mailflow
```

### Nginx 502 Bad Gateway

```bash
# Verificar que el backend está corriendo
pm2 status

# Si está caído, reiniciar
pm2 start mailflow

# Ver logs de nginx
sudo tail -f /var/log/nginx/error.log
```

---

## Resumen de archivos generados

| Archivo | Para qué |
|---|---|
| `.env.production` | Template de variables — cópialo a `.env` en el VPS |
| `server/listmonk.ts` | Cliente HTTP para la API de ListMonk (Basic Auth) |
| `server/routes.ts` | Rutas Express — llama API real cuando `LISTMONK_URL` está definida |
| `server/storage.ts` | `PgStorage` (real DB) + `MemStorage` (demo fallback) |
| `infra/001_mailflow_schema.sql` | Schema PostgreSQL en namespace `mailflow` |
| `ecosystem.config.cjs` | Configuración PM2 |
| `infra/nginx.conf` | Reverse proxy Nginx |
| `docs/DEPLOY_VPS.md` | Esta guía |

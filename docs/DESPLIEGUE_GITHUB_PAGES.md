# Publicar en GitHub Pages

La aplicación es 100 % estática (HTML + JS), usa rutas con `#` y funciona bajo HTTPS, que es lo que necesitan la **cámara**, **Web Bluetooth** y **WebUSB**.

## Paso a paso
1. Crea un repositorio en GitHub y sube el proyecto (incluye `pnpm-lock.yaml`):
   ```bash
   git init && git add . && git commit -m "Inspección municipal"
   git branch -M main
   git remote add origin https://github.com/TU-USUARIO/inspector-valpo.git
   git push -u origin main
   ```
2. En el repositorio: **Settings → Pages → Build and deployment → Source: _GitHub Actions_**.
3. Haz un *push* a `main` (o **Actions → Publicar en GitHub Pages → Run workflow**). Al terminar verás la URL:
   `https://TU-USUARIO.github.io/inspector-valpo/`

## La ruta base
| Caso | Valor de `VITE_BASE` |
|---|---|
| Sitio de proyecto (`usuario.github.io/repo/`) | `/repo/` (el workflow lo calcula solo) |
| Sitio de usuario (`usuario.github.io`) o dominio propio | `/` → crea la variable de repositorio `VITE_BASE` con `/` |

Prueba local de lo que se publicará: `VITE_BASE=/inspector-valpo/ pnpm build && pnpm preview`.

## Variables de configuración
En **Settings → Secrets and variables → Actions → Variables** (solo valores públicos):
`VITE_DATA_BACKEND`, `VITE_PERMITS_API`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.
> ⚠️ Todo lo que empieza con `VITE_` queda **visible en el navegador**. Nunca pongas aquí la secret key de Supabase ni contraseñas de PostgreSQL.

## Seguridad: qué tener en cuenta
* **GitHub Pages es público:** cualquiera puede abrir la aplicación. Con datos reales, exige inicio de sesión (Supabase Auth) y políticas RLS (`db/schema.sql`); no confíes en esconder la URL.
* En modo memoria, los datos reales quedan en el navegador de cada inspector. No los subas al repositorio (el `.gitignore` ya excluye `.env`).
* Pages no permite cabeceras HTTP: la política de seguridad (CSP) va como `<meta>` en el HTML (ver `vite.config.ts`). Si usas Cloudflare delante del dominio, puedes añadir las cabeceras completas (HSTS, `frame-ancestors`, etc.).
* Si la API de permisos bloquea el acceso por **CORS** desde `github.io`, usa un proxy propio y apunta `VITE_PERMITS_API` a él (añade su dominio a `connect-src` en `vite.config.ts`).
* Para equipos municipales, considera un repositorio privado con GitHub Enterprise (Pages privado) o publicar en la infraestructura del municipio.

## Dominio propio
En **Settings → Pages → Custom domain**, apunta un registro `CNAME` a `TU-USUARIO.github.io`, activa *Enforce HTTPS* y define `VITE_BASE=/`.

## Problemas frecuentes
| Síntoma | Causa y solución |
|---|---|
| Página en blanco, errores 404 de `assets/` | `VITE_BASE` no coincide con la ruta publicada. |
| El workflow falla en `pnpm install --frozen-lockfile` | Falta subir `pnpm-lock.yaml` o cambió `package.json` sin actualizarlo (`pnpm install`). |
| La cámara no abre | Debe abrirse por `https://` y aceptar el permiso del navegador. |

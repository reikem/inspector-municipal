# Seguridad

## Reportar una vulnerabilidad
Escribe de forma privada a quien administre este repositorio (GitHub → *Security → Report a vulnerability*). No publiques datos personales en *issues*.

## Reglas del proyecto
* **Claves:** en el frontend solo claves públicas (`VITE_*`). La secret key de Supabase y las contraseñas de PostgreSQL **nunca** van en el navegador ni en el repositorio; si se exponen, rótalas.
* **Datos personales** (nombre, RUT, deuda): RUT enmascarado en pantalla; la página pública del QR no muestra RUT, dirección ni fotos. Trata la información según la ley de protección de datos personales.
* **QR de resultados:** en modo memoria no es a prueba de falsificación. En producción, valida el código en el servidor (`verify_inspection`).
* **Consultas a la API de permisos:** hazlas con rangos acotados y, preferentemente, a través de un proxy con límites. Pide al municipio autorización o una exportación oficial para cargas masivas.
* **Dependencias:** `pnpm-workspace.yaml` bloquea scripts de instalación salvo `esbuild` y exige 3 días de antigüedad a cada versión. Versiona `pnpm-lock.yaml`.
* **CSP:** se aplica como `<meta>` en producción (ver `vite.config.ts`). Cualquier servicio externo nuevo debe agregarse de forma explícita.

import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * GitHub Pages no permite configurar cabeceras HTTP, así que la política de seguridad (CSP) se incrusta como
 * <meta> en el HTML de producción. Si agregas otro servicio externo, súmalo aquí (connect-src / img-src).
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://tile.openstreetmap.org",
  "font-src 'self' data:",
  "connect-src 'self' https://yopagoenvalpo.cl https://mindicador.cl https://nominatim.openstreetmap.org https://*.supabase.co",
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const csp = (): Plugin => ({
  name: 'inject-csp',
  apply: 'build',
  transformIndexHtml: (html) => html.replace('<meta name="color-scheme"', `<meta http-equiv="Content-Security-Policy" content="${CSP}" />\n    <meta name="color-scheme"`),
});

// VITE_BASE: en GitHub Pages de proyecto es "/nombre-del-repo/"; en un sitio de usuario o dominio propio, "/".
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react(), csp()],
  build: { target: 'es2022', chunkSizeWarningLimit: 700 },
});

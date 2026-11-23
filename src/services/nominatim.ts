import { get, set } from 'idb-keyval';

/**
 * Geocodificación opcional con Nominatim (OpenStreetMap). Política de uso: máximo 1 consulta por segundo,
 * sin cargas masivas y con caché. Para volumen alto usa tu propia instancia o un proveedor de pago.
 * Se activa en Ajustes → "Geocodificar con Nominatim".
 */
let last = 0;
export async function geocode(query: string): Promise<{ lat: number; lon: number } | null> {
  const key = `geo:${query.toLowerCase()}`;
  const cached = (await get(key).catch(() => undefined)) as { lat: number; lon: number } | null | undefined;
  if (cached !== undefined) return cached;
  const wait = Math.max(0, last + 1100 - Date.now());
  await new Promise((r) => setTimeout(r, wait));
  last = Date.now();
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=cl&q=${encodeURIComponent(query + ', Valparaíso, Chile')}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
  if (!res.ok) return null;
  const [hit] = (await res.json()) as { lat: string; lon: string }[];
  const out = hit ? { lat: Number(hit.lat), lon: Number(hit.lon) } : null;
  void set(key, out).catch(() => undefined);
  return out;
}

import type { Permit } from '../types';
import { findStreet } from '../data/streets';

/** Calle a partir de la dirección ("PEDRO MONTT ALTURA 1942 - B BAZAR …" → "Pedro Montt"). */
export function streetOf(direccion: string, descripcion = ''): string {
  const ref = findStreet(direccion) ?? findStreet(descripcion);
  if (ref) return ref.name;
  const m = direccion.match(/^(.*?)(?:\s+ALT(?:URA)?\b|\s+N[°º]?\s*\d|\s+\d)/i);
  const raw = (m?.[1] ?? direccion).trim();
  return raw ? raw.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()) : 'Sin calle';
}

const hash = (n: number) => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };

/**
 * Ubica el permiso con la referencia de calles (APROXIMADA): interpola por la altura de la dirección.
 * Reemplázalo por un geocodificador real cuando lo tengas (ver services/nominatim.ts).
 */
export function locate(p: Permit): Permit {
  const ref = findStreet(p.direccion) ?? findStreet(p.descripcion);
  if (!ref) return p;
  const altura = Number(p.direccion.match(/ALT(?:URA)?\.?\s*(\d{1,5})/i)?.[1] ?? 0);
  const t = ref.from === ref.to ? 0.5 : Math.min(1, Math.max(0, (altura - ref.from) / (ref.to - ref.from)));
  const jitter = (k: number) => (hash(p.numeroArriendo + k) - 0.5) * 0.00045;
  return { ...p, calle: ref.name, lat: ref.a[0] + (ref.b[0] - ref.a[0]) * t + jitter(1), lon: ref.a[1] + (ref.b[1] - ref.a[1]) * t + jitter(2) };
}

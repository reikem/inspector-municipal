import type { Fine, Inspection, Outcome } from '../types';

/** Datos mínimos que viajan dentro del QR (sin RUT ni dirección). */
export interface QrPayload { c: string; n: number; r: Outcome; d: string; i: string; f?: string; m?: number }

const b64u = {
  enc: (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
  dec: (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))),
};

export function payloadOf(i: Inspection, f?: Fine): QrPayload {
  return { c: i.code, n: i.permitNumber, r: i.outcome, d: i.finishedAt, i: i.inspectorId, ...(f ? { f: f.folio, m: f.totalClp } : {}) };
}

/**
 * URL pública que se codifica en el QR. Con el backend en memoria, el resultado viaja dentro de la propia URL
 * (sirve para demostrar el flujo, pero NO es a prueba de falsificación). En producción (Supabase/Postgres) el QR
 * solo lleva el código y la página consulta al servidor.
 */
export function verifyUrl(i: Inspection, f?: Fine, embed = true): string {
  const base = `${location.origin}${location.pathname}#/v/${encodeURIComponent(i.code)}`;
  return embed ? `${base}?p=${b64u.enc(JSON.stringify(payloadOf(i, f)))}` : base;
}

export function readPayload(hash: string): QrPayload | undefined {
  const q = hash.split('?')[1];
  const p = q ? new URLSearchParams(q).get('p') : null;
  if (!p) return undefined;
  try { return JSON.parse(b64u.dec(p)) as QrPayload; } catch { return undefined; }
}

export const OUTCOME_LABEL: Record<Outcome, string> = {
  aprobada: 'Inspección aprobada',
  observaciones: 'Aprobada con observaciones',
  multa: 'Multa cursada',
};

/** Código corto legible para el QR (sin caracteres confusos). */
export function newCode(): string {
  const abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const b = crypto.getRandomValues(new Uint8Array(8));
  return [...b].map((x) => abc[x % abc.length]).join('');
}

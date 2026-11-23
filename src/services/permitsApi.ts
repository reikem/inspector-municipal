import { config } from '../config';
import type { Permit, PermitStatus, Settings } from '../types';
import { locate, streetOf } from './geo';

// ---------- Lectura de la respuesta (JSON o XML) ----------
const decodeEntities = (s: string): string =>
  s.replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

function parseJson(s: string): unknown {
  try { let v: unknown = JSON.parse(s); if (typeof v === 'string') v = JSON.parse(v); return v; } catch { return null; }
}

/** El servicio puede responder JSON o XML (<string>{"provisoria":…}</string>): se aceptan ambos. */
export function parseBody(text: string): unknown {
  const t = text.trim().replace(/^\uFEFF/, '');
  if (!t.startsWith('<')) return parseJson(t);
  const inner = decodeEntities(t.replace(/<\?[\s\S]*?\?>/g, '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '').trim());
  if (inner.startsWith('{') || inner.startsWith('"')) return parseJson(inner);
  const out: Record<string, string> = {};
  for (const m of t.matchAll(/<([A-Za-z_][\w.-]*)(?:\s[^>]*)?>([^<]*)<\/\1>/g)) out[m[1]] = decodeEntities(m[2].trim());
  return Object.keys(out).length ? out : null;
}

export function toPermit(data: unknown): Permit | null {
  const root = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const nested = Object.entries(root).find(([k]) => k.toLowerCase() === 'provisoria')?.[1];
  const src = (nested && typeof nested === 'object' ? nested : root) as Record<string, unknown>;
  const get = (name: string) => {
    const hit = Object.entries(src).find(([k]) => k.toLowerCase() === name);
    return hit && hit[1] != null ? String(hit[1]).trim() : '';
  };
  const numero = Number(get('numeroarriendo'));
  const nombres = get('nombres'), estado = get('estado');
  if (!Number.isFinite(numero) || numero <= 0 || !nombres || !estado) return null;
  const direccionRaw = get('direccion');
  const descripcion = get('descripcion');
  const permit: Permit = {
    numeroArriendo: numero,
    nombres,
    rut: get('rut'),
    direccion: direccionRaw.replace(/\s{2,}/g, ' '),
    metraje: get('metraje') || direccionRaw.match(/METRAJE\s+(.+)$/i)?.[1]?.trim() || '',
    descripcion,
    estado,
    deuda: Number(get('deuda').replace(/[^\d.-]/g, '')) || 0,
    calle: streetOf(direccionRaw, descripcion),
    source: 'api',
    fetchedAt: new Date().toISOString(),
  };
  return locate(permit);
}

export const statusOf = (p: Pick<Permit, 'estado' | 'deuda'>): PermitStatus =>
  p.estado.trim().toUpperCase() !== 'VIGENTE' ? 'desactivado' : p.deuda > 0 ? 'atrasado' : 'al_dia';

export const STATUS_LABEL: Record<PermitStatus, string> = { al_dia: 'Al día', atrasado: 'Atrasado', desactivado: 'Desactivado' };

// ---------- Consulta ----------
export type FetchResult = { kind: 'found'; permit: Permit } | { kind: 'missing' } | { kind: 'error'; status: number; why: string };

export async function fetchPermit(id: number, signal?: AbortSignal, base: string = config.permitsApi): Promise<FetchResult> {
  const url = new URL(base);
  url.searchParams.set('id', String(id));
  try {
    const timeout = AbortSignal.timeout(10_000);
    const res = await fetch(url, {
      headers: { Accept: 'application/json, application/xml;q=0.9, text/xml;q=0.8' },
      credentials: 'omit', referrerPolicy: 'no-referrer',
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    if (res.status === 404) return { kind: 'missing' };
    if (!res.ok) return { kind: 'error', status: res.status, why: `HTTP ${res.status}` };
    const permit = toPermit(parseBody(await res.text()));
    return permit ? { kind: 'found', permit } : { kind: 'missing' };
  } catch (e) {
    if (signal?.aborted) return { kind: 'error', status: 0, why: 'cancelado' };
    return { kind: 'error', status: 0, why: `No se pudo leer la respuesta (¿CORS o sin conexión?). Usa un proxy: ${String(e)}` };
  }
}

// ---------- Recorrido (sincronización) ----------
export interface Progress { current: number; found: number; missing: number; errors: number; message: string }
const sleep = (ms: number, signal?: AbortSignal) => new Promise<void>((r) => { const t = setTimeout(r, ms); signal?.addEventListener('abort', () => { clearTimeout(t); r(); }, { once: true }); });

/**
 * Recorre un rango de N.º de arriendo consultando la API, con cortesía hacia el servidor:
 * pocas consultas en paralelo, pausa entre tandas, retroceso ante errores/429 y corte automático
 * cuando aparecen muchos números seguidos sin permiso (fin de la numeración).
 */
export async function syncRange(
  s: Settings['sync'],
  onBatch: (found: Permit[], p: Progress) => Promise<void> | void,
  signal: AbortSignal,
): Promise<Progress> {
  const p: Progress = { current: s.from, found: 0, missing: 0, errors: 0, message: 'Iniciando…' };
  let misses = 0, delay = s.delayMs;
  for (let id = s.from; id <= s.to && !signal.aborted; ) {
    const ids = Array.from({ length: Math.min(s.concurrency, s.to - id + 1) }, (_, i) => id + i);
    const results = await Promise.all(ids.map((n) => fetchPermit(n, signal)));
    const found: Permit[] = [];
    let rateLimited = false, failed = false;
    results.forEach((r) => {
      if (r.kind === 'found') { found.push(r.permit); misses = 0; p.found++; }
      else if (r.kind === 'missing') { misses++; p.missing++; }
      else { p.errors++; failed = true; if (r.status === 429) rateLimited = true; p.message = r.why; }
    });
    id += ids.length;
    p.current = id - 1;
    if (found.length) await onBatch(found, p);
    if (failed && p.errors > 20 && p.found === 0) { p.message = 'Demasiados errores seguidos: revisa CORS/proxy y vuelve a intentar.'; break; }
    if (misses >= s.maxMisses) { p.message = `Fin de la numeración (${misses} números seguidos sin permiso).`; break; }
    delay = rateLimited ? Math.min(15000, delay * 2 + 1000) : failed ? Math.min(5000, delay * 1.5) : s.delayMs;
    await sleep(delay, signal);
  }
  if (signal.aborted) p.message = 'Pausado por el usuario.';
  else if (!p.message.startsWith('Fin') && !p.message.startsWith('Demasiados')) p.message = 'Recorrido completo.';
  return p;
}

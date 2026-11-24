import { useEffect, useState } from 'react';
import { useStore } from '../store';
import type { Permit } from '../types';

const DB_NAME = 'inspector_municipal_cache';
const STORE_NAME = 'permits';
const DB_VERSION = 1;
const PERMITS_UPDATED_EVENT = 'inspector:permits-updated';

function openCacheDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'numeroArriendo' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function notifyPermitsUpdated(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PERMITS_UPDATED_EVENT));
  }
}

export async function getCachedPermit(numeroArriendo: number): Promise<Permit | null> {
  const db = await openCacheDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(numeroArriendo);
    req.onsuccess = () => resolve((req.result as Permit) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllCachedPermits(): Promise<Permit[]> {
  const db = await openCacheDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve((req.result as Permit[]) ?? []);
    req.onerror = () => reject(req.error);
  });
}

export async function saveCachedPermits(permits: Permit[]): Promise<void> {
  if (!permits.length) return;
  const db = await openCacheDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    for (const p of permits) store.put(p);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  notifyPermitsUpdated();
}

/** Devuelve true solo si hoy está entre el día 2 y el día 5 del mes (inclusive). */
export function isMonthlyRefreshWindow(now: Date = new Date()): boolean {
  const day = now.getDate();
  return day >= 2 && day <= 5;
}

/**
 * Determina si corresponde consultar nuevamente la API para un permiso en caché:
 * - Si no existe en caché: sí.
 * - Si estamos fuera de los días 2 al 5 del mes: NO (usa caché para proteger la API).
 * - Si estamos entre los días 2 y 5: sí, siempre que aún no se haya actualizado en este mes/año.
 */
export function shouldRevalidatePermit(cached: Permit | null, now: Date = new Date()): boolean {
  if (!cached || cached.source === 'demo') return true;
  if (!isMonthlyRefreshWindow(now)) return false;

  const fetched = new Date(cached.fetchedAt);
  if (Number.isNaN(fetched.getTime())) return true;

  const sameMonth =
    fetched.getFullYear() === now.getFullYear() && fetched.getMonth() === now.getMonth();
  return !sameMonth;
}

/**
 * Hook reactivo: combina el store y la base local (IndexedDB).
 * Cuando existen permisos reales ('api'), reemplaza los registros 'demo'
 * y actualiza automáticamente Dashboard, MapPage y cualquier componente suscrito.
 */
export function useActivePermits(): Permit[] {
  const storePermits = useStore((s) => s.permits);
  const [cachedPermits, setCachedPermits] = useState<Permit[]>(() => []);

  useEffect(() => {
    let active = true;
    const load = () => {
      void getAllCachedPermits()
        .then((list) => {
          if (active) setCachedPermits(list);
        })
        .catch(() => {});
    };

    load();
    window.addEventListener(PERMITS_UPDATED_EVENT, load);
    return () => {
      active = false;
      window.removeEventListener(PERMITS_UPDATED_EVENT, load);
    };
  }, []);

  const merged = new Map<number, Permit>();
  for (const p of storePermits) {
    merged.set(p.numeroArriendo, p);
  }
  for (const p of cachedPermits) {
    const prev = merged.get(p.numeroArriendo);
    if (!prev || new Date(p.fetchedAt) >= new Date(prev.fetchedAt)) {
      merged.set(p.numeroArriendo, p);
    }
  }

  const all = [...merged.values()];
  const hasRealPermits = all.some((p) => p.source === 'api');
  return hasRealPermits ? all.filter((p) => p.source !== 'demo') : all;
}
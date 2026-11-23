/**
 * CONECTOR POSTGRESQL (comentado).
 *
 * Un navegador NO puede (ni debe) conectarse directo a PostgreSQL: expondría usuario y contraseña.
 * La arquitectura correcta es:  navegador → tu API HTTP (con login) → PostgreSQL.
 *
 *  1. Crea las tablas con db/schema.sql en tu PostgreSQL.
 *  2. Levanta la API de ejemplo de server/postgres-api.example.ts (Express + pg), con autenticación.
 *  3. Define VITE_DATA_BACKEND=postgres y VITE_POSTGRES_API=https://tu-servidor/api
 *  4. Descomenta este archivo y el bloque de repository/index.ts.
 */

// import type { Fine, Inspection, Permit, Settings, Snapshot } from '../types';
// import type { Repository } from './types';
//
// export class PostgresHttpRepository implements Repository {
//   readonly name = 'PostgreSQL (vía API)';
//   constructor(private base: string, private token = () => localStorage.getItem('inspector:token') ?? '') {}
//
//   private async call<T>(path: string, init: RequestInit = {}): Promise<T> {
//     const res = await fetch(`${this.base}${path}`, {
//       ...init,
//       headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token()}`, ...init.headers },
//     });
//     if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
//     return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
//   }
//   private put = (path: string, body: unknown) => this.call<void>(path, { method: 'PUT', body: JSON.stringify(body) });
//
//   async init() {}
//   getPermits() { return this.call<Permit[]>('/permits'); }
//   upsertPermits(items: Permit[]) { return this.put('/permits', items); }
//   clearPermits() { return this.call<void>('/permits', { method: 'DELETE' }); }
//   getInspections() { return this.call<Inspection[]>('/inspections'); }
//   saveInspection(i: Inspection) { return this.put(`/inspections/${i.id}`, i); }
//   getFines() { return this.call<Fine[]>('/fines'); }
//   saveFine(f: Fine) { return this.put(`/fines/${f.id}`, f); }
//   async nextFolio() { return (await this.call<{ folio: string }>('/folio/next', { method: 'POST' })).folio; }
//   getSnapshots() { return this.call<Snapshot[]>('/snapshots'); }
//   addSnapshot(s: Snapshot) { return this.put(`/snapshots/${s.date}`, s); }
//   async getSettings() { return (await this.call<Settings | null>('/settings')) ?? undefined; }
//   saveSettings(s: Settings) { return this.put('/settings', s); }
//   async findInspectionByCode(code: string) {
//     try { return await this.call<{ inspection: Inspection; fine?: Fine }>(`/verify/${encodeURIComponent(code)}`); } catch { return undefined; }
//   }
//   async replaceAll() { throw new Error('No disponible: importa por SQL.'); }
//   async reset() { throw new Error('No disponible.'); }
// }
export {};

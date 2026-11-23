/**
 * CONECTOR SUPABASE (comentado). Para activarlo:
 *   pnpm add @supabase/supabase-js   ·   ejecutar db/schema.sql   ·   descomentar este archivo y el bloque de repository/index.ts
 *
 * Seguridad:
 *  - En el navegador va SOLO la publishable key. La secret/service key NUNCA va en el frontend.
 *  - Las tablas tienen RLS: solo usuarios autenticados (inspectores) leen y escriben.
 *  - La verificación pública del QR usa la función RPC `verify_inspection` (devuelve únicamente campos no sensibles).
 *  - Inicia sesión a los inspectores con supabase.auth (correo + contraseña o enlace mágico) antes de usar el repositorio.
 */

// import { createClient, type SupabaseClient } from '@supabase/supabase-js';
// import type { Fine, Inspection, Permit, Settings, Snapshot } from '../types';
// import type { Repository } from './types';
//
// const snake = (o: Record<string, unknown>) =>
//   Object.fromEntries(Object.entries(o).map(([k, v]) => [k.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase()), v]));
// const camel = <T,>(o: Record<string, unknown>) =>
//   Object.fromEntries(Object.entries(o).map(([k, v]) => [k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()), v])) as T;
//
// export class SupabaseRepository implements Repository {
//   readonly name = 'Supabase';
//   private db: SupabaseClient;
//   constructor(url: string, publishableKey: string) {
//     this.db = createClient(url, publishableKey, { auth: { persistSession: true } });
//   }
//   async init() { /* opcional: comprobar sesión → const { data } = await this.db.auth.getSession(); */ }
//
//   async getPermits() {
//     const out: Permit[] = [];
//     for (let from = 0; ; from += 1000) {                       // pagina de a 1000 filas
//       const { data, error } = await this.db.from('permits').select('*').range(from, from + 999);
//       if (error) throw error;
//       out.push(...(data ?? []).map((r) => camel<Permit>(r)));
//       if (!data || data.length < 1000) break;
//     }
//     return out;
//   }
//   async upsertPermits(items: Permit[]) {
//     for (let i = 0; i < items.length; i += 500) {
//       const { error } = await this.db.from('permits').upsert(items.slice(i, i + 500).map((p) => snake({ ...p })), { onConflict: 'numero_arriendo' });
//       if (error) throw error;
//     }
//   }
//   async clearPermits() { const { error } = await this.db.from('permits').delete().gte('numero_arriendo', 0); if (error) throw error; }
//
//   async getInspections() {
//     const { data, error } = await this.db.from('inspections').select('*').order('finished_at', { ascending: false });
//     if (error) throw error; return (data ?? []).map((r) => camel<Inspection>(r));
//   }
//   async saveInspection(i: Inspection) { const { error } = await this.db.from('inspections').upsert(snake({ ...i })); if (error) throw error; }
//
//   async getFines() {
//     const { data, error } = await this.db.from('fines').select('*').order('issued_at', { ascending: false });
//     if (error) throw error; return (data ?? []).map((r) => camel<Fine>(r));
//   }
//   async saveFine(f: Fine) { const { error } = await this.db.from('fines').upsert(snake({ ...f })); if (error) throw error; }
//   async nextFolio() {                                           // secuencia atómica en la base (evita folios repetidos)
//     const { data, error } = await this.db.rpc('next_folio'); if (error) throw error; return data as string;
//   }
//
//   async getSnapshots() {
//     const { data, error } = await this.db.from('snapshots').select('*').order('date');
//     if (error) throw error; return (data ?? []).map((r) => camel<Snapshot>(r));
//   }
//   async addSnapshot(s: Snapshot) { const { error } = await this.db.from('snapshots').upsert(snake({ ...s }), { onConflict: 'date' }); if (error) throw error; }
//
//   async getSettings() {
//     const { data } = await this.db.from('settings').select('value').eq('id', 1).maybeSingle();
//     return (data?.value as Settings | undefined) ?? undefined;
//   }
//   async saveSettings(s: Settings) { const { error } = await this.db.from('settings').upsert({ id: 1, value: s }); if (error) throw error; }
//
//   async findInspectionByCode(code: string) {
//     // Verificación pública: la función devuelve solo campos no sensibles (ver db/schema.sql).
//     const { data, error } = await this.db.rpc('verify_inspection', { p_code: code });
//     if (error || !data) return undefined;
//     return data as { inspection: Inspection; fine?: Fine };
//   }
//
//   async replaceAll() { throw new Error('No disponible en Supabase: usa migraciones o importa por SQL.'); }
//   async reset() { throw new Error('No disponible en Supabase.'); }
// }
export {};

import { MemoryRepository } from './memory';
import type { Repository } from './types';
// ── Conectores (descomenta el que vayas a usar y su archivo *.connector.ts) ──────────────────────
// import { SupabaseRepository } from './supabase.connector';
// import { PostgresHttpRepository } from './postgres.connector';
// import { config } from '../config';

/**
 * Punto único donde se elige el backend. Por ahora: memoria del navegador.
 *
 * Para Supabase:
 *   1. Ejecuta db/schema.sql en el SQL Editor de tu proyecto.
 *   2. Define VITE_DATA_BACKEND=supabase, VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY en .env
 *   3. Instala el cliente:  pnpm add @supabase/supabase-js
 *   4. Descomenta los imports de arriba y el bloque de abajo.
 */
export function createRepository(): Repository {
  // switch (config.backend) {
  //   case 'supabase': return new SupabaseRepository(config.supabaseUrl, config.supabaseKey);
  //   case 'postgres': return new PostgresHttpRepository(config.postgresApi);
  //   default: break;
  // }
  return new MemoryRepository();
}

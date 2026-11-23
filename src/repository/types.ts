import type { Fine, Inspection, Permit, Settings, Snapshot } from '../types';

/**
 * Contrato de almacenamiento. Hoy se usa MemoryRepository (memoria del navegador).
 * Para pasar a Supabase o PostgreSQL solo hay que descomentar su conector (ver *.connector.ts)
 * e implementar esta misma interfaz: ninguna pantalla cambia.
 */
export interface Repository {
  readonly name: string;
  init(): Promise<void>;

  getPermits(): Promise<Permit[]>;
  upsertPermits(items: Permit[]): Promise<void>;
  clearPermits(): Promise<void>;

  getInspections(): Promise<Inspection[]>;
  saveInspection(i: Inspection): Promise<void>;

  getFines(): Promise<Fine[]>;
  saveFine(f: Fine): Promise<void>;
  nextFolio(): Promise<string>;

  getSnapshots(): Promise<Snapshot[]>;
  addSnapshot(s: Snapshot): Promise<void>;

  getSettings(): Promise<Settings | undefined>;
  saveSettings(s: Settings): Promise<void>;

  /** Busca una inspección por el código del QR (la verificación pública usa solo esto). */
  findInspectionByCode(code: string): Promise<{ inspection: Inspection; fine?: Fine } | undefined>;

  /** Reemplaza todos los datos (demo, importar). */
  replaceAll(data: { permits: Permit[]; inspections: Inspection[]; fines: Fine[]; snapshots: Snapshot[] }): Promise<void>;
  reset(): Promise<void>;
}

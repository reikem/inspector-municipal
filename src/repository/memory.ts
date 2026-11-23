import { del, get, set } from 'idb-keyval';
import type { Fine, Inspection, Permit, Settings, Snapshot } from '../types';
import type { Repository } from './types';

const KEYS = ['permits', 'inspections', 'fines', 'snapshots', 'settings', 'folio'] as const;
const PREFIX = 'inspector:';

/**
 * Almacenamiento en MEMORIA del navegador. Se respalda en IndexedDB para no perder datos al recargar.
 * Limitación: los datos viven solo en este dispositivo; para trabajo en equipo usa Supabase/PostgreSQL.
 */
export class MemoryRepository implements Repository {
  readonly name = 'Memoria del navegador (IndexedDB)';
  private permits = new Map<number, Permit>();
  private inspections = new Map<string, Inspection>();
  private fines = new Map<string, Fine>();
  private snapshots: Snapshot[] = [];
  private settings?: Settings;
  private folio = 0;
  private timer?: ReturnType<typeof setTimeout>;

  async init(): Promise<void> {
    try {
      const [p, i, f, s, st, fo] = await Promise.all(KEYS.map((k) => get(PREFIX + k)));
      ((p as Permit[]) ?? []).forEach((x) => this.permits.set(x.numeroArriendo, x));
      ((i as Inspection[]) ?? []).forEach((x) => this.inspections.set(x.id, x));
      ((f as Fine[]) ?? []).forEach((x) => this.fines.set(x.id, x));
      this.snapshots = (s as Snapshot[]) ?? [];
      this.settings = st as Settings | undefined;
      this.folio = (fo as number) ?? 0;
    } catch { /* IndexedDB no disponible (modo privado): se trabaja solo en memoria */ }
  }

  /** Guarda en IndexedDB con retraso para no escribir en cada cambio. */
  private persist(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      const data: Record<(typeof KEYS)[number], unknown> = {
        permits: [...this.permits.values()], inspections: [...this.inspections.values()], fines: [...this.fines.values()],
        snapshots: this.snapshots, settings: this.settings, folio: this.folio,
      };
      KEYS.forEach((k) => { void set(PREFIX + k, data[k]).catch(() => undefined); });
    }, 400);
  }

  async getPermits() { return [...this.permits.values()]; }
  async upsertPermits(items: Permit[]) { items.forEach((p) => this.permits.set(p.numeroArriendo, p)); this.persist(); }
  async clearPermits() { this.permits.clear(); this.persist(); }

  async getInspections() { return [...this.inspections.values()].sort((a, b) => b.finishedAt.localeCompare(a.finishedAt)); }
  async saveInspection(i: Inspection) { this.inspections.set(i.id, i); this.persist(); }

  async getFines() { return [...this.fines.values()].sort((a, b) => b.issuedAt.localeCompare(a.issuedAt)); }
  async saveFine(f: Fine) { this.fines.set(f.id, f); this.persist(); }
  async nextFolio() {
    this.folio += 1; this.persist();
    return `M-${new Date().getFullYear()}-${String(this.folio).padStart(6, '0')}`;
  }

  async getSnapshots() { return this.snapshots; }
  async addSnapshot(s: Snapshot) {
    this.snapshots = [...this.snapshots.filter((x) => x.date !== s.date), s].sort((a, b) => a.date.localeCompare(b.date)).slice(-120);
    this.persist();
  }

  async getSettings() { return this.settings; }
  async saveSettings(s: Settings) { this.settings = s; this.persist(); }

  async findInspectionByCode(code: string) {
    const inspection = [...this.inspections.values()].find((x) => x.code === code);
    if (!inspection) return undefined;
    return { inspection, fine: inspection.fineId ? this.fines.get(inspection.fineId) : undefined };
  }

  async replaceAll(d: { permits: Permit[]; inspections: Inspection[]; fines: Fine[]; snapshots: Snapshot[] }) {
    this.permits = new Map(d.permits.map((x) => [x.numeroArriendo, x]));
    this.inspections = new Map(d.inspections.map((x) => [x.id, x]));
    this.fines = new Map(d.fines.map((x) => [x.id, x]));
    this.snapshots = d.snapshots;
    this.persist();
  }

  async reset() {
    this.permits.clear(); this.inspections.clear(); this.fines.clear(); this.snapshots = []; this.settings = undefined; this.folio = 0;
    await Promise.all(KEYS.map((k) => del(PREFIX + k).catch(() => undefined)));
  }
}

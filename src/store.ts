import { useSyncExternalStore } from 'react';
import { defaultSettings } from './config';
import { makeDemoInspections, makeDemoPermits, makeDemoSnapshots } from './data/demo';
import { RULES } from './data/rules';
import { createRepository } from './repository';
import { fetchUtm } from './services/utm';
import { statusOf, syncRange } from './services/permitsApi';
import { newCode } from './services/verify';
import { summarize } from './services/stats';
import type { CheckValue, Fine, FineItem, Inspection, Outcome, Permit, Settings, Snapshot, SyncState } from './types';

export interface State {
  ready: boolean;
  backend: string;
  permits: Permit[];
  inspections: Inspection[];
  fines: Fine[];
  snapshots: Snapshot[];
  settings: Settings;
  sync: SyncState;
  toast: string;
}

const repo = createRepository();
const initial: State = {
  ready: false, backend: repo.name, permits: [], inspections: [], fines: [], snapshots: [],
  settings: structuredClone(defaultSettings) as Settings,
  sync: { running: false, current: 0, from: 0, to: 0, found: 0, missing: 0, errors: 0, message: '' },
  toast: '',
};
let state = initial;
const listeners = new Set<() => void>();
const set = (patch: Partial<State>) => { state = { ...state, ...patch }; listeners.forEach((l) => l()); };
export const useStore = <T,>(sel: (s: State) => T): T => useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => sel(state));
export const getState = () => state;
export const toast = (m: string) => { set({ toast: m }); setTimeout(() => { if (state.toast === m) set({ toast: '' }); }, 3500); };
export const findRepoInspection = (code: string) => repo.findInspectionByCode(code);

// ───────── Arranque ─────────
export async function boot() {
  await repo.init();
  const saved = await repo.getSettings();
  const settings = { ...(structuredClone(defaultSettings) as Settings), ...saved };
  let [permits, inspections, fines, snapshots] = await Promise.all([repo.getPermits(), repo.getInspections(), repo.getFines(), repo.getSnapshots()]);
  if (permits.length === 0) {
    // Primera vez: datos FICTICIOS de demostración hasta que se sincronice con la API real.
    permits = makeDemoPermits();
    snapshots = makeDemoSnapshots(permits);
    const demo = makeDemoInspections(permits, settings);
    inspections = demo.inspections; fines = demo.fines;
    await repo.replaceAll({ permits, inspections, fines, snapshots });
  }
  set({ ready: true, permits, inspections: [...inspections].sort((a, b) => b.finishedAt.localeCompare(a.finishedAt)), fines: [...fines].sort((a, b) => b.issuedAt.localeCompare(a.issuedAt)), snapshots, settings });
  fetchUtm().then((u) => saveSettings({ ...state.settings, utmValue: u.value, utmDate: u.date })).catch(() => undefined);
}

export async function saveSettings(s: Settings) { await repo.saveSettings(s); set({ settings: s }); }
export const isDemo = () => state.permits.length > 0 && state.permits.every((p) => p.source === 'demo');

// ───────── Sincronización con la API de permisos ─────────
let abort: AbortController | null = null;
export function stopSync() { abort?.abort(); }

export async function startSync() {
  if (state.sync.running) return;
  const cfg = state.settings.sync;
  abort = new AbortController();
  if (isDemo()) { await repo.clearPermits(); set({ permits: [] }); }
  set({ sync: { running: true, current: cfg.from, from: cfg.from, to: cfg.to, found: 0, missing: 0, errors: 0, message: 'Consultando…' } });
  const res = await syncRange(cfg, async (found, p) => {
    await repo.upsertPermits(found);
    const map = new Map(state.permits.map((x) => [x.numeroArriendo, x]));
    found.forEach((x) => map.set(x.numeroArriendo, x));
    set({ permits: [...map.values()], sync: { ...state.sync, ...p, running: true, from: cfg.from, to: cfg.to } });
  }, abort.signal);
  set({ sync: { ...state.sync, ...res, running: false } });
  if (state.permits.length) await takeSnapshot();
  toast(res.message);
}

export async function takeSnapshot() {
  const s = summarize(state.permits);
  const snap: Snapshot = { date: new Date().toISOString().slice(0, 10), alDia: s.alDia, atrasado: s.atrasado, desactivado: s.desactivado, deuda: s.deuda };
  await repo.addSnapshot(snap);
  set({ snapshots: await repo.getSnapshots() });
}

// ───────── Inspección ─────────
export interface Evaluation { failed: FineItem[]; totalUtm: number; reincident: boolean; seizure: boolean; suggested: Outcome }

export function evaluate(checks: Record<string, CheckValue>, permit: Permit, reincident: boolean): Evaluation {
  const failed = RULES.filter((r) => checks[r.id] === 'fail').map((r) => ({ ruleId: r.id, label: r.label, utm: r.utm }));
  const cap = reincident ? state.settings.fineCapReincidentUtm : state.settings.fineCapUtm;
  const sum = failed.reduce((a, b) => a + b.utm, 0) * (reincident ? 2 : 1);
  const hard = RULES.some((r) => checks[r.id] === 'fail' && r.severity !== 'leve');
  void permit;
  return { failed, totalUtm: Math.min(cap, sum), reincident, seizure: RULES.some((r) => r.seizure && checks[r.id] === 'fail'), suggested: !failed.length ? 'aprobada' : hard ? 'multa' : 'observaciones' };
}

/** ¿Tiene multas emitidas en los últimos 12 meses? */
export const isReincident = (n: number) => state.fines.some((f) => f.permitNumber === n && f.status !== 'anulada' && Date.now() - new Date(f.issuedAt).getTime() < 365 * 86400000);

export function autoChecks(p: Permit): Record<string, CheckValue> {
  const st = statusOf(p);
  return { permiso_vigente: st === 'desactivado' ? 'fail' : 'ok', pagos_al_dia: st === 'atrasado' ? 'fail' : st === 'desactivado' ? 'na' : 'ok' };
}

export interface InspectionDraft { permit: Permit; checks: Record<string, CheckValue>; notes: string; photos: string[]; gps?: Inspection['gps']; outcome: Outcome; startedAt: string }

export async function registerInspection(d: InspectionDraft): Promise<{ inspection: Inspection; fine?: Fine }> {
  const s = state.settings;
  const reincident = isReincident(d.permit.numeroArriendo);
  const ev = evaluate(d.checks, d.permit, reincident);
  const now = new Date().toISOString();
  const inspection: Inspection = {
    id: crypto.randomUUID(), code: newCode(), permitNumber: d.permit.numeroArriendo, permitName: d.permit.nombres, permitRut: d.permit.rut, direccion: d.permit.direccion,
    startedAt: d.startedAt, finishedAt: now, inspectorName: s.inspectorName, inspectorId: s.inspectorId, checks: d.checks, notes: d.notes, photos: d.photos, gps: d.gps, outcome: d.outcome,
  };
  let fine: Fine | undefined;
  if (d.outcome === 'multa') {
    fine = {
      id: crypto.randomUUID(), folio: await repo.nextFolio(), inspectionId: inspection.id, inspectionCode: inspection.code, permitNumber: d.permit.numeroArriendo,
      permitName: d.permit.nombres, permitRut: d.permit.rut, direccion: d.permit.direccion, items: ev.failed, totalUtm: ev.totalUtm, utmValue: s.utmValue,
      totalClp: Math.round(ev.totalUtm * s.utmValue), reincident, seizure: ev.seizure, status: 'emitida', issuedAt: now, inspectorName: s.inspectorName, inspectorId: s.inspectorId, notes: d.notes,
    };
    inspection.fineId = fine.id;
    await repo.saveFine(fine);
  }
  await repo.saveInspection(inspection);
  set({ inspections: [inspection, ...state.inspections], fines: fine ? [fine, ...state.fines] : state.fines });
  return { inspection, fine };
}

export async function updateFine(f: Fine) { await repo.saveFine(f); set({ fines: state.fines.map((x) => (x.id === f.id ? f : x)) }); }

// ───────── Datos ─────────
export async function resetDemo() {
  await repo.reset();
  const s = structuredClone(defaultSettings) as Settings;
  const permits = makeDemoPermits(); const snapshots = makeDemoSnapshots(permits); const demo = makeDemoInspections(permits, s);
  await repo.replaceAll({ permits, snapshots, inspections: demo.inspections, fines: demo.fines });
  await repo.saveSettings(s);
  set({ permits, snapshots, inspections: demo.inspections, fines: demo.fines, settings: s });
  toast('Datos de demostración restaurados.');
}

export function exportJson(): string { return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), permits: state.permits, inspections: state.inspections, fines: state.fines, snapshots: state.snapshots }); }

export async function importJson(text: string) {
  const d = JSON.parse(text) as { permits?: Permit[]; inspections?: Inspection[]; fines?: Fine[]; snapshots?: Snapshot[] };
  if (!Array.isArray(d.permits)) throw new Error('Archivo no válido.');
  const all = { permits: d.permits, inspections: d.inspections ?? [], fines: d.fines ?? [], snapshots: d.snapshots ?? [] };
  await repo.replaceAll(all);
  set(all);
  toast('Datos importados.');
}

export async function upsertPermit(p: Permit) {
  await repo.upsertPermits([p]);
  set({ permits: [...state.permits.filter((x) => x.numeroArriendo !== p.numeroArriendo), p] });
}

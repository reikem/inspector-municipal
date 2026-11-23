import type { Fine, Inspection, Permit, PermitStatus } from '../types';
import { statusOf } from './permitsApi';

export interface Summary { total: number; alDia: number; atrasado: number; desactivado: number; deuda: number; porcentajeAlDia: number }

export function summarize(permits: Permit[]): Summary {
  const s = { total: permits.length, alDia: 0, atrasado: 0, desactivado: 0, deuda: 0, porcentajeAlDia: 0 };
  permits.forEach((p) => {
    const st = statusOf(p);
    if (st === 'al_dia') s.alDia++; else if (st === 'atrasado') s.atrasado++; else s.desactivado++;
    s.deuda += p.deuda;
  });
  const vigentes = s.alDia + s.atrasado;
  s.porcentajeAlDia = vigentes ? Math.round((s.alDia / vigentes) * 100) : 0;
  return s;
}

export interface StreetRow { calle: string; total: number; atrasados: number; desactivados: number; deuda: number; tasa: number }

export function byStreet(permits: Permit[]): StreetRow[] {
  const m = new Map<string, StreetRow>();
  permits.forEach((p) => {
    const r = m.get(p.calle) ?? { calle: p.calle, total: 0, atrasados: 0, desactivados: 0, deuda: 0, tasa: 0 };
    const st: PermitStatus = statusOf(p);
    r.total++; if (st === 'atrasado') r.atrasados++; if (st === 'desactivado') r.desactivados++; r.deuda += p.deuda;
    m.set(p.calle, r);
  });
  return [...m.values()].map((r) => ({ ...r, tasa: r.total ? r.atrasados / r.total : 0 })).sort((a, b) => b.atrasados - a.atrasados || b.deuda - a.deuda);
}

export type HeatMetric = 'atrasos' | 'deuda' | 'todos';
export interface MapPoint { lat: number; lon: number; weight: number; permit: Permit; status: PermitStatus }

/** Puntos del mapa: el peso del calor es el atraso (1) o la deuda relativa a la mayor deuda. */
export function mapPoints(permits: Permit[], metric: HeatMetric): MapPoint[] {
  const max = Math.max(1, ...permits.map((p) => p.deuda));
  return permits.flatMap((p) => {
    if (p.lat == null || p.lon == null) return [];
    const status = statusOf(p);
    const weight = metric === 'todos' ? 0.35 : status !== 'atrasado' ? 0 : metric === 'deuda' ? 0.25 + 0.75 * (p.deuda / max) : 1;
    return [{ lat: p.lat, lon: p.lon, weight, permit: p, status }];
  });
}

export interface DayRow { date: string; label: string; inspecciones: number; multas: number; observaciones: number }

export function dailyActivity(inspections: Inspection[], fines: Fine[], days = 30): DayRow[] {
  const rows: DayRow[] = [];
  for (let d = days - 1; d >= 0; d--) {
    const date = new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
    rows.push({ date, label: date.slice(5).replace('-', '/'), inspecciones: 0, multas: 0, observaciones: 0 });
  }
  const idx = new Map(rows.map((r, i) => [r.date, i]));
  inspections.forEach((i) => {
    const r = rows[idx.get(i.finishedAt.slice(0, 10)) ?? -1];
    if (!r) return;
    r.inspecciones++; if (i.outcome === 'observaciones') r.observaciones++;
  });
  fines.forEach((f) => { const r = rows[idx.get(f.issuedAt.slice(0, 10)) ?? -1]; if (r && f.status !== 'anulada') r.multas++; });
  return rows;
}

export const clp = (n: number): string => '$' + Math.round(n).toLocaleString('es-CL');
export const utmFmt = (n: number): string => n.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
export const maskRut = (rut: string): string => {
  const [b = '', d = ''] = rut.replace(/\./g, '').split('-');
  const body = b.replace(/^0+/, '');
  return `${body.slice(0, Math.max(0, body.length - 6)) || '*'}.***.***-${d.toUpperCase()}`;
};
export const fullRut = (rut: string): string => {
  const [b = '', d = ''] = rut.replace(/\./g, '').split('-');
  const body = b.replace(/^0+/, '');
  return `${body.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${d.toUpperCase()}`;
};
export const dateTime = (iso: string): string => new Date(iso).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });

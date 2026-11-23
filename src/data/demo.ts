import type { Fine, Inspection, Permit, Settings, Snapshot } from '../types';
import { RULES } from './rules';
import { STREETS } from './streets';
import { locate } from '../services/geo';

/** Generador pseudoaleatorio determinista (los datos de demostración son siempre los mismos). */
function rng(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
const pick = <T,>(r: () => number, a: readonly T[]): T => a[Math.floor(r() * a.length)];

const NOMBRES = ['MARIA', 'JUAN', 'ROSA', 'LUIS', 'ANA', 'JOSE', 'CARMEN', 'PEDRO', 'SOFIA', 'MARIO', 'PATRICIA', 'HECTOR', 'CAMILA', 'RAUL', 'ELENA', 'JORGE', 'GLORIA', 'RICARDO', 'VERONICA', 'CARLOS', 'MARCELA', 'OSCAR', 'NANCY', 'DANIEL'];
const APELLIDOS = ['MUÑOZ', 'ROJAS', 'DIAZ', 'PEREZ', 'SOTO', 'CONTRERAS', 'SILVA', 'MARTINEZ', 'SEPULVEDA', 'MORALES', 'RODRIGUEZ', 'LOPEZ', 'FUENTES', 'HERNANDEZ', 'TORRES', 'ARAYA', 'FLORES', 'ESPINOZA', 'VALENZUELA', 'CASTILLO', 'TAPIA', 'REYES', 'GUTIERREZ', 'CORTES'];
const RUBROS = ['BAZAR', 'FRUTAS Y VERDURAS', 'FLORES', 'COMIDA RAPIDA', 'ARTESANIA', 'ROPA', 'ACCESORIOS', 'LIBROS', 'CONFITERIA'];

function dv(num: number): string {
  let sum = 0, mul = 2;
  for (let n = num; n > 0; n = Math.floor(n / 10)) { sum += (n % 10) * mul; mul = mul === 7 ? 2 : mul + 1; }
  const r = 11 - (sum % 11);
  return r === 11 ? '0' : r === 10 ? 'K' : String(r);
}

/** Permisos FICTICIOS para probar el sistema sin conectarse a ninguna API. */
export function makeDemoPermits(count = 320): Permit[] {
  const r = rng(42);
  const pool = STREETS.flatMap((s) => Array<typeof s>(s.weight).fill(s));
  const now = new Date().toISOString();
  return Array.from({ length: count }, (_, i) => {
    const st = pick(r, pool);
    const altura = st.from === st.to ? 0 : Math.round(st.from + r() * (st.to - st.from));
    const rubro = pick(r, RUBROS);
    const rut = 6_000_000 + Math.floor(r() * 17_000_000);
    const off = r() < 0.12;
    const late = !off && r() < st.arrears;
    const lote = pick(r, ['A', 'B', 'C']);
    const permit: Permit = {
      numeroArriendo: 9_900_001 + i, // rango propio: no choca con números reales
      nombres: `${pick(r, NOMBRES)} ${pick(r, NOMBRES)} ${pick(r, APELLIDOS)} ${pick(r, APELLIDOS)}`,
      rut: `${String(rut).padStart(9, '0')}-${dv(rut)}`,
      direccion: `${st.name.toUpperCase()} ${altura ? `ALTURA ${altura} - ${lote}` : '(PLAZA)'} ${rubro} METRAJE 2 X2 MTRS2`,
      metraje: '2 X2 MTRS2',
      descripcion: `AMBULANTE ${st.name.toUpperCase()}`,
      estado: off ? pick(r, ['DESACTIVADO', 'REVOCADO', 'SUSPENDIDO']) : 'VIGENTE',
      deuda: late ? Math.round((8000 + r() * 190000) / 100) * 100 : 0,
      calle: st.name,
      source: 'demo',
      fetchedAt: now,
    };
    return locate(permit);
  });
}

const status = (p: Permit) => (p.estado.toUpperCase() !== 'VIGENTE' ? 'desactivado' : p.deuda > 0 ? 'atrasado' : 'al_dia');

/** Historial de 30 días para los gráficos de seguimiento. */
export function makeDemoSnapshots(permits: Permit[]): Snapshot[] {
  const r = rng(7);
  const cur = { al: 0, at: 0, de: 0, debt: 0 };
  permits.forEach((p) => { const s = status(p); if (s === 'al_dia') cur.al++; else if (s === 'atrasado') cur.at++; else cur.de++; cur.debt += p.deuda; });
  const out: Snapshot[] = [];
  let at = Math.round(cur.at * 0.78), al = cur.al + (cur.at - at), de = Math.round(cur.de * 0.9), debt = Math.round(cur.debt * 0.7);
  for (let d = 29; d >= 0; d--) {
    const date = new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
    if (d === 0) { out.push({ date, alDia: cur.al, atrasado: cur.at, desactivado: cur.de, deuda: cur.debt }); break; }
    const dAt = Math.round((cur.at - at) / (d + 1) + (r() - 0.5) * 3);
    at += dAt; al -= dAt; de = Math.min(cur.de, de + (r() < 0.2 ? 1 : 0)); debt += Math.round((cur.debt - debt) / (d + 1) + (r() - 0.5) * 20000);
    out.push({ date, alDia: al, atrasado: at, desactivado: de, deuda: debt });
  }
  return out;
}

/** Inspecciones y multas FICTICIAS de los últimos 30 días. */
export function makeDemoInspections(permits: Permit[], settings: Settings): { inspections: Inspection[]; fines: Fine[] } {
  const r = rng(99);
  const inspections: Inspection[] = [];
  const fines: Fine[] = [];
  const active = permits.filter((x) => status(x) !== 'desactivado');
  const failable = RULES.filter((x) => !x.auto);
  for (let i = 0; i < 34; i++) {
    const p = pick(r, active);
    const when = new Date(Date.now() - Math.floor(r() * 29) * 86400000 - Math.floor(r() * 36000000)).toISOString();
    const checks: Inspection['checks'] = {};
    RULES.forEach((x) => { checks[x.id] = x.auto ? (x.auto === 'al_dia' && p.deuda > 0 ? 'fail' : 'ok') : r() < 0.18 ? 'fail' : 'ok'; });
    const failed = failable.filter((x) => checks[x.id] === 'fail');
    const outcome: Inspection['outcome'] = failed.length === 0 ? 'aprobada' : failed.some((x) => x.severity !== 'leve') ? 'multa' : 'observaciones';
    const id = `demo-i-${i}`;
    const code = `D${String(i).padStart(3, '0')}${Math.floor(r() * 1e5).toString(36).toUpperCase()}`;
    const ins: Inspection = { id, code, permitNumber: p.numeroArriendo, permitName: p.nombres, permitRut: p.rut, direccion: p.direccion, startedAt: when, finishedAt: when, inspectorName: settings.inspectorName, inspectorId: settings.inspectorId, checks, notes: '', photos: [], outcome, demo: true };
    if (outcome === 'multa') {
      const items = failed.map((x) => ({ ruleId: x.id, label: x.label, utm: x.utm }));
      const totalUtm = Math.min(settings.fineCapUtm, items.reduce((a, b) => a + b.utm, 0));
      const fine: Fine = { id: `demo-f-${i}`, folio: `M-DEMO-${String(i + 1).padStart(6, '0')}`, inspectionId: id, inspectionCode: code, permitNumber: p.numeroArriendo, permitName: p.nombres, permitRut: p.rut, direccion: p.direccion, items, totalUtm, utmValue: settings.utmValue, totalClp: Math.round(totalUtm * settings.utmValue), reincident: false, seizure: failed.some((x) => x.seizure), status: r() < 0.35 ? 'pagada' : 'emitida', issuedAt: when, inspectorName: settings.inspectorName, inspectorId: settings.inspectorId, notes: '', demo: true };
      ins.fineId = fine.id;
      fines.push(fine);
    }
    inspections.push(ins);
  }
  return { inspections, fines };
}

import { useMemo, useRef, useState } from 'react';
import DataTable, { type Column } from '../components/DataTable';
import { Card, StatusBadge, go, useHash } from '../components/ui';
import PermitDetail from '../components/PermitDetail';
import { getState, saveSettings, startSync, stopSync, toast, useStore } from '../store';
import { fetchPermit, STATUS_LABEL, statusOf } from '../services/permitsApi';
import { clp, maskRut, fullRut } from '../services/stats';
import { config } from '../config';
import type { Permit, PermitStatus } from '../types';

export default function Permits() {
  const { query } = useHash();
  const permits = useStore((s) => s.permits);
  const full = useStore((s) => s.settings.showFullRut);
  const [sel, setSel] = useState<Permit | null>(null);
  const streets = useMemo(() => [...new Set(permits.map((p) => p.calle))].sort((a, b) => a.localeCompare(b, 'es')), [permits]);
  const initial = useMemo<Record<string, string>>(() => { const e = query.get('estado'); const o: Record<string, string> = {}; if (e) o.estado = e; return o; }, [query]);

  const columns: Column<Permit>[] = [
    { key: 'n', header: 'N.º', value: (p) => p.numeroArriendo, sortable: true },
    { key: 'titular', header: 'Titular', value: (p) => p.nombres, sortable: true, render: (p) => <button className="link" onClick={() => setSel(p)}>{p.nombres}</button> },
    { key: 'rut', header: 'RUT', value: (p) => (full ? fullRut(p.rut) : maskRut(p.rut)), render: (p) => <span className="mono">{full ? fullRut(p.rut) : maskRut(p.rut)}</span> },
    { key: 'calle', header: 'Calle', value: (p) => p.calle, sortable: true },
    { key: 'direccion', header: 'Dirección', value: (p) => p.direccion },
    { key: 'deuda', header: 'Deuda', value: (p) => p.deuda, num: true, sortable: true, render: (p) => (p.deuda ? clp(p.deuda) : '—') },
    { key: 'estado', header: 'Estado', value: (p) => STATUS_LABEL[statusOf(p)], sortable: true, render: (p) => <StatusBadge status={statusOf(p)} /> },
    { key: 'acc', header: '', value: () => '', render: (p) => <button className="btn btn--small" onClick={() => go(`/inspeccion?n=${p.numeroArriendo}`)}>Inspeccionar</button> },
  ];

  return (
    <div className="page">
      <h1>Comerciantes y permisos <small className="muted">{permits.length.toLocaleString('es-CL')} registrados</small></h1>
      <SyncPanel />
      <Card>
        <DataTable
          rows={permits} columns={columns} rowKey={(p) => p.numeroArriendo} caption="Permisos de comercio en bienes nacionales de uso público"
          search={{ placeholder: 'Buscar por N.º, nombre, RUT o dirección', text: (p) => `${p.numeroArriendo} ${p.nombres} ${p.rut} ${p.direccion}` }}
          initialSelects={initial} defaultSort={{ key: 'deuda', dir: 'desc' }} exportName="comerciantes"
          filters={[
            { type: 'select', key: 'estado', label: 'Estado', options: (['al_dia', 'atrasado', 'desactivado'] as PermitStatus[]).map((v) => ({ value: v, label: STATUS_LABEL[v] })), test: (p, v) => statusOf(p) === v },
            { type: 'select', key: 'calle', label: 'Calle', options: streets.map((c) => ({ value: c, label: c })), test: (p, v) => p.calle === v },
            { type: 'select', key: 'origen', label: 'Origen', options: [{ value: 'api', label: 'API municipal' }, { value: 'demo', label: 'Demostración' }], test: (p, v) => p.source === v },
            { type: 'range', key: 'deuda', label: 'Deuda ($)', value: (p) => p.deuda, step: 1000 },
          ]}
        />
      </Card>
      {sel && <PermitDetail permit={sel} onClose={() => setSel(null)} />}
    </div>
  );
}

/** Recorre un rango de N.º de arriendo consultando la API y guarda los permisos encontrados. */
function SyncPanel() {
  const settings = useStore((s) => s.settings);
  const sync = useStore((s) => s.sync);
  const [form, setForm] = useState(settings.sync);
  const [test, setTest] = useState('');
  const num = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: Number(e.target.value) });
  const pct = sync.to > sync.from ? Math.round(((sync.current - sync.from + 1) / (sync.to - sync.from + 1)) * 100) : 0;
  const ref = useRef<HTMLDetailsElement>(null);

  const run = async () => { await saveSettings({ ...getState().settings, sync: form }); void startSync(); };
  const probe = async () => {
    setTest('Probando…');
    const r = await fetchPermit(form.from);
    setTest(r.kind === 'found' ? `✔ La API respondió y el formato es válido (N.º ${r.permit.numeroArriendo}).` : r.kind === 'missing' ? '✔ La API responde, pero ese número no existe. Prueba otro.' : `✖ ${r.why}`);
  };

  return (
    <details className="card sync" ref={ref} open={sync.running || undefined}>
      <summary><strong>Sincronizar con la API de permisos</strong><span className="muted"> · recorre un rango de N.º de arriendo</span></summary>
      <div className="sync__body">
        <p className="muted">Consulta <code>{config.permitsApi}</code> número por número. Úsalo con rangos acotados y con tu autorización: es un servicio pensado para consultas individuales; para cargas masivas pide al municipio una exportación oficial o un acceso con límites. Si el navegador bloquea la consulta (CORS), apunta <code>VITE_PERMITS_API</code> a un proxy tuyo.</p>
        <div className="formgrid">
          <label>Desde N.º<input type="number" value={form.from} onChange={num('from')} /></label>
          <label>Hasta N.º<input type="number" value={form.to} onChange={num('to')} /></label>
          <label>En paralelo<input type="number" min={1} max={6} value={form.concurrency} onChange={num('concurrency')} /></label>
          <label>Pausa (ms)<input type="number" min={100} step={50} value={form.delayMs} onChange={num('delayMs')} /></label>
          <label>Cortar tras N sin permiso<input type="number" min={5} value={form.maxMisses} onChange={num('maxMisses')} /></label>
        </div>
        <div className="row">
          {sync.running ? <button className="btn btn--bad" onClick={stopSync}>Pausar</button> : <button className="btn" onClick={() => void run()}>Iniciar recorrido</button>}
          <button className="btn btn--ghost" onClick={() => void probe()} disabled={sync.running}>Probar conexión</button>
          {test && <span role="status">{test}</span>}
        </div>
        {(sync.running || sync.found + sync.missing + sync.errors > 0) && (
          <div className="progress"><div className="bar"><i style={{ width: `${pct}%` }} /></div>
            <p>{sync.running ? 'Consultando' : 'Listo'} · N.º {sync.current} · <b>{sync.found}</b> permisos · {sync.missing} sin permiso · {sync.errors} errores</p>{sync.message && <p className="muted">{sync.message}</p>}</div>)}
        {getState().permits.some((p) => p.source === 'demo') && <p className="muted">Al iniciar, los datos de demostración se reemplazan por los reales.</p>}
        <button className="link" onClick={() => toast('Los permisos se guardan en este navegador (IndexedDB).')}>¿Dónde se guardan?</button>
      </div>
    </details>
  );
}

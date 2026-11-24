import { useEffect, useMemo, useRef, useState } from 'react';
import DataTable, { type Column } from '../components/DataTable';
import { Card, StatusBadge, go, useHash } from '../components/ui';
import PermitDetail from '../components/PermitDetail';
import { getState, saveSettings, startSync, stopSync, toast, useStore } from '../store';
import { fetchPermit, STATUS_LABEL, statusOf } from '../services/permitsApi';
import { getAllCachedPermits, isMonthlyRefreshWindow, saveCachedPermits } from '../services/permitCache';
import { clp, maskRut, fullRut } from '../services/stats';
import { config } from '../config';
import type { Permit, PermitStatus } from '../types';

export default function Permits() {
  const { query } = useHash();
  const storePermits = useStore((s) => s.permits);
  const full = useStore((s) => s.settings.showFullRut);
  const [cachedMap, setCachedMap] = useState<Map<number, Permit>>(() => new Map());
  const [sel, setSel] = useState<Permit | null>(null);

  useEffect(() => {
    void getAllCachedPermits()
      .then((list) => {
        if (!list.length) return;
        setCachedMap(new Map(list.map((p) => [p.numeroArriendo, p])));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const apiPermits = storePermits.filter((p) => p.source === 'api');
    if (!apiPermits.length) return;
    void saveCachedPermits(apiPermits).catch(() => {});
    setCachedMap((prev: Map<number, Permit>) => {
      const next = new Map(prev);
      for (const p of apiPermits) next.set(p.numeroArriendo, p);
      return next;
    });
  }, [storePermits]);

  const permits = useMemo(() => {
    const map = new Map<number, Permit>();
    for (const p of storePermits) {
      if (p.source !== 'demo' || cachedMap.size === 0) map.set(p.numeroArriendo, p);
    }
    for (const [k, p] of cachedMap) {
      const existing = map.get(k);
      if (!existing || new Date(p.fetchedAt) >= new Date(existing.fetchedAt)) {
        map.set(k, p);
      }
    }
    return [...map.values()];
  }, [storePermits, cachedMap]);

  const upsertLocalPermit = (permit: Permit) => {
    setCachedMap((prev: Map<number, Permit>) => {
      const next = new Map(prev);
      next.set(permit.numeroArriendo, permit);
      return next;
    });
    setSel((curr) => (curr?.numeroArriendo === permit.numeroArriendo ? permit : curr));
  };

  const handleRefreshRow = async (row: Permit) => {
    const res = await fetchPermit(row.numeroArriendo, { force: true });
    if (res.kind === 'found') {
      upsertLocalPermit(res.permit);
      toast(`Permiso N.º ${res.permit.numeroArriendo} actualizado desde la API.`);
    } else if (res.kind === 'missing') {
      toast(`El permiso N.º ${row.numeroArriendo} ya no figura en la API municipal.`);
    } else {
      toast(`Error al actualizar N.º ${row.numeroArriendo}: ${res.why}`);
    }
  };

  const streets = useMemo(
    () => [...new Set(permits.map((p) => p.calle))].sort((a, b) => a.localeCompare(b, 'es')),
    [permits],
  );
  const initial = useMemo<Record<string, string>>(() => {
    const e = query.get('estado');
    const o: Record<string, string> = {};
    if (e) o.estado = e;
    return o;
  }, [query]);

  const columns: Column<Permit>[] = [
    { key: 'n', header: 'N.º', value: (p) => p.numeroArriendo, sortable: true },
    { key: 'titular', header: 'Titular', value: (p) => p.nombres, sortable: true, render: (p) => <button className="link" onClick={() => setSel(p)}>{p.nombres}</button> },
    { key: 'rut', header: 'RUT', value: (p) => (full ? fullRut(p.rut) : maskRut(p.rut)), render: (p) => <span className="mono">{full ? fullRut(p.rut) : maskRut(p.rut)}</span> },
    { key: 'calle', header: 'Calle', value: (p) => p.calle, sortable: true },
    { key: 'direccion', header: 'Dirección', value: (p) => p.direccion },
    { key: 'deuda', header: 'Deuda', value: (p) => p.deuda, num: true, sortable: true, render: (p) => (p.deuda ? clp(p.deuda) : '—') },
    { key: 'estado', header: 'Estado', value: (p) => STATUS_LABEL[statusOf(p)], sortable: true, render: (p) => <StatusBadge status={statusOf(p)} /> },
    {
      key: 'actualizado',
      header: 'Consultado',
      value: (p) => p.fetchedAt,
      sortable: true,
      render: (p) => <span className="muted">{new Date(p.fetchedAt).toLocaleDateString('es-CL')}</span>,
    },
    { key: 'acc', header: '', value: () => '', render: (p) => <button className="btn btn--small" onClick={() => go(`/inspeccion?n=${p.numeroArriendo}`)}>Inspeccionar</button> },
  ];

  return (
    <div className="page">
      <h1>Comerciantes y permisos <small className="muted">{permits.length.toLocaleString('es-CL')} en base local</small></h1>
      <SyncPanel onPermitLoaded={upsertLocalPermit} />
      <Card>
        <DataTable
          rows={permits}
          columns={columns}
          rowKey={(p) => p.numeroArriendo}
          caption="Permisos de comercio en bienes nacionales de uso público"
          search={{ placeholder: 'Buscar por N.º, nombre, RUT o dirección', text: (p) => `${p.numeroArriendo} ${p.nombres} ${p.rut} ${p.direccion}` }}
          initialSelects={initial}
          defaultSort={{ key: 'deuda', dir: 'desc' }}
          exportName="comerciantes"
          onRefreshRow={handleRefreshRow}
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

function SyncPanel({ onPermitLoaded }: { onPermitLoaded: (p: Permit) => void }) {
  const settings = useStore((s) => s.settings);
  const sync = useStore((s) => s.sync);
  const [form, setForm] = useState(settings.sync);
  const [singleId, setSingleId] = useState('');
  const [test, setTest] = useState('');
  const [loadingSingle, setLoadingSingle] = useState(false);

  const inRefreshWindow = isMonthlyRefreshWindow();
  const num = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: Number(e.target.value) });
  const pct = sync.to > sync.from ? Math.round(((sync.current - sync.from + 1) / (sync.to - sync.from + 1)) * 100) : 0;
  const ref = useRef<HTMLDetailsElement>(null);

  const run = async () => {
    await saveSettings({ ...getState().settings, sync: form });
    void startSync();
  };

  const probe = async () => {
    setTest('Probando…');
    const r = await fetchPermit(form.from);
    if (r.kind === 'found') {
      onPermitLoaded(r.permit);
      setTest(
        `✔ N.º ${r.permit.numeroArriendo} (${r.permit.nombres}) · ${r.fromCache ? 'leído desde IndexedDB local' : 'consultado en la API'}.`,
      );
    } else if (r.kind === 'missing') {
      setTest('✔ La API responde, pero ese número no existe. Prueba otro.');
    } else {
      setTest(`✖ ${r.why}`);
    }
  };

  const querySingle = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(singleId.trim());
    if (!Number.isInteger(n) || n <= 0) {
      setTest('✖ Ingresa un N.º de arriendo numérico válido (ej: 70509).');
      return;
    }
    setLoadingSingle(true);
    setTest(`Buscando N.º ${n}…`);
    const r = await fetchPermit(n);
    setLoadingSingle(false);

    if (r.kind === 'found') {
      onPermitLoaded(r.permit);
      setSingleId('');
      setTest(
        `✔ N.º ${r.permit.numeroArriendo} (${r.permit.nombres}) agregado a la tabla (${r.fromCache ? 'desde caché local' : 'desde API'}).`,
      );
    } else if (r.kind === 'missing') {
      setTest(`⚠️ El N.º ${n} no tiene permiso registrado.`);
    } else {
      setTest(`✖ ${r.why}`);
    }
  };

  return (
    <details className="card sync" ref={ref} open={sync.running || undefined}>
      <summary>
        <strong>Consultar y sincronizar permisos</strong>
        <span className="muted"> · {inRefreshWindow ? 'ventana mensual activa (días 2–5)' : 'modo ahorro API (usa IndexedDB)'}</span>
      </summary>
      <div className="sync__body">
        <p className="muted">
          Endpoint: <code>{config.permitsApi}</code>. Los registros se guardan en <strong>IndexedDB</strong> y solo se vuelven a consultar masivamente entre los <strong>días 2 y 5 de cada mes</strong> (fuera de esa fecha, usa el botón <strong>Actualizar</strong> de cada fila si necesitas refrescar un permiso puntual).
        </p>

        <form className="row" onSubmit={(e) => void querySingle(e)} style={{ marginBottom: '0.75rem' }}>
          <input
            type="number"
            placeholder="Consultar N.º puntual (ej: 70509)"
            value={singleId}
            onChange={(e) => setSingleId(e.target.value)}
            disabled={sync.running || loadingSingle}
          />
          <button className="btn" type="submit" disabled={sync.running || loadingSingle}>
            {loadingSingle ? 'Consultando…' : 'Consultar y guardar N.º'}
          </button>
        </form>

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
          <div className="progress">
            <div className="bar"><i style={{ width: `${pct}%` }} /></div>
            <p>{sync.running ? 'Consultando' : 'Listo'} · N.º {sync.current} · <b>{sync.found}</b> permisos · {sync.missing} sin permiso · {sync.errors} errores</p>
            {sync.message && <p className="muted">{sync.message}</p>}
          </div>
        )}
        <button className="link" onClick={() => toast('Los permisos se guardan en IndexedDB del navegador y solo se revalidan entre los días 2 y 5 de cada mes.')}>¿Cómo funciona el caché?</button>
      </div>
    </details>
  );
}

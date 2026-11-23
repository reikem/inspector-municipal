import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, StatusBadge, go, useHash } from '../components/ui';
import Scanner from '../components/Scanner';
import QrCode from '../components/QrCode';
import TicketView from '../components/TicketView';
import { GROUPS, RULES, type RuleGroup } from '../data/rules';
import { autoChecks, evaluate, getState, isReincident, registerInspection, toast, upsertPermit, useStore } from '../store';
import { fetchPermit, statusOf } from '../services/permitsApi';
import { clp, fullRut, maskRut, utmFmt } from '../services/stats';
import { OUTCOME_LABEL, verifyUrl } from '../services/verify';
import { printDoc } from '../services/printing/printers';
import { fineDoc, slipDoc } from '../services/printing/ticket';
import { config } from '../config';
import type { CheckValue, Fine, Inspection, Outcome, Permit } from '../types';

async function shrink(file: File, max = 900): Promise<string> {
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return c.toDataURL('image/jpeg', 0.7);
}

export default function Inspect() {
  const { query } = useHash();
  const [permit, setPermit] = useState<Permit | null>(null);
  const [result, setResult] = useState<{ inspection: Inspection; fine?: Fine } | null>(null);
  const [scan, setScan] = useState(false);
  const [busy, setBusy] = useState('');

  /** Abre un permiso: primero el guardado; si viene de la API, se refresca para ver la deuda actual. */
  const open = useCallback(async (n: number) => {
    setScan(false); setBusy('Consultando permiso…');
    let p = getState().permits.find((x) => x.numeroArriendo === n);
    if (!p || p.source === 'api') {
      const r = await fetchPermit(n);
      if (r.kind === 'found') { p = r.permit; await upsertPermit(p); }
      else if (!p) { setBusy(''); toast(r.kind === 'missing' ? `No existe el permiso N.º ${n}.` : `No se pudo consultar: ${r.why}`); return; }
    }
    setBusy(''); setResult(null); setPermit(p ?? null);
  }, []);

  useEffect(() => { const n = Number(query.get('n')); if (n) void open(n); }, [query, open]);

  if (result) return <Done {...result} onNew={() => { setResult(null); setPermit(null); go('/inspeccion'); }} />;
  if (permit) return <Checklist permit={permit} onCancel={() => { setPermit(null); go('/inspeccion'); }} onDone={setResult} />;
  return (
    <div className="page">
      <h1>Nueva inspección</h1>
      <Finder onPick={(n) => void open(n)} onScan={() => setScan(true)} busy={busy} />
      <Recent />
      {scan && <Scanner onId={(id) => void open(id)} onClose={() => setScan(false)} />}
    </div>
  );
}

function Finder({ onPick, onScan, busy }: { onPick: (n: number) => void; onScan: () => void; busy: string }) {
  const permits = useStore((s) => s.permits);
  const [q, setQ] = useState('');
  const t = q.trim().toUpperCase();
  const hits = useMemo(() => (t.length < 2 ? [] : permits.filter((p) => String(p.numeroArriendo).includes(t) || p.nombres.includes(t) || p.rut.replace(/\D/g, '').includes(t.replace(/\D/g, '') || '§')).slice(0, 8)), [permits, t]);
  const asNumber = /^\d{4,10}$/.test(t) ? Number(t) : 0;
  return (
    <Card>
      <div className="row">
        <button className="btn btn--big" onClick={onScan}>📷 Escanear QR de la credencial</button>
        <span className="muted">o busca por N.º de arriendo, nombre o RUT</span>
      </div>
      <input className="bigsearch" type="search" placeholder="Ej.: 70509 o MARIA SOTO" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar permiso" />
      {busy && <p role="status" className="muted">{busy}</p>}
      <ul className="results">
        {hits.map((p) => (<li key={p.numeroArriendo}><button onClick={() => onPick(p.numeroArriendo)}><b>N.º {p.numeroArriendo}</b> {p.nombres}<small>{p.direccion}</small><StatusBadge status={statusOf(p)} /></button></li>))}
        {asNumber > 0 && !hits.some((h) => h.numeroArriendo === asNumber) && <li><button onClick={() => onPick(asNumber)}>Consultar N.º {asNumber} en la API municipal</button></li>}
      </ul>
    </Card>
  );
}

function Recent() {
  const list = useStore((s) => s.inspections).slice(0, 6);
  return (
    <Card title="Últimas inspecciones">
      <ul className="plain">{list.map((i) => (<li key={i.id}><b>N.º {i.permitNumber}</b> · {i.permitName} · <span className={`out out--${i.outcome}`}>{OUTCOME_LABEL[i.outcome]}</span>{i.demo && <small className="muted"> (demo)</small>}</li>))}</ul>
    </Card>
  );
}

function Checklist({ permit, onCancel, onDone }: { permit: Permit; onCancel: () => void; onDone: (r: { inspection: Inspection; fine?: Fine }) => void }) {
  const settings = useStore((s) => s.settings);
  const startedAt = useMemo(() => new Date().toISOString(), []);
  const [checks, setChecks] = useState<Record<string, CheckValue>>(() => ({ ...Object.fromEntries(RULES.map((r) => [r.id, 'ok' as CheckValue])), ...autoChecks(permit) }));
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [gps, setGps] = useState<Inspection['gps']>();
  const [manual, setManual] = useState<Outcome | null>(null);
  const [saving, setSaving] = useState(false);
  const reincident = isReincident(permit.numeroArriendo);
  const ev = evaluate(checks, permit, reincident);
  const outcome = manual ?? ev.suggested;
  const st = statusOf(permit);

  const addPhotos = async (files: FileList | null) => {
    if (!files) return;
    const out: string[] = [];
    for (const f of Array.from(files).slice(0, 4 - photos.length)) out.push(await shrink(f));
    setPhotos([...photos, ...out]);
  };
  const locate = () => navigator.geolocation?.getCurrentPosition(
    (p) => setGps({ lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy }),
    () => toast('No se pudo obtener la ubicación.'), { enableHighAccuracy: true, timeout: 10000 });

  const submit = async () => {
    setSaving(true);
    onDone(await registerInspection({ permit, checks, notes, photos, gps, outcome, startedAt }));
  };

  return (
    <div className="page">
      <div className="row between"><h1>Inspección · N.º {permit.numeroArriendo}</h1><button className="btn btn--ghost" onClick={onCancel}>Cancelar</button></div>
      <Card className={`permitcard permitcard--${st}`}>
        <div className="row between"><div><strong>{permit.nombres}</strong><div className="muted">{settings.showFullRut ? fullRut(permit.rut) : maskRut(permit.rut)} · {permit.direccion}</div></div><StatusBadge status={st} /></div>
        <div className="row"><span>Metraje: <b>{permit.metraje || '—'}</b></span><span>Sector: <b>{permit.descripcion}</b></span>{permit.deuda > 0 && <span className="bad">Deuda: <b>{clp(permit.deuda)}</b></span>}{reincident && <span className="pill pill--warn">Reincidente (multa en los últimos 12 meses)</span>}</div>
      </Card>

      <p className="muted">Todo parte como «Cumple»: marca solo lo que <b>no cumple</b>. Las reglas son de referencia y se ajustan en <code>src/data/rules.ts</code> según la normativa vigente.</p>

      {(Object.keys(GROUPS) as RuleGroup[]).map((g) => (
        <Card key={g} title={GROUPS[g]}>
          <ul className="checks">
            {RULES.filter((r) => r.group === g).map((r) => (
              <li key={r.id} className={checks[r.id] === 'fail' ? 'is-fail' : ''}>
                <div><strong>{r.label}</strong><small>{r.help}{r.auto ? ' · automático' : ''}</small></div>
                <div className="seg seg--tri" role="group" aria-label={r.label}>
                  {(['ok', 'fail', 'na'] as const).map((v) => (
                    <button key={v} disabled={!!r.auto} className={`${checks[r.id] === v ? 'on' : ''} ${v}`} onClick={() => setChecks({ ...checks, [r.id]: v })}>{v === 'ok' ? 'Cumple' : v === 'fail' ? 'No cumple' : 'N/A'}</button>))}
                </div>
              </li>))}
          </ul>
        </Card>))}

      <Card title="Evidencia y observaciones">
        <div className="row">
          <label className="btn btn--ghost">📷 Agregar foto<input type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => void addPhotos(e.target.files)} /></label>
          <button className="btn btn--ghost" onClick={locate}>📍 {gps ? `Ubicación (±${Math.round(gps.accuracy ?? 0)} m)` : 'Registrar ubicación GPS'}</button>
        </div>
        {photos.length > 0 && <div className="thumbs">{photos.map((p, i) => <button key={i} onClick={() => setPhotos(photos.filter((_, j) => j !== i))} title="Quitar foto"><img src={p} alt={`Evidencia ${i + 1}`} /></button>)}</div>}
        <textarea rows={3} placeholder="Observaciones (qué se vio, qué se le explicó al comerciante…)" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Card>

      <Card title="Resultado" className="resultcard">
        {ev.failed.length ? (<ul className="plain">{ev.failed.map((f) => <li key={f.ruleId}>✖ {f.label} <b>{utmFmt(f.utm)} UTM</b></li>)}</ul>) : <p>✔ Sin incumplimientos.</p>}
        {ev.seizure && <p className="pill pill--warn">Sospecha de mercadería falsificada: registra evidencia y sigue el procedimiento legal (denuncia / decomiso). Este sistema solo deja constancia.</p>}
        <p className="total">Multa sugerida: <b>{utmFmt(ev.totalUtm)} UTM</b> ≈ <b>{clp(ev.totalUtm * settings.utmValue)}</b> <small className="muted">(UTM {clp(settings.utmValue)}{reincident ? ' · reincidencia x2' : ''}; tope {utmFmt(reincident ? settings.fineCapReincidentUtm : settings.fineCapUtm)} UTM)</small></p>
        <div className="seg seg--out" role="radiogroup" aria-label="Resultado de la inspección">
          {(['aprobada', 'observaciones', 'multa'] as const).map((o) => (<button key={o} role="radio" aria-checked={outcome === o} disabled={o === 'multa' && ev.failed.length === 0} className={`${outcome === o ? 'on' : ''} ${o}`} onClick={() => setManual(o)}>{OUTCOME_LABEL[o]}</button>))}
        </div>
        {outcome === 'aprobada' && ev.failed.length > 0 && <p className="muted">Hay incumplimientos marcados: considera «Aprobada con observaciones» o «Multa».</p>}
        <button className="btn btn--big" disabled={saving} onClick={() => void submit()}>Registrar inspección y emitir QR</button>
      </Card>
    </div>
  );
}

function Done({ inspection, fine, onNew }: { inspection: Inspection; fine?: Fine; onNew: () => void }) {
  const settings = useStore((s) => s.settings);
  const [view, setView] = useState<'fine' | 'slip'>(fine ? 'fine' : 'slip');
  const [msg, setMsg] = useState('');
  const url = verifyUrl(inspection, fine, config.backend === 'memory');
  const lines = view === 'fine' && fine ? fineDoc(fine, settings, url) : slipDoc(inspection, settings, url);
  const print = async () => { const r = await printDoc(lines, settings); setMsg(r.ok ? `Enviado: ${r.via}.` : `No se pudo imprimir: ${r.error}`); };
  return (
    <div className="page done">
      <div className={`banner banner--${inspection.outcome}`}><h1>{OUTCOME_LABEL[inspection.outcome]}</h1><p>N.º {inspection.permitNumber} · {inspection.permitName}{fine && <> · Folio <b>{fine.folio}</b> · {clp(fine.totalClp)}</>}</p></div>
      <div className="grid g2">
        <Card title="QR para el comerciante"><div className="center"><QrCode data={url} size={240} label="QR del resultado de la inspección" /><p>Código <b className="mono">{inspection.code}</b></p><p className="muted">El comerciante lo escanea con su teléfono para ver si pasó la inspección{fine ? ' y los datos de su multa' : ''}.</p>{config.backend === 'memory' && <p className="pill pill--warn">Modo memoria: el resultado va dentro del QR y no es a prueba de falsificación. Con Supabase/PostgreSQL el QR solo lleva el código y se valida en el servidor.</p>}</div></Card>
        <Card title="Imprimir" actions={fine && <div className="seg"><button className={view === 'fine' ? 'on' : ''} onClick={() => setView('fine')}>Boleta de multa</button><button className={view === 'slip' ? 'on' : ''} onClick={() => setView('slip')}>Comprobante</button></div>}>
          <TicketView lines={lines} width={settings.printer.width} />
          <div className="row noprint"><button className="btn" onClick={() => void print()}>🖨 Imprimir ({settings.printer.driver})</button><a className="btn btn--ghost" href="#/ajustes">Configurar impresora</a></div>
          {msg && <p role="status" className="muted noprint">{msg}</p>}
        </Card>
      </div>
      <div className="row noprint"><button className="btn btn--big" onClick={onNew}>Nueva inspección</button><a className="btn btn--ghost" href="#/multas">Ver multas</a></div>
    </div>
  );
}

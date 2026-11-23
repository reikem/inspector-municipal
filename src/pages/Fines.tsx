import { useState } from 'react';
import DataTable, { type Column } from '../components/DataTable';
import { Card, Modal } from '../components/ui';
import TicketView from '../components/TicketView';
import { toast, updateFine, useStore } from '../store';
import { clp, dateTime, maskRut, utmFmt } from '../services/stats';
import { verifyUrl } from '../services/verify';
import { printDoc } from '../services/printing/printers';
import { fineDoc } from '../services/printing/ticket';
import { config } from '../config';
import type { Fine } from '../types';

export default function Fines() {
  const fines = useStore((s) => s.fines);
  const inspections = useStore((s) => s.inspections);
  const settings = useStore((s) => s.settings);
  const [sel, setSel] = useState<Fine | null>(null);
  const [msg, setMsg] = useState('');
  const total = fines.filter((f) => f.status !== 'anulada').reduce((a, f) => a + f.totalClp, 0);
  const columns: Column<Fine>[] = [
    { key: 'folio', header: 'Folio', value: (f) => f.folio, sortable: true, render: (f) => <button className="link" onClick={() => setSel(f)}>{f.folio}</button> },
    { key: 'fecha', header: 'Fecha', value: (f) => f.issuedAt, sortable: true, render: (f) => dateTime(f.issuedAt) },
    { key: 'n', header: 'N.º', value: (f) => f.permitNumber, sortable: true },
    { key: 'titular', header: 'Titular', value: (f) => f.permitName, sortable: true, render: (f) => <>{f.permitName}<small className="muted"> {maskRut(f.permitRut)}</small></> },
    { key: 'infr', header: 'Infracciones', value: (f) => f.items.map((i) => i.label).join(' | ') , render: (f) => <small>{f.items.length}</small> },
    { key: 'utm', header: 'UTM', value: (f) => f.totalUtm, num: true, sortable: true, render: (f) => utmFmt(f.totalUtm) },
    { key: 'monto', header: 'Monto', value: (f) => f.totalClp, num: true, sortable: true, render: (f) => clp(f.totalClp) },
    { key: 'estado', header: 'Estado', value: (f) => f.status, sortable: true, render: (f) => <span className={`badge badge--f-${f.status}`}>{f.status}</span> },
  ];

  const lines = sel ? fineDoc(sel, settings, verifyUrl(inspections.find((i) => i.id === sel.inspectionId) ?? ({ code: sel.inspectionCode, permitNumber: sel.permitNumber, outcome: 'multa', finishedAt: sel.issuedAt, inspectorId: sel.inspectorId } as never), sel, config.backend === 'memory')) : [];

  return (
    <div className="page">
      <h1>Multas</h1>
      <Card>
        <p className="muted">{fines.length} multas · {clp(total)} (sin anuladas)</p>
        <DataTable rows={fines} columns={columns} rowKey={(f) => f.id} caption="Multas cursadas" exportName="multas" defaultSort={{ key: 'fecha', dir: 'desc' }} empty="Aún no hay multas."
          search={{ placeholder: 'Buscar por folio, N.º, nombre o infracción', text: (f) => `${f.folio} ${f.permitNumber} ${f.permitName} ${f.items.map((i) => i.label).join(' ')}` }}
          filters={[
            { type: 'select', key: 'estado', label: 'Estado', options: [{ value: 'emitida', label: 'Emitidas' }, { value: 'pagada', label: 'Pagadas' }, { value: 'anulada', label: 'Anuladas' }], test: (f, v) => f.status === v },
            { type: 'select', key: 'reinc', label: 'Reincidencia', options: [{ value: 'si', label: 'Reincidentes' }, { value: 'no', label: 'Primera vez' }], test: (f, v) => (v === 'si') === f.reincident },
            { type: 'range', key: 'monto', label: 'Monto ($)', value: (f) => f.totalClp, step: 1000 },
          ]} />
      </Card>
      {sel && (
        <Modal title={`Boleta ${sel.folio}`} onClose={() => { setSel(null); setMsg(''); }} wide>
          <TicketView lines={lines} width={settings.printer.width} />
          <div className="row noprint">
            <button className="btn" onClick={async () => { const r = await printDoc(lines, settings); setMsg(r.ok ? `Enviado: ${r.via}.` : `No se pudo imprimir: ${r.error}`); }}>🖨 Imprimir / reimprimir</button>
            {sel.status === 'emitida' && <button className="btn btn--ghost" onClick={async () => { const n = { ...sel, status: 'pagada' as const }; await updateFine(n); setSel(n); toast('Marcada como pagada.'); }}>Marcar pagada</button>}
            {sel.status !== 'anulada' && <button className="btn btn--bad" onClick={async () => { if (!confirm('¿Anular esta multa? Queda registrada como anulada.')) return; const n = { ...sel, status: 'anulada' as const }; await updateFine(n); setSel(n); }}>Anular</button>}
          </div>
          {msg && <p role="status" className="muted noprint">{msg}</p>}
        </Modal>)}
    </div>
  );
}

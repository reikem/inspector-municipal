import { useStore } from '../store';
import { STATUS_LABEL, statusOf } from '../services/permitsApi';
import { clp, dateTime, fullRut, maskRut } from '../services/stats';
import { OUTCOME_LABEL } from '../services/verify';
import type { Permit } from '../types';
import { Modal, StatusBadge, go } from './ui';

export default function PermitDetail({ permit, onClose }: { permit: Permit; onClose: () => void }) {
  const full = useStore((s) => s.settings.showFullRut);
  const inspections = useStore((s) => s.inspections).filter((i) => i.permitNumber === permit.numeroArriendo).slice(0, 5);
  const st = statusOf(permit);
  const rows: [string, string][] = [
    ['Titular', permit.nombres], ['RUT', full ? fullRut(permit.rut) : maskRut(permit.rut)], ['Dirección', permit.direccion], ['Sector', permit.descripcion],
    ['Metraje', permit.metraje || '—'], ['Estado en el sistema', permit.estado], ['Deuda', permit.deuda ? clp(permit.deuda) : 'Sin deuda'], ['Calle', permit.calle],
    ['Origen del dato', permit.source === 'demo' ? 'Demostración (ficticio)' : `API municipal · ${dateTime(permit.fetchedAt)}`],
  ];
  return (
    <Modal title={`Permiso N.º ${permit.numeroArriendo}`} onClose={onClose}>
      <p><StatusBadge status={st} /> <span className="muted">{STATUS_LABEL[st]}</span></p>
      <dl className="dl">{rows.map(([k, v]) => (<div key={k}><dt>{k}</dt><dd>{v}</dd></div>))}</dl>
      {inspections.length > 0 && (<><h3>Últimas inspecciones</h3><ul className="plain">{inspections.map((i) => (<li key={i.id}>{dateTime(i.finishedAt)} · {OUTCOME_LABEL[i.outcome]}</li>))}</ul></>)}
      <div className="row">
        <button className="btn" onClick={() => { onClose(); go(`/inspeccion?n=${permit.numeroArriendo}`); }}>Inspeccionar</button>
        {permit.lat != null && <button className="btn btn--ghost" onClick={() => { onClose(); go(`/mapa?n=${permit.numeroArriendo}`); }}>Ver en el mapa</button>}
      </div>
    </Modal>
  );
}

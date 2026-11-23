import { useEffect, useState } from 'react';
import { findRepoInspection } from '../store';
import { OUTCOME_LABEL, readPayload } from '../services/verify';
import { clp, dateTime } from '../services/stats';
import type { Fine, Inspection, Outcome } from '../types';

interface View { outcome: Outcome; permitNumber: number; date: string; inspectorId: string; folio?: string; amount?: number; fineStatus?: string; source: 'local' | 'qr' }

/** Página pública que ve el comerciante al escanear el QR. No muestra RUT, dirección ni fotos. */
export default function PublicVerify({ code }: { code: string }) {
  const [v, setV] = useState<View | null | undefined>(undefined);
  useEffect(() => {
    (async () => {
      const hit = (await findRepoInspection(code)) as { inspection: Inspection; fine?: Fine } | undefined;
      if (hit) { setV({ outcome: hit.inspection.outcome, permitNumber: hit.inspection.permitNumber, date: hit.inspection.finishedAt, inspectorId: hit.inspection.inspectorId, folio: hit.fine?.folio, amount: hit.fine?.totalClp, fineStatus: hit.fine?.status, source: 'local' }); return; }
      const p = readPayload(location.hash);
      if (p && p.c === code) setV({ outcome: p.r, permitNumber: p.n, date: p.d, inspectorId: p.i, folio: p.f, amount: p.m, source: 'qr' });
      else setV(null);
    })();
  }, [code]);

  return (
    <main className="public">
      <div className="public__card">
        <p className="muted">Inspección municipal · Comercio en BNUP</p>
        {v === undefined && <p>Verificando…</p>}
        {v === null && (<><h1 className="bad">No se encontró la inspección</h1><p>El código <b className="mono">{code}</b> no existe o el QR está incompleto. Pide al inspector que lo emita nuevamente.</p></>)}
        {v && (
          <>
            <div className={`banner banner--${v.outcome}`}><h1>{OUTCOME_LABEL[v.outcome]}</h1></div>
            <dl className="dl">
              <div><dt>Permiso N.º</dt><dd>{v.permitNumber}</dd></div>
              <div><dt>Fecha</dt><dd>{dateTime(v.date)}</dd></div>
              <div><dt>Inspector</dt><dd>{v.inspectorId}</dd></div>
              {v.folio && <div><dt>Multa folio</dt><dd>{v.folio}</dd></div>}
              {v.amount != null && <div><dt>Monto</dt><dd>{clp(v.amount)}</dd></div>}
              {v.fineStatus && <div><dt>Estado de la multa</dt><dd>{v.fineStatus}</dd></div>}
            </dl>
            {v.outcome === 'multa' && <p>Para pagar o reclamar, sigue las instrucciones de tu boleta.</p>}
            {v.source === 'qr' && <p className="pill pill--warn">Estos datos vienen dentro del QR y no fueron validados en un servidor. Confirma con el inspector o con el municipio.</p>}
          </>)}
      </div>
    </main>
  );
}

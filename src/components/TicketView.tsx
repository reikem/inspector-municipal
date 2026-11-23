import type { TLine } from '../services/printing/ticket';
import QrCode from './QrCode';

/** Vista previa de la boleta/comprobante. Es también el área que se imprime con el diálogo del navegador. */
export default function TicketView({ lines, width }: { lines: TLine[]; width: 58 | 80 }) {
  return (
    <div className={`ticket ticket--${width} print-area`}>
      {lines.map((l, i) => {
        if (l.k === 'hr') return <hr key={i} />;
        if (l.k === 'blank') return <div key={i} className="t-blank" />;
        if (l.k === 'qr') return <div key={i} className="t-qr"><QrCode data={l.data} size={width === 80 ? 150 : 120} label="QR de verificación" /></div>;
        if (l.k === 'pair') return <div key={i} className={`t-pair ${l.bold ? 'b' : ''}`}><span>{l.l}</span><span>{l.r}</span></div>;
        return <div key={i} className={`t-text ${l.bold ? 'b' : ''} ${l.big ? 'big' : ''}`} style={{ textAlign: l.align ?? 'left' }}>{l.t}</div>;
      })}
    </div>
  );
}

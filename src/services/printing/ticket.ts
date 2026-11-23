import type { Fine, Inspection, Settings } from '../../types';
import { clp, dateTime, fullRut, utmFmt } from '../stats';
import { OUTCOME_LABEL } from '../verify';
import { EscPos } from './escpos';

/** Documento de impresión neutro: se dibuja igual en HTML (vista previa / imprimir) y en ESC/POS. */
export type TLine =
  | { k: 'text'; t: string; align?: 'left' | 'center' | 'right'; bold?: boolean; big?: boolean }
  | { k: 'pair'; l: string; r: string; bold?: boolean }
  | { k: 'hr' }
  | { k: 'blank' }
  | { k: 'qr'; data: string };

export const colsOf = (width: 58 | 80): number => (width === 80 ? 48 : 32);

function head(s: Settings): TLine[] {
  return [
    { k: 'text', t: s.municipality.toUpperCase(), align: 'center', bold: true },
    { k: 'text', t: s.department, align: 'center' },
    { k: 'hr' },
  ];
}

/** BOLETA DE MULTA. */
export function fineDoc(f: Fine, s: Settings, url: string): TLine[] {
  const lines: TLine[] = [
    ...head(s),
    { k: 'text', t: 'BOLETA DE MULTA', align: 'center', bold: true, big: true },
    { k: 'pair', l: 'Folio', r: f.folio, bold: true },
    { k: 'pair', l: 'Fecha', r: dateTime(f.issuedAt) },
    ...(f.demo ? [{ k: 'text', t: '*** DOCUMENTO DE PRUEBA ***', align: 'center', bold: true } as TLine] : []),
    { k: 'hr' },
    { k: 'text', t: 'COMERCIANTE', bold: true },
    { k: 'text', t: f.permitName },
    { k: 'pair', l: 'RUT', r: fullRut(f.permitRut) },
    { k: 'pair', l: 'N° arriendo', r: String(f.permitNumber) },
    { k: 'text', t: f.direccion },
    { k: 'hr' },
    { k: 'pair', l: 'INFRACCIONES', r: 'UTM', bold: true },
    ...f.items.map((i): TLine => ({ k: 'pair', l: `- ${i.label}`, r: utmFmt(i.utm) })),
    { k: 'hr' },
    { k: 'pair', l: 'Total', r: `${utmFmt(f.totalUtm)} UTM` },
    { k: 'pair', l: 'Valor UTM', r: clp(f.utmValue) },
    { k: 'pair', l: 'MONTO A PAGAR', r: clp(f.totalClp), bold: true },
    ...(f.reincident ? [{ k: 'text', t: 'Reincidencia: SI', bold: true } as TLine] : []),
    ...(f.seizure ? [{ k: 'text', t: 'Se registra sospecha de especies falsificadas o de origen ilícito. Se informa el procedimiento legal de decomiso.', bold: true } as TLine] : []),
    ...(f.notes ? [{ k: 'text', t: `Obs.: ${f.notes}` } as TLine] : []),
    { k: 'hr' },
    { k: 'text', t: `Inspector: ${f.inspectorName} (${f.inspectorId})` },
    { k: 'blank' },
    { k: 'text', t: 'Escanee para ver el estado de esta inspección:', align: 'center' },
    { k: 'qr', data: url },
    { k: 'text', t: `Código ${f.inspectionCode}`, align: 'center', bold: true },
    { k: 'hr' },
    { k: 'text', t: s.legalFooter },
    { k: 'blank' },
    { k: 'text', t: 'Firma del comerciante: ______________' },
  ];
  return lines;
}

/** COMPROBANTE de inspección (aprobada o con observaciones). */
export function slipDoc(i: Inspection, s: Settings, url: string): TLine[] {
  const fails = Object.entries(i.checks).filter(([, v]) => v === 'fail').length;
  return [
    ...head(s),
    { k: 'text', t: 'COMPROBANTE DE INSPECCIÓN', align: 'center', bold: true },
    { k: 'text', t: OUTCOME_LABEL[i.outcome].toUpperCase(), align: 'center', bold: true, big: true },
    { k: 'pair', l: 'Fecha', r: dateTime(i.finishedAt) },
    { k: 'pair', l: 'N° arriendo', r: String(i.permitNumber) },
    { k: 'text', t: i.permitName },
    { k: 'text', t: i.direccion },
    ...(fails ? [{ k: 'text', t: `Observaciones registradas: ${fails}` } as TLine] : []),
    { k: 'text', t: `Inspector: ${i.inspectorName} (${i.inspectorId})` },
    { k: 'blank' },
    { k: 'text', t: 'Escanee para verificar:', align: 'center' },
    { k: 'qr', data: url },
    { k: 'text', t: `Código ${i.code}`, align: 'center', bold: true },
  ];
}

export function testDoc(s: Settings): TLine[] {
  return [...head(s), { k: 'text', t: 'PRUEBA DE IMPRESIÓN', align: 'center', bold: true, big: true }, { k: 'text', t: 'Ñandú, camión, niño: áéíóú ¿¡°!?' }, { k: 'pair', l: 'Ancho', r: `${s.printer.width} mm` }, { k: 'qr', data: 'https://example.org/prueba' }, { k: 'text', t: 'Si ves bien los acentos y el QR, la impresora está lista.', align: 'center' }];
}

// ---------- Utilidades de texto para ESC/POS ----------
function wrap(text: string, width: number): string[] {
  const out: string[] = [];
  text.split('\n').forEach((para) => {
    let line = '';
    para.split(/\s+/).forEach((w) => {
      while (w.length > width) { if (line) { out.push(line); line = ''; } out.push(w.slice(0, width)); w = w.slice(width); }
      if (!line) line = w; else if (line.length + 1 + w.length <= width) line += ' ' + w; else { out.push(line); line = w; }
    });
    out.push(line);
  });
  return out;
}

/** Convierte el documento a bytes ESC/POS listos para enviar a la impresora. */
export function toEscPos(lines: TLine[], s: Settings): Uint8Array {
  const cols = colsOf(s.printer.width);
  const p = new EscPos(cols, s.printer.codePage);
  for (const l of lines) {
    if (l.k === 'hr') p.align('left').line('-'.repeat(cols));
    else if (l.k === 'blank') p.feed(1);
    else if (l.k === 'qr') p.align('center').qr(l.data, s.printer.width === 80 ? 7 : 6).feed(1);
    else if (l.k === 'text') {
      const w = l.big ? Math.floor(cols / 2) : cols;
      p.align(l.align ?? 'left').bold(!!l.bold).size(l.big ? 2 : 1);
      wrap(l.t, w).forEach((x) => p.line(x));
      p.bold(false).size(1);
    } else {
      // par izquierda/derecha: si no cabe, la derecha baja a otra línea alineada a la derecha
      p.align('left').bold(!!l.bold);
      const left = wrap(l.l, Math.max(8, cols - l.r.length - 1));
      left.forEach((x, idx) => {
        if (idx === left.length - 1 && x.length + 1 + l.r.length <= cols) p.line(x + ' '.repeat(cols - x.length - l.r.length) + l.r);
        else p.line(x);
      });
      if (!(left[left.length - 1].length + 1 + l.r.length <= cols)) p.align('right').line(l.r).align('left');
      p.bold(false);
    }
  }
  return p.align('left').cut().build();
}

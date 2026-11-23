import type { Settings } from '../../types';

const ESC = 0x1b, GS = 0x1d;
type CodePage = Settings['printer']['codePage'];

const CP858: Record<string, number> = {
  á: 0xa0, é: 0x82, í: 0xa1, ó: 0xa2, ú: 0xa3, ñ: 0xa4, Ñ: 0xa5, ü: 0x81, Ü: 0x9a, Á: 0xb5, É: 0x90, Í: 0xd6, Ó: 0xe0, Ú: 0xe9,
  '¿': 0xa8, '¡': 0xad, '°': 0xf8, º: 0xa7, ª: 0xa6, '×': 0x9e, '€': 0xd5, '·': 0xfa,
};

/** Convierte un carácter al byte de la tabla de caracteres elegida (WPC1252 ≈ Latin-1, o CP858). */
export function encodeChar(ch: string, cp: CodePage): number {
  const code = ch.codePointAt(0) ?? 63;
  if (code < 128) return code;
  if (cp === 'cp858') return CP858[ch] ?? 63;
  if (code <= 0xff) return code;
  if (ch === '€') return 0x80;
  if (ch === '–' || ch === '—') return 0x2d;
  if (ch === '“' || ch === '”') return 0x22;
  if (ch === '‘' || ch === '’') return 0x27;
  return 63;
}

/** Constructor de comandos ESC/POS (impresoras térmicas de 58 mm y 80 mm). */
export class EscPos {
  private bytes: number[] = [];
  constructor(public readonly cols: number, private cp: CodePage) {
    this.raw(ESC, 0x40);                              // inicializa
    this.raw(ESC, 0x74, cp === 'cp858' ? 19 : 16);    // tabla de caracteres
  }
  raw(...b: number[]): this { this.bytes.push(...b); return this; }
  align(a: 'left' | 'center' | 'right'): this { return this.raw(ESC, 0x61, a === 'left' ? 0 : a === 'center' ? 1 : 2); }
  bold(on: boolean): this { return this.raw(ESC, 0x45, on ? 1 : 0); }
  size(n: 1 | 2): this { return this.raw(GS, 0x21, n === 2 ? 0x11 : 0x00); }
  text(s: string): this { for (const ch of s) this.bytes.push(encodeChar(ch, this.cp)); return this; }
  line(s = ''): this { return this.text(s).raw(0x0a); }
  feed(n = 1): this { return this.raw(ESC, 0x64, n); }
  cut(): this { return this.feed(4).raw(GS, 0x56, 0x42, 0x00); }
  /** QR con el comando nativo de la impresora (no necesita imagen). */
  qr(data: string, moduleSize = 6): this {
    const d = new TextEncoder().encode(data);
    const len = d.length + 3;
    this.raw(GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00);          // modelo 2
    this.raw(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, moduleSize);           // tamaño del módulo
    this.raw(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31);                 // corrección de errores M
    this.raw(GS, 0x28, 0x6b, len & 0xff, (len >> 8) & 0xff, 0x31, 0x50, 0x30, ...d);
    return this.raw(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30);          // imprimir
  }
  build(): Uint8Array { return new Uint8Array(this.bytes); }
}

export const toBase64 = (b: Uint8Array): string => { let s = ''; b.forEach((x) => { s += String.fromCharCode(x); }); return btoa(s); };

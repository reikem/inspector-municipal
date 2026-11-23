import type { Settings } from '../../types';
import { toBase64 } from './escpos';
import { toEscPos, type TLine } from './ticket';

export type PrintResult = { ok: true; via: string } | { ok: false; error: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ───────── Bluetooth Low Energy (Web Bluetooth) ─────────
// Funciona en Chrome/Edge (Android y escritorio, HTTPS) con impresoras térmicas BLE. Las impresoras Bluetooth
// «clásicas» (SPP) no son compatibles con Web Bluetooth: para esas usa RawBT o el puente nativo.
const BLE_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', '0000ff00-0000-1000-8000-00805f9b34fb', '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', '0000ae30-0000-1000-8000-00805f9b34fb', '0000fee7-0000-1000-8000-00805f9b34fb',
];
let bleChar: BluetoothRemoteGATTCharacteristic | null = null;
let bleName = '';

export async function connectBluetooth(): Promise<string> {
  if (!navigator.bluetooth) throw new Error('Este navegador no soporta Web Bluetooth (usa Chrome en Android o escritorio, con HTTPS).');
  const dev = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: BLE_SERVICES });
  const server = await dev.gatt!.connect();
  for (const uuid of BLE_SERVICES) {
    try {
      const svc = await server.getPrimaryService(uuid);
      const chars = await svc.getCharacteristics();
      const w = chars.find((c) => c.properties.writeWithoutResponse || c.properties.write);
      if (w) {
        bleChar = w; bleName = dev.name ?? 'Impresora BLE';
        dev.addEventListener('gattserverdisconnected', () => { bleChar = null; });
        return bleName;
      }
    } catch { /* prueba el siguiente servicio */ }
  }
  throw new Error('No encontré un canal de escritura. Prueba con RawBT o el puente nativo.');
}

type Bytes = Uint8Array<ArrayBuffer>;
async function writeChunks(write: (c: Bytes) => Promise<void>, bytes: Uint8Array, size: number) {
  for (let i = 0; i < bytes.length; i += size) { await write(new Uint8Array(bytes.slice(i, i + size))); await sleep(25); }
}

async function viaBluetooth(bytes: Uint8Array) {
  if (!bleChar) await connectBluetooth();
  const c = bleChar!;
  await writeChunks(async (chunk) => { if (c.properties.writeWithoutResponse) await c.writeValueWithoutResponse(chunk); else await c.writeValue(chunk); }, bytes, 100);
}

// ───────── USB (WebUSB): PDA o POS Android con impresora por USB ─────────
let usbDev: USBDevice | null = null;
let usbOut = 0;

export async function connectUsb(): Promise<string> {
  if (!navigator.usb) throw new Error('Este navegador no soporta WebUSB.');
  const dev = await navigator.usb.requestDevice({ filters: [] });
  await dev.open();
  if (!dev.configuration) await dev.selectConfiguration(1);
  for (const itf of dev.configuration!.interfaces) {
    const alt = itf.alternates.find((a) => a.endpoints.some((e) => e.direction === 'out' && e.type === 'bulk'));
    if (alt) {
      await dev.claimInterface(itf.interfaceNumber);
      usbOut = alt.endpoints.find((e) => e.direction === 'out' && e.type === 'bulk')!.endpointNumber;
      usbDev = dev;
      return dev.productName ?? 'Impresora USB';
    }
  }
  throw new Error('No encontré un endpoint de salida en el dispositivo USB.');
}

async function viaUsb(bytes: Uint8Array) {
  if (!usbDev) await connectUsb();
  await writeChunks(async (c) => { await usbDev!.transferOut(usbOut, c); }, bytes, 512);
}

// ───────── RawBT (app Android): imprime ESC/POS desde el navegador por Bluetooth clásico, USB o red ─────────
function viaRawBT(bytes: Uint8Array) { window.location.href = `rawbt:base64,${toBase64(bytes)}`; }

// ───────── Puente nativo: app Android (WebView) que expone la impresora integrada del POS ─────────
// Implementa en tu app una interfaz JS  `AndroidPrinter.printRaw(base64)`  que envíe los bytes al SDK del fabricante
// (Sunmi, PAX, Urovo, iMin, Zebra, etc.).
interface Bridge { printRaw(b64: string): void }
function viaBridge(bytes: Uint8Array) {
  const b = (window as unknown as { AndroidPrinter?: Bridge }).AndroidPrinter;
  if (!b) throw new Error('No hay puente nativo (AndroidPrinter). Abre la página desde la app del POS.');
  b.printRaw(toBase64(bytes));
}

export const printerStatus = () => ({ ble: bleChar ? bleName : '', usb: usbDev ? usbDev.productName ?? 'USB' : '' });

/** Imprime con el método elegido en Ajustes. «browser» abre el diálogo del sistema (la vista previa debe estar en pantalla). */
export async function printDoc(lines: TLine[], s: Settings): Promise<PrintResult> {
  try {
    const d = s.printer.driver;
    if (d === 'browser') { window.print(); return { ok: true, via: 'diálogo de impresión' }; }
    const bytes = toEscPos(lines, s);
    for (let n = 0; n < Math.max(1, s.printer.copies); n++) {
      if (d === 'bluetooth') await viaBluetooth(bytes);
      else if (d === 'usb') await viaUsb(bytes);
      else if (d === 'rawbt') viaRawBT(bytes);
      else viaBridge(bytes);
      if (n > 0) await sleep(400);
    }
    return { ok: true, via: d };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

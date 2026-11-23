import { useState } from 'react';
import { Card } from '../components/ui';
import TicketView from '../components/TicketView';
import { exportJson, importJson, resetDemo, saveSettings, toast, useStore } from '../store';
import { fetchUtm } from '../services/utm';
import { connectBluetooth, connectUsb, printDoc, printerStatus } from '../services/printing/printers';
import { testDoc } from '../services/printing/ticket';
import { config } from '../config';
import type { PrinterDriver, Settings as S } from '../types';

const DRIVERS: [PrinterDriver, string, string][] = [
  ['browser', 'Navegador (diálogo del sistema)', 'Cualquier impresora que Android/PC vea. Usa el ancho 58/80 mm del papel.'],
  ['bluetooth', 'Bluetooth BLE (Web Bluetooth)', 'Impresoras térmicas BLE desde Chrome (HTTPS). No sirve para Bluetooth clásico/SPP.'],
  ['usb', 'USB (WebUSB)', 'PDA o POS con impresora/USB. Requiere Chrome y permiso del dispositivo.'],
  ['rawbt', 'RawBT (app Android)', 'Instala RawBT: imprime ESC/POS por Bluetooth clásico, USB o red desde el navegador.'],
  ['bridge', 'Puente nativo (POS con impresora integrada)', 'Para POS Android (Sunmi, PAX, Urovo…): tu app expone AndroidPrinter.printRaw(base64).'],
];

export default function Settings() {
  const saved = useStore((s) => s.settings);
  const backend = useStore((s) => s.backend);
  const [f, setF] = useState<S>(saved);
  const [msg, setMsg] = useState('');
  const set = <K extends keyof S>(k: K, v: S[K]) => setF({ ...f, [k]: v });
  const num = (v: string) => Number(v.replace(',', '.')) || 0;
  const st = printerStatus();

  const save = async () => { await saveSettings(f); toast('Ajustes guardados.'); };
  const test = async () => { await saveSettings(f); const r = await printDoc(testDoc(f), f); setMsg(r.ok ? `Enviado: ${r.via}` : `Error: ${r.error}`); };
  const download = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([exportJson()], { type: 'application/json' })); a.download = `inspeccion-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(a.href); };

  return (
    <div className="page">
      <div className="row between"><h1>Ajustes</h1><button className="btn" onClick={() => void save()}>Guardar ajustes</button></div>
      <div className="grid g2">
        <Card title="Inspector y municipalidad">
          <div className="form">
            <label>Nombre del inspector<input value={f.inspectorName} onChange={(e) => set('inspectorName', e.target.value)} /></label>
            <label>N.º / credencial del inspector<input value={f.inspectorId} onChange={(e) => set('inspectorId', e.target.value)} /></label>
            <label>Municipalidad<input value={f.municipality} onChange={(e) => set('municipality', e.target.value)} /></label>
            <label>Unidad o departamento<input value={f.department} onChange={(e) => set('department', e.target.value)} /></label>
            <label className="check"><input type="checkbox" checked={f.showFullRut} onChange={(e) => set('showFullRut', e.target.checked)} />Mostrar RUT completo en pantalla (la boleta siempre lo incluye)</label>
          </div>
        </Card>
        <Card title="Multas">
          <div className="form">
            <label>Valor de la UTM ($)<div className="row"><input type="number" value={f.utmValue} onChange={(e) => set('utmValue', num(e.target.value))} /><button className="btn btn--ghost btn--small" onClick={async () => { try { const u = await fetchUtm(); setF({ ...f, utmValue: u.value, utmDate: u.date }); toast(`UTM ${u.value} (${u.date})`); } catch { toast('No se pudo consultar mindicador.cl'); } }}>Actualizar</button></div><small className="muted">{f.utmDate ? `Último valor: ${f.utmDate}` : 'Valor manual'}</small></label>
            <label>Tope de multa (UTM)<input type="number" step="0.25" value={f.fineCapUtm} onChange={(e) => set('fineCapUtm', num(e.target.value))} /></label>
            <label>Tope con reincidencia (UTM)<input type="number" step="0.25" value={f.fineCapReincidentUtm} onChange={(e) => set('fineCapReincidentUtm', num(e.target.value))} /></label>
            <label>Texto legal de la boleta<textarea rows={4} value={f.legalFooter} onChange={(e) => set('legalFooter', e.target.value)} /></label>
          </div>
          <p className="muted small">Montos y reglas de referencia (ordenanza anulada). Confírmalos con la normativa vigente y con la unidad jurídica.</p>
        </Card>
      </div>

      <Card title="Impresora de boletas (POS Android, POS móvil, PDA)">
        <div className="grid g2">
          <div className="form">
            <label>Método de impresión
              <select value={f.printer.driver} onChange={(e) => set('printer', { ...f.printer, driver: e.target.value as PrinterDriver })}>{DRIVERS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
              <small className="muted">{DRIVERS.find(([k]) => k === f.printer.driver)?.[2]}</small>
            </label>
            <div className="row">
              <label>Ancho del papel<select value={f.printer.width} onChange={(e) => set('printer', { ...f.printer, width: Number(e.target.value) as 58 | 80 })}><option value={58}>58 mm (32 columnas)</option><option value={80}>80 mm (48 columnas)</option></select></label>
              <label>Tabla de caracteres<select value={f.printer.codePage} onChange={(e) => set('printer', { ...f.printer, codePage: e.target.value as 'wpc1252' | 'cp858' })}><option value="wpc1252">WPC1252 (Epson/estándar)</option><option value="cp858">CP858 (muchas chinas)</option></select></label>
              <label>Copias<input type="number" min={1} max={3} value={f.printer.copies} onChange={(e) => set('printer', { ...f.printer, copies: num(e.target.value) || 1 })} /></label>
            </div>
            <div className="row">
              {f.printer.driver === 'bluetooth' && <button className="btn btn--ghost" onClick={async () => { try { toast(`Conectada: ${await connectBluetooth()}`); } catch (e) { setMsg(e instanceof Error ? e.message : String(e)); } }}>Emparejar impresora BLE</button>}
              {f.printer.driver === 'usb' && <button className="btn btn--ghost" onClick={async () => { try { toast(`Conectada: ${await connectUsb()}`); } catch (e) { setMsg(e instanceof Error ? e.message : String(e)); } }}>Seleccionar impresora USB</button>}
              <button className="btn" onClick={() => void test()}>Imprimir prueba</button>
            </div>
            <p className="muted small">Conexión: {st.ble ? `BLE ${st.ble}` : st.usb ? `USB ${st.usb}` : 'sin conectar'} {msg && <> · <span role="status">{msg}</span></>}</p>
            <p className="muted small">Si los acentos salen raros, cambia la tabla de caracteres. Si la impresora no tiene QR nativo, actualiza su firmware o usa el método «Navegador».</p>
          </div>
          <TicketView lines={testDoc(f)} width={f.printer.width} />
        </div>
      </Card>

      <div className="grid g2">
        <Card title="Datos y almacenamiento">
          <p>Backend activo: <b>{backend}</b> <small className="muted">(VITE_DATA_BACKEND = {config.backend})</small></p>
          <p className="muted">Hoy todo vive en la memoria del navegador (IndexedDB) de este dispositivo. Para trabajar en equipo, descomenta los conectores de <code>src/repository/</code> (Supabase o PostgreSQL) y ejecuta <code>db/schema.sql</code>.</p>
          <div className="row"><button className="btn btn--ghost" onClick={download}>Exportar respaldo (JSON)</button>
            <label className="btn btn--ghost">Importar respaldo<input hidden type="file" accept="application/json" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; try { await importJson(await file.text()); } catch (err) { toast(err instanceof Error ? err.message : 'Archivo no válido'); } e.target.value = ''; }} /></label>
            <button className="btn btn--bad" onClick={() => { if (confirm('¿Borrar todo y volver a los datos de demostración?')) void resetDemo(); }}>Restablecer demostración</button></div>
        </Card>
        <Card title="Ubicación de los permisos">
          <label className="check"><input type="checkbox" checked={f.geocodeNominatim} onChange={(e) => set('geocodeNominatim', e.target.checked)} />Geocodificar con Nominatim (OpenStreetMap)</label>
          <p className="muted small">Hoy los permisos se ubican por calle y altura (aproximado). Con Nominatim se pueden obtener coordenadas exactas (1 consulta/seg., con caché). Para producción, usa el Geoportal municipal o un geocodificador propio.</p>
        </Card>
      </div>
    </div>
  );
}

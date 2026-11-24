import { useState } from 'react';
import { Card } from '../components/ui';
import { config } from '../config';
import { fetchPermit } from '../services/permitsApi';
import { useActivePermits } from '../services/permitCache';
import { fetchUtm } from '../services/utm';
import { geocode } from '../services/nominatim';
import { getState } from '../store';

interface Src { name: string; url: string; use: string; state: string; tone: 'ok' | 'warn' | 'off'; test?: 'permits' | 'utm' | 'geo' }

export default function Sources() {
  const permits = useActivePermits();
  const realCount = permits.filter((p) => p.source === 'api').length;
  const [out, setOut] = useState<Record<string, string>>({});

  const sources: Src[] = [
    {
      name: 'Yo pago en Valpo · PorNumeroArriendo',
      url: config.permitsApi + '?id={N}',
      use: 'Permisos: titular, dirección, rubro, estado y deuda (una consulta por número vía proxy Cloudflare).',
      state: `En uso (${realCount.toLocaleString('es-CL')} registros en IndexedDB local). Se revalida automáticamente solo entre los días 2 y 5 de cada mes.`,
      tone: 'ok',
      test: 'permits',
    },
    { name: 'mindicador.cl · UTM', url: 'https://mindicador.cl/api/utm', use: 'Valor diario de la UTM para convertir multas a pesos.', state: 'En uso (API abierta y gratuita de indicadores).', tone: 'ok', test: 'utm' },
    { name: 'OpenStreetMap · teselas', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', use: 'Mapa base. Respeta su política de uso; en producción usa un proveedor de teselas con plan adecuado.', state: 'En uso.', tone: 'ok' },
    { name: 'Nominatim (OpenStreetMap)', url: 'https://nominatim.openstreetmap.org/search', use: 'Convertir direcciones en coordenadas exactas (máx. 1 consulta por segundo, con caché).', state: 'Opcional (se activa en Ajustes).', tone: 'warn', test: 'geo' },
    { name: 'Overpass API (OpenStreetMap)', url: 'https://overpass-api.de/api/interpreter', use: 'Consultar grifos, paraderos, colegios y calles cercanas para validar zonas de exclusión.', state: 'Por evaluar (no integrado).', tone: 'warn' },
    { name: 'datos.gob.cl · portal nacional de datos abiertos', url: 'https://datos.gob.cl', use: 'Buscar conjuntos de datos (comercio, patentes, cartografía). Muchos portales de este tipo exponen una API CKAN.', state: 'Por verificar si hay conjuntos útiles de Valparaíso.', tone: 'warn' },
    { name: 'Geoportal de Valparaíso (SECPLA · SIG)', url: 'Sitio web oficial de la Municipalidad', use: 'Capas de la ciudad (zonificación, equipamiento). Su creación fue aprobada por decreto publicado en el Diario Oficial el 27-jun-2025, con acceso a datos abiertos.', state: 'Por contactar: confirmar URL y servicios (WMS/WFS/API).', tone: 'warn' },
    { name: 'INE · Inventario de Registros Administrativos', url: 'https://www.ine.gob.cl/institucional/inventario-de-registros-administrativos/municipalidades/valparaiso/60636', use: 'Catálogo de registros de la municipalidad.', state: 'No es una API abierta: el acceso a los datos es por convenio de traspaso.', tone: 'off' },
  ];

  const run = async (s: Src) => {
    setOut((o) => ({ ...o, [s.name]: 'Probando…' }));
    let msg = '';
    try {
      if (s.test === 'utm') { const u = await fetchUtm(); msg = `✔ UTM ${u.value.toLocaleString('es-CL')} (${u.date})`; }
      else if (s.test === 'geo') { const g = await geocode('Pedro Montt 1942'); msg = g ? `✔ ${g.lat.toFixed(4)}, ${g.lon.toFixed(4)}` : '✖ Sin resultados'; }
      else {
        const r = await fetchPermit(getState().settings.sync.from);
        msg = r.kind === 'found'
          ? `✔ Responde y el formato es válido (${r.fromCache ? 'desde IndexedDB' : 'desde API'})`
          : r.kind === 'missing'
            ? '✔ Responde (ese N.º no existe)'
            : `✖ ${r.why}`;
      }
    } catch (e) { msg = `✖ ${e instanceof Error ? e.message : String(e)}`; }
    setOut((o) => ({ ...o, [s.name]: msg }));
  };

  return (
    <div className="page">
      <h1>Fuentes de datos y APIs abiertas</h1>
      <p className="muted">Lo marcado «Por verificar» no está confirmado: revisa disponibilidad, licencia y límites de uso antes de integrarlo.</p>
      <div className="sources">
        {sources.map((s) => (
          <Card key={s.name} className={`source source--${s.tone}`}>
            <h2>{s.name}</h2><code>{s.url}</code><p>{s.use}</p><p className="muted">{s.state}</p>
            {s.test && <div className="row"><button className="btn btn--small" onClick={() => void run(s)}>Probar desde este navegador</button><span role="status">{out[s.name]}</span></div>}
          </Card>))}
      </div>
    </div>
  );
}
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Permit } from '../types';
import type { MapPoint } from '../services/stats';
import { STATUS_LABEL } from '../services/permitsApi';
import { clp, maskRut } from '../services/stats';

export type MapMode = 'heat' | 'markers' | 'both';
const COLOR = { al_dia: '#1f9d6b', atrasado: '#e0562b', desactivado: '#7a8794' } as const;
const CENTER: [number, number] = [-33.0455, -71.6195];
type HeatCtor = new (data: Array<[number, number, number]>, opts: Record<string, unknown>) => L.Layer;

interface Props { points: MapPoint[]; mode: MapMode; height?: number | string; onSelect?: (p: Permit) => void }

/** Mapa de Valparaíso con mapa de calor (atrasos/deuda) y marcadores por estado. */
export default function HeatMap({ points, mode, height = 420, onSelect }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layers = useRef<{ heat?: L.Layer; markers?: L.LayerGroup }>({});
  const fitted = useRef(false);
  const [ready, setReady] = useState(false);
  const [heatOk, setHeatOk] = useState(true);
  const Heat = useRef<HeatCtor | null>(null);

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { center: CENTER, zoom: 15, zoomControl: true, attributionControl: true });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© colaboradores de OpenStreetMap' }).addTo(m);
    map.current = m;
    // El plugin de calor se carga bajo demanda (leaflet.heat v1 exporta la clase HeatLayer).
    import('leaflet.heat').then((m) => { Heat.current = m.HeatLayer as unknown as HeatCtor; setReady(true); }).catch(() => { setHeatOk(false); setReady(true); });
    return () => { m.remove(); map.current = null; layers.current = {}; fitted.current = false; };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    layers.current.heat?.remove(); layers.current.markers?.remove();
    if (points.length && !fitted.current) { m.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lon] as [number, number])), { padding: [30, 30], maxZoom: 16 }); fitted.current = true; }

    if ((mode === 'heat' || mode === 'both') && heatOk && Heat.current) {
      const data = points.filter((p) => p.weight > 0).map((p) => [p.lat, p.lon, p.weight] as [number, number, number]);
      layers.current.heat = new Heat.current(data, { radius: 26, blur: 22, maxZoom: 17, max: 1, minOpacity: 0.3, gradient: { 0.2: '#2c7bb6', 0.45: '#abd9e9', 0.65: '#ffffbf', 0.82: '#fdae61', 1: '#d7191c' } }).addTo(m);
    }
    if (mode === 'markers' || mode === 'both') {
      const g = L.layerGroup();
      points.forEach((p) => {
        const mk = L.circleMarker([p.lat, p.lon], { radius: 6, color: '#fff', weight: 1.5, fillColor: COLOR[p.status], fillOpacity: 0.95 });
        const box = document.createElement('div');
        const t = document.createElement('strong'); t.textContent = `N.º ${p.permit.numeroArriendo} · ${STATUS_LABEL[p.status]}`;
        const n = document.createElement('div'); n.textContent = p.permit.nombres;
        const a = document.createElement('div'); a.textContent = p.permit.direccion;
        const d = document.createElement('div'); d.textContent = `${maskRut(p.permit.rut)}${p.permit.deuda ? ` · deuda ${clp(p.permit.deuda)}` : ''}`;
        box.append(t, n, a, d);
        if (onSelect) { const b = document.createElement('button'); b.textContent = 'Ver ficha'; b.className = 'btn btn--small'; b.onclick = () => onSelect(p.permit); box.append(b); }
        mk.bindPopup(box).addTo(g);
      });
      g.addTo(m); layers.current.markers = g;
    }
  }, [points, mode, ready, heatOk, onSelect]);

  return (
    <div className="mapwrap">
      <div ref={el} className="map" style={{ height }} role="application" aria-label="Mapa de permisos de comercio en Valparaíso" />
      <div className="maplegend" aria-hidden="true">
        <span><i style={{ background: COLOR.al_dia }} />Al día</span><span><i style={{ background: COLOR.atrasado }} />Atrasado</span><span><i style={{ background: COLOR.desactivado }} />Desactivado</span>
        <span className="grad">Calor: <i /> más atrasos</span>
      </div>
    </div>
  );
}

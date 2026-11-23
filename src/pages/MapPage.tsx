import { useCallback, useMemo, useState } from 'react';
import { Card, HeatMapToolbar } from './mapParts';
import HeatMap, { type MapMode } from '../components/HeatMap';
import PermitDetail from '../components/PermitDetail';
import { useStore } from '../store';
import { statusOf } from '../services/permitsApi';
import { byStreet, mapPoints, type HeatMetric } from '../services/stats';
import type { Permit, PermitStatus } from '../types';

export default function MapPage() {
  const permits = useStore((s) => s.permits);
  const [mode, setMode] = useState<MapMode>('both');
  const [metric, setMetric] = useState<HeatMetric>('atrasos');
  const [street, setStreet] = useState('');
  const [status, setStatus] = useState<'' | PermitStatus>('');
  const [sel, setSel] = useState<Permit | null>(null);
  const onSelect = useCallback((p: Permit) => setSel(p), []);

  const filtered = useMemo(() => permits.filter((p) => (!street || p.calle === street) && (!status || statusOf(p) === status)), [permits, street, status]);
  const points = useMemo(() => mapPoints(filtered, metric), [filtered, metric]);
  const streets = useMemo(() => byStreet(permits), [permits]);
  const located = permits.filter((p) => p.lat != null).length;

  return (
    <div className="page">
      <h1>Mapa de comercio ambulante</h1>
      <div className="mapgrid">
        <Card>
          <HeatMapToolbar mode={mode} setMode={setMode} metric={metric} setMetric={setMetric} status={status} setStatus={setStatus} />
          <HeatMap points={points} mode={mode} height="calc(100vh - 290px)" onSelect={onSelect} />
          <p className="muted small">{located.toLocaleString('es-CL')} de {permits.length.toLocaleString('es-CL')} permisos ubicados. Las posiciones se estiman por calle y altura (aproximadas); conecta un geocodificador para ubicaciones exactas.</p>
        </Card>
        <Card title="Calles">
          <ul className="streetlist">
            <li><button className={!street ? 'on' : ''} onClick={() => setStreet('')}>Todas las calles</button></li>
            {streets.map((s) => (<li key={s.calle}><button className={street === s.calle ? 'on' : ''} onClick={() => setStreet(s.calle)}><span>{s.calle}</span><b>{s.atrasados}</b><small>{s.total} permisos</small></button></li>))}
          </ul>
        </Card>
      </div>
      {sel && <PermitDetail permit={sel} onClose={() => setSel(null)} />}
    </div>
  );
}

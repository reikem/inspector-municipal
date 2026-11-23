import type { MapMode } from '../components/HeatMap';
import type { HeatMetric } from '../services/stats';
import type { PermitStatus } from '../types';
export { Card } from '../components/ui';

interface P { mode: MapMode; setMode: (m: MapMode) => void; metric: HeatMetric; setMetric: (m: HeatMetric) => void; status: '' | PermitStatus; setStatus: (s: '' | PermitStatus) => void }

export function HeatMapToolbar({ mode, setMode, metric, setMetric, status, setStatus }: P) {
  return (
    <div className="toolbar">
      <div className="seg" role="group" aria-label="Capas">
        {([['both', 'Calor + puntos'], ['heat', 'Solo calor'], ['markers', 'Solo puntos']] as const).map(([k, l]) => <button key={k} className={mode === k ? 'on' : ''} onClick={() => setMode(k)}>{l}</button>)}
      </div>
      <div className="seg" role="group" aria-label="Métrica">
        <button className={metric === 'atrasos' ? 'on' : ''} onClick={() => setMetric('atrasos')}>Atrasos</button>
        <button className={metric === 'deuda' ? 'on' : ''} onClick={() => setMetric('deuda')}>Deuda</button>
      </div>
      <select value={status} onChange={(e) => setStatus(e.target.value as '' | PermitStatus)} aria-label="Filtrar estado"><option value="">Todos</option><option value="atrasado">Atrasados</option><option value="al_dia">Al día</option><option value="desactivado">Desactivados</option></select>
    </div>
  );
}

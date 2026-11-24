import { useCallback, useMemo, useState } from 'react';
import { Card, Kpi, StatusBadge, go } from '../components/ui';
import { DonutChart, HBarChart, LineChart } from '../components/charts';
import HeatMap from '../components/HeatMap';
import PermitDetail from '../components/PermitDetail';
import { useStore } from '../store';
import { useActivePermits } from '../services/permitCache';
import { statusOf } from '../services/permitsApi';
import { byStreet, clp, dailyActivity, mapPoints, summarize, type HeatMetric } from '../services/stats';
import type { Permit } from '../types';

export default function Dashboard() {
  const permits = useActivePermits();
  const inspections = useStore((s) => s.inspections);
  const fines = useStore((s) => s.fines);
  const storeSnapshots = useStore((s) => s.snapshots);
  const [metric, setMetric] = useState<HeatMetric>('atrasos');
  const [sel, setSel] = useState<Permit | null>(null);
  const onSelect = useCallback((p: Permit) => setSel(p), []);

  const sum = useMemo(() => summarize(permits), [permits]);
  const streets = useMemo(() => byStreet(permits), [permits]);
  const act = useMemo(() => dailyActivity(inspections, fines, 30), [inspections, fines]);
  const points = useMemo(() => mapPoints(permits, metric), [permits, metric]);
  const late = useMemo(
    () => permits.filter((p) => statusOf(p) === 'atrasado').sort((a, b) => b.deuda - a.deuda).slice(0, 8),
    [permits],
  );

  const snapshots = useMemo(() => {
    const hasReal = permits.some((p) => p.source === 'api');
    if (!hasReal && storeSnapshots.length > 1) return storeSnapshots;
    const now = new Date();
    const yesterday = new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10);
    const today = now.toISOString().slice(0, 10);
    const base = !hasReal && storeSnapshots.length === 1 ? storeSnapshots[0] : {
      alDia: sum.alDia,
      atrasado: sum.atrasado,
      desactivado: sum.desactivado,
      deuda: sum.deuda,
    };
    return [
      { date: yesterday, ...base },
      { date: today, alDia: sum.alDia, atrasado: sum.atrasado, desactivado: sum.desactivado, deuda: sum.deuda },
    ];
  }, [permits, storeSnapshots, sum]);

  const finesMonth = fines.filter((f) => f.status !== 'anulada' && Date.now() - new Date(f.issuedAt).getTime() < 30 * 86400000);
  const inspMonth = inspections.filter((i) => Date.now() - new Date(i.finishedAt).getTime() < 30 * 86400000);

  return (
    <div className="page">
      <h1>Panel de fiscalización</h1>
      <div className="kpis">
        <Kpi label="Permisos" value={sum.total.toLocaleString('es-CL')} sub="registrados" tone="info" />
        <Kpi label="Al día" value={sum.alDia.toLocaleString('es-CL')} sub={`${sum.porcentajeAlDia} % de los vigentes`} tone="ok" />
        <Kpi label="Atrasados" value={sum.atrasado.toLocaleString('es-CL')} sub={`Deuda ${clp(sum.deuda)}`} tone="bad" />
        <Kpi label="Desactivados" value={sum.desactivado.toLocaleString('es-CL')} sub="sin permiso activo" tone="off" />
        <Kpi label="Inspecciones (30 d)" value={inspMonth.length} sub={`${inspMonth.filter((i) => i.outcome === 'aprobada').length} aprobadas`} />
        <Kpi label="Multas (30 d)" value={finesMonth.length} sub={clp(finesMonth.reduce((a, f) => a + f.totalClp, 0))} />
      </div>

      <div className="grid g2">
        <Card title="Estado de los permisos" exportName="estado-de-permisos">
          <DonutChart
            centerValue={`${sum.porcentajeAlDia}%`}
            centerLabel="al día (vigentes)"
            data={[
              { label: 'Al día', value: sum.alDia, color: 'var(--ok)' },
              { label: 'Atrasados', value: sum.atrasado, color: 'var(--bad)' },
              { label: 'Desactivados', value: sum.desactivado, color: 'var(--off)' },
            ]}
          />
        </Card>
        <Card title="Seguimiento de permisos (30 días)" exportName="seguimiento-permisos">
          <LineChart
            labels={snapshots.map((s) => s.date.slice(5).replace('-', '/'))}
            series={[
              { name: 'Al día', color: 'var(--ok)', values: snapshots.map((s) => s.alDia) },
              { name: 'Atrasados', color: 'var(--bad)', values: snapshots.map((s) => s.atrasado) },
              { name: 'Desactivados', color: 'var(--off)', values: snapshots.map((s) => s.desactivado), dashed: true },
            ]}
          />
        </Card>
      </div>

      <Card
        title="Mapa de calor: dónde hay más atrasos"
        actions={
          <div className="seg" role="group" aria-label="Métrica del mapa">
            <button type="button" className={metric === 'atrasos' ? 'on' : ''} onClick={() => setMetric('atrasos')}>Cantidad de atrasos</button>
            <button type="button" className={metric === 'deuda' ? 'on' : ''} onClick={() => setMetric('deuda')}>Monto de la deuda</button>
            <button type="button" className="btn btn--ghost btn--small" onClick={() => go('/mapa')}>Abrir mapa</button>
          </div>
        }
      >
        <HeatMap points={points} mode="both" height={430} onSelect={onSelect} />
      </Card>

      <div className="grid g2">
        <Card title="Calles con más atrasos" exportName="calles-con-mas-atrasos">
          <HBarChart rows={streets.slice(0, 8).map((s) => ({ label: s.calle, value: s.atrasados, extra: `${Math.round(s.tasa * 100)} % de ${s.total}` }))} />
        </Card>
        <Card title="Inspecciones y multas por día (30 días)" exportName="inspecciones-y-multas">
          <LineChart
            labels={act.map((d) => d.label)}
            series={[
              { name: 'Inspecciones', color: 'var(--info)', values: act.map((d) => d.inspecciones) },
              { name: 'Multas', color: 'var(--bad)', values: act.map((d) => d.multas) },
            ]}
          />
        </Card>
      </div>

      <Card title="Mayores deudas" actions={<button type="button" className="btn btn--ghost btn--small" onClick={() => go('/permisos?estado=atrasado')}>Ver todos</button>}>
        <div className="tablewrap">
          <table className="table">
            <thead><tr><th>N.º</th><th>Titular</th><th>Calle</th><th className="num">Deuda</th><th>Estado</th><th /></tr></thead>
            <tbody>
              {late.map((p) => (
                <tr key={p.numeroArriendo}>
                  <td>{p.numeroArriendo}</td>
                  <td>{p.nombres}</td>
                  <td>{p.calle}</td>
                  <td className="num">{clp(p.deuda)}</td>
                  <td><StatusBadge status="atrasado" /></td>
                  <td><button type="button" className="btn btn--small" onClick={() => go(`/inspeccion?n=${p.numeroArriendo}`)}>Inspeccionar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {sel && <PermitDetail permit={sel} onClose={() => setSel(null)} />}
    </div>
  );
}
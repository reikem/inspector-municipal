import { useState } from 'react';

export interface Slice { label: string; value: number; color: string }

/** Gráfico de anillo (al día / atrasados / desactivados). */
export function DonutChart({ data, centerValue, centerLabel }: { data: Slice[]; centerValue: string; centerLabel: string }) {
  const total = data.reduce((a, b) => a + b.value, 0) || 1;
  const r = 70, c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="donut">
      <svg viewBox="0 0 200 200" role="img" aria-label={data.map((d) => `${d.label}: ${d.value}`).join(', ')}>
        <circle cx="100" cy="100" r={r} fill="none" stroke="var(--line)" strokeWidth="26" />
        {data.map((d) => {
          const len = (d.value / total) * c;
          const el = <circle key={d.label} cx="100" cy="100" r={r} fill="none" stroke={d.color} strokeWidth="26" strokeDasharray={`${Math.max(0, len - 1.5)} ${c}`} strokeDashoffset={-acc} transform="rotate(-90 100 100)" />;
          acc += len; return el;
        })}
        <text x="100" y="98" textAnchor="middle" className="donut__v">{centerValue}</text>
        <text x="100" y="120" textAnchor="middle" className="donut__l">{centerLabel}</text>
      </svg>
      <ul className="legend">
        {data.map((d) => (
          <li key={d.label}><i style={{ background: d.color }} /><span>{d.label}</span><strong>{d.value.toLocaleString('es-CL')}</strong><small>{Math.round((d.value / total) * 100)} %</small></li>
        ))}
      </ul>
    </div>
  );
}

export interface Series { name: string; color: string; values: number[]; dashed?: boolean }

/** Gráfico de líneas de seguimiento con lectura al pasar el cursor / tocar. */
export function LineChart({ labels, series, height = 230, fmt = (n: number) => String(Math.round(n)) }: { labels: string[]; series: Series[]; height?: number; fmt?: (n: number) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, H = height, pl = 44, pr = 12, pt = 12, pb = 26;
  const max = Math.max(1, ...series.flatMap((s) => s.values)) * 1.08;
  const x = (i: number) => pl + (i / Math.max(1, labels.length - 1)) * (W - pl - pr);
  const y = (v: number) => pt + (1 - v / max) * (H - pt - pb);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  return (
    <div className="linechart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={series.map((s) => s.name).join(', ')}
        onPointerMove={(e) => { const b = e.currentTarget.getBoundingClientRect(); const px = ((e.clientX - b.left) / b.width) * W; setHover(Math.max(0, Math.min(labels.length - 1, Math.round(((px - pl) / (W - pl - pr)) * (labels.length - 1))))); }}
        onPointerLeave={() => setHover(null)}>
        {ticks.map((t) => (<g key={t}><line x1={pl} x2={W - pr} y1={y(t)} y2={y(t)} stroke="var(--line)" /><text x={pl - 6} y={y(t) + 4} textAnchor="end" className="axis">{fmt(t)}</text></g>))}
        {labels.map((l, i) => (i % Math.ceil(labels.length / 6) === 0 ? <text key={l} x={x(i)} y={H - 6} textAnchor="middle" className="axis">{l}</text> : null))}
        {series.map((s) => (<polyline key={s.name} fill="none" stroke={s.color} strokeWidth="2.4" strokeLinejoin="round" strokeDasharray={s.dashed ? '5 4' : undefined} points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />))}
        {hover !== null && (<g><line x1={x(hover)} x2={x(hover)} y1={pt} y2={H - pb} stroke="var(--fg-soft)" strokeDasharray="3 3" />{series.map((s) => <circle key={s.name} cx={x(hover)} cy={y(s.values[hover])} r="4" fill={s.color} />)}</g>)}
      </svg>
      <div className="linechart__legend">
        {series.map((s) => (<span key={s.name}><i style={{ background: s.color }} />{s.name}{hover !== null && <b> {fmt(s.values[hover])}</b>}</span>))}
        {hover !== null && <em>{labels[hover]}</em>}
      </div>
    </div>
  );
}

export interface BarRow { label: string; value: number; extra?: string; color?: string }

/** Barras horizontales (calles con más atrasos). */
export function HBarChart({ rows, color = 'var(--bad)', fmt = (n: number) => String(n) }: { rows: BarRow[]; color?: string; fmt?: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="hbars">
      {rows.map((r) => (
        <li key={r.label}>
          <span className="hbars__label">{r.label}</span>
          <span className="hbars__track"><i style={{ width: `${(r.value / max) * 100}%`, background: r.color ?? color }} /></span>
          <strong>{fmt(r.value)}</strong>
          {r.extra && <small>{r.extra}</small>}
        </li>
      ))}
    </ul>
  );
}

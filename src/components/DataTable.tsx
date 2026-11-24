import { useEffect, useMemo, useState, type ReactNode } from 'react';

export interface Column<T> {
  key: string;
  header: string;
  value: (r: T) => string | number;
  render?: (r: T) => ReactNode;
  sortable?: boolean;
  num?: boolean;
}
export interface SelectFilter<T> { type: 'select'; key: string; label: string; options: { value: string; label: string }[]; test: (r: T, v: string) => boolean }
export interface RangeFilter<T> { type: 'range'; key: string; label: string; value: (r: T) => number; step?: number }
export type Filter<T> = SelectFilter<T> | RangeFilter<T>;

interface Props<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (r: T) => string | number;
  search?: { placeholder: string; text: (r: T) => string };
  filters?: Filter<T>[];
  initialSelects?: Record<string, string>;
  pageSizes?: number[];
  defaultPageSize?: number;
  defaultSort?: { key: string; dir: 'asc' | 'desc' };
  exportName?: string;
  empty?: string;
  caption: string;
  onRefreshRow?: (r: T) => Promise<void> | void;
}

const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

function pageList(cur: number, total: number): (number | '…')[] {
  const set = new Set([0, total - 1, cur - 1, cur, cur + 1].filter((n) => n >= 0 && n < total));
  const out: (number | '…')[] = [];
  [...set].sort((a, b) => a - b).forEach((n, i, arr) => { if (i && n - arr[i - 1] > 1) out.push('…'); out.push(n); });
  return out;
}

export default function DataTable<T>({
  rows,
  columns,
  rowKey,
  search,
  filters = [],
  initialSelects = {},
  pageSizes = [10, 25, 50, 100],
  defaultPageSize = 25,
  defaultSort,
  exportName,
  empty = 'No hay resultados con esos filtros.',
  caption,
  onRefreshRow,
}: Props<T>) {
  const [q, setQ] = useState('');
  const [selects, setSelects] = useState<Record<string, string>>(initialSelects);
  const [ranges, setRanges] = useState<Record<string, { min: string; max: string }>>({});
  const [sort, setSort] = useState(defaultSort);
  const [size, setSize] = useState(defaultPageSize);
  const [page, setPage] = useState(0);
  const [jump, setJump] = useState('');
  const [refreshingKey, setRefreshingKey] = useState<string | number | null>(null);

  useEffect(() => {
    setPage(0);
  }, [rows.length]);

  const filtered = useMemo(() => {
    const term = fold(q.trim());
    const digits = q.replace(/\D/g, '');
    const out = rows.filter((r) => {
      if (term && search) {
        const text = fold(search.text(r));
        if (!text.includes(term) && !(digits.length >= 3 && text.replace(/\D/g, '').includes(digits))) return false;
      }
      for (const f of filters) {
        if (f.type === 'select') { const v = selects[f.key]; if (v && !f.test(r, v)) return false; }
        else {
          const rg = ranges[f.key]; const n = f.value(r);
          if (rg?.min !== undefined && rg.min !== '' && n < Number(rg.min)) return false;
          if (rg?.max !== undefined && rg.max !== '' && n > Number(rg.max)) return false;
        }
      }
      return true;
    });
    const col = columns.find((c) => c.key === sort?.key);
    if (col && sort) {
      const dir = sort.dir === 'asc' ? 1 : -1;
      out.sort((a, b) => { const x = col.value(a), y = col.value(b); return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'es')) * dir; });
    }
    return out;
  }, [rows, q, selects, ranges, sort, search, filters, columns]);

  const pages = Math.max(1, Math.ceil(filtered.length / size));
  useEffect(() => { if (page > pages - 1) setPage(Math.max(0, pages - 1)); }, [page, pages]);
  const start = page * size;
  const slice = filtered.slice(start, start + size);
  const active = Boolean(q) || Object.values(selects).some(Boolean) || Object.values(ranges).some((r) => r.min || r.max);
  const reset = () => setPage(0);
  const clear = () => { setQ(''); setSelects({}); setRanges({}); reset(); };

  const toggleSort = (key: string) => { setSort((s) => (s?.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })); reset(); };

  const handleRefresh = async (r: T) => {
    if (!onRefreshRow) return;
    const k = rowKey(r);
    setRefreshingKey(k);
    try {
      await onRefreshRow(r);
    } finally {
      setRefreshingKey((curr) => (curr === k ? null : curr));
    }
  };

  const csv = () => {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const body = filtered.map((r) => columns.map((c) => esc(c.value(r))).join(','));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\ufeff' + [columns.map((c) => esc(c.header)).join(','), ...body].join('\n')], { type: 'text/csv;charset=utf-8' }));
    a.download = `${exportName ?? 'tabla'}-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };

  const totalCols = columns.length + (onRefreshRow ? 1 : 0);

  return (
    <div className="dt">
      <div className="dt__filters">
        {search && <input type="search" placeholder={search.placeholder} value={q} onChange={(e) => { setQ(e.target.value); reset(); }} aria-label={search.placeholder} />}
        {filters.map((f) => f.type === 'select' ? (
          <select key={f.key} value={selects[f.key] ?? ''} onChange={(e) => { setSelects({ ...selects, [f.key]: e.target.value }); reset(); }} aria-label={f.label}>
            <option value="">{f.label}: todos</option>{f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ) : (
          <span key={f.key} className="dt__range"><small>{f.label}</small>
            <input type="number" inputMode="numeric" min={0} step={f.step ?? 1} placeholder="mín." aria-label={`${f.label} mínimo`} value={ranges[f.key]?.min ?? ''} onChange={(e) => { setRanges({ ...ranges, [f.key]: { min: e.target.value, max: ranges[f.key]?.max ?? '' } }); reset(); }} />
            <input type="number" inputMode="numeric" min={0} step={f.step ?? 1} placeholder="máx." aria-label={`${f.label} máximo`} value={ranges[f.key]?.max ?? ''} onChange={(e) => { setRanges({ ...ranges, [f.key]: { min: ranges[f.key]?.min ?? '', max: e.target.value } }); reset(); }} />
          </span>))}
        {active && <button type="button" className="btn btn--ghost btn--small" onClick={clear}>Limpiar filtros</button>}
        {exportName && <button type="button" className="btn btn--ghost btn--small dt__csv" onClick={csv} title="Descarga lo que ves filtrado">⬇ CSV ({filtered.length})</button>}
      </div>

      <div className="tablewrap">
        <table className="table">
          <caption className="visually-hidden">{caption}</caption>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={c.num ? 'num' : ''} aria-sort={sort?.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                  {c.sortable ? <button type="button" className="dt__sort" onClick={() => toggleSort(c.key)}>{c.header}<span aria-hidden="true">{sort?.key === c.key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ' ↕'}</span></button> : c.header}
                </th>
              ))}
              {onRefreshRow && <th>Actualizar</th>}
            </tr>
          </thead>
          <tbody>
            {slice.map((r) => {
              const k = rowKey(r);
              const isRefreshing = refreshingKey === k;
              return (
                <tr key={k}>
                  {columns.map((c) => <td key={c.key} className={c.num ? 'num' : ''}>{c.render ? c.render(r) : c.value(r)}</td>)}
                  {onRefreshRow && (
                    <td>
                      <button
                        type="button"
                        className="btn btn--ghost btn--small"
                        disabled={isRefreshing}
                        onClick={() => void handleRefresh(r)}
                        title="Consultar nuevamente este registro en la API municipal"
                      >
                        {isRefreshing ? 'Actualizando…' : 'Actualizar'}
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
            {!slice.length && <tr><td colSpan={totalCols} className="muted">{empty}</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="dt__foot">
        <span className="muted" role="status">{filtered.length ? `Mostrando ${start + 1}–${Math.min(start + size, filtered.length)} de ${filtered.length.toLocaleString('es-CL')}` : 'Sin resultados'}{active && filtered.length !== rows.length ? ` (de ${rows.length.toLocaleString('es-CL')} en total)` : ''}</span>
        <label className="dt__size">Por página
          <select value={size} onChange={(e) => { setSize(Number(e.target.value)); reset(); }}>{pageSizes.map((n) => <option key={n} value={n}>{n}</option>)}</select>
        </label>
        <nav className="dt__pager" aria-label="Paginación">
          <button type="button" disabled={page === 0} onClick={() => setPage(0)} aria-label="Primera página">«</button>
          <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Página anterior">‹</button>
          {pageList(page, pages).map((n, i) => n === '…' ? <span key={`e${i}`} aria-hidden="true">…</span> : <button type="button" key={n} className={n === page ? 'on' : ''} aria-current={n === page ? 'page' : undefined} onClick={() => setPage(n)}>{n + 1}</button>)}
          <button type="button" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} aria-label="Página siguiente">›</button>
          <button type="button" disabled={page >= pages - 1} onClick={() => setPage(pages - 1)} aria-label="Última página">»</button>
        </nav>
        {pages > 7 && <form className="dt__jump" onSubmit={(e) => { e.preventDefault(); const n = Number(jump); if (n >= 1 && n <= pages) setPage(n - 1); setJump(''); }}>
          <input type="number" min={1} max={pages} placeholder="Ir a…" value={jump} onChange={(e) => setJump(e.target.value)} aria-label="Ir a la página" /></form>}
      </div>
    </div>
  );
}
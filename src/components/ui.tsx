import { useEffect, useRef, useState, type ReactNode } from 'react';
import ExportMenu from './ExportMenu';
import { isDemo } from '../store';
import type { PermitStatus } from '../types';
import { STATUS_LABEL } from '../services/permitsApi';

export function useHash(): { path: string; query: URLSearchParams } {
  const read = () => {
    const h = location.hash.replace(/^#/, '') || '/';
    const [path, q = ''] = h.split('?');
    return { path, query: new URLSearchParams(q) };
  };
  const [v, setV] = useState(read);
  useEffect(() => { const f = () => setV(read()); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  return v;
}

export const go = (path: string) => { location.hash = path; };

export function StatusBadge({ status }: { status: PermitStatus }) {
  return <span className={`badge badge--${status}`}>{STATUS_LABEL[status]}</span>;
}

export function Kpi({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'ok' | 'bad' | 'off' | 'info' }) {
  return (
    <div className={`kpi ${tone ? `kpi--${tone}` : ''}`}>
      <span className="kpi__label">{label}</span>
      <strong className="kpi__value">{value}</strong>
      {sub && <span className="kpi__sub">{sub}</span>}
    </div>
  );
}

export function Card({ title, actions, children, className = '', exportName }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; exportName?: string }) {
  const ref = useRef<HTMLElement>(null);
  return (
    <section ref={ref} className={`card ${className}`}>
      {(title || actions || exportName) && (
        <header className="card__head"><h2>{title}</h2>
          <div className="card__actions">{actions}{exportName && <ExportMenu getNode={() => ref.current} name={exportName} />}</div>
        </header>)}
      {children}
      {exportName && <p className="exportstamp">Generado el {new Date().toLocaleString('es-CL', { dateStyle: 'long', timeStyle: 'short' })} · Inspección municipal{isDemo() ? ' · datos de demostración' : ''}</p>}
    </section>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k);
    document.body.classList.add('noscroll');
    return () => { document.removeEventListener('keydown', k); document.body.classList.remove('noscroll'); };
  }, [onClose]);
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal__box ${wide ? 'modal__box--wide' : ''}`}>
        <header><h2>{title}</h2><button className="btn btn--ghost" onClick={onClose} aria-label="Cerrar">✕</button></header>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}

const ICONS: Record<string, string> = {
  dashboard: 'M3 13h8V3H3zm0 8h8v-6H3zm10 0h8V11h-8zm0-18v6h8V3z',
  permits: 'M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0zM4 21a8 8 0 0 1 16 0',
  map: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14',
  inspect: 'M9 11l3 3 7-7M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z',
  fines: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
  sources: 'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zm0 0v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
};
export function Icon({ name }: { name: string }) {
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONS[name]} /></svg>;
}

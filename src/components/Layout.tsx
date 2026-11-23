import type { ReactNode } from 'react';
import { isDemo, useStore } from '../store';
import { Icon } from './ui';

const NAV = [
  { path: '/', label: 'Panel', icon: 'dashboard' },
  { path: '/permisos', label: 'Permisos', icon: 'permits' },
  { path: '/mapa', label: 'Mapa', icon: 'map' },
  { path: '/inspeccion', label: 'Inspección', icon: 'inspect' },
  { path: '/multas', label: 'Multas', icon: 'fines' },
  { path: '/fuentes', label: 'Fuentes', icon: 'sources' },
  { path: '/ajustes', label: 'Ajustes', icon: 'settings' },
];

export default function Layout({ path, children }: { path: string; children: ReactNode }) {
  const backend = useStore((s) => s.backend);
  const inspector = useStore((s) => s.settings.inspectorName);
  const toast = useStore((s) => s.toast);
  useStore((s) => s.permits); // re-evalúa isDemo
  const active = (p: string) => (p === '/' ? path === '/' : path.startsWith(p));
  return (
    <div className="shell">
      <aside className="side">
        <a className="brand" href="#/"><svg viewBox="0 0 64 64" width="30" height="30" aria-hidden="true"><rect width="64" height="64" rx="14" fill="#3fb6a8" /><path d="M32 12l16 6v12c0 10-7 17-16 21-9-4-16-11-16-21V18z" fill="none" stroke="#0d2b45" strokeWidth="5" strokeLinejoin="round" /></svg><span>Inspección<br /><small>Comercio en BNUP</small></span></a>
        <nav aria-label="Principal">
          {NAV.map((n) => (<a key={n.path} href={`#${n.path}`} className={active(n.path) ? 'is-active' : ''} aria-current={active(n.path) ? 'page' : undefined}><Icon name={n.icon} /><span>{n.label}</span></a>))}
        </nav>
      </aside>
      <div className="main">
        <header className="top">
          <div className="top__left">{isDemo() && <span className="pill pill--warn" title="Estos datos son ficticios hasta que sincronices con la API real">Datos de demostración</span>}</div>
          <div className="top__right"><span className="pill">{backend}</span><span className="who">{inspector}</span></div>
        </header>
        <main id="contenido">{children}</main>
      </div>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

import Layout from './components/Layout';
import { useHash } from './components/ui';
import { useStore } from './store';
import Dashboard from './pages/Dashboard';
import Permits from './pages/Permits';
import MapPage from './pages/MapPage';
import Inspect from './pages/Inspect';
import Fines from './pages/Fines';
import Sources from './pages/Sources';
import Settings from './pages/Settings';
import PublicVerify from './pages/PublicVerify';

export default function App() {
  const { path } = useHash();
  const ready = useStore((s) => s.ready);
  const pub = path.match(/^\/v\/([^/]+)/);
  if (pub) return <PublicVerify code={decodeURIComponent(pub[1])} />;
  if (!ready) return <div className="boot">Cargando…</div>;
  const page = path.startsWith('/permisos') ? <Permits /> : path.startsWith('/mapa') ? <MapPage /> : path.startsWith('/inspeccion') ? <Inspect /> : path.startsWith('/multas') ? <Fines /> : path.startsWith('/fuentes') ? <Sources /> : path.startsWith('/ajustes') ? <Settings /> : <Dashboard />;
  return <Layout path={path}>{page}</Layout>;
}

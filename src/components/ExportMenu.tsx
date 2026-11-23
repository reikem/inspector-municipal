import { useState } from 'react';
import { exportNode, type ImageFormat } from '../services/exportImage';
import { toast } from '../store';

/** Botones «Imagen: PNG · SVG» para descargar un gráfico. */
export default function ExportMenu({ getNode, name }: { getNode: () => HTMLElement | null; name: string }) {
  const [busy, setBusy] = useState(false);
  const run = async (f: ImageFormat) => {
    const node = getNode();
    if (!node || busy) return;
    setBusy(true);
    try { await exportNode(node, name, f); toast(`Imagen ${f.toUpperCase()} descargada.`); }
    catch { toast('No se pudo exportar la imagen.'); }
    finally { setBusy(false); }
  };
  return (
    <span className="exportmenu noexport" role="group" aria-label="Exportar como imagen">
      <span aria-hidden="true">⬇</span>
      <button className="btn btn--ghost btn--small" disabled={busy} onClick={() => void run('png')} title="Descargar como PNG">PNG</button>
      <button className="btn btn--ghost btn--small" disabled={busy} onClick={() => void run('svg')} title="Descargar como SVG">SVG</button>
    </span>
  );
}

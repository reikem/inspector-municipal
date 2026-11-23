import { toPng, toSvg } from 'html-to-image';

export type ImageFormat = 'png' | 'svg';

/**
 * Exporta un elemento (gráfico con su título y leyenda) como imagen PNG o SVG.
 * Los controles marcados con la clase "noexport" no salen en la imagen; el sello
 * ".exportstamp" (fecha y origen de los datos) sí.
 */
export async function exportNode(node: HTMLElement, name: string, format: ImageFormat): Promise<void> {
  node.classList.add('exporting');
  try {
    const opts = {
      pixelRatio: 2,
      backgroundColor: getComputedStyle(node).backgroundColor,
      filter: (n: Node) => !(n instanceof HTMLElement && n.classList.contains('noexport')),
      // El SVG no incrusta las tipografías (pesaría casi 1 MB); el PNG sí, para verse idéntico.
      skipFonts: format === 'svg',
    };
    const url = format === 'png' ? await toPng(node, opts) : await toSvg(node, opts);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}-${new Date().toISOString().slice(0, 10)}.${format}`;
    a.click();
  } finally {
    node.classList.remove('exporting');
  }
}

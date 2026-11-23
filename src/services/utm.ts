/** Valor de la UTM desde mindicador.cl (API abierta de indicadores económicos). */
export async function fetchUtm(): Promise<{ value: number; date: string }> {
  const res = await fetch('https://mindicador.cl/api/utm', { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`mindicador.cl respondió ${res.status}`);
  const data = (await res.json()) as { serie?: { fecha: string; valor: number }[] };
  const last = data.serie?.[0];
  if (!last || !Number.isFinite(last.valor)) throw new Error('Respuesta inesperada de mindicador.cl');
  return { value: last.valor, date: last.fecha.slice(0, 10) };
}

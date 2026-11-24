const WORKER_URL =
  process.env.WORKER_URL ||
  'https://inspector-municipal.jimmymeneses11.workers.dev/api/provisoria';

const START_ID = Number(process.env.START_ID || 1);
const END_ID = Number(process.env.END_ID || 30);
const CONCURRENCY = Number(process.env.CONCURRENCY || 5);

async function fetchPermiso(id) {
  const endpoint = `${WORKER_URL}?id=${encodeURIComponent(id)}`;
  try {
    const res = await fetch(endpoint, {
      headers: { Accept: 'application/json' },
    });

    const data = await res.json().catch(() => null);

    if (res.ok && data && !data.error) {
      return { ok: true, id, data };
    }

    return {
      ok: false,
      id,
      status: res.status,
      code: data?.code || 'unknown',
      error: data?.error || `HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      ok: false,
      id,
      status: 0,
      code: 'network',
      error: err?.message || 'Error de red',
    };
  }
}

async function runPool(ids, concurrency, workerFn) {
  const results = [];
  let index = 0;

  async function next() {
    while (index < ids.length) {
      const currentIndex = index++;
      const item = await workerFn(ids[currentIndex]);
      results[currentIndex] = item;
    }
  }

  const runners = Array.from({ length: Math.min(concurrency, ids.length) }, next);
  await Promise.all(runners);
  return results;
}

async function main() {
  if (Number.isNaN(START_ID) || Number.isNaN(END_ID) || END_ID < START_ID) {
    console.error('❌ Rango inválido. Usa START_ID <= END_ID (ej: START_ID=1 END_ID=50).');
    process.exit(1);
  }

  const ids = Array.from({ length: END_ID - START_ID + 1 }, (_, i) => START_ID + i);
  console.log(`🔍 Consultando IDs del ${START_ID} al ${END_ID} en ${WORKER_URL}...\n`);

  const results = await runPool(ids, CONCURRENCY, fetchPermiso);
  const validos = results.filter((r) => r.ok);
  const errores = results.filter((r) => !r.ok);

  console.log(`✅ Permisos encontrados: ${validos.length} de ${ids.length} consultados`);
  console.log(`⚠️  Sin registro / errores: ${errores.length}\n`);

  if (validos.length > 0) {
    console.table(
      validos.map(({ id, data }) => ({
        id_consultado: id,
        numero_arriendo: data.NumeroArriendo,
        rut: data.Rut,
        nombre: data.nombres,
        estado: data.estado,
        deuda: data.deuda,
      }))
    );

    const fs = await import('node:fs/promises');
    const outputFile = 'permisos-cache-local.json';
    await fs.writeFile(
      outputFile,
      JSON.stringify(
        {
          total: validos.length,
          consultadoEn: new Date().toISOString(),
          permisos: validos.map((v) => ({ id: v.id, ...v.data })),
        },
        null,
        2
      ),
      'utf8'
    );
    console.log(`💾 Respaldo guardado en ${outputFile}`);
  }

  if (errores.length > 0) {
    const resumenErrores = errores.reduce((acc, item) => {
      const key = `${item.status} (${item.code})`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    console.log('\n📋 Resumen de respuestas no encontradas o con error:', resumenErrores);
  }
}

main();

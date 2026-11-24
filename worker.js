const ALLOWED_ORIGINS = new Set([
  'https://reikem.github.io',
  'http://localhost:4321',
  'http://localhost:5173',
]);

function getCorsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : 'https://reikem.github.io';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Accept, Content-Type, Authorization, apikey',
    'Vary': 'Origin',
  };
}

function jsonResponse(request, data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...getCorsHeaders(request),
      ...extraHeaders,
    },
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: getCorsHeaders(request) });
    }

    if (request.method !== 'GET') {
      return jsonResponse(request, { error: 'Método no permitido.' }, 405);
    }

    const pathId = url.pathname.match(/^\/(?:api\/)?provisoria\/(\d{1,10})$/)?.[1];
    const queryId = url.searchParams.get('id')?.trim() ?? '';
    const rentalId = pathId || queryId;

    if (!/^\d{1,10}$/.test(rentalId)) {
      return jsonResponse(
        request,
        { code: 'invalid_qr', error: 'ID inválido.' },
        400
      );
    }

    const cacheKey = new Request(
      `https://cache.local/provisoria/${encodeURIComponent(rentalId)}`,
      { method: 'GET' }
    );
    const cache = caches.default;
    const cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) {
      const headers = new Headers(cachedResponse.headers);
      const cors = getCorsHeaders(request);
      Object.entries(cors).forEach(([k, v]) => headers.set(k, v));
      return new Response(cachedResponse.body, {
        status: cachedResponse.status,
        headers,
      });
    }

    if (!env.MUNICIPAL_API_URL) {
      return jsonResponse(
        request,
        { code: 'server', error: 'Falta configurar MUNICIPAL_API_URL en el Worker.' },
        500
      );
    }

    let targetUrl;
    try {
      targetUrl = new URL(env.MUNICIPAL_API_URL);
      targetUrl.searchParams.set('id', rentalId);
    } catch {
      return jsonResponse(
        request,
        { code: 'server', error: 'MUNICIPAL_API_URL tiene un formato de URL inválido.' },
        500
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const upstream = await fetch(targetUrl.toString(), {
        method: 'GET',
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });

      clearTimeout(timeoutId);

      if (upstream.status === 404) {
        return jsonResponse(
          request,
          { code: 'not_found', error: 'No encontrado.' },
          404
        );
      }

      if (!upstream.ok) {
        return jsonResponse(
          request,
          { code: 'server', error: 'El sistema municipal no responde.' },
          502
        );
      }

      const body = await upstream.json().catch(() => null);
      const p = body?.provisoria ?? body?.data ?? body;

      if (!p || typeof p !== 'object' || (!p.NumeroArriendo && !p.Rut && !p.nombres)) {
        return jsonResponse(
          request,
          { code: 'not_found', error: 'No encontrado.' },
          404
        );
      }

      const payload = {
        NumeroArriendo: p.NumeroArriendo ?? rentalId,
        nombres: p.nombres ?? '',
        Rut: p.Rut ?? '',
        direccion: p.direccion ?? '',
        metraje: p.metraje ?? '',
        descripcion: p.descripcion ?? '',
        estado: p.estado ?? 'DESCONOCIDO',
        deuda: Number(p.deuda ?? 0),
      };

      const response = jsonResponse(request, payload, 200, {
        'Cache-Control': 'public, max-age=60',
      });

      ctx.waitUntil(cache.put(cacheKey, response.clone()));
      return response;
    } catch (err) {
      clearTimeout(timeoutId);
      const isTimeout = err?.name === 'AbortError';
      return jsonResponse(
        request,
        {
          code: isTimeout ? 'network' : 'server',
          error: isTimeout
            ? 'Tiempo de espera agotado al consultar el sistema municipal.'
            : 'El sistema municipal no responde.',
        },
        isTimeout ? 504 : 502
      );
    }
  },
};

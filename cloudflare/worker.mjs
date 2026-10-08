// Pages serves public assets; the existing Site remains the private registry.
const UPSTREAM = 'https://nexbuy-importaciones.juanperal05.chatgpt.site';
const PUBLIC_ORIGIN = '__NEXBUY_PUBLIC_ORIGIN__';
const FORWARDED_HEADERS = ['Accept', 'Content-Type', 'Cookie', 'X-NexBuy-Form', 'X-NexBuy-Admin', 'Sec-Fetch-Site', 'Sec-Fetch-Mode', 'Sec-Fetch-Dest'];
const error = (message, status) => new Response(JSON.stringify({error: message}), {status, headers: {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff'}});

function externalURL(value) {
  const url = new URL(value, UPSTREAM);
  if (url.origin !== UPSTREAM) throw new Error('Unexpected upstream URL');
  return PUBLIC_ORIGIN + url.pathname + url.search + url.hash;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.origin !== PUBLIC_ORIGIN) return error('Esta publicación no está configurada para esta dirección.', 421);
    const privateRoute = url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin');
    if (!privateRoute) return env.ASSETS.fetch(request);
    if (!['GET', 'HEAD', 'POST', 'PATCH'].includes(request.method)) return error('Método no disponible.', 405);
    const mutating = !['GET', 'HEAD'].includes(request.method);
    if (mutating && (request.headers.get('Origin') !== PUBLIC_ORIGIN || request.headers.get('Sec-Fetch-Site') === 'cross-site')) {
      return error('No se pudo verificar esta acción. Recargá la página para continuar.', 403);
    }
    if (mutating && Number(request.headers.get('Content-Length') || 0) > 32000) return error('La solicitud es demasiado extensa.', 413);
    const headers = new Headers();
    for (const name of FORWARDED_HEADERS) {
      if (request.headers.has(name)) headers.set(name, request.headers.get(name));
    }
    // Preserve server-side CSRF checks after validating the actual public origin.
    if (request.headers.get('Origin') === PUBLIC_ORIGIN) headers.set('Origin', UPSTREAM);
    else if (request.headers.has('Origin')) headers.set('Origin', request.headers.get('Origin'));
    try {
      let body;
      if (mutating) {
        body = await request.arrayBuffer();
        if (body.byteLength > 32000) return error('La solicitud es demasiado extensa.', 413);
      }
      const result = await fetch(UPSTREAM + url.pathname + url.search, {method: request.method, headers, body, redirect: 'manual'});
      const responseHeaders = new Headers(result.headers);
      responseHeaders.set('Cache-Control', 'private, no-store');
      responseHeaders.delete('Access-Control-Allow-Origin');
      responseHeaders.delete('Access-Control-Allow-Credentials');
      if (responseHeaders.has('Location')) {
        responseHeaders.set('Location', externalURL(responseHeaders.get('Location')));
      }
      if (url.pathname === '/api/requests' && request.method === 'POST' && result.ok) {
        const data = await result.json();
        if (data.deliveryRequired && data.emailPayload) {
          data.emailPayload._next = externalURL(data.emailPayload._next);
          data.emailPayload._url = PUBLIC_ORIGIN;
        }
        responseHeaders.delete('Content-Length');
        responseHeaders.delete('Content-Encoding');
        responseHeaders.delete('ETag');
        responseHeaders.set('Content-Type', 'application/json; charset=utf-8');
        return new Response(JSON.stringify(data), {status: result.status, headers: responseHeaders});
      }
      return new Response(request.method === 'HEAD' ? null : result.body, {status: result.status, headers: responseHeaders});
    } catch {
      return error('El registro no está disponible en este momento. Conservamos tus datos para volver a intentar.', 503);
    }
  }
};

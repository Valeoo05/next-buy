// NexBuy en Netlify: las páginas públicas se sirven como archivos estáticos y
// solo el formulario, el stock, las fotos subidas y el panel privado se reenvían
// al servidor original (base de datos, sesiones e imágenes siguen ahí).
const UPSTREAM = 'https://nexbuy-importaciones.juanperal05.chatgpt.site';
const FORWARDED_HEADERS = ['Accept', 'Content-Type', 'Cookie', 'If-None-Match', 'X-NexBuy-Form', 'X-NexBuy-Admin', 'Sec-Fetch-Site', 'Sec-Fetch-Mode', 'Sec-Fetch-Dest'];
const METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH'];
const SMALL_BODY = 64 * 1024;         // formularios y fichas de producto
const IMAGE_BODY = 1024 * 1024 + 1024; // fotos del panel de stock (máx. 1 MB)

const error = (message, status) => new Response(JSON.stringify({error: message}), {
  status,
  headers: {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff'}
});

function toPublic(value, publicOrigin) {
  const url = new URL(value, UPSTREAM);
  if (url.origin !== UPSTREAM) return value;
  return publicOrigin + url.pathname + url.search + url.hash;
}

export default async function nexbuyProxy(request) {
  const url = new URL(request.url);
  const publicOrigin = url.origin;
  if (!METHODS.includes(request.method)) return error('Método no disponible.', 405);

  const mutating = request.method !== 'GET' && request.method !== 'HEAD';
  if (mutating && (request.headers.get('Origin') !== publicOrigin || request.headers.get('Sec-Fetch-Site') === 'cross-site')) {
    return error('No se pudo verificar esta acción. Recargá la página para continuar.', 403);
  }
  const limit = url.pathname === '/api/admin/stock-images' ? IMAGE_BODY : SMALL_BODY;
  if (mutating && Number(request.headers.get('Content-Length') || 0) > limit) return error('La solicitud es demasiado extensa.', 413);

  const headers = new Headers();
  for (const name of FORWARDED_HEADERS) if (request.headers.has(name)) headers.set(name, request.headers.get(name));
  // El servidor original verifica que las acciones vengan de su propio dominio.
  if (request.headers.get('Origin') === publicOrigin) headers.set('Origin', UPSTREAM);

  let body;
  if (mutating) {
    body = await request.arrayBuffer();
    if (body.byteLength > limit) return error('La solicitud es demasiado extensa.', 413);
  }

  let result;
  try {
    result = await fetch(UPSTREAM + url.pathname + url.search, {method: request.method, headers, body, redirect: 'manual'});
  } catch {
    return error('El registro no está disponible en este momento. Conservamos tus datos para volver a intentar.', 503);
  }

  const responseHeaders = new Headers(result.headers);
  for (const name of ['Content-Encoding', 'Content-Length', 'Transfer-Encoding', 'Access-Control-Allow-Origin', 'Access-Control-Allow-Credentials']) responseHeaders.delete(name);
  if (!url.pathname.startsWith('/stock-images/')) responseHeaders.set('Cache-Control', 'private, no-store');
  if (responseHeaders.has('Location')) responseHeaders.set('Location', toPublic(responseHeaders.get('Location'), publicOrigin));

  // Después de enviar el correo, FormSubmit tiene que devolver al cliente a esta web, no a la vieja.
  if (url.pathname === '/api/requests' && request.method === 'POST' && result.ok) {
    const data = await result.json();
    if (data.deliveryRequired && data.emailPayload) {
      data.emailPayload._next = toPublic(data.emailPayload._next, publicOrigin);
      data.emailPayload._url = publicOrigin;
    }
    responseHeaders.delete('ETag');
    responseHeaders.set('Content-Type', 'application/json; charset=utf-8');
    return new Response(JSON.stringify(data), {status: result.status, headers: responseHeaders});
  }

  // Las páginas del panel apuntan su vista previa social al dominio viejo.
  if ((responseHeaders.get('Content-Type') || '').includes('text/html') && request.method !== 'HEAD') {
    const html = (await result.text()).replaceAll(UPSTREAM, publicOrigin);
    return new Response(html, {status: result.status, headers: responseHeaders});
  }
  return new Response(request.method === 'HEAD' ? null : result.body, {status: result.status, headers: responseHeaders});
}

export const config = {
  path: ['/api/*', '/admin', '/admin/*', '/admin.html', '/admin-login.html', '/admin-stock.html', '/stock-images/*']
};

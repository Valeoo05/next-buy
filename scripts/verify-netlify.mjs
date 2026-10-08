// Prueba local de la publicación en Netlify: usa el servidor real del proyecto con una base en memoria
// y la función de Netlify. No envía correos ni toca la web real.
// Uso: npm run build && node scripts/build-netlify.mjs https://nexbuy-test.netlify.app && node scripts/verify-netlify.mjs
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {pbkdf2Sync} from 'node:crypto';
import original from '../dist/server/index.js';
import proxy, {config} from '../netlify/edge-functions/nexbuy-proxy.js';

const origin = 'https://nexbuy-test.netlify.app';
const upstream = 'https://nexbuy-importaciones.juanperal05.chatgpt.site';
const sql = new DatabaseSync(':memory:');
for (const file of readdirSync('drizzle').filter(n => n.endsWith('.sql')).sort()) sql.exec(readFileSync('drizzle/' + file, 'utf8'));
class Statement {
  constructor(query, args = []) {this.query = query; this.args = args;}
  bind(...args) {return new Statement(this.query, args);}
  async first() {return sql.prepare(this.query).get(...this.args) || null;}
  async all() {return {results: sql.prepare(this.query).all(...this.args)};}
  async run() {return {meta: {changes: Number(sql.prepare(this.query).run(...this.args).changes)}};}
}
const objects = new Map();
const salt = '1234567890abcdef1234567890abcdef', password = 'netlify-local-fixture-only';
const env = {
  ADMIN_USERNAME: 'owner@example.com', ADMIN_PASSWORD_SALT: salt,
  ADMIN_PASSWORD_HASH: pbkdf2Sync(password, Buffer.from(salt, 'hex'), 100000, 32, 'sha256').toString('hex'),
  DB: {prepare: q => new Statement(q), async batch(statements) {
    sql.exec('BEGIN');
    try {const r = []; for (const s of statements) r.push(await s.run()); sql.exec('COMMIT'); return r;}
    catch (e) {sql.exec('ROLLBACK'); throw e;}
  }},
  MEDIA: {async put(k, b) {objects.set(k, new Uint8Array(b));}, async get(k) {const body = objects.get(k); return body ? {body} : null;}, async delete(k) {objects.delete(k);}}
};
let calls = 0, networkFailure = false;
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  calls++;
  assert.equal(new URL(url).origin, upstream, 'La función solo habla con el servidor original');
  assert.equal(init.redirect, 'manual');
  if (networkFailure) throw new Error('Network unavailable');
  return original.fetch(new Request(url, init), env, {waitUntil() {}});
};
// Simula el enrutamiento de Netlify: rutas de la función -> proxy, el resto -> archivos estáticos.
const patterns = config.path.map(p => new RegExp('^' + p.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$'));
const redirects = Object.fromEntries(readFileSync('netlify-build/_redirects', 'utf8').trim().split('\n').map(l => l.split(/\s+/).slice(0, 2)));
async function call(path, init = {}) {
  const request = new Request(origin + path, init);
  const pathname = new URL(request.url).pathname;
  if (patterns.some(r => r.test(pathname))) return proxy(request, {});
  const file = 'netlify-build' + (pathname === '/' ? '/index.html' : redirects[pathname] || pathname);
  return existsSync(file) ? new Response(readFileSync(file)) : new Response('Not found', {status: 404});
}
const jsonHeaders = {Origin: origin, 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'same-origin'};
const fixture = {requestType: 'personal', name: 'Verificación local', contactMethod: 'email', email: 'prueba@example.com', phone: '', country: 'Argentina', city: 'Salta', region: 'Salta', notes: 'Sin correo real', timing: 'Sin urgencia', currency: 'USD', budget: '', supplierInterest: '', images: [], products: [{name: 'Producto', qty: '2', category: 'Tecnología', link: '', reference: 'Modelo X', variants: 'Negro', alternatives: false}]};

try {
  for (const f of ['admin.html', 'admin-login.html', 'admin-stock.html']) assert.ok(!existsSync('netlify-build/' + f));
  const html = await (await call('/')).text();
  assert.ok(!html.includes('chatgpt.site'));
  assert.match(html, /og:image" content="https:\/\/nexbuy-test\.netlify\.app\/og\.png"/);
  assert.match(await (await call('/stock')).text(), /stock\.js/);
  assert.equal((await call('/og.png')).status, 200);
  assert.equal(calls, 0, 'Las visitas a páginas públicas no usan la función');

  // Stock público
  const stock = await (await call('/api/stock')).json();
  assert.equal(stock.products.length, 15);

  // Protecciones
  assert.equal((await call('/api/requests', {method: 'POST', headers: {...jsonHeaders, Origin: 'https://otro.example'}, body: '{}'})).status, 403);
  assert.equal((await call('/api/requests', {method: 'POST', headers: {...jsonHeaders, 'Sec-Fetch-Site': 'cross-site'}, body: '{}'})).status, 403);
  assert.equal((await call('/api/requests', {method: 'POST', headers: jsonHeaders, body: 'x'.repeat(70000)})).status, 413);
  assert.equal((await call('/api/admin/requests')).status, 401);
  const anonymous = await call('/admin');
  assert.equal(anonymous.headers.get('X-Robots-Tag'), 'noindex');
  assert.match(await anonymous.text(), /name="password"/);
  assert.equal((await call('/admin.html')).headers.get('Location'), origin + '/admin');
  assert.equal((await call('/admin/stock')).headers.get('Location'), origin + '/admin?next=stock');

  // Login del dueño
  const bad = await call('/api/admin/login', {method: 'POST', headers: {...jsonHeaders, 'X-NexBuy-Admin': '1'}, body: JSON.stringify({username: env.ADMIN_USERNAME, password: 'mal'})});
  assert.equal(bad.status, 401);
  const login = await call('/api/admin/login', {method: 'POST', headers: {...jsonHeaders, 'X-NexBuy-Admin': '1'}, body: JSON.stringify({username: env.ADMIN_USERNAME, password})});
  assert.equal(login.status, 200);
  assert.match(login.headers.get('Set-Cookie'), /^__Host-nexbuy-admin=.*Secure; HttpOnly; SameSite=Strict/);
  const owner = {Cookie: login.headers.get('Set-Cookie').split(';')[0]};
  const dash = await call('/admin', {headers: owner});
  const dashHtml = await dash.text();
  assert.match(dashHtml, /Registro privado/);
  assert.ok(!dashHtml.includes('chatgpt.site'));
  const panel = await call('/admin/stock', {headers: owner});
  assert.equal(panel.status, 200);
  assert.ok(!(await panel.text()).includes('chatgpt.site'));

  // Subir foto y crear/editar producto desde el panel
  const jpeg = new Uint8Array(500_000); jpeg.set([255, 216, 255]);
  const up = await call('/api/admin/stock-images', {method: 'POST', headers: {...owner, Origin: origin, 'Sec-Fetch-Site': 'same-origin', 'X-NexBuy-Admin': '1', 'Content-Type': 'image/jpeg'}, body: jpeg});
  assert.equal(up.status, 201, await up.clone().text());
  const photo = await up.json();
  assert.equal((await call(photo.url)).status, 404, 'Foto sin publicar es privada');
  const img = await call(photo.url, {headers: owner});
  assert.equal(img.status, 200);
  assert.equal((await img.arrayBuffer()).byteLength, 500_000);
  const item = {id: crypto.randomUUID(), name: 'Producto Netlify', category: 'Hogar', description: 'Prueba', details: [], price: 1000, quantity: 2, quantityKnown: true, delivery: 'Retiro a coordinar', visible: true, photoId: photo.id, gallery: []};
  const adminJson = {...owner, ...jsonHeaders, 'X-NexBuy-Admin': '1'};
  const created = await call('/api/admin/stock', {method: 'POST', headers: adminJson, body: JSON.stringify(item)});
  assert.equal(created.status, 201, await created.clone().text());
  const saved = (await created.json()).product;
  const edited = await call('/api/admin/stock/' + saved.id, {method: 'PUT', headers: adminJson, body: JSON.stringify({...item, ...saved, price: 2000})});
  assert.equal(edited.status, 200, saved.id + ' ' + await edited.clone().text());
  assert.ok((await (await call('/api/stock')).json()).products.some(p => p.name === 'Producto Netlify' && p.price === 2000));
  assert.equal((await call(photo.url)).status, 200, 'Foto de producto visible es pública');

  // Formulario de clientes + regreso desde FormSubmit
  const tokenResponse = await call('/api/form-token');
  const token = (await tokenResponse.json()).token, formCookie = tokenResponse.headers.get('Set-Cookie').split(';')[0];
  const registered = await call('/api/requests', {method: 'POST', headers: {...jsonHeaders, Cookie: formCookie, 'X-NexBuy-Form': token}, body: JSON.stringify({id: 'NB-AAAAAAAA', data: fixture, consent: true})});
  assert.equal(registered.status, 201);
  const data = await registered.json();
  assert.equal(data.emailPayload._url, origin);
  const next = new URL(data.emailPayload._next);
  assert.equal(next.origin, origin);
  const returned = await call('/api/email-return', {method: 'POST', headers: jsonHeaders, body: JSON.stringify({id: 'NB-AAAAAAAA', receipt: new URLSearchParams(next.hash.slice(1)).get('receipt')})});
  assert.equal(returned.status, 200);
  const list = await (await call('/api/admin/requests', {headers: owner})).json();
  assert.equal(list.requests[0].id, 'NB-AAAAAAAA');
  const patched = await call('/api/admin/requests/NB-AAAAAAAA', {method: 'PATCH', headers: adminJson, body: JSON.stringify({status: 'quoted'})});
  assert.equal(patched.status, 200, await patched.clone().text());

  // Cerrar sesión
  assert.equal((await call('/api/admin/logout', {method: 'POST', headers: {...owner, Origin: origin, 'Sec-Fetch-Site': 'same-origin', 'X-NexBuy-Admin': '1'}})).status, 200);
  assert.equal((await call('/api/admin/requests', {headers: owner})).status, 401);

  networkFailure = true;
  assert.equal((await call('/api/form-token')).status, 503);
  console.log('OK: páginas estáticas, stock, fotos subidas, panel privado (login, stock, solicitudes), formulario con regreso a Netlify y manejo de caídas.');
} finally {
  globalThis.fetch = realFetch;
  sql.close();
}

import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {pbkdf2Sync} from 'node:crypto';
import {JSDOM} from 'jsdom';
import original from '../dist/server/index.js';
import pages from '../cloudflare-build/_worker.js';

const origin = 'https://nexbuyimportaciones.pages.dev';
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
const salt = '1234567890abcdef1234567890abcdef';
const password = 'cloudflare-local-fixture-only';
const env = {
  ADMIN_USERNAME: 'juanperal05@gmail.com', ADMIN_PASSWORD_SALT: salt,
  ADMIN_PASSWORD_HASH: pbkdf2Sync(password, Buffer.from(salt, 'hex'), 100000, 32, 'sha256').toString('hex'),
  DB: {prepare: query => new Statement(query), async batch(statements) {
    sql.exec('BEGIN');
    try {const result = []; for (const s of statements) result.push(await s.run()); sql.exec('COMMIT'); return result;}
    catch (error) {sql.exec('ROLLBACK'); throw error;}
  }}
};
const fixture = {requestType: 'personal', name: 'Verificación local', contactMethod: 'email', email: 'prueba@example.com', phone: '', country: 'Argentina', city: 'Salta', region: 'Salta', notes: 'Sin correo real', timing: 'Sin urgencia', currency: 'USD', budget: '', supplierInterest: '', images: [{id: '11111111-2222-3333-4444-555555555555', name: 'producto.jpg', type: 'image/jpeg', size: 40000, width: 1600, height: 900}], products: [{name: 'Producto', qty: '2', category: 'Tecnología', link: '', reference: 'Modelo X', variants: 'Negro', alternatives: false}]};
let calls = 0, networkFailure = false;
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  calls++;
  assert.equal(new URL(url).origin, upstream, 'Proxy cannot send credentials to another destination');
  assert.equal(init.redirect, 'manual');
  assert.equal(init.headers.get('Authorization'), null);
  assert.equal(init.headers.get('oai-authenticated-user-email'), null);
  if (networkFailure) throw new Error('Network unavailable');
  return original.fetch(new Request(url, init), env, {waitUntil() {}});
};
const assetEnv = {ASSETS: {async fetch(request) {
  const pathname = new URL(request.url).pathname;
  const file = 'cloudflare-build' + (pathname === '/' ? '/index.html' : pathname);
  if (!existsSync(file)) return new Response('Not found', {status: 404});
  return new Response(request.method === 'HEAD' ? null : readFileSync(file));
}}};
const call = (path, init = {}) => pages.fetch(new Request(origin + path, init), assetEnv);
const jsonHeaders = {Origin: origin, 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'same-origin'};
async function form() {
  const response = await call('/api/form-token');
  const body = await response.json();
  assert.match(response.headers.get('Set-Cookie'), /HttpOnly; SameSite=Strict/);
  return {token: body.token, cookie: response.headers.get('Set-Cookie').split(';')[0]};
}

try {
  assert.ok(!existsSync('cloudflare-build/admin.html'));
  assert.ok(!existsSync('cloudflare-build/admin-login.html'));
  const routes = JSON.parse(readFileSync('cloudflare-build/_routes.json'));
  assert.deepEqual(routes.include, ['/api/*', '/admin*']);
  const html = await (await call('/')).text();
  assert.match(html, /content="index, follow"/);
  assert.match(html, /content="https:\/\/nexbuyimportaciones\.pages\.dev\/og\.png"/);
  assert.match(html, /property="og:url" content="https:\/\/nexbuyimportaciones\.pages\.dev\/"/);
  assert.ok(!html.includes('juanperal05.chatgpt.site'));
  assert.ok(!html.includes('href="/admin"'));
  assert.equal((await call('/robots.txt')).status, 404);
  assert.equal(calls, 0, 'Static visitors do not invoke the existing backend');
  assert.equal((await pages.fetch(new Request('https://other.pages.dev/api/form-token'), assetEnv)).status, 421);
  const forbidden = () => call('/api/requests', {method: 'POST', headers: {...jsonHeaders, Origin: 'https://other.example'}, body: '{}'});
  assert.equal((await forbidden()).status, 403);
  assert.equal((await call('/api/requests', {method: 'POST', headers: {...jsonHeaders, 'Sec-Fetch-Site': 'cross-site'}, body: '{}'})).status, 403);
  assert.equal((await call('/api/requests', {method: 'POST', headers: jsonHeaders, body: 'x'.repeat(32001)})).status, 413);
  assert.equal(calls, 0, 'Blocked mutations never reach the registry');
  assert.equal((await call('/api/admin/requests')).status, 401);
  const anonymous = await call('/admin');
  assert.equal(anonymous.headers.get('X-Robots-Tag'), 'noindex');
  assert.match(await anonymous.text(), /name="password"/);
  assert.equal((await call('/admin.html')).headers.get('Location'), origin + '/admin');
  const login = await call('/api/admin/login', {method: 'POST', headers: {...jsonHeaders, 'X-NexBuy-Admin': '1', Authorization: 'not-forwarded', 'oai-authenticated-user-email': 'not-forwarded'}, body: JSON.stringify({username: env.ADMIN_USERNAME, password})});
  assert.equal(login.status, 200);
  const ownerCookie = login.headers.get('Set-Cookie').split(';')[0];
  const dashboard = await call('/admin', {headers: {Cookie: ownerCookie}});
  assert.match(await dashboard.text(), /Registro privado/);
  assert.equal(dashboard.headers.get('Cache-Control'), 'private, no-store');
  const f = await form();
  const registration = {method: 'POST', headers: {...jsonHeaders, Cookie: f.cookie, 'X-NexBuy-Form': f.token}, body: JSON.stringify({id: 'NB-AAAAAAAA', data: fixture, consent: true})};
  const registered = await call('/api/requests', registration);
  assert.equal(registered.status, 201);
  const data = await registered.json();
  assert.equal(data.registered, true);
  assert.equal(data.emailPayload.Imagenes_adjuntas, '1');
  assert.equal(data.emailPayload._url, origin);
  assert.match(data.emailPayload.message, /Cantidad: 2/);
  const next = new URL(data.emailPayload._next);
  assert.equal(next.origin, origin);
  const receipt = new URLSearchParams(next.hash.slice(1)).get('receipt');
  const returned = await call('/api/email-return', {method: 'POST', headers: jsonHeaders, body: JSON.stringify({id: 'NB-AAAAAAAA', receipt})});
  assert.equal(returned.status, 200);
  assert.equal((await returned.json()).status, 'received_by_email_service');
  const replay = await (await call('/api/requests', registration)).json();
  assert.equal(replay.deliveryRequired, undefined, 'Retries cannot trigger another email');
  const list = await (await call('/api/admin/requests', {headers: {Cookie: ownerCookie}})).json();
  assert.equal(list.stats.total, 1);
  assert.equal(list.requests[0].id, 'NB-AAAAAAAA');
  const dom = new JSDOM('<body></body>', {url: origin, runScripts: 'outside-only'});
  dom.window.AbortController = globalThis.AbortController;
  let browserCookie = '';
  dom.window.fetch = async (path, init = {}) => {
    const headers = new Headers(init.headers);
    if (browserCookie) headers.set('Cookie', browserCookie);
    if (init.method === 'POST') {headers.set('Origin', origin); headers.set('Sec-Fetch-Site', 'same-origin');}
    const response = await call(path, {...init, headers});
    if (response.headers.has('Set-Cookie')) browserCookie = response.headers.get('Set-Cookie').split(';')[0];
    return response;
  };
  dom.window.eval(readFileSync('cloudflare-build/email-delivery.js', 'utf8'));
  let native;
  dom.window.HTMLFormElement.prototype.submit = function() {
    native = {action: this.action, method: this.method, encoding: this.enctype, fields: Object.fromEntries(new dom.window.FormData(this))};
  };
  const handoff = await dom.window.NexBuyEmail.submit({id: 'NB-BBBBBBBB', data: {...fixture, images: []}});
  handoff.continueToEmail();
  assert.equal(native.action, 'https://formsubmit.co/juanperal05@gmail.com');
  assert.equal(native.method, 'post');
  assert.equal(native.encoding, 'multipart/form-data');
  assert.equal(new URL(native.fields._next).origin, origin);
  assert.equal(native.fields._url, origin);
  assert.equal(native.fields.Solicitud, 'NB-BBBBBBBB');
  dom.window.close();
  networkFailure = true;
  assert.equal((await call('/api/form-token')).status, 503);
  console.log('PASS: Cloudflare metadata, static files, protected administration, secure cookies, origin checks, durable registration, native multipart email handoff, return receipt, retry protection and backend failure handling. No live email sent.');
} finally {
  globalThis.fetch = realFetch;
  sql.close();
}

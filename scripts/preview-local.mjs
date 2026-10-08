// Solo para la copia compartida. No despliega, no usa la base real y no envía correos.
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync, readdirSync, mkdirSync, existsSync, writeFileSync, unlinkSync } from 'node:fs';
import { createHash, pbkdf2Sync, randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const port = Number(process.env.NEXBUY_PREVIEW_PORT || 3000);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Elegí un puerto entre 1024 y 65535.');
const origin = `http://127.0.0.1:${port}`;
const productionOrigin = 'https://nexbuy-importaciones.juanperal05.chatgpt.site';
const build = spawnSync(process.execPath, ['scripts/build.mjs'], { cwd: root, stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status || 1);
const { default: worker } = await import(pathToFileURL(path.join(root, 'dist/server/index.js')).href);

const localDir = path.join(root, '.local-preview');
const imagesDir = path.join(localDir, 'images');
mkdirSync(imagesDir, { recursive: true });
const sql = new DatabaseSync(path.join(localDir, 'datos-locales.sqlite'));
sql.exec('CREATE TABLE IF NOT EXISTS preview_migrations (name TEXT PRIMARY KEY)');
for (const name of readdirSync('drizzle').filter(n => n.endsWith('.sql')).sort()) {
  if (sql.prepare('SELECT name FROM preview_migrations WHERE name = ?').get(name)) continue;
  sql.exec('BEGIN');
  try {
    sql.exec(readFileSync(path.join('drizzle', name), 'utf8'));
    sql.prepare('INSERT INTO preview_migrations (name) VALUES (?)').run(name);
    sql.exec('COMMIT');
  } catch (error) { sql.exec('ROLLBACK'); throw error; }
}
class Statement {
  constructor(query, args = []) { this.query = query; this.args = args; }
  bind(...args) { return new Statement(this.query, args); }
  async first() { return sql.prepare(this.query).get(...this.args) || null; }
  async all() { return { results: sql.prepare(this.query).all(...this.args) }; }
  async run() { return { meta: { changes: Number(sql.prepare(this.query).run(...this.args).changes) } }; }
}
const imagePath = key => path.join(imagesDir, createHash('sha256').update(key).digest('hex'));
const salt = randomBytes(16).toString('hex');
const password = randomBytes(9).toString('base64url');
const env = {
  ADMIN_USERNAME: 'admin-local',
  ADMIN_PASSWORD_SALT: salt,
  ADMIN_PASSWORD_HASH: pbkdf2Sync(password, Buffer.from(salt, 'hex'), 100000, 32, 'sha256').toString('hex'),
  DB: {
    prepare: query => new Statement(query),
    async batch(statements) {
      sql.exec('BEGIN');
      try {
        const result = statements.map(s => ({ meta: { changes: Number(sql.prepare(s.query).run(...s.args).changes) } }));
        sql.exec('COMMIT'); return result;
      } catch (error) { sql.exec('ROLLBACK'); throw error; }
    }
  },
  MEDIA: {
    async put(key, bytes) { writeFileSync(imagePath(key), new Uint8Array(bytes)); },
    async get(key) { const file = imagePath(key); return existsSync(file) ? { body: readFileSync(file) } : null; },
    async delete(key) { const file = imagePath(key); if (existsSync(file)) unlinkSync(file); }
  }
};
// El Worker de prueba no puede iniciar llamadas a servicios externos.
globalThis.fetch = async () => { throw new Error('Las conexiones externas están desactivadas en la vista previa local.'); };
const context = { waitUntil(promise) { Promise.resolve(promise).catch(console.error); } };
const banner = '<aside role="status" style="padding:10px 16px;background:#f6e8be;color:#101e2b;text-align:center;font:14px system-ui">Vista previa local · datos de prueba · los envíos se simulan y no llegan por mail</aside>';
const localCookie = value => value.replaceAll('__Host-nexbuy-', 'nexbuy-preview-').replace(/;\s*Secure/gi, '');
const internalCookie = value => value.replaceAll('nexbuy-preview-', '__Host-nexbuy-');

async function bodyOf(req) {
  const chunks = []; let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 8 * 1024 * 1024) throw Object.assign(new Error('El envío supera 8 MB.'), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
const server = http.createServer(async (req, res) => {
  try {
    if (req.headers.host !== `127.0.0.1:${port}`) { res.writeHead(403); res.end('Abrí la dirección 127.0.0.1 que muestra la terminal.'); return; }
    const url = new URL(req.url, origin);
    if (req.headers.origin && req.headers.origin !== origin && req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(403); res.end('Origen no permitido en esta copia local.'); return;
    }
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
    if (headers.get('Origin') === origin) headers.set('Origin', productionOrigin);
    if (headers.has('Cookie')) headers.set('Cookie', internalCookie(headers.get('Cookie')));
    const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await bodyOf(req);
    if (url.pathname === '/__preview__/formsubmit') {
      if (req.method !== 'POST' || req.headers.origin !== origin) { res.writeHead(403); res.end('Envío local no autorizado.'); return; }
      const form = await new Request(url, { method: 'POST', headers, body }).formData();
      const next = new URL(String(form.get('_next') || ''), origin);
      if (next.origin !== origin || next.pathname !== '/' || !next.searchParams.has('enviada') || !next.hash.startsWith('#receipt=')) {
        res.writeHead(400); res.end('No se pudo simular la confirmación.'); return;
      }
      // Simula únicamente el retorno de FormSubmit; conserva la validación real del recibo.
      res.writeHead(303, { Location: next.pathname + next.search + next.hash, 'Cache-Control': 'no-store' }); res.end(); return;
    }
    const internalURL = productionOrigin + url.pathname + url.search;
    const response = await worker.fetch(new Request(internalURL, { method: req.method, headers, ...(body ? { body } : {}) }), env, context);
    const outgoing = new Headers(response.headers);
    const cookies = outgoing.getSetCookie().map(localCookie);
    outgoing.delete('Set-Cookie'); outgoing.delete('Content-Length');
    outgoing.set('Cache-Control', 'no-store');
    if (outgoing.get('Location')?.startsWith(productionOrigin)) outgoing.set('Location', outgoing.get('Location').replace(productionOrigin, origin));
    let bytes = Buffer.from(await response.arrayBuffer());
    const type = outgoing.get('Content-Type') || '';
    if (type.includes('text/html')) {
      bytes = Buffer.from(bytes.toString().replace(/<body\b[^>]*>/i, tag => tag + banner));
      outgoing.set('Content-Security-Policy', "connect-src 'self'; form-action 'self'");
    } else if (url.pathname === '/email-delivery.js') {
      bytes = Buffer.from(bytes.toString().replace("const endpoint='https://formsubmit.co/juanperal05@gmail.com'", "const endpoint='/__preview__/formsubmit'"));
    } else if (type.includes('application/json')) {
      const data = JSON.parse(bytes.toString());
      if (data.emailPayload?._next) data.emailPayload._next = data.emailPayload._next.replace(productionOrigin, origin);
      if (data.emailPayload?._url) data.emailPayload._url = origin;
      bytes = Buffer.from(JSON.stringify(data));
    }
    const responseHeaders = Object.fromEntries(outgoing);
    if (cookies.length) responseHeaders['Set-Cookie'] = cookies;
    res.writeHead(response.status, responseHeaders); res.end(req.method === 'HEAD' ? undefined : bytes);
  } catch (error) {
    console.error(error.message); res.writeHead(error.status || 500, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Error de la copia local: ' + error.message);
  }
});
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE' ? `El puerto ${port} está ocupado. Cerrá la otra vista previa o elegí NEXBUY_PREVIEW_PORT.` : error.message);
  sql.close(); process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => {
  console.log(`\nNexBuy — copia local: ${origin}`);
  console.log(`Stock: ${origin}/stock`);
  console.log(`Panel de prueba: ${origin}/admin/stock`);
  console.log(`Usuario local: admin-local\nContraseña local para esta sesión: ${password}`);
  console.log('No es la contraseña de la web publicada. Los correos se simulan.');
  console.log('Guardá los archivos, detené con Ctrl+C y ejecutá de nuevo npm run preview:local para ver cambios.\n');
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => { sql.close(); process.exit(0); }));

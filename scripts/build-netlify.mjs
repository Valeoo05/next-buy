// Prepara la carpeta que publica Netlify (netlify-build/).
import {cp, mkdir, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';

const OLD = 'https://nexbuy-importaciones.juanperal05.chatgpt.site';
// Netlify define URL con la dirección principal del sitio (tu dominio propio si lo configuraste).
const site = (process.argv[2] || process.env.URL || '').replace(/\/+$/, '');
if (site && !/^https:\/\/[^/]+$/.test(site)) throw new Error('La dirección debe ser del tipo https://mi-sitio.netlify.app');

const out = path.resolve('netlify-build');
await rm(out, {recursive: true, force: true});
await mkdir(out, {recursive: true});
await cp('public', out, {recursive: true});
// El panel privado lo entrega siempre el servidor original (pasa por la función de Netlify).
for (const file of ['admin.html', 'admin-login.html', 'admin-stock.html']) await rm(path.join(out, file), {force: true});

if (site) {
  for (const file of (await readdir(out)).filter(f => f.endsWith('.html'))) {
    const p = path.join(out, file);
    await writeFile(p, (await readFile(p, 'utf8')).replaceAll(OLD, site));
  }
}
await writeFile(path.join(out, '_redirects'), '/stock   /stock.html   200\n/stock/  /stock.html   200\n');
await writeFile(path.join(out, '_headers'), [
  '/*',
  '  X-Content-Type-Options: nosniff',
  '  Referrer-Policy: strict-origin-when-cross-origin',
  '/*.html',
  '  Cache-Control: no-cache',
  '/',
  '  Cache-Control: no-cache',
  '/assets/*',
  '  Cache-Control: public, max-age=604800',
  ''
].join('\n'));
console.log(JSON.stringify({carpeta: out, direccion_publica: site || '(sin definir: se mantienen los enlaces sociales viejos)'}));

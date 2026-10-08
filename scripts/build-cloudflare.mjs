import {cp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
const origin = process.argv[2] || 'https://nexbuyimportaciones.pages.dev';
const parsed = new URL(origin);
if (parsed.origin !== origin || parsed.protocol !== 'https:' || !/^[a-z0-9-]+\.pages\.dev$/.test(parsed.hostname)) {
  throw new Error('Provide the exact production https://project.pages.dev origin, without a path.');
}
const out = path.resolve('cloudflare-build');
await rm(out, {recursive: true, force: true});
await mkdir(out, {recursive: true});
await cp('public', out, {recursive: true});
// The administration HTML is always served by the authenticated upstream.
await rm(path.join(out, 'admin.html'));
await rm(path.join(out, 'admin-login.html'));
const html = await readFile(path.join(out, 'index.html'), 'utf8');
await writeFile(path.join(out, 'index.html'), html.replaceAll('https://nexbuy-importaciones.juanperal05.chatgpt.site', origin));
const worker = await readFile('cloudflare/worker.mjs', 'utf8');
await writeFile(path.join(out, '_worker.js'), worker.replace('__NEXBUY_PUBLIC_ORIGIN__', origin));
await writeFile(path.join(out, '_routes.json'), JSON.stringify({version: 1, include: ['/api/*', '/admin*'], exclude: []}, null, 2) + '\n');
await writeFile(path.join(out, '_headers'), '/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n');
console.log(JSON.stringify({directory: out, public_origin: origin, includes_private_records: false, includes_credentials: false}));

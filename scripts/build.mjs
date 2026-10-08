import { cp, mkdir, rm, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
await rm('dist', { recursive: true, force: true });
await mkdir('dist/server', { recursive: true });
await mkdir('dist/.openai', { recursive: true });
const assets={};
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ttf':'font/ttf'};
async function collect(dir){for(const item of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,item.name);if(item.isDirectory())await collect(p);else{assets['/'+path.relative('public',p)]={body:(await readFile(p)).toString('base64'),type:types[path.extname(p)]||'application/octet-stream'};}}}
await collect('public');
const source=await readFile('worker/index.mjs','utf8');
const initialStock=JSON.parse(await readFile('worker/catalog-import.json','utf8'));
await writeFile('dist/server/index.js',source.replace("import { assets } from './assets.mjs';",'const assets = '+JSON.stringify(assets)+';').replace("import initialStock from './catalog-import.json';",'const initialStock = '+JSON.stringify(initialStock)+';'));
await cp('.openai/hosting.json','dist/.openai/hosting.json');
await cp('drizzle','dist/.openai/drizzle',{recursive:true});
console.log('NexBuy Worker, assets and database migrations prepared.');

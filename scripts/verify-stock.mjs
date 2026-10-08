import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { pbkdf2Sync } from 'node:crypto';
import { JSDOM } from 'jsdom';
import worker from '../dist/server/index.js';

// Isolated database and object storage: these checks never write production data.
const sql=new DatabaseSync(':memory:');
for(const name of readdirSync('drizzle').filter(n=>n.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+name,'utf8'));
class Statement {
 constructor(query,args=[]){this.query=query;this.args=args;}
 bind(...args){return new Statement(this.query,args);}
 async first(){return sql.prepare(this.query).get(...this.args)||null;}
 async all(){return {results:sql.prepare(this.query).all(...this.args)};}
 async run(){const r=sql.prepare(this.query).run(...this.args);return {meta:{changes:Number(r.changes)}};}
}
const password='stock-test-only',salt='1234567890abcdef1234567890abcdef',objects=new Map();
const env={ADMIN_USERNAME:'owner@example.com',ADMIN_PASSWORD_SALT:salt,ADMIN_PASSWORD_HASH:pbkdf2Sync(password,Buffer.from(salt,'hex'),100000,32,'sha256').toString('hex'),DB:{prepare:q=>new Statement(q),async batch(statements){sql.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());sql.exec('COMMIT');return results;}catch(e){sql.exec('ROLLBACK');throw e;}}},MEDIA:{async put(key,bytes){objects.set(key,new Uint8Array(bytes));},async get(key){const body=objects.get(key);return body?{body}:null;},async delete(key){objects.delete(key);}}};
const origin='https://nexbuy-importaciones.juanperal05.chatgpt.site',ctx={waitUntil(){}};
const call=(path,init={})=>worker.fetch(new Request(origin+path,init),env,ctx);
let owner={};
const mutate=(path,data,method='POST',extra={})=>call(path,{method,headers:{...owner,Origin:origin,'X-NexBuy-Admin':'1','Content-Type':'application/json',...extra},body:JSON.stringify(data)});
const live=[];
try{
 const home=await (await call('/')).text();assert.match(home,/href="\/stock"/);assert.ok(!home.includes('data-stock-grid'));assert.ok(!home.includes('href="/admin'));const homeDom=new JSDOM(home);assert.ok(Array.from(homeDom.window.document.querySelectorAll('a[href*="wa.me"]')).length>=2);for(const a of homeDom.window.document.querySelectorAll('a[href*="wa.me"]'))assert.equal(new URL(a.href).pathname,'/5492996550378');for(const a of homeDom.window.document.querySelector('#how-content').content.querySelectorAll('a[href*="wa.me"]'))assert.equal(new URL(a.href).pathname,'/5492996550378');homeDom.window.close();
 const page=await call('/stock');assert.equal(page.status,200);assert.equal(page.headers.get('x-robots-tag'),null);assert.match(await page.text(),/name="robots" content="index, follow"/);
 const imported=(await (await call('/api/stock')).json()).products;const seedCount=imported.length;assert.equal(seedCount,15);const initial=imported.find(p=>p.name==='Afnan Supremacy Collector’s Edition');assert.equal(initial.name,'Afnan Supremacy Collector’s Edition');assert.equal(initial.price,125000);assert.equal(initial.quantityKnown,false);assert.equal(initial.photos.length,2);assert.equal(initial.photoUrl,initial.photos[0]);
 sql.prepare('UPDATE stock_products SET details = NULL WHERE id = ?').run(initial.id);assert.deepEqual((await (await call('/api/stock')).json()).products.find(p=>p.id===initial.id).details,initial.details);
 for(const path of imported.flatMap(p=>p.photos)){const r=await call(path);assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/^image\//);}
 // Hiding the imported record must survive future reads; isolate older fixtures.
 for(const seed of imported)sql.prepare('UPDATE stock_products SET visible = 0 WHERE id = ?').run(seed.id);
 assert.deepEqual((await (await call('/api/stock')).json()).products,[]);
 for(const path of ['/admin/stock','/admin-stock.html']){const r=await call(path);assert.equal(r.status,303);assert.equal(r.headers.get('location'),'/admin?next=stock');assert.equal(r.headers.get('x-robots-tag'),'noindex');}
 assert.equal((await call('/api/admin/stock')).status,401);assert.equal((await mutate('/api/admin/stock',{})).status,401);
 assert.equal((await call('/api/admin/stock',{headers:{Cookie:'__Host-nexbuy-admin='+'A'.repeat(43),'oai-authenticated-user-id':'fake'}})).status,401);
 const signed=await mutate('/api/admin/login',{username:env.ADMIN_USERNAME,password});assert.equal(signed.status,200);assert.match(signed.headers.get('set-cookie'),/HttpOnly/);owner={Cookie:signed.headers.get('set-cookie').split(';')[0]};
 const privatePage=await call('/admin/stock',{headers:owner});assert.equal(privatePage.status,200);assert.equal(privatePage.headers.get('x-robots-tag'),'noindex');assert.match(privatePage.headers.get('cache-control'),/no-store/);
 const upload=(bytes,type='image/jpeg')=>call('/api/admin/stock-images',{method:'POST',headers:{...owner,Origin:origin,'X-NexBuy-Admin':'1','Content-Type':type},body:bytes});
 assert.equal((await upload(new Uint8Array([1,2,3]),'image/svg+xml')).status,400);
 assert.equal((await upload(new Uint8Array([1,2,3]))).status,400);
 assert.equal((await upload(new Uint8Array(1024*1024+1))).status,413);
 const photoBytes=new Uint8Array([255,216,255,224,0,1,255,217]);const uploaded=await upload(photoBytes);assert.equal(uploaded.status,201);const photo=await uploaded.json();
 assert.equal((await call(photo.url)).status,404);assert.deepEqual(new Uint8Array(await (await call(photo.url,{headers:owner})).arrayBuffer()),photoBytes);
 const item={id:crypto.randomUUID(),name:'Producto <img src=x>',category:'Hogar',description:'Detalles de prueba',details:[{label:'Color',value:'<img src=x>'}],price:25000.45,quantity:2,delivery:'Retiro a coordinar',visible:true,photoId:photo.id};
 assert.equal((await mutate('/api/admin/stock',item,'POST',{Origin:'https://another.example'})).status,403);
 assert.equal((await mutate('/api/admin/stock',{...item,quantity:1.5})).status,400);
 assert.equal((await mutate('/api/admin/stock',{...item,price:0.001})).status,400);
 assert.equal((await mutate('/api/admin/stock',{...item,photoId:crypto.randomUUID()})).status,400);
 assert.equal((await mutate('/api/admin/stock',{...item,details:Array.from({length:5},()=>({label:'A',value:'B'}))})).status,400);assert.equal((await mutate('/api/admin/stock',{...item,details:[{label:'Color',value:''}]})).status,400);assert.equal((await mutate('/api/admin/stock',{...item,details:[{label:'x'.repeat(41),value:'Azul'}]})).status,400);const saved=await mutate('/api/admin/stock',item);assert.equal(saved.status,201);let product=(await saved.json()).product;
 assert.deepEqual(product.details,item.details);assert.deepEqual(JSON.parse(sql.prepare('SELECT details FROM stock_products WHERE id = ?').get(item.id).details),item.details);assert.equal(product.price,item.price);assert.equal(product.photoUrl,photo.url);assert.equal(sql.prepare('SELECT price_cents FROM stock_products WHERE id = ?').get(item.id).price_cents,2500045);
 assert.equal((await mutate('/api/admin/stock',item)).status,200);assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM stock_products').get().n,seedCount+1);
 assert.equal((await mutate('/api/admin/stock',{...item,name:'Otro nombre'})).status,409);
 assert.equal((await call(photo.url)).status,200);assert.equal((await call(photo.url,{method:'HEAD'})).headers.get('content-type'),'image/jpeg');
 let publicList=(await (await call('/api/stock')).json()).products;assert.equal(publicList.length,1);assert.equal(publicList[0].name,item.name);
 const stale=product;const exhausted=await mutate('/api/admin/stock/'+item.id,{...product,quantity:0},'PUT');assert.equal(exhausted.status,200);product=(await exhausted.json()).product;
 assert.equal((await mutate('/api/admin/stock/'+item.id,{...stale,quantity:99},'PUT')).status,409);
 assert.equal((await (await call('/api/stock')).json()).products[0].quantity,0);
 const hidden=await mutate('/api/admin/stock/'+item.id,{...product,visible:false},'PUT');assert.equal(hidden.status,200);product=(await hidden.json()).product;
 assert.deepEqual((await (await call('/api/stock')).json()).products,[]);assert.equal((await call(photo.url)).status,404);assert.equal((await call(photo.url,{headers:owner})).status,200);
 assert.equal((await (await call('/api/admin/stock',{headers:owner})).json()).products.length,seedCount+1);
 const shown=await mutate('/api/admin/stock/'+item.id,{...product,visible:true,quantity:1},'PUT');assert.equal(shown.status,200);product=(await shown.json()).product;
 publicList=(await (await call('/api/stock')).json()).products;
 // Public catalog shows only server records, safe text, real WhatsApp links.
 const catalog=new JSDOM(readFileSync('public/stock.html','utf8'),{url:origin+'/stock',runScripts:'outside-only'});live.push(catalog);
 catalog.window.fetch=async()=>({ok:true,json:async()=>({products:publicList})});catalog.window.eval(readFileSync('public/seda-common.js','utf8'));catalog.window.eval(readFileSync('public/stock.js','utf8'));await new Promise(r=>setTimeout(r,20));
 const card=catalog.window.document.querySelector('[data-stock-grid] [data-card-name]');assert.equal(card.textContent,item.name);assert.equal(card.querySelector('img'),null);const safeFacts=catalog.window.document.querySelector('[data-card-details]');assert.equal(safeFacts.querySelector('img'),null);assert.equal(safeFacts.querySelector('dd').textContent,'<img src=x>');
 const link=catalog.window.document.querySelector('[data-stock-grid] [data-card-consult]');assert.equal(link.target,'_blank');assert.ok(link.rel.includes('noopener'));assert.equal(new URL(link.href).pathname,'/5492995657073');assert.match(new URL(link.href).searchParams.get('text'),/Producto <img src=x>/);assert.equal(catalog.window.document.querySelector('[data-stock-grid] [data-card-stock]').textContent,'Disponible');
 // The owner's requested product opens with the official cover and supplied second image.
 const galleryDom=new JSDOM(readFileSync('public/stock.html','utf8'),{url:origin+'/stock',runScripts:'outside-only',pretendToBeVisual:true});live.push(galleryDom);const g=galleryDom.window;
 g.HTMLDialogElement.prototype.showModal=function(){this.open=true;};g.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new g.Event('close'));};g.HTMLElement.prototype.scrollIntoView=function(){};
 g.fetch=async()=>({ok:true,json:async()=>({products:imported})});g.eval(readFileSync('public/seda-common.js','utf8'));g.eval(readFileSync('public/stock.js','utf8'));await new Promise(r=>setTimeout(r,20));
 const seedCard=Array.from(g.document.querySelectorAll('.sk-product')).find(card=>card.querySelector('[data-card-name]').textContent===initial.name);
 assert.equal(seedCard.querySelector('[data-card-photo]').getAttribute('src'),initial.photos[0]);assert.equal(seedCard.querySelector('[data-card-stock]').textContent,'Disponible');assert.match(seedCard.querySelector('[data-card-price]').textContent,/125.000/);
 seedCard.querySelector('[data-card-open]').click();const detail=g.document.querySelector('#stock-dialog');assert.equal(detail.open,true);assert.equal(g.document.querySelector('[data-gallery-count]').textContent,'1 de 2');assert.deepEqual(Array.from(g.document.querySelectorAll('.sg-slide img'),i=>i.getAttribute('src')),initial.photos);
 g.document.querySelector('[data-gallery-next]').click();assert.equal(g.document.querySelector('[data-gallery-count]').textContent,'2 de 2');assert.equal(g.document.querySelector('[data-gallery-enlarge]').getAttribute('href'),initial.photos[1]);assert.equal(g.document.querySelector('[data-gallery-next]').disabled,true);
 const track=g.document.querySelector('[data-gallery-track]');track.dispatchEvent(new g.KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));assert.equal(g.document.querySelector('[data-gallery-count]').textContent,'1 de 2');
 Object.defineProperty(track,'clientWidth',{value:300});track.scrollLeft=300;track.dispatchEvent(new g.Event('scroll'));assert.equal(g.document.querySelector('[data-gallery-count]').textContent,'2 de 2');
 g.document.querySelector('[data-gallery-thumbnails] button').click();assert.equal(g.document.querySelector('[data-gallery-count]').textContent,'1 de 2');assert.equal(new URL(g.document.querySelector('[data-detail-consult]').href).pathname,'/5492995657073');
 g.document.querySelector('[data-detail-close]').click();assert.equal(detail.open,false);assert.equal(g.document.body.style.overflow,'');assert.equal(new URL(g.location.href).searchParams.get('producto'),null);
 // Check every added name/price/image pair through the actual gallery UI.
 const expected=[["Rasasi Hawas Verde",95000,"hawas-verde"],["Rasasi Hawas Tropical",80000,"hawas-tropical"],["Rasasi Hawas Malibu",95000,"hawas-malibu"],["Rasasi Hawas Kobra",88000,"hawas-kobra"],["Afnan 9 PM Night Out",118000,"9pm-night-out"],["French Avenue Liquid Brun Limited Edition",135000,"liquid-brun-limited-edition"],["Armaf Club de Nuit Iconic Extrait de Parfum",105000,"club-de-nuit-iconic-extrait"],["Armaf Club de Nuit Précieux I",110000,"club-de-nuit-precieux-i"],["Rayhaan Wolf",102000,"rayhaan-wolf"],["Rayhaan Azul",110000,"rayhaan-azul"],["French Avenue Amber Empire",130000,"amber-empire"],["Riiffs Momento",115000,"riiffs-momento"],["Afnan Turathi Blue",102000,"turathi-blue"],["Bharara Rome Extradose",110000,"rome-extradose"]];
 const currency=new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:2});
 for(const [name,price,slug] of expected){
  const product=imported.find(p=>p.name===name);assert.ok(product);assert.equal(product.price,price);assert.equal(product.quantityKnown,false);assert.deepEqual(product.photos,['/assets/stock/'+slug+'.webp','/assets/stock/'+slug+'-ficha.jpg']);
  const card=Array.from(g.document.querySelectorAll('.sk-product')).find(c=>c.querySelector('[data-card-name]').textContent===name);assert.equal(card.querySelector('[data-card-photo]').getAttribute('src'),product.photos[0]);assert.equal(card.querySelector('[data-card-price]').textContent,currency.format(price));card.querySelector('[data-card-open]').click();assert.equal(g.document.querySelector('#stock-product-name').textContent,name);assert.equal(g.document.querySelector('[data-detail-price]').textContent,currency.format(price));g.document.querySelector('[data-gallery-next]').click();assert.equal(g.document.querySelector('[data-gallery-count]').textContent,'2 de 2');assert.equal(g.document.querySelector('[data-gallery-enlarge]').getAttribute('href'),product.photos[1]);assert.ok(new URL(g.document.querySelector('[data-detail-consult]').href).searchParams.get('text').includes(name));g.document.querySelector('[data-detail-close]').click();
 }
 // Catalog search, category sections, price sorting, sharing and direct links.
 const cards=()=>Array.from(g.document.querySelectorAll('.sk-product'));
 const names=()=>cards().map(c=>c.querySelector('[data-card-name]').textContent);
 const byCategory=name=>Array.from(g.document.querySelectorAll('[data-stock-category]')).find(b=>b.dataset.stockCategory===name);
 assert.deepEqual(Array.from(g.document.querySelectorAll('[data-stock-category]')).map(b=>b.dataset.stockCategory),['Todos','Perfumería']);
 assert.equal(g.document.querySelector('[data-category-section]').dataset.categorySection,'Perfumería');
 assert.ok(cards().every(c=>c.querySelector('[data-card-details]').children.length>=2));
 const search=g.document.querySelector('[data-stock-search]'),sort=g.document.querySelector('[data-stock-sort]');
 const query=value=>{search.value=value;search.dispatchEvent(new g.Event('input'));};
 query('HAWAS');assert.equal(cards().length,4);query('precieux');assert.deepEqual(names(),['Armaf Club de Nuit Précieux I']);query('romero');assert.deepEqual(names(),['Rasasi Hawas Verde']);query('producto inexistente');assert.equal(cards().length,0);assert.equal(g.document.querySelector('[data-stock-empty]').hidden,false);
 g.document.querySelector('[data-stock-clear]').click();assert.equal(cards().length,15);assert.equal(search.value,'');
 byCategory('Perfumería').click();assert.equal(byCategory('Perfumería').getAttribute('aria-pressed'),'true');
 sort.value='price-asc';sort.dispatchEvent(new g.Event('change'));assert.deepEqual(names(),[...imported].sort((a,b)=>a.price-b.price||a.name.localeCompare(b.name,'es')).map(p=>p.name));
 sort.value='price-desc';sort.dispatchEvent(new g.Event('change'));assert.deepEqual(names(),[...imported].sort((a,b)=>b.price-a.price||a.name.localeCompare(b.name,'es')).map(p=>p.name));
 sort.value='newest';sort.dispatchEvent(new g.Event('change'));assert.deepEqual(names(),[...imported].sort((a,b)=>b.createdAt-a.createdAt||b.id.localeCompare(a.id)).map(p=>p.name));
 g.document.querySelector('[data-stock-clear]').click();
 const shareCard=cards().find(c=>c.querySelector('[data-card-name]').textContent===initial.name),shareButton=shareCard.querySelector('.sk-share-button'),shareMenu=shareCard.querySelector('.sk-share-menu');
 shareButton.click();assert.equal(shareMenu.hidden,false);const shared=new URL(shareMenu.querySelector('[data-share-whatsapp]').href);assert.ok(shared.searchParams.get('text').includes(origin+'/stock?producto='+initial.id));assert.ok(shared.searchParams.get('text').includes(initial.name));assert.equal(shareMenu.querySelector('[data-share-whatsapp]').rel,'noopener');
 let copied='';Object.defineProperty(g.navigator,'clipboard',{configurable:true,value:{writeText:async value=>{copied=value;}}});shareMenu.querySelector('[data-share-copy]').click();await new Promise(r=>setTimeout(r,0));assert.equal(copied,origin+'/stock?producto='+initial.id);assert.equal(shareCard.querySelector('[role=status]').textContent,'Enlace copiado.');
 Object.defineProperty(g.navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('Blocked');}}});shareMenu.querySelector('[data-share-copy]').click();await new Promise(r=>setTimeout(r,0));assert.equal(shareMenu.querySelector('input').hidden,false);assert.equal(shareMenu.querySelector('input').value,copied);shareButton.click();
 let nativeShare;g.navigator.share=async data=>{nativeShare=data;};shareButton.click();await new Promise(r=>setTimeout(r,0));assert.equal(nativeShare.url,copied);assert.equal(shareMenu.hidden,true);delete g.navigator.share;
 const direct=new JSDOM(readFileSync('public/stock.html','utf8'),{url:copied,runScripts:'outside-only'});live.push(direct);const dw=direct.window;dw.HTMLDialogElement.prototype.showModal=function(){this.open=true;};dw.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new dw.Event('close'));};dw.fetch=async()=>({ok:true,json:async()=>({products:imported})});dw.eval(readFileSync('public/seda-common.js','utf8'));dw.eval(readFileSync('public/stock.js','utf8'));await new Promise(r=>setTimeout(r,20));assert.equal(dw.document.querySelector('#stock-dialog').open,true);assert.equal(dw.document.querySelector('#stock-product-name').textContent,initial.name);assert.equal(new URL(dw.document.querySelector('[data-detail-consult]').href).pathname,'/5492995657073');
 const mixed=new JSDOM(readFileSync('public/stock.html','utf8'),{url:origin+'/stock',runScripts:'outside-only'});live.push(mixed);const mw=mixed.window;const extra=[{...initial,id:crypto.randomUUID(),name:'Teléfono de prueba',category:'Tecnología',details:[{label:'Capacidad',value:'256 GB'}]},{...initial,id:crypto.randomUUID(),name:'Termo de prueba',category:'Stanley y termos'},{...initial,id:crypto.randomUUID(),name:'Producto de hogar',category:'Hogar'}];mw.fetch=async()=>({ok:true,json:async()=>({products:[...imported,...extra]})});mw.eval(readFileSync('public/seda-common.js','utf8'));mw.eval(readFileSync('public/stock.js','utf8'));await new Promise(r=>setTimeout(r,20));assert.equal(mw.document.querySelectorAll('[data-category-section]').length,4);const technology=Array.from(mw.document.querySelectorAll('[data-stock-category]')).find(b=>b.dataset.stockCategory==='Tecnología');technology.click();assert.equal(mw.document.querySelectorAll('.sk-product').length,1);assert.equal(mw.document.querySelector('[data-card-name]').textContent,'Teléfono de prueba');assert.equal(mw.document.querySelector('[data-card-details] dd').textContent,'256 GB');
 // Invalid gallery URLs cannot enter the stored catalog.
 assert.equal((await mutate('/api/admin/stock',{...item,id:crypto.randomUUID(),gallery:['https://evil.example/photo.jpg']})).status,400);
 // Management UI creates and edits through the authenticated API, then reads back.
 const management=new JSDOM(readFileSync('public/admin-stock.html','utf8'),{url:origin+'/admin/stock',runScripts:'outside-only',pretendToBeVisual:true});live.push(management);const w=management.window,doc=w.document;
 w.fetch=(path,init={})=>call(path,{...init,headers:{...owner,Origin:origin,...init.headers}});w.eval(readFileSync('public/seda-common.js','utf8'));w.eval(readFileSync('public/admin-stock.js','utf8'));await new Promise(r=>setTimeout(r,20));
 assert.equal(doc.querySelector('[data-inventory-count]').textContent,(seedCount+1)+' productos · 1 visibles');
 const form=doc.querySelector('[data-stock-editor]');form.elements.stockName.value='Nuevo producto de prueba';form.elements.stockPrice.value='12000';form.elements.stockQuantity.value='3';form.elements.stockCategory.value='Stanley y termos';form.elements.stockCategory.dispatchEvent(new w.Event('change'));assert.equal(form.elements.stockDetailLabel2.value,'Capacidad');form.elements.stockDetailValue2.value='1,2 litros';form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,30));
 assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM stock_products').get().n,seedCount+2);assert.match(doc.querySelector('[data-stock-status]').textContent,/guardado/);const newRow=sql.prepare('SELECT category, details FROM stock_products WHERE name = ?').get('Nuevo producto de prueba');assert.equal(newRow.category,'Stanley y termos');assert.deepEqual(JSON.parse(newRow.details),[{label:'Capacidad',value:'1,2 litros'}]);
 doc.querySelector('[data-inventory-list] [data-item-edit]').click();form.elements.stockQuantity.value='5';assert.equal(form.elements.stockDetailValue1.value,'1,2 litros');form.elements.stockDetailValue1.value='1,5 litros';form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,30));assert.equal(sql.prepare('SELECT quantity FROM stock_products WHERE name = ?').get('Nuevo producto de prueba').quantity,5);assert.deepEqual(JSON.parse(sql.prepare('SELECT details FROM stock_products WHERE name = ?').get('Nuevo producto de prueba').details),[{label:'Capacidad',value:'1,5 litros'}]);
 doc.querySelector('[data-inventory-list] [data-item-toggle]').click();await new Promise(r=>setTimeout(r,30));assert.equal(sql.prepare('SELECT visible FROM stock_products WHERE name = ?').get('Nuevo producto de prueba').visible,0);
 doc.querySelector('[data-refresh-stock]').click();await new Promise(r=>setTimeout(r,20));assert.equal(doc.querySelector('[data-inventory-count]').textContent,(seedCount+2)+' productos · 1 visibles');
 const seedRow=Array.from(doc.querySelectorAll('[data-inventory-row]')).find(row=>row.querySelector('[data-item-name]')?.textContent===initial.name)||Array.from(doc.querySelectorAll('[data-inventory-list] > *')).find(row=>row.querySelector('[data-item-name]')?.textContent===initial.name);assert.ok(seedRow);seedRow.querySelector('[data-item-edit]').click();assert.equal(form.elements.stockQuantity.value,'');assert.equal(doc.querySelector('[data-photo-image]').getAttribute('src'),initial.photos[0]);form.elements.stockPrice.value='126000';form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,30));
 const persisted=(await (await call('/api/admin/stock',{headers:owner})).json()).products.find(p=>p.id===initial.id);assert.equal(persisted.price,126000);assert.equal(persisted.visible,false);assert.equal(persisted.quantityKnown,false);assert.deepEqual(persisted.photos,initial.photos);assert.deepEqual(persisted.details,initial.details);const cleared=await mutate('/api/admin/stock/'+persisted.id,{...persisted,details:[]},'PUT');assert.equal(cleared.status,200);assert.deepEqual((await (await call('/api/admin/stock',{headers:owner})).json()).products.find(p=>p.id===initial.id).details,[]);
 console.log('PASS: separate stock page, owner-approved initial perfume, two-photo gallery, buttons/keyboard/swipe, real server authentication, durable products/photos, image limits, validation, idempotent create, concurrent-edit protection, visibility, safe catalog, categories/search/price/newest, safe editable facts, native share/copy/WhatsApp/deep links, separate stock and homepage WhatsApp, owner create/edit/hide/refresh.');
}finally{for(const dom of live)dom.window.close();sql.close();}

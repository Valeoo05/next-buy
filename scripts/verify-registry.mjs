import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import worker from '../dist/server/index.js';
import { pbkdf2Sync } from 'node:crypto';
const sql=new DatabaseSync(':memory:');
for(const name of readdirSync('drizzle').filter(n=>n.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+name,'utf8'));
class Statement {
  constructor(query,args=[]){this.query=query;this.args=args;}
  bind(...args){return new Statement(this.query,args);}
  async first(){return sql.prepare(this.query).get(...this.args)||null;}
  async all(){return {results:sql.prepare(this.query).all(...this.args)};}
  async run(){const r=sql.prepare(this.query).run(...this.args);return {meta:{changes:Number(r.changes)}};}
}
const testPassword='local-fixture-password-only',testSalt='1234567890abcdef1234567890abcdef';
const env={ADMIN_USERNAME:'juanperal05@gmail.com',ADMIN_PASSWORD_SALT:testSalt,ADMIN_PASSWORD_HASH:pbkdf2Sync(testPassword,Buffer.from(testSalt,'hex'),100000,32,'sha256').toString('hex'),DB:{prepare:q=>new Statement(q),async batch(statements){sql.exec('BEGIN');try{const r=[];for(const s of statements)r.push(await s.run());sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}}}};
const origin='https://nexbuy-importaciones.juanperal05.chatgpt.site';
const ctx={waitUntil(){}};
let owner={};
const other={Cookie:'__Host-nexbuy-admin='+ 'A'.repeat(43)};
const call=(path,init={})=>worker.fetch(new Request(origin+path,init),env,ctx);
let sent=0,mailMode='ok',lastEmail;
const realFetch=globalThis.fetch;
globalThis.fetch=async (url,init)=>{
  sent++;assert.equal(url,'https://formsubmit.co/ajax/juanperal05@gmail.com');
  lastEmail=JSON.parse(init.body);assert.match(lastEmail._url,/nexbuy-importaciones/);assert.ok(!lastEmail._cc&&!lastEmail._autoresponse);
  const record=sql.prepare('SELECT * FROM requests WHERE id = ?').get(lastEmail.Solicitud);assert.ok(record,'Saved before attempting mail');
  if(mailMode==='network')throw new Error('Offline');
  if(mailMode==='rejected')return new Response(JSON.stringify({success:false}),{status:400});
  return new Response(JSON.stringify({success:'true'}));
};
const base={requestType:'personal',name:'Prueba <script>',contactMethod:'email',email:'prueba@example.com',phone:'',country:'Argentina',city:'Salta',region:'Salta',notes:'Consulta de prueba',timing:'Sin urgencia',currency:'USD',budget:'500',supplierInterest:'',products:[{name:'Producto de prueba',qty:'2',category:'Tecnología',link:'',reference:'Modelo X',variants:'Negro',alternatives:false}]};
async function form(){const r=await call('/api/form-token');const body=await r.json();return {token:body.token,cookie:r.headers.get('set-cookie').split(';')[0]};}
async function submission(id,data,f,extra={}){const response=await call('/api/requests',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-NexBuy-Form':f.token,Cookie:f.cookie,...extra.headers},body:JSON.stringify({id,data,consent:extra.consent??true})});
  const payload=await response.clone().json();
  if(!payload.deliveryRequired)return response;
  assert.equal(payload.registered,true);
  let emailStatus='unconfirmed';
  try{const r=await fetch('https://formsubmit.co/ajax/juanperal05@gmail.com',{body:JSON.stringify(payload.emailPayload)});const result=await r.json();emailStatus=r.ok&&[true,'true'].includes(result.success)?'accepted':'failed';}catch{}
  const reported=await call('/api/requests/'+id+'/delivery',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-NexBuy-Form':f.token,Cookie:f.cookie},body:JSON.stringify({emailStatus})});
  assert.equal(reported.status,200);
  return new Response(await reported.text(),{status:response.status,headers:reported.headers});
}
try{
  assert.equal((await call('/')).status,200);assert.match(await (await call('/')).text(),/24 horas/);
  assert.equal((await call('/admin')).status,200);assert.match(await (await call('/admin')).text(),/name="password"/);assert.equal((await call('/admin.html')).status,308);assert.equal((await call('/admin/')).status,308);
  assert.match(await (await call('/admin',{headers:other})).text(),/name="password"/);
  assert.equal((await call('/api/admin/requests')).status,401);
  assert.equal((await call('/api/admin/requests',{headers:other})).status,401);
  assert.equal((await call('/api/admin/requests',{headers:{'oai-authenticated-user-id':'fake-owner','oai-authenticated-user-email':env.ADMIN_USERNAME}})).status,401);
  const loginBody=JSON.stringify({username:env.ADMIN_USERNAME,password:testPassword});
  const loginHeaders={Origin:origin,'Content-Type':'application/json','X-NexBuy-Admin':'1','CF-Connecting-IP':'192.0.2.1'};
  assert.equal((await call('/api/admin/login',{method:'POST',headers:{...loginHeaders,Origin:'https://another.example'},body:loginBody})).status,403);
  assert.equal((await call('/api/admin/login',{method:'POST',headers:loginHeaders,body:JSON.stringify({username:env.ADMIN_USERNAME,password:'wrong'})})).status,401);
  const signIn=await call('/api/admin/login',{method:'POST',headers:loginHeaders,body:loginBody});assert.equal(signIn.status,200);
  const sessionCookie=signIn.headers.get('set-cookie');assert.match(sessionCookie,/HttpOnly/);assert.match(sessionCookie,/Secure/);assert.match(sessionCookie,/SameSite=Strict/);
  owner={Cookie:sessionCookie.split(';')[0]};
  const admin=await call('/admin',{headers:owner});assert.equal(admin.status,200);assert.match(admin.headers.get('cache-control'),/no-store/);
  let f=await form();
  assert.equal((await submission('NB-AAAAAAAA',base,f,{consent:false})).status,400);assert.equal(sent,0);
  assert.equal((await submission('NB-AAAAAAAA',base,f,{headers:{Origin:'https://another.example'}})).status,403);assert.equal(sent,0);
  assert.equal((await submission('NB-AAAAAAAA',{...base,products:[{...base.products[0],link:'javascript:alert(1)'}]},f)).status,400);
  const first=await submission('NB-AAAAAAAA',base,f);assert.equal(first.status,201);assert.equal((await first.json()).registered,true);assert.equal(sent,1);assert.match(lastEmail.message,/Cantidad: 2/);
  assert.equal((await submission('NB-AAAAAAAA',base,f)).status,200);
  const altered=await call('/api/requests/NB-AAAAAAAA/delivery',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-NexBuy-Form':f.token,Cookie:f.cookie},body:JSON.stringify({emailStatus:'failed'})});assert.equal(altered.status,200);assert.equal(sql.prepare('SELECT email_status FROM requests WHERE id = ?').get('NB-AAAAAAAA').email_status,'accepted','Delivery replay cannot overwrite outcome');assert.equal(sent,1,'Retry does not email twice');
  assert.equal((await submission('NB-BBBBBBBB',base,f)).status,409);
  f=await form();assert.equal((await submission('NB-BBBBBBBB',{...base,requestType:'wholesale'},f)).status,400);await submission('NB-BBBBBBBB',{...base,contactMethod:'whatsapp',phone:'+54 9 387 123 4567',email:''},f);assert.ok(!lastEmail.email);
  f=await form();assert.equal((await submission('NB-CCCCCCCC',{...base,requestType:'suppliers',products:[],supplierInterest:'Perfumes para revender'},f)).status,400);await submission('NB-CCCCCCCC',base,f);
  // Legacy commercial requests remain readable and filterable after the UI moves to WhatsApp.
  sql.prepare('UPDATE requests SET request_type = ?, payload = ? WHERE id = ?').run('wholesale',JSON.stringify({...base,requestType:'wholesale'}),'NB-BBBBBBBB');
  sql.prepare('UPDATE requests SET request_type = ?, payload = ? WHERE id = ?').run('suppliers',JSON.stringify({...base,requestType:'suppliers',supplierInterest:'Perfumes para revender'}),'NB-CCCCCCCC');
  mailMode='network';f=await form();const failed=await submission('NB-DDDDDDDD',base,f);assert.equal(failed.status,201);assert.equal((await failed.json()).status,'registered_email_pending');assert.equal(sql.prepare('SELECT email_status FROM requests WHERE id = ?').get('NB-DDDDDDDD').email_status,'unconfirmed');
  mailMode='rejected';f=await form();await submission('NB-EEEEEEEE',base,f);assert.equal(sql.prepare('SELECT email_status FROM requests WHERE id = ?').get('NB-EEEEEEEE').email_status,'failed');
  const list=await (await call('/api/admin/requests',{headers:owner})).json();assert.equal(list.stats.total,5);assert.equal(list.stats.pending,5);assert.equal(list.stats.wholesale,1);assert.equal(list.stats.suppliers,1);assert.equal(list.requests.length,5);
  const filtered=await (await call('/api/admin/requests?type=suppliers',{headers:owner})).json();assert.equal(filtered.filteredTotal,1);
  const search=await (await call('/api/admin/requests?q=Prueba',{headers:owner})).json();assert.equal(search.filteredTotal,5);
  const detail=await (await call('/api/admin/requests/NB-CCCCCCCC',{headers:owner})).json();assert.equal(detail.data.supplierInterest,'Perfumes para revender');assert.equal(detail.form_key,undefined);
  const patch={method:'PATCH',headers:{...owner,Origin:origin,'X-NexBuy-Admin':'1','Content-Type':'application/json'},body:JSON.stringify({status:'quoted'})};
  assert.equal((await call('/api/admin/requests/NB-AAAAAAAA',{...patch,headers:{...patch.headers,...other}})).status,401);
  assert.equal((await call('/api/admin/requests/NB-AAAAAAAA',{...patch,headers:{...patch.headers,Origin:'https://another.example'}})).status,403);
  assert.equal((await call('/api/admin/requests/NB-AAAAAAAA',patch)).status,200);
  assert.equal((await (await call('/api/admin/requests',{headers:owner})).json()).stats.pending,4);
  assert.equal(sent,5,'Changing state sends no email');
  const image={id:'11111111-2222-3333-4444-555555555555',name:'producto.jpg',type:'image/jpeg',size:40000,width:1600,height:900};
  f=await form();assert.equal((await submission('NB-FFFFFFFF',{...base,images:[{...image,type:'image/svg+xml'}]},f)).status,400);assert.equal((await submission('NB-FFFFFFFF',{...base,images:Array(4).fill(image)},f)).status,400);
  const registration=await call('/api/requests',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-NexBuy-Form':f.token,Cookie:f.cookie},body:JSON.stringify({id:'NB-FFFFFFFF',data:{...base,images:[image],products:[{...base.products[0],reference:''}]},consent:true})});assert.equal(registration.status,201);const registered=await registration.json();assert.equal(registered.emailPayload.Imagenes_adjuntas,'1');
  const next=new URL(registered.emailPayload._next),receipt=new URLSearchParams(next.hash.slice(1)).get('receipt');assert.equal(next.origin,origin);
  const receiptInit={method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({id:'NB-FFFFFFFF',receipt})};
  assert.equal((await call('/api/email-return',{...receiptInit,headers:{...receiptInit.headers,Origin:'https://other.example'}})).status,403);
  assert.equal((await call('/api/email-return',{...receiptInit,body:JSON.stringify({id:'NB-FFFFFFFF',receipt:'0'.repeat(72)})})).status,403);
  const returned=await call('/api/email-return',receiptInit);assert.equal(returned.status,200);const returnedData=await returned.json();assert.equal(returnedData.status,'received_by_email_service');assert.equal(returnedData.data.images.length,1);assert.equal(returnedData.email_return_hash,undefined);assert.equal((await call('/api/email-return',receiptInit)).status,200);assert.equal(sent,5);
  assert.match((await call('/api/admin/requests',{headers:owner})).headers.get('cache-control'),/no-store/);
  const unavailable=await worker.fetch(new Request(origin+'/api/admin/requests',{headers:owner}),{ADMIN_USERNAME:env.ADMIN_USERNAME},ctx);assert.equal(unavailable.status,503);
  const publicPage=await call('/');assert.equal(publicPage.headers.get('x-robots-tag'),null);const publicHtml=await publicPage.text();assert.match(publicHtml,/<meta name="robots" content="index, follow">/);assert.ok(!publicHtml.includes('href="/admin"'));
  assert.equal((await call('/robots.txt')).status,404);
  const privatePage=await call('/admin',{headers:owner});assert.equal(privatePage.headers.get('x-robots-tag'),'noindex');assert.match(await privatePage.text(),/<meta name="robots" content="noindex">/);
  const expiredCookie=owner.Cookie;const tokenValue=expiredCookie.split('=')[1];const storedHash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(tokenValue));const h=Buffer.from(storedHash).toString('hex');
  assert.ok(sql.prepare('SELECT token_hash FROM admin_sessions WHERE token_hash = ?').get(h));
  const signOut=await call('/api/admin/logout',{method:'POST',headers:{...owner,...loginHeaders},body:'{}'});assert.equal(signOut.status,200);assert.equal((await call('/api/admin/requests',{headers:owner})).status,401);assert.equal(sql.prepare('SELECT token_hash FROM admin_sessions WHERE token_hash = ?').get(h),undefined);
  for(let i=0;i<5;i++)assert.equal((await call('/api/admin/login',{method:'POST',headers:{...loginHeaders,'CF-Connecting-IP':'192.0.2.99'},body:JSON.stringify({username:env.ADMIN_USERNAME,password:'wrong'})})).status,401);
  assert.equal((await call('/api/admin/login',{method:'POST',headers:{...loginHeaders,'CF-Connecting-IP':'192.0.2.99'},body:loginBody})).status,429);
  console.log('PASS: anonymous intake, consent, validation, durable records, single email, failure retention, password login, session revocation, rate limits, private access, public indexing, totals, filters, details and status updates.');
}finally{globalThis.fetch=realFetch;sql.close();}

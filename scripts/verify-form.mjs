import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
const origin='https://nexbuy-importaciones.juanperal05.chatgpt.site';
const tick=()=>new Promise(resolve=>setTimeout(resolve,10));
const draftTick=()=>new Promise(resolve=>setTimeout(resolve,300));
function setup(file='index.html'){
  const dom=new JSDOM(readFileSync('public/'+file,'utf8'),{url:origin+(file==='admin.html'?'/admin':'/'),runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window;
  w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
  w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');this.dispatchEvent(new w.Event('close'));};
  w.HTMLElement.prototype.scrollIntoView=function(){};
  w.AbortController=globalThis.AbortController;
  if(file==='index.html')w.eval(readFileSync('public/attachments.js','utf8'));
  return {dom,w,doc:w.document};
}
function fill(w,id,value){const el=w.document.getElementById(id);assert.ok(el,'Field '+id+' exists');el.value=value;el.dispatchEvent(new w.Event('input',{bubbles:true}));}
function submit(w,id='quote-form'){w.document.getElementById(id).dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));}
const live=[];
try{
  const metadata=setup();live.push(metadata.dom);
  for(const property of ['og:title','og:description','og:image','og:url','og:type','og:locale'])assert.ok(metadata.doc.querySelector(`meta[property="${property}"]`)?.content);
  assert.equal(metadata.doc.querySelector('meta[property="og:locale"]').content,'es_AR');assert.equal(metadata.doc.querySelector('meta[name="twitter:card"]').content,'summary_large_image');assert.equal(metadata.doc.querySelector('meta[property="og:image"]').content,origin+'/og.png');assert.equal(metadata.doc.querySelector('meta[name="twitter:image"]').content,origin+'/og.png');assert.ok(metadata.doc.querySelector('link[rel="icon"]'));
  const card=readFileSync('public/og.png');assert.equal(card.subarray(1,4).toString(),'PNG');assert.equal(card.readUInt32BE(16),1200);assert.equal(card.readUInt32BE(20),630);
  {
    const {dom,w,doc}=setup();live.push(dom);let registrations=0,handoffs=0,lastBody,captured;
    const returnedUrl=origin+'/?enviada=NB-AAAAAAAA#receipt='+'a'.repeat(72);
    w.HTMLFormElement.prototype.submit=function(){handoffs++;captured=this;assert.equal(this.action,'https://formsubmit.co/juanperal05@gmail.com');assert.equal(this.enctype,'multipart/form-data');assert.equal(this.querySelector('[name=_next]').value,returnedUrl);};
    w.fetch=async(url,init={})=>{
      if(url==='/api/form-token')return {ok:true,json:async()=>({token:'test-token'})};
      assert.equal(url,'/api/requests');registrations++;lastBody=JSON.parse(init.body);assert.equal(lastBody.consent,true);assert.equal(lastBody.data.requestType,'personal');
      return {ok:true,json:async()=>({id:lastBody.id,createdAt:new Date().toISOString(),registered:true,status:'registered_email_pending',deliveryRequired:true,emailPayload:{Solicitud:lastBody.id,message:'Solicitud revisada',_next:returnedUrl}})};
    };
    w.eval(readFileSync('public/email-delivery.js','utf8'));w.eval(readFileSync('public/app.js','utf8'));
    assert.equal(doc.querySelector('[data-request-type]'),null);
    for(const a of doc.querySelectorAll('a[href^="https://wa.me/"]')){const link=new URL(a.href);assert.equal(link.pathname,'/5492996550378');assert.equal(a.target,'_blank');assert.ok(a.rel.split(' ').includes('noopener'));assert.match(link.searchParams.get('text'),/Hola NexBuy! Quiero consultar/);}
    assert.equal(doc.querySelectorAll('a[href^="https://wa.me/"]').length,2);
    fill(w,'p0_name','Auriculares');fill(w,'p0_qty','2');doc.querySelector('[data-category="Tecnología"]').click();fill(w,'p0_reference','Sony modelo X');submit(w);
    fill(w,'name','Cliente de prueba');fill(w,'phone','+54 9 387 123 4567');fill(w,'city','Salta');fill(w,'region','Salta');submit(w);submit(w);assert.equal(registrations,0);assert.match(doc.body.textContent,/Autorizá el envío/);
    doc.getElementById('consent').checked=true;submit(w);submit(w);await tick();assert.equal(registrations,1);assert.equal(handoffs,1);assert.match(doc.body.textContent,/Finalizando el envío/);assert.ok(w.localStorage.getItem('nexbuy.draft.v1'),'Draft remains until email return');
    const request=JSON.parse(w.localStorage.getItem('nexbuy.requests.v1'))[0];
    const back=setup();live.push(back.dom);back.dom.reconfigure({url:origin+'/?enviada='+request.id+'#receipt='+'a'.repeat(72)});back.w.localStorage.setItem('nexbuy.requests.v1',w.localStorage.getItem('nexbuy.requests.v1'));back.w.localStorage.setItem('nexbuy.draft.v1',w.localStorage.getItem('nexbuy.draft.v1'));
    back.w.fetch=async(url,init)=>{assert.equal(url,'/api/email-return');assert.equal(JSON.parse(init.body).id,request.id);return {ok:true,json:async()=>({id:request.id,createdAt:request.createdAt,registered:true,status:'received_by_email_service',data:request.data})};};back.w.eval(readFileSync('public/app.js','utf8'));await tick();assert.match(back.doc.body.textContent,/Solicitud recibida/);assert.match(back.doc.body.textContent,/próximas 24 horas/);await draftTick();assert.equal(back.w.localStorage.getItem('nexbuy.draft.v1'),null);back.w.dispatchEvent(new back.w.Event('pagehide'));assert.equal(back.w.localStorage.getItem('nexbuy.draft.v1'),null);assert.equal(back.w.location.hash,'');back.doc.getElementById('open-requests').click();assert.match(back.doc.querySelector('#dialog-content').textContent,/Auriculares/);
  }
  const first=setup();live.push(first.dom);first.w.eval(readFileSync('public/app.js','utf8'));
  fill(first.w,'p0_name','Auriculares');fill(first.w,'p0_qty','3');first.doc.querySelector('[data-category="Tecnología"]').click();fill(first.w,'p0_reference','Modelo X, color negro. Acepto alternativas similares.');submit(first.w);
  fill(first.w,'name','Persona con borrador');fill(first.w,'phone','+54 9 387 123 4567');fill(first.w,'city','Salta');fill(first.w,'region','Salta');fill(first.w,'budget','250');fill(first.w,'notes','Guardar los detalles');submit(first.w);await draftTick();
  const snapshot=first.w.localStorage.getItem('nexbuy.draft.v1');assert.equal(JSON.parse(snapshot).step,3);
  const restored=setup();live.push(restored.dom);restored.w.localStorage.setItem('nexbuy.draft.v1',snapshot);restored.w.eval(readFileSync('public/app.js','utf8'));
  assert.match(restored.doc.querySelector('.draft-recovery').textContent,/Recuperamos tu borrador/);assert.ok(restored.doc.getElementById('consent'));assert.equal(restored.doc.getElementById('consent').checked,false);assert.match(restored.doc.body.textContent,/Persona con borrador/);assert.match(restored.doc.body.textContent,/Guardar los detalles/);assert.match(restored.doc.body.textContent,/Cantidad: 3/);
  restored.doc.querySelector('[data-edit-step="1"]').click();assert.match(restored.doc.getElementById('p0_reference').value,/color negro/);assert.match(restored.doc.getElementById('p0_reference').value,/Acepto alternativas/);restored.doc.getElementById('restart-draft').click();assert.equal(restored.doc.getElementById('p0_name').value,'');await draftTick();assert.equal(restored.w.localStorage.getItem('nexbuy.draft.v1'),null);
  fill(restored.w,'p0_name','Último cambio antes de salir');restored.w.dispatchEvent(new restored.w.Event('pagehide'));assert.equal(JSON.parse(restored.w.localStorage.getItem('nexbuy.draft.v1')).data.products[0].name,'Último cambio antes de salir');
  const blocked=setup();live.push(blocked.dom);Object.defineProperty(blocked.w,'localStorage',{get(){throw new Error('Storage blocked');}});blocked.w.eval(readFileSync('public/app.js','utf8'));assert.ok(blocked.doc.getElementById('p0_name'));assert.match(blocked.doc.querySelector('.storage-warning').textContent,/no permite guardar/);
  const damaged=setup();live.push(damaged.dom);damaged.w.localStorage.setItem('nexbuy.draft.v1','invalid-json');damaged.w.eval(readFileSync('public/app.js','utf8'));fill(damaged.w,'p0_name','Borrador nuevo');await draftTick();assert.equal(JSON.parse(damaged.w.localStorage.getItem('nexbuy.draft.v1')).data.products[0].name,'Borrador nuevo');
  const quota=setup();live.push(quota.dom);quota.w.eval(readFileSync('public/app.js','utf8'));quota.w.Storage.prototype.setItem=function(){throw new Error('Quota exceeded');};fill(quota.w,'p0_name','Datos que siguen disponibles');await draftTick();assert.equal(quota.doc.getElementById('p0_name').value,'Datos que siguen disponibles');assert.ok(quota.doc.querySelector('.storage-warning'));
  const {dom,w,doc}=setup('admin.html');live.push(dom);let saved=0;
  const row={id:'NB-AAAAAAAA',created_at:Date.now(),request_type:'suppliers',client_name:'Cliente <img src=x>',contact_method:'email',contact:'cliente@example.com',destination:'Salta',status:'pending',email_status:'accepted'};
  w.fetch=async (url,init={})=>{
    if(init.method==='PATCH'){saved++;assert.equal(JSON.parse(init.body).status,'quoted');assert.equal(init.headers['X-NexBuy-Admin'],'1');return {ok:true,json:async()=>({saved:true})};}
    if(url==='/api/admin/requests/NB-AAAAAAAA')return {ok:true,json:async()=>({...row,data:{requestType:'suppliers',name:row.client_name,contactMethod:'email',email:row.contact,supplierInterest:'Perfumes <script>bad()</script>',budget:'',currency:'USD',timing:'Sin urgencia',notes:'Sin comentarios'}})};
    return {ok:true,json:async()=>({stats:{total:1,today:1,week:1,pending:1},requests:[row],filteredTotal:1,page:1,email:'juanperal05@gmail.com'})};
  };
  w.eval(readFileSync('public/admin.js','utf8'));await tick();assert.equal(doc.getElementById('stat-total').textContent,'1');assert.equal(doc.querySelector('#requests-list img'),null);
  doc.querySelector('[data-detail]').click();await tick();assert.match(doc.getElementById('request-detail').textContent,/Perfumes <script>/);assert.equal(doc.querySelector('#request-detail script'),null);
  fill(w,'request-status','quoted');submit(w,'status-form');await tick();assert.equal(saved,1);assert.match(doc.getElementById('save-message').textContent,/Estado guardado/);
  const login=setup('admin-login.html');live.push(login.dom);let loginCalls=0;
  login.w.fetch=async(url,init)=>{assert.equal(url,'/api/admin/login');loginCalls++;const body=JSON.parse(init.body);assert.equal(body.username,'admin@example.com');assert.equal(body.password,'wrong');return {ok:false,json:async()=>({error:'Usuario o contraseña incorrectos.'})};};
  login.w.eval(readFileSync('public/admin-login.js','utf8'));fill(login.w,'username','admin@example.com');fill(login.w,'password','wrong');submit(login.w,'admin-login-form');submit(login.w,'admin-login-form');await tick();assert.equal(loginCalls,1);assert.equal(login.doc.querySelector('#login-message').hidden,false);assert.match(login.doc.querySelector('#login-message').textContent,/Usuario o contraseña/);assert.equal(login.w.localStorage.length,0);
  console.log('PASS: intake flows and email, consent, double-click protection, draft reload/step/details/contact/reset/success cleanup, blocked/corrupt storage, private dashboard, escaped customer content.');
}finally{for(const dom of live)dom.window.close();}

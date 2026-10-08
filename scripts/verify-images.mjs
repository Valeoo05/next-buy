import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {JSDOM} from 'jsdom';
const require=createRequire(import.meta.url);
const sharp=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/sharp');
const origin='https://nexbuy-importaciones.juanperal05.chatgpt.site';
const dom=new JSDOM(readFileSync('public/index.html','utf8'),{url:origin,runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window,doc=w.document,objects=new Map(),draws=[];
const FileList=require('jsdom/lib/generated/idl/FileList.js'),{implForWrapper}=require('jsdom/lib/generated/idl/utils.js');
w.DataTransfer=class{constructor(){this.files=FileList.create(w);this.items={add:file=>implForWrapper(this.files).push(implForWrapper(file))};}};
w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};w.HTMLElement.prototype.scrollIntoView=function(){};
w.URL.createObjectURL=blob=>{const key='blob:test-'+objects.size;objects.set(key,blob);return key;};w.URL.revokeObjectURL=key=>objects.delete(key);
const read=blob=>new Promise((resolve,reject)=>{const reader=new w.FileReader();reader.onload=()=>resolve(Buffer.from(reader.result));reader.onerror=reject;reader.readAsArrayBuffer(blob);});
w.Image=class{set src(url){read(objects.get(url)).then(async buffer=>{const m=await sharp(buffer).metadata();this.buffer=buffer;this.naturalWidth=m.width;this.naturalHeight=m.height;this.onload();}).catch(()=>this.onerror());}};
// JSDOM has no raster canvas. Use a real JPEG codec for the canvas output and
// record the browser API's requested dimensions; UI behavior remains real DOM.
w.HTMLCanvasElement.prototype.getContext=function(){const canvas=this;return {fillRect(){},drawImage(source,x,y,width,height){canvas.buffer=source.buffer;draws.push({width,height});}};};
w.HTMLCanvasElement.prototype.toBlob=function(callback,type,quality){sharp(this.buffer).resize(this.width,this.height).flatten({background:'#fff'}).jpeg({quality:Math.round(quality*100)}).toBuffer().then(buffer=>callback(new w.Blob([buffer],{type})));};
const tiny=await sharp({create:{width:240,height:120,channels:3,background:'#c7efad'}}).jpeg().toBuffer();
w.HTMLCanvasElement.prototype.toDataURL=function(){return 'data:image/jpeg;base64,'+tiny.toString('base64');};
w.eval(readFileSync('public/attachments.js','utf8'));
const images=w.NexBuyImages;
try{
  await assert.rejects(images.prepare(new w.File(['bad'],'bad.gif',{type:'image/gif'})),/Formato no válido/);
  await assert.rejects(images.prepare(new w.File([new Uint8Array(16*1024*1024)],'large.png',{type:'image/png'})),/15 MB/);
  await assert.rejects(images.prepare(new w.File(['not-an-image'],'bad.png',{type:'image/png'})),/No pudimos abrir/);
  const all=[];
  for(const format of ['jpeg','png','webp']){const buffer=await sharp({create:{width:4000,height:2000,channels:3,background:'#537d9d'}})[format]().toBuffer();const prepared=await images.prepare(new w.File([buffer],'producto.'+format,{type:'image/'+format}));assert.equal(prepared.width,1600);assert.equal(prepared.height,800);assert.ok(prepared.size<=1024*1024);assert.equal(prepared.persisted,false);assert.ok(images.safePreview(prepared.preview));all.push(prepared);const [file]=await images.files([prepared]);const metadata=await sharp(await read(file)).metadata();assert.equal(metadata.width,1600);assert.equal(metadata.height,800);assert.equal(metadata.format,'jpeg');}
  assert.equal((await images.files(all)).length,3);await assert.rejects(images.files([...all,all[0]]),/hasta 3/);assert.ok(draws.some(d=>d.width===1600&&d.height===800));assert.ok(draws.some(d=>d.width===240&&d.height===120));
  let handoff;
  w.HTMLFormElement.prototype.submit=function(){handoff=new w.FormData(this);assert.equal(this.enctype,'multipart/form-data');};
  w.fetch=async(url,init={})=>{if(url==='/api/form-token')return {ok:true,json:async()=>({token:'test-token'})};assert.equal(url,'/api/requests');const body=JSON.parse(init.body);assert.equal(body.data.images.length,1);assert.equal(body.data.images[0].preview,undefined);return {ok:true,json:async()=>({id:body.id,createdAt:new Date().toISOString(),registered:true,status:'registered_email_pending',deliveryRequired:true,emailPayload:{Solicitud:body.id,_next:origin+'/?enviada='+body.id+'#receipt='+'a'.repeat(72)}})};};
  w.eval(readFileSync('public/email-delivery.js','utf8'));w.eval(readFileSync('public/app.js','utf8'));
  const fill=(id,value)=>{doc.getElementById(id).value=value;doc.getElementById(id).dispatchEvent(new w.Event('input',{bubbles:true}));};
  fill('p0_name','Producto por foto');w.document.querySelector('[data-category="Tecnología"]').click();
  const upload=doc.getElementById('product-images');const small=new w.File([await sharp({create:{width:100,height:60,channels:3,background:'#abc'}}).png().toBuffer()],'foto.png',{type:'image/png'});Object.defineProperty(upload,'files',{value:[small]});upload.dispatchEvent(new w.Event('change',{bubbles:true}));
  const until=async test=>{for(let n=0;n<100;n++){if(test())return;await new Promise(r=>setTimeout(r,10));}throw Error('Image UI did not settle');};
  await until(()=>doc.querySelector('.image-gallery img')&&!doc.getElementById('product-images').disabled);assert.match(doc.getElementById('image-message').textContent,/volver a subirlas/);
  const paste=new w.Event('paste',{bubbles:true,cancelable:true});Object.defineProperty(paste,'clipboardData',{value:{items:[{kind:'file',getAsFile:()=>small}]}});doc.getElementById('quote-form').dispatchEvent(paste);assert.equal(paste.defaultPrevented,true);await until(()=>doc.querySelectorAll('.image-gallery img').length===2&&!doc.getElementById('product-images').disabled);
  doc.querySelector('[data-remove-image]').click();assert.equal(doc.querySelectorAll('.image-gallery img').length,1);await new Promise(r=>setTimeout(r,300));const snapshot=JSON.parse(w.localStorage.getItem('nexbuy.draft.v1'));assert.equal(snapshot.data.images.length,1);
  doc.getElementById('quote-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));fill('name','Persona prueba');fill('phone','+54 9 299 655 0378');fill('city','Neuquén');fill('region','Neuquén');doc.getElementById('quote-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));assert.ok(doc.getElementById('consent'));assert.equal(doc.querySelectorAll('.image-gallery img').length,1);
  doc.getElementById('consent').checked=true;doc.getElementById('quote-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await until(()=>handoff);const sentFile=handoff.get('attachment');assert.equal(sentFile.type,'image/jpeg');assert.ok(sentFile.size>0);assert.equal((await sharp(await read(sentFile)).metadata()).width,100);assert.equal(handoff.get('_captcha'),'false');
  const local={id:'NB-AAAAFFFF',createdAt:new Date().toISOString(),status:'registered_email_pending',data:snapshot.data};w.localStorage.setItem('nexbuy.requests.v1',JSON.stringify([local]));
  const reload=new JSDOM(readFileSync('public/index.html','utf8'),{url:origin,runScripts:'outside-only'});reload.window.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};reload.window.HTMLElement.prototype.scrollIntoView=function(){};reload.window.localStorage.setItem('nexbuy.draft.v1',JSON.stringify(snapshot));reload.window.localStorage.setItem('nexbuy.requests.v1',JSON.stringify([local]));reload.window.eval(readFileSync('public/attachments.js','utf8'));reload.window.eval(readFileSync('public/app.js','utf8'));await new Promise(r=>setTimeout(r,20));assert.match(reload.window.document.body.textContent,/volver a subir/);reload.window.document.getElementById('open-requests').click();assert.ok(reload.window.document.querySelector('#dialog-content .image-gallery img'));reload.window.close();
  console.log('PASS: JPG/PNG/WebP decoding, 1600 px resizing, actual JPEG output, size and count limits, invalid image errors, upload/paste/remove/review/history, missing-storage warning.');
}finally{dom.window.close();}

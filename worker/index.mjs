// Private admin authentication is checked on every server request.
import { assets } from './assets.mjs';
import initialStock from './catalog-import.json';
const ORIGIN = 'https://nexbuy-importaciones.juanperal05.chatgpt.site';
const EMAIL = 'juanperal05@gmail.com';
const COOKIE = '__Host-nexbuy-form';
const TYPES = {personal:'Compra personal', wholesale:'Compra mayorista', suppliers:'Acceso a proveedores'};
const STATES = ['pending','quoted','accepted','closed'];
const CATEGORIES = ['Tecnología','Perfumería','Moda y accesorios','Hogar','Deporte','Otros'];
const json = (body,status=200,headers={}) => new Response(JSON.stringify(body), {status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',...headers}});
function db(env){if(!env.DB)throw new Error('Database unavailable');return env.DB;}
function media(env){if(!env.MEDIA)throw new Error('Image storage unavailable');return env.MEDIA;}
const ADMIN_COOKIE='__Host-nexbuy-admin';
const SESSION_AGE=8*60*60;
const LOGIN_WINDOW=15*60*1000;
const PASSWORD_ITERATIONS=100000;
function adminCookie(request){return (request.headers.get('Cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(ADMIN_COOKIE+'='))?.slice(ADMIN_COOKIE.length+1)||'';}
const hex=buffer=>Array.from(new Uint8Array(buffer),b=>b.toString(16).padStart(2,'0')).join('');
const unhex=value=>Uint8Array.from(value.match(/.{2}/g)||[],h=>parseInt(h,16));
const digest=async value=>hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
async function passwordHash(password,salt){
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:unhex(salt),iterations:PASSWORD_ITERATIONS},key,256));
}
function constantEqual(a,b){let diff=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)diff|=(a[i]||0)^(b[i]||0);return diff===0;}
async function adminSession(request,env){
  const value=adminCookie(request);
  if(!/^[A-Za-z0-9_-]{43}$/.test(value)||!env.ADMIN_USERNAME)return null;
  const tokenHash=await digest(value);
  const row=await db(env).prepare('SELECT token_hash FROM admin_sessions WHERE token_hash = ? AND expires_at > ?').bind(tokenHash,Date.now()).first();
  return row?{username:env.ADMIN_USERNAME,tokenHash}:null;
}
async function login(request,env){
  if(!sameOrigin(request)||!request.headers.get('Content-Type')?.startsWith('application/json')||request.headers.get('X-NexBuy-Admin')!=='1')return json({error:'No se pudo verificar el inicio de sesión.'},403);
  if(!env.ADMIN_USERNAME||!/^[a-f0-9]{64}$/.test(env.ADMIN_PASSWORD_HASH||'')||!/^[a-f0-9]{32}$/.test(env.ADMIN_PASSWORD_SALT||''))return json({error:'El acceso del administrador no está disponible.'},503);
  if(Number(request.headers.get('Content-Length')||0)>1200)return json({error:'Datos de acceso inválidos.'},400);
  const raw=await request.text();if(new TextEncoder().encode(raw).length>1200)return json({error:'Datos de acceso inválidos.'},400);
  let body;try{body=JSON.parse(raw);}catch{return json({error:'Datos de acceso inválidos.'},400);}
  if(typeof body.username!=='string'||body.username.length>150||typeof body.password!=='string'||body.password.length>256)return json({error:'Usuario o contraseña incorrectos.'},401);
  const now=Date.now(),key=await digest(env.ADMIN_PASSWORD_SALT+':'+(request.headers.get('CF-Connecting-IP')||'unknown'));
  const attempt=await db(env).prepare('INSERT INTO admin_login_attempts (key, window_start, attempts) VALUES (?, ?, 1) ON CONFLICT(key) DO UPDATE SET attempts = CASE WHEN window_start <= ? THEN 1 ELSE attempts + 1 END, window_start = CASE WHEN window_start <= ? THEN ? ELSE window_start END RETURNING attempts, window_start').bind(key,now,now-LOGIN_WINDOW,now-LOGIN_WINDOW,now).first();
  if(attempt.attempts>5)return json({error:'Demasiados intentos. Esperá 15 minutos antes de volver a ingresar.'},429,{'Retry-After':String(Math.max(1,Math.ceil((attempt.window_start+LOGIN_WINDOW-now)/1000)))});
  const candidate=await passwordHash(body.password,env.ADMIN_PASSWORD_SALT);
  const validPassword=constantEqual(candidate,unhex(env.ADMIN_PASSWORD_HASH));
  if(body.username.trim().toLowerCase()!==env.ADMIN_USERNAME.toLowerCase()||!validPassword)return json({error:'Usuario o contraseña incorrectos.'},401);
  const bytes=crypto.getRandomValues(new Uint8Array(32));
  const sessionToken=btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const tokenHash=await digest(sessionToken);
  await db(env).batch([
    db(env).prepare('DELETE FROM admin_sessions WHERE expires_at <= ?').bind(now),
    db(env).prepare('INSERT INTO admin_sessions (token_hash, expires_at) VALUES (?, ?)').bind(tokenHash,now+SESSION_AGE*1000),
    db(env).prepare('DELETE FROM admin_login_attempts WHERE key = ? OR window_start < ?').bind(key,now-86400000)
  ]);
  return json({signedIn:true},200,{'Set-Cookie':`${ADMIN_COOKIE}=${sessionToken}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${SESSION_AGE}`});
}
async function logout(request,env){
  if(!sameOrigin(request)||request.headers.get('X-NexBuy-Admin')!=='1')return json({error:'No se pudo verificar esta acción.'},403);
  const session=await adminSession(request,env);
  if(session)await db(env).prepare('DELETE FROM admin_sessions WHERE token_hash = ?').bind(session.tokenHash).run();
  return json({signedOut:true},200,{'Set-Cookie':`${ADMIN_COOKIE}=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0`});
}
function sameOrigin(request){return request.headers.get('Origin')===ORIGIN && request.headers.get('Sec-Fetch-Site')!=='cross-site';}
function cookie(request){return (request.headers.get('Cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||'';}
function text(data,key,min,max){const v=data[key];if(typeof v!=='string'||v.trim().length<min||v.length>max)throw new Error('Revisá el campo '+key+'.');return v.trim();}
function validate(input){
  if(!input||input.consent!==true||typeof input.id!=='string'||!/^NB-[A-F0-9-]{8,40}$/.test(input.id))throw new Error('Revisá y autorizá tu solicitud.');
  const d=input.data;if(!d||!Object.hasOwn(TYPES,d.requestType))throw new Error('Elegí el tipo de consulta.');
  if(d.requestType!=='personal')throw new Error('Las compras mayoristas y el acceso a proveedores se consultan por WhatsApp.');
  const out={requestType:d.requestType,name:text(d,'name',2,100),contactMethod:d.contactMethod,country:text(d,'country',2,80),city:text(d,'city',1,100),region:text(d,'region',1,100),notes:text(d,'notes',0,1500),timing:text(d,'timing',1,100),currency:d.currency,budget:text(d,'budget',0,30),products:[],supplierInterest:''};
  if(d.images!==undefined&&!Array.isArray(d.images)||d.images?.length>3)throw new Error('Podés adjuntar hasta 3 imágenes.');
  let imageBytes=0;out.images=(d.images||[]).map(image=>{if(!image||!/^[-a-f0-9]{36}$/.test(image.id||'')||!['image/jpeg','image/png','image/webp'].includes(image.type)||!Number.isInteger(image.size)||image.size<1||image.size>1024*1024||![image.width,image.height].every(n=>Number.isInteger(n)&&n>0&&n<=1600))throw new Error('Revisá las imágenes adjuntas.');imageBytes+=image.size;return {id:image.id,name:text(image,'name',1,100),type:image.type,size:image.size,width:image.width,height:image.height};});
  if(imageBytes>3*1024*1024)throw new Error('Las imágenes juntas no pueden superar 3 MB.');
  if(!['USD','ARS'].includes(out.currency)||out.budget&&(!Number.isFinite(Number(out.budget))||Number(out.budget)<=0||Number(out.budget)>1e9))throw new Error('Revisá el presupuesto.');
  if(d.contactMethod==='email'){out.email=text(d,'email',3,150);if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email))throw new Error('Revisá tu correo.');out.phone='';}
  else if(d.contactMethod==='whatsapp'){out.phone=text(d,'phone',8,30);const n=out.phone.replace(/\D/g,'');if(n.length<8||n.length>15||!/^[+\d\s()\-]+$/.test(out.phone))throw new Error('Revisá tu WhatsApp.');out.email='';}
  else throw new Error('Elegí un contacto válido.');
  if(d.requestType==='suppliers')out.supplierInterest=text(d,'supplierInterest',3,1000);
  else{
    if(!Array.isArray(d.products)||!d.products.length||d.products.length>10)throw new Error('Agregá entre 1 y 10 productos.');
    out.products=d.products.map(p=>{
      const item={name:text(p,'name',0,150),qty:String(p.qty),category:text(p,'category',1,80),link:text(p,'link',0,2000),reference:text(p,'reference',0,3000),variants:text(p,'variants',0,300),alternatives:p.alternatives===true};
      if(!Number.isInteger(Number(item.qty))||Number(item.qty)<1||Number(item.qty)>9999||!CATEGORIES.includes(item.category))throw new Error('Revisá los productos y cantidades.');
      if(!item.name&&!item.link&&!item.reference&&!out.images.length)throw new Error('Agregá un nombre, un enlace, una referencia o una imagen.');
      if(item.link){let u;try{u=new URL(item.link);}catch{throw new Error('Revisá el enlace.');}if(!['http:','https:'].includes(u.protocol)||!u.hostname.includes('.'))throw new Error('Revisá el enlace.');}
      item.name ||= item.link||item.reference?'Producto de la referencia':'Producto de las imágenes';return item;
    });
  }
  return out;
}
function summary(id,d){return `NEXBUY IMPORTACIONES\nSolicitud: ${id}\nTipo: ${TYPES[d.requestType]}\n\n${d.requestType==='suppliers'?'INTERÉS EN PROVEEDORES\n'+d.supplierInterest:'PRODUCTOS\n'+d.products.map((p,i)=>`${i+1}. ${p.name}\nCantidad: ${p.qty}\nCategoría: ${p.category}\nEnlace: ${p.link||'Sin enlace'}\nReferencia: ${p.reference||'Sin referencia'}\nVersión: ${p.variants||'Sin especificar'}\nAcepta alternativas: ${p.alternatives?'Sí':'No'}`).join('\n\n')}\n\nNombre: ${d.name}\nContacto: ${d.contactMethod==='email'?d.email:d.phone}\nDestino: ${d.city}, ${d.region}, ${d.country}\nPresupuesto: ${d.budget?d.budget+' '+d.currency:'Sin definir'}\nPlazo deseado: ${d.timing}\nComentarios: ${d.notes||'Sin comentarios'}\n\nResponder en las próximas 24 horas. Consulta sin compromiso de compra.`;}
function mailPayload(id,d){
  const body={name:d.name,Solicitud:id,Tipo_de_consulta:TYPES[d.requestType],Contacto_preferido:d.contactMethod==='email'?'Email':'WhatsApp',Contacto:d.contactMethod==='email'?d.email:d.phone,Destino:`${d.city}, ${d.region}, ${d.country}`,message:summary(id,d),_subject:`NexBuy | Nueva solicitud ${id} | ${d.name.replace(/[\r\n]/g,' ').slice(0,100)}`,_template:'table',_url:ORIGIN};
  if(d.contactMethod==='email')body.email=d.email;
  return body;
}
function submissionResult(row){return {id:row.id,createdAt:new Date(row.created_at).toISOString(),registered:true,status:row.email_status==='accepted'?'received_by_email_service':'registered_email_pending'};}
async function token(request,env){
  const existing=cookie(request),now=Date.now();
  if(/^[a-f0-9-]{36}$/.test(existing)){
    const found=await db(env).prepare('SELECT id FROM form_tokens WHERE id = ? AND created_at > ? AND consumed_by IS NULL').bind(existing,now-1800000).first();
    if(found)return json({token:existing});
  }
  const id=crypto.randomUUID();
  await db(env).batch([db(env).prepare('DELETE FROM form_tokens WHERE created_at < ?').bind(now-86400000),db(env).prepare('INSERT INTO form_tokens (id, created_at) VALUES (?, ?)').bind(id,now)]);
  return json({token:id},200,{'Set-Cookie':`${COOKIE}=${id}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=1800`});
}
async function submit(request,env){
  if(!sameOrigin(request)||!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'Recargá el formulario para enviar tu solicitud.'},403);
  if(Number(request.headers.get('Content-Length')||0)>32000)return json({error:'La solicitud es demasiado extensa.'},413);
  const raw=await request.text();if(new TextEncoder().encode(raw).length>32000)return json({error:'La solicitud es demasiado extensa.'},413);
  let input,d;try{input=JSON.parse(raw);d=validate(input);}catch(e){return json({error:e.message||'Revisá tu solicitud.'},400);}
  const key=request.headers.get('X-NexBuy-Form')||'';
  if(!/^[a-f0-9-]{36}$/.test(key)||cookie(request)!==key)return json({error:'Recargá el formulario antes de enviar.'},403);
  const existing=await db(env).prepare('SELECT id, created_at, email_status, form_key FROM requests WHERE id = ?').bind(input.id).first();
  if(existing)return existing.form_key===key?json(submissionResult(existing)):json({error:'Prepará una nueva solicitud.'},409);
  const valid=await db(env).prepare('SELECT id FROM form_tokens WHERE id = ? AND created_at > ? AND consumed_by IS NULL').bind(key,Date.now()-1800000).first();
  if(!valid)return json({error:'Tu sesión de envío venció. Volvé a pulsar Enviar solicitud.'},409);
  const now=Date.now(),contact=d.contactMethod==='email'?d.email:d.phone,receipt=crypto.randomUUID()+crypto.randomUUID(),returnHash=await digest(receipt);
  try{
    await db(env).batch([
      db(env).prepare('INSERT INTO requests (id, created_at, request_type, client_name, contact_method, contact, destination, status, email_status, payload, form_key, email_return_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(input.id,now,d.requestType,d.name,d.contactMethod,contact,`${d.city}, ${d.region}, ${d.country}`,'pending','sending',JSON.stringify(d),key,returnHash),
      db(env).prepare('UPDATE form_tokens SET consumed_by = ? WHERE id = ? AND consumed_by IS NULL').bind(input.id,key)
    ]);
  }catch(e){
    const duplicate=await db(env).prepare('SELECT id, created_at, email_status, form_key FROM requests WHERE id = ?').bind(input.id).first();
    if(duplicate&&duplicate.form_key===key)return json(submissionResult(duplicate));
    console.error('request_save_failed');return json({error:'No pudimos registrar la consulta. Conservamos tu borrador; intentá nuevamente.'},503);
  }
  // Only the first successful registration grants an email attempt. Replays never resend.
  return json({...submissionResult({id:input.id,created_at:now,email_status:'sending'}),deliveryRequired:true,emailPayload:{...mailPayload(input.id,d),Imagenes_adjuntas:String(d.images.length),_next:ORIGIN+'/?enviada='+encodeURIComponent(input.id)+'#receipt='+receipt}},201);
}
async function emailReturn(request,env){
  if(!sameOrigin(request)||!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'No se pudo confirmar el envío.'},403);
  const raw=await request.text();if(raw.length>500)return json({error:'Regreso de envío inválido.'},400);let body;try{body=JSON.parse(raw);}catch{return json({error:'Regreso de envío inválido.'},400);}
  if(!/^NB-[A-F0-9-]{8,40}$/.test(body?.id||'')||!/^[-a-f0-9]{72}$/.test(body?.receipt||''))return json({error:'Regreso de envío inválido.'},400);
  const row=await db(env).prepare('SELECT id, created_at, email_status, email_return_hash, payload FROM requests WHERE id = ?').bind(body.id).first();
  if(!row||!row.email_return_hash||row.created_at<Date.now()-6*3600000||!constantEqual(unhex(await digest(body.receipt)),unhex(row.email_return_hash)))return json({error:'No se pudo verificar la confirmación de FormSubmit. Tu consulta sigue registrada.'},403);
  await db(env).prepare('UPDATE requests SET email_status = ? WHERE id = ? AND email_status = ?').bind('accepted',body.id,'sending').run();
  const current=await db(env).prepare('SELECT id, created_at, email_status FROM requests WHERE id = ?').bind(body.id).first();return json({...submissionResult(current),data:JSON.parse(row.payload)});
}
async function reportDelivery(request,env,id){
  if(!sameOrigin(request)||!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'Acción no disponible.'},403);
  const key=request.headers.get('X-NexBuy-Form')||'';
  if(!/^[a-f0-9-]{36}$/.test(key)||cookie(request)!==key)return json({error:'Acción no disponible.'},403);
  const raw=await request.text();if(raw.length>200)return json({error:'Acción inválida.'},413);
  let body;try{body=JSON.parse(raw);}catch{return json({error:'Acción inválida.'},400);}
  if(!['accepted','failed','unconfirmed','activation'].includes(body.emailStatus))return json({error:'Estado inválido.'},400);
  const row=await db(env).prepare('SELECT id, created_at, email_status, form_key FROM requests WHERE id = ?').bind(id).first();
  if(!row||row.form_key!==key)return json({error:'Acción no disponible.'},403);
  // Only finalize the attempt once; a replay cannot overwrite the recorded outcome.
  await db(env).prepare('UPDATE requests SET email_status = ? WHERE id = ? AND form_key = ? AND email_status = ?').bind(body.emailStatus,id,key,'sending').run();
  const current=await db(env).prepare('SELECT id, created_at, email_status FROM requests WHERE id = ?').bind(id).first();
  return json(submissionResult(current));
}

async function admin(request,env,url){
  const session=await adminSession(request,env);
  if(!session)return json({error:'Ingresá con tu usuario y contraseña para acceder al registro.'},401);
  if(url.pathname.startsWith('/api/admin/stock'))return await manageStock(request,env,url);
  if(url.pathname==='/api/admin/requests'&&request.method==='GET'){
    const now=Date.now(),today=Math.floor((now-10800000)/86400000)*86400000+10800000;
    const stats=await db(env).prepare('SELECT COUNT(*) AS total, COALESCE(SUM(created_at >= ?),0) AS today, COALESCE(SUM(created_at >= ?),0) AS week, COALESCE(SUM(status = ?),0) AS pending, COALESCE(SUM(request_type = ?),0) AS wholesale, COALESCE(SUM(request_type = ?),0) AS suppliers FROM requests').bind(today,now-7*86400000,'pending','wholesale','suppliers').first();
    const page=Math.max(1,Math.min(10000,Math.floor(Number(url.searchParams.get('page')))||1)),status=url.searchParams.get('status')||'',type=url.searchParams.get('type')||'';
    if(status&&!STATES.includes(status)||type&&!Object.hasOwn(TYPES,type))return json({error:'Filtro inválido.'},400);
    const where=[],params=[];
    if(status){where.push('status = ?');params.push(status);}if(type){where.push('request_type = ?');params.push(type);}
    const search=(url.searchParams.get('q')||'').slice(0,100).trim();
    if(search){where.push('(client_name LIKE ? ESCAPE \'\\\' OR id LIKE ? ESCAPE \'\\\' OR contact LIKE ? ESCAPE \'\\\')');const pattern='%'+search.replace(/[\\%_]/g,'\\$&')+'%';params.push(pattern,pattern,pattern);}
    const clause=where.length?' WHERE '+where.join(' AND '):'';
    const count=await db(env).prepare('SELECT COUNT(*) AS total FROM requests'+clause).bind(...params).first();
    const result=await db(env).prepare('SELECT id, created_at, request_type, client_name, contact_method, contact, destination, status, email_status FROM requests'+clause+' ORDER BY created_at DESC, id DESC LIMIT 50 OFFSET ?').bind(...params,(page-1)*50).all();
    return json({stats,requests:result.results||[],filteredTotal:count.total,page,email:session.username});
  }
  const match=url.pathname.match(/^\/api\/admin\/requests\/(NB-[A-F0-9-]{8,40})$/);
  if(match&&request.method==='GET'){
    const row=await db(env).prepare('SELECT id, created_at, request_type, client_name, contact_method, contact, destination, status, email_status, payload FROM requests WHERE id = ?').bind(match[1]).first();
    if(!row)return json({error:'Solicitud no encontrada.'},404);
    row.data=JSON.parse(row.payload);delete row.payload;return json(row);
  }
  if(match&&request.method==='PATCH'){
    if(!sameOrigin(request)||request.headers.get('X-NexBuy-Admin')!=='1')return json({error:'No se pudo verificar esta acción.'},403);
    if(Number(request.headers.get('Content-Length')||0)>200)return json({error:'Acción inválida.'},413);
    let body;try{const raw=await request.text();if(raw.length>200)throw Error();body=JSON.parse(raw);}catch{return json({error:'Acción inválida.'},400);}
    if(!STATES.includes(body.status))return json({error:'Estado inválido.'},400);
    const result=await db(env).prepare('UPDATE requests SET status = ? WHERE id = ?').bind(body.status,match[1]).run();
    return result.meta?.changes?json({saved:true}):json({error:'Solicitud no encontrada.'},404);
  }
  return json({error:'Ruta no disponible.'},404);
}
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const STOCK_CATEGORIES=['Tecnología','Perfumería','Stanley y termos','Moda','Hogar','Deporte','Otros'];
function stockDetails(value){
  if(!Array.isArray(value)||value.length>4)throw Error('La ficha breve admite hasta cuatro características.');
  return value.map(detail=>({label:text(detail,'label',1,40),value:text(detail,'value',1,120)}));
}
function stockView(row){
  let gallery=[];try{gallery=JSON.parse(row.gallery||'[]');}catch{}
  gallery=Array.isArray(gallery)?gallery.filter(p=>typeof p==='string'&&p.startsWith('/assets/stock/')&&assets[p]).slice(0,3):[];
  const photoUrl=row.photo_id?'/stock-images/'+row.photo_id:gallery[0]||null;
  const photos=row.photo_id?[photoUrl,...gallery.slice(1)]:gallery;
  let details=[];try{details=stockDetails(row.details===null?initialStock.find(item=>item.id===row.id&&item.name===row.name)?.details||[]:JSON.parse(row.details||'[]'));}catch{}
  return {id:row.id,name:row.name,category:row.category,description:row.description,details,price:row.price_cents/100,quantity:row.quantity,quantityKnown:row.quantity_known!==0,delivery:row.delivery,visible:Boolean(row.visible),photoId:row.photo_id,photoUrl,gallery,photos,createdAt:row.created_at,updatedAt:row.updated_at};
}
// Explicit owner-approved catalog data is imported separately from schema migrations.
// INSERT OR IGNORE keeps later edits, prices and hidden states authoritative in D1.
async function importInitialStock(env){
  for(const item of initialStock){
    if(await db(env).prepare('SELECT id FROM stock_products WHERE id = ?').bind(item.id).first())continue;
    const now=Date.now();
    await db(env).prepare('INSERT OR IGNORE INTO stock_products (id, name, category, description, details, price_cents, quantity, delivery, visible, photo_id, gallery, quantity_known, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(item.id,item.name,item.category,item.description,JSON.stringify(item.details||[]),item.priceCents,item.quantity,item.delivery,1,null,JSON.stringify(item.gallery),item.quantityKnown?1:0,now,now).run();
  }
}
async function publicStock(env){
  await importInitialStock(env);
  const result=await db(env).prepare('SELECT * FROM stock_products WHERE visible = 1 ORDER BY created_at DESC, id DESC LIMIT 500').all();
  return json({products:(result.results||[]).map(stockView)});
}
async function manageStock(request,env,url){
  if(url.pathname==='/api/admin/stock'&&request.method==='GET'){
    await importInitialStock(env);
    const result=await db(env).prepare('SELECT * FROM stock_products ORDER BY created_at DESC, id DESC LIMIT 500').all();return json({products:(result.results||[]).map(stockView)});
  }
  if(!sameOrigin(request)||request.headers.get('X-NexBuy-Admin')!=='1')return json({error:'No se pudo verificar esta acción.'},403);
  if(url.pathname==='/api/admin/stock-images'&&request.method==='POST'){
    const type=(request.headers.get('Content-Type')||'').split(';')[0];
    if(!['image/jpeg','image/png','image/webp'].includes(type))return json({error:'Usá una imagen JPG, PNG o WebP.'},400);
    if(Number(request.headers.get('Content-Length')||0)>1024*1024)return json({error:'La imagen comprimida supera 1 MB.'},413);
    const bytes=new Uint8Array(await request.arrayBuffer());
    if(!bytes.length||bytes.length>1024*1024)return json({error:'La imagen comprimida debe pesar entre 1 byte y 1 MB.'},413);
    const matches=type==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:type==='image/png'?[137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b):String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
    if(!matches)return json({error:'La imagen no corresponde a un JPG, PNG o WebP válido.'},400);
    const id=crypto.randomUUID(),key='stock/'+id;
    await media(env).put(key,bytes,{httpMetadata:{contentType:type}});
    try{await db(env).prepare('INSERT INTO stock_images (id, object_key, content_type, size, created_at) VALUES (?, ?, ?, ?, ?)').bind(id,key,type,bytes.length,Date.now()).run();}catch(e){await media(env).delete(key);throw e;}
    return json({id,url:'/stock-images/'+id},201);
  }
  const match=url.pathname.match(/^\/api\/admin\/stock\/([a-f0-9-]{36})$/);
  if(!(url.pathname==='/api/admin/stock'&&request.method==='POST')&&!(match&&UUID.test(match[1])&&request.method==='PUT'))return json({error:'Acción no disponible.'},404);
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'Datos del producto inválidos.'},400);
  if(Number(request.headers.get('Content-Length')||0)>10000)return json({error:'La ficha es demasiado extensa.'},413);
  const raw=await request.text();if(new TextEncoder().encode(raw).length>10000)return json({error:'La ficha es demasiado extensa.'},413);
  let input;try{input=JSON.parse(raw);}catch{return json({error:'Datos del producto inválidos.'},400);}
  const previous=match?await db(env).prepare('SELECT * FROM stock_products WHERE id = ?').bind(match[1]).first():null;
  let item;try{
    item={id:match?match[1]:text(input,'id',36,36),name:text(input,'name',2,120),category:text(input,'category',1,40),description:text(input,'description',0,400),delivery:text(input,'delivery',0,150),price:Number(input.price),quantity:input.quantity,visible:input.visible,photoId:input.photoId||null,gallery:input.gallery??(previous?JSON.parse(previous.gallery||'[]'):[]),quantityKnown:input.quantityKnown??(previous?previous.quantity_known!==0:true)};
    item.details=stockDetails(input.details??(previous?stockView(previous).details:[]));
    if(!UUID.test(item.id)||!STOCK_CATEGORIES.includes(item.category)||typeof input.price!=='number'||!Number.isFinite(item.price)||Math.round(item.price*100)<1||item.price>1e9||!Number.isInteger(item.quantity)||item.quantity<0||item.quantity>9999||typeof item.visible!=='boolean'||item.photoId&&!UUID.test(item.photoId))throw Error('Revisá el precio, la cantidad y la categoría.');
    if(typeof item.quantityKnown!=='boolean'||!Array.isArray(item.gallery)||item.gallery.length>3||item.gallery.some(p=>typeof p!=='string'||!p.startsWith('/assets/stock/')||!assets[p]||!/^image\//.test(assets[p].type)))throw Error('Revisá las imágenes de la ficha.');
    if(item.photoId&&!await db(env).prepare('SELECT id FROM stock_images WHERE id = ?').bind(item.photoId).first())throw Error('Volvé a cargar la foto del producto.');
  }catch(e){return json({error:e.message||'Revisá los datos del producto.'},400);}
  const now=Date.now(),existing=await db(env).prepare('SELECT * FROM stock_products WHERE id = ?').bind(item.id).first();
  if(match){
    if(!existing)return json({error:'Producto no encontrado. Actualizá el listado.'},404);
    if(input.updatedAt!==existing.updated_at)return json({error:'La ficha cambió desde que la abriste. Actualizá el listado y volvé a editarla.'},409);
    const result=await db(env).prepare('UPDATE stock_products SET name = ?, category = ?, description = ?, details = ?, price_cents = ?, quantity = ?, delivery = ?, visible = ?, photo_id = ?, gallery = ?, quantity_known = ?, updated_at = ? WHERE id = ? AND updated_at = ?').bind(item.name,item.category,item.description,JSON.stringify(item.details),Math.round(item.price*100),item.quantity,item.delivery,item.visible?1:0,item.photoId,JSON.stringify(item.gallery),item.quantityKnown?1:0,Math.max(now,existing.updated_at+1),item.id,existing.updated_at).run();
    if(!result.meta?.changes)return json({error:'La ficha cambió. Actualizá el listado antes de volver a guardar.'},409);
  }else if(existing){
    if(existing.name!==item.name||existing.category!==item.category||existing.description!==item.description||JSON.stringify(stockView(existing).details)!==JSON.stringify(item.details)||existing.price_cents!==Math.round(item.price*100)||existing.quantity!==item.quantity||existing.delivery!==item.delivery||Boolean(existing.visible)!==item.visible||existing.photo_id!==item.photoId||existing.gallery!==JSON.stringify(item.gallery)||Boolean(existing.quantity_known)!==item.quantityKnown)return json({error:'Esta ficha ya fue guardada. Actualizá el listado y usá Editar para cambiarla.'},409);
    return json({product:stockView(existing),saved:true});
  }
  else{
    const count=await db(env).prepare('SELECT COUNT(*) AS total FROM stock_products').first();if(count.total>=500)return json({error:'El catálogo admite hasta 500 fichas. Contactá a NexBuy antes de agregar más.'},409);
    await db(env).prepare('INSERT INTO stock_products (id, name, category, description, details, price_cents, quantity, delivery, visible, photo_id, gallery, quantity_known, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(item.id,item.name,item.category,item.description,JSON.stringify(item.details),Math.round(item.price*100),item.quantity,item.delivery,item.visible?1:0,item.photoId,JSON.stringify(item.gallery),item.quantityKnown?1:0,now,now).run();
  }
  const row=await db(env).prepare('SELECT * FROM stock_products WHERE id = ?').bind(item.id).first();return json({product:stockView(row),saved:true},match?200:201);
}
async function stockImage(request,env,id){
  const linked=await db(env).prepare('SELECT id FROM stock_products WHERE photo_id = ? AND visible = 1 LIMIT 1').bind(id).first();
  if(!linked&&!await adminSession(request,env))return new Response('Imagen no disponible',{status:404});
  const row=await db(env).prepare('SELECT * FROM stock_images WHERE id = ?').bind(id).first();if(!row)return new Response('Imagen no encontrada',{status:404});
  const object=await media(env).get(row.object_key);if(!object)return new Response('Imagen no disponible',{status:404});
  return new Response(request.method==='HEAD'?null:object.body,{headers:{'Content-Type':row.content_type,'Content-Length':String(row.size),'Cache-Control':'private, no-cache','X-Content-Type-Options':'nosniff'}});
}
function asset(path,privatePage=false){
  const item=assets[path];if(!item)return new Response('Página no encontrada',{status:404});
  const bytes=Uint8Array.from(atob(item.body),c=>c.charCodeAt(0));
  return new Response(bytes,{headers:{'Content-Type':item.type,'Cache-Control':privatePage?'private, no-store':item.type.includes('text/html')?'no-cache':'public, max-age=300','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin',...(privatePage?{'X-Robots-Tag':'noindex','Vary':'Cookie'}:{})}});
}
export default {async fetch(request,env,ctx){
  const url=new URL(request.url);
  try{
    if(url.pathname==='/api/admin/login'&&request.method==='POST')return await login(request,env);
    if(url.pathname==='/api/admin/logout'&&request.method==='POST')return await logout(request,env);
    if(url.pathname.startsWith('/api/admin/'))return await admin(request,env,url);
    if(url.pathname==='/api/stock'&&request.method==='GET')return await publicStock(env);
    if(url.pathname==='/api/form-token'&&request.method==='GET')return await token(request,env);
    if(url.pathname==='/api/requests'&&request.method==='POST')return await submit(request,env);
    if(url.pathname==='/api/email-return'&&request.method==='POST')return await emailReturn(request,env);
    const delivery=url.pathname.match(/^\/api\/requests\/(NB-[A-F0-9-]{8,40})\/delivery$/);
    if(delivery&&request.method==='POST')return await reportDelivery(request,env,delivery[1]);
    if(url.pathname==='/admin/'||url.pathname==='/admin.html'||url.pathname==='/admin-login.html')return new Response(null,{status:308,headers:{Location:'/admin','Cache-Control':'private, no-store'}});
    if(url.pathname==='/admin'){
      if(!['GET','HEAD'].includes(request.method))return json({error:'Método no disponible.'},405);
      const session=await adminSession(request,env);
      return asset(session?'/admin.html':'/admin-login.html',true);
    }
    if(url.pathname==='/admin/stock'||url.pathname==='/admin-stock.html'){
      if(!['GET','HEAD'].includes(request.method))return json({error:'Método no disponible.'},405);
      if(!await adminSession(request,env))return new Response(null,{status:303,headers:{Location:'/admin?next=stock','Cache-Control':'private, no-store','X-Robots-Tag':'noindex'}});
      return asset('/admin-stock.html',true);
    }
    if(!['GET','HEAD'].includes(request.method))return json({error:'Método no disponible.'},405);
    const image=url.pathname.match(/^\/stock-images\/([a-f0-9-]{36})$/);if(image&&UUID.test(image[1]))return await stockImage(request,env,image[1]);
    if(url.pathname==='/stock/'||url.pathname==='/stock.html')return new Response(null,{status:308,headers:{Location:'/stock'}});
    if(url.pathname==='/stock')return asset('/stock.html');
    if(url.pathname.startsWith('/api/'))return json({error:'Ruta no disponible.'},404);
    return asset(url.pathname==='/'?'/index.html':url.pathname);
  }catch(e){console.error('nexbuy_request_failed',e?.message);return json({error:'El registro no está disponible en este momento. Tus datos se conservan para volver a intentar.'},503);}
}};

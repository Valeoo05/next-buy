'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const typeNames={personal:'Compra personal',wholesale:'Compra mayorista',suppliers:'Acceso a proveedores'};
const stateNames={pending:'Pendiente',quoted:'Cotizada',accepted:'Aceptada',closed:'Cerrada'};
const mailNames={sending:'Pendiente de confirmación',accepted:'Aceptado por el servicio',failed:'Correo no enviado',unconfirmed:'Envío sin confirmar',activation:'Activación pendiente'};
const dialog=document.querySelector('#request-dialog');
let page=1,activeId='',loading=false;
const date=v=>new Date(v).toLocaleString('es-AR',{timeZone:'America/Argentina/Salta',dateStyle:'short',timeStyle:'short'});
function message(text,error=false){const el=document.querySelector('#admin-message');el.textContent=text;el.className=error?'admin-message error-summary':'admin-message';el.hidden=!text;}
async function api(path,options={}){
  const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...options});
  const result=await response.json();
  if(!response.ok){const error=new Error(result.error||'No pudimos cargar el registro.');error.signInRequired=response.status===401;throw error;}
  return result;
}
async function load(){
  if(loading)return;loading=true;document.querySelector('#refresh').disabled=true;document.querySelector('#requests-list').setAttribute('aria-busy','true');
  try{
    const params=new URLSearchParams(new FormData(document.querySelector('#filters')));params.set('page',String(page));
    const result=await api('/api/admin/requests?'+params);
    message('');for(const key of ['total','today','week','pending'])document.querySelector('#stat-'+key).textContent=Number(result.stats[key]).toLocaleString('es-AR');
    document.querySelector('#account').textContent='Acceso exclusivo de '+result.email;
    document.querySelector('#requests-list').innerHTML=result.requests.length?result.requests.map(r=>`<tr><td><strong class="request-id">${esc(r.id)}</strong><small>${esc(date(r.created_at))}</small></td><td><strong>${esc(r.client_name)}</strong><small>${esc(r.contact)}</small><small>${esc(r.destination)}</small></td><td>${esc(typeNames[r.request_type])}</td><td><span class="admin-state ${esc(r.status)}">${esc(stateNames[r.status])}</span></td><td><span class="mail-state ${r.email_status==='accepted'?'':'mail-warning'}">${esc(mailNames[r.email_status])}</span></td><td><button class="button button-outline detail-button" data-detail="${esc(r.id)}">Ver</button></td></tr>`).join(''):'<tr><td colspan="6"><div class="admin-empty"><strong>No hay solicitudes para mostrar.</strong><p>Las nuevas consultas aparecerán aquí al enviarse desde el formulario. Si aplicaste filtros, probá cambiarlos.</p></div></td></tr>';
    document.querySelectorAll('[data-detail]').forEach(b=>b.onclick=()=>detail(b.dataset.detail));
    document.querySelector('#result-count').textContent=`${result.filteredTotal} solicitudes · Página ${page} de ${Math.max(1,Math.ceil(result.filteredTotal/50))}`;
    document.querySelector('#prev-page').disabled=page<=1;document.querySelector('#next-page').disabled=page*50>=result.filteredTotal;
  }catch(error){message(error.message,true);if(error.signInRequired){const link=document.createElement('a');link.href='/admin';link.target='_top';link.textContent='Volver a ingresar';link.className='button button-outline';document.querySelector('#admin-message').append(' ',link);}document.querySelector('#requests-list').innerHTML='<tr><td colspan="6">No pudimos cargar el listado. Pulsá Actualizar para intentar nuevamente.</td></tr>';}
  finally{loading=false;document.querySelector('#refresh').disabled=false;document.querySelector('#requests-list').removeAttribute('aria-busy');}
}
async function detail(id){
  activeId=id;document.querySelector('#request-title').textContent='Detalle de solicitud';document.querySelector('#request-detail').innerHTML='<p>Cargando detalle…</p>';if(!dialog.open)dialog.showModal();
  try{
    const r=await api('/api/admin/requests/'+encodeURIComponent(id));if(activeId!==id)return;
    const d=r.data,contact=d.contactMethod==='email'?`mailto:${d.email}`:'https://wa.me/'+d.phone.replace(/\D/g,'');
    document.querySelector('#request-title').textContent=typeNames[d.requestType];
    document.querySelector('#request-detail').innerHTML=`<p class="dialog-footnote request-id">${esc(r.id)} · ${esc(date(r.created_at))}</p><div class="review-group"><dl class="review-grid"><div><dt>Cliente</dt><dd>${esc(d.name)}</dd></div><div><dt>Contacto preferido</dt><dd>${d.contactMethod==='email'?'Email':'WhatsApp'} · ${esc(d.contactMethod==='email'?d.email:d.phone)}</dd></div><div><dt>Destino</dt><dd>${esc(r.destination)}</dd></div><div><dt>Correo a NexBuy</dt><dd>${esc(mailNames[r.email_status])}</dd></div></dl><a class="button button-outline" href="${esc(contact)}" target="_blank" rel="noopener noreferrer">Abrir contacto del cliente</a></div><div class="review-group">${d.requestType==='suppliers'?`<h3>Interés en proveedores</h3><p class="detail-text">${esc(d.supplierInterest)}</p>`:`<h3>Productos</h3>${d.products.map((p,i)=>`<div class="review-product"><strong>${i+1}. ${esc(p.name)}</strong><p>${esc(p.category)} · ${esc(p.qty)} unidades</p>${p.link?`<p><a class="text-link" href="${esc(p.link)}" target="_blank" rel="noopener noreferrer">Abrir enlace del producto</a></p>`:''}${p.reference?`<p class="detail-text">Referencia: ${esc(p.reference)}</p>`:''}${p.variants?`<p>Versión: ${esc(p.variants)}</p>`:''}<p>${p.alternatives?'Acepta alternativas':'Producto indicado, sin alternativas'}</p></div>`).join('')}`}</div><div class="review-group"><dl class="review-grid"><div><dt>Presupuesto</dt><dd>${d.budget?esc(d.budget+' '+d.currency):'Sin definir'}</dd></div><div><dt>Plazo deseado</dt><dd>${esc(d.timing)}</dd></div></dl>${d.notes?`<p class="detail-text">Comentarios: ${esc(d.notes)}</p>`:''}</div><form id="status-form"><div class="field"><label for="request-status">Estado de la solicitud</label><select id="request-status">${Object.entries(stateNames).map(([key,label])=>`<option value="${key}" ${r.status===key?'selected':''}>${label}</option>`).join('')}</select></div><button class="button button-primary" type="submit">Guardar estado</button><p class="field-help">Cambiar el estado no envía mensajes al cliente.</p><p id="save-message" role="status"></p></form>`;
    document.querySelector('#status-form').onsubmit=async event=>{
      event.preventDefault();const button=event.currentTarget.querySelector('button');button.disabled=true;const out=document.querySelector('#save-message');
      try{await api('/api/admin/requests/'+encodeURIComponent(id),{method:'PATCH',headers:{'Content-Type':'application/json','X-NexBuy-Admin':'1'},body:JSON.stringify({status:document.querySelector('#request-status').value})});out.textContent='Estado guardado.';await load();}catch(error){out.textContent=error.message;}finally{button.disabled=false;}
    };
  }catch(error){document.querySelector('#request-detail').textContent=error.message;}
}
document.querySelector('#refresh').onclick=()=>load();
document.querySelector('#filters').onsubmit=event=>{event.preventDefault();page=1;load();};
document.querySelector('#prev-page').onclick=()=>{page--;load();};document.querySelector('#next-page').onclick=()=>{page++;load();};
document.querySelector('#close-detail').onclick=()=>{activeId='';dialog.close();};dialog.addEventListener('close',()=>{activeId='';});
document.querySelector('#logout').onclick=async()=>{const button=document.querySelector('#logout');button.disabled=true;try{await api('/api/admin/logout',{method:'POST',headers:{'Content-Type':'application/json','X-NexBuy-Admin':'1'},body:'{}'});window.location.assign('/admin');}catch(error){message(error.message,true);button.disabled=false;}};
load();

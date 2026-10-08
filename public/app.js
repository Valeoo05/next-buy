'use strict';

// Reviewed intake: explicit submission to NexBuy email; no supplier or client messaging.
const icons = {
  arrow:'M4 12h16m-6-6 6 6-6 6', 'arrow-down':'M12 4v16m-6-6 6 6 6-6', check:'m5 12 4 4L19 6',
  'check-circle':'M22 11.1V12a10 10 0 1 1-5.9-9.1M22 4 12 14l-3-3',
  folder:'M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z',
  headphones:'M3 14v-3a9 9 0 0 1 18 0v3M3 12h3v8H4a1 1 0 0 1-1-1v-7Zm18 0h-3v8h2a1 1 0 0 0 1-1v-7Z',
  sparkles:'m12 3 2.3 6.7L21 12l-6.7 2.3L12 21l-2.3-6.7L3 12l6.7-2.3L12 3ZM20 2v4m-2-2h4',
  laptop:'M4 4h16v12H4ZM2 20h20l-2-4H4l-2 4Z',bag:'M4 8h16l1 13H3L4 8Zm4 0V6a4 4 0 0 1 8 0v2',
  home:'m3 10 9-7 9 7M5 9v12h14V9M9 21v-7h6v7', plus:'M12 5v14M5 12h14',
  search:'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
  sliders:'M4 6h4m6 0h6M4 12h10m6 0h0M4 18h1m6 0h9M8 3v6m6 0v6M5 15v6',
  info:'M12 11v6m0-10v.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  shield:'M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6l-9-4Zm-4 10 3 3 5-6',
  lock:'M5 10h14v11H5ZM8 10V6a4 4 0 0 1 8 0v4m-4 5v2', close:'m6 6 12 12M6 18 18 6',
  pin:'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Zm-5 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  mail:'M3 5h18v14H3Zm0 0 9 8 9-8',phone:'M8 3H4v4c0 7.2 5.8 13 13 13h4v-4l-5-2-2 3a15 15 0 0 1-7-7l3-2-2-5Z',
  download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',copy:'M9 9h12v12H9ZM15 9V3H3v12h6',trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',back:'M20 12H4m6-6-6 6 6 6'
};
icons['shopping-bag']=icons.bag;icons.house=icons.home;icons['user-round']='M20 21v-2a7 7 0 0 0-14 0v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z';icons.ellipsis='M5 12h.01M12 12h.01M19 12h.01';
function icon(name){return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${icons[name]||icons.arrow}"/></svg>`;}
function hydrateIcons(root=document){root.querySelectorAll('[data-icon]').forEach(el=>{el.innerHTML=icon(el.dataset.icon);});}
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const categories=['Tecnología','Perfumería','Moda y accesorios','Hogar','Deporte','Otros'];
const storageKey='nexbuy.requests.v1', draftKey='nexbuy.draft.v1';
const newProduct=()=>({name:'',qty:'1',category:'Otros',link:'',reference:'',variants:'',alternatives:false});
const requestTypes={personal:'Compra personal',wholesale:'Compra mayorista',suppliers:'Acceso a proveedores'};
const newDraft=()=>({requestType:'personal',supplierInterest:'',products:[newProduct()],images:[],name:'',contactMethod:'whatsapp',phone:'',email:'',country:'Argentina',city:'',region:'',budget:'',currency:'USD',timing:'Sin urgencia',notes:''});
let draft=newDraft(),step=1,errors={},requests=[],lastRequest=null,storageAvailable=true,sending=false,pendingRequest=null,recoveredDraft=false,draftTimer,imageBusy=false,imageWarning='';
try{
  const testKey='nexbuy.storage-test';localStorage.setItem(testKey,'1');localStorage.removeItem(testKey);
}catch{storageAvailable=false;}
if(storageAvailable){
  try{const stored=JSON.parse(localStorage.getItem(storageKey)||'[]');
    if(Array.isArray(stored))requests=stored.filter(r=>r&&typeof r.id==='string'&&r.data&&Array.isArray(r.data.products)&&r.data.products.length&&r.data.products.every(p=>p&&typeof p.name==='string')).slice(0,50);
  }catch{} // A damaged local history must not prevent completing a new request.
  try{
  const snapshot=JSON.parse(localStorage.getItem(draftKey)||'null');
  const saved=snapshot?.version===2?snapshot.data:snapshot;
  if(saved&&Array.isArray(saved.products)&&saved.products.length&&saved.products.every(p=>p&&typeof p.name==='string')){
    draft={...newDraft(),...saved,products:saved.products.slice(0,10).map(p=>({...newProduct(),...p}))};
    draft.requestType='personal';draft.supplierInterest='';
    draft.images=Array.isArray(saved.images)?saved.images.filter(p=>p&&typeof p.id==='string'&&window.NexBuyImages?.safePreview(p.preview)).slice(0,3):[];
    if(!['whatsapp','email'].includes(draft.contactMethod))draft.contactMethod='whatsapp';
    for(const key of Object.keys(newDraft()))if(typeof newDraft()[key]==='string'&&typeof draft[key]!=='string')draft[key]=newDraft()[key];
    draft.products=draft.products.map(p=>{const value={...newProduct(),...p};for(const key of Object.keys(newProduct()))if(typeof newProduct()[key]==='string'&&typeof value[key]!=='string')value[key]=String(value[key]??'');value.alternatives=value.alternatives===true;return value;});
    step=snapshot?.version===2&&[1,2,3].includes(snapshot.step)?snapshot.step:1;
    recoveredDraft=true;
    if(snapshot?.pendingRequest?.id&&snapshot.pendingRequest.data)pendingRequest=snapshot.pendingRequest;
  }
  }catch{} // Ignore malformed drafts without disabling otherwise working storage.
}
const content=document.querySelector('#form-content'), dialog=document.querySelector('#app-dialog');
function persistDraft(){clearTimeout(draftTimer);draftTimer=null;if(storageAvailable){try{localStorage.setItem(draftKey,JSON.stringify({version:2,step,data:draft,pendingRequest}));}catch{storageAvailable=false;showStorageWarning();}}}
function saveDraft(){clearTimeout(draftTimer);draftTimer=setTimeout(persistDraft,250);}
function showStorageWarning(){if(content.querySelector('.storage-warning'))return;const warning=document.createElement('p');warning.className='storage-warning';warning.setAttribute('role','status');warning.textContent='Este navegador no permite guardar datos. Podés preparar y copiar el resumen, pero no quedará guardado al cerrar la página.';content.prepend(warning);}
function removeDraft(){clearTimeout(draftTimer);draftTimer=null;try{localStorage.removeItem(draftKey);}catch{storageAvailable=false;}recoveredDraft=false;}
function startAgain(){if(imageBusy||sending)return;for(const image of draft.images||[])window.NexBuyImages?.remove(image.id);removeDraft();draft=newDraft();pendingRequest=null;imageWarning='';step=1;errors={};renderForm(true);notify('Borrador borrado.');}
window.addEventListener('pagehide',()=>{if(draftTimer){collect();persistDraft();}});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&draftTimer){collect();persistDraft();}});
function notify(message){const el=document.querySelector('#toast');el.textContent=message;el.hidden=false;clearTimeout(notify.timer);notify.timer=setTimeout(()=>{el.hidden=true;},4500);}
function updateCount(){const el=document.querySelector('#request-count');el.textContent=requests.length;el.hidden=!requests.length;}
function errorFor(id){return errors[id]?`<p class="field-error" id="${id}-error">${esc(errors[id])}</p>`:'';}
function field(id,label,opts={}){
  const val=opts.value??draft[id]??'';
  const attrs=`${opts.attrs||''} id="${id}" name="${id}" ${opts.required?'aria-required="true"':''} ${errors[id]?`aria-invalid="true" aria-describedby="${id}-error"`:opts.help?`aria-describedby="${id}-help"`:''}`;
  let input='';
  if(opts.options)input=`<select ${attrs}>${opts.options.map(o=>`<option value="${esc(o.value??o)}" ${String(val)===String(o.value??o)?'selected':''}>${esc(o.label??o)}</option>`).join('')}</select>`;
  else if(opts.textarea)input=`<textarea ${attrs} maxlength="${opts.maxlength||1000}" placeholder="${esc(opts.placeholder||'')}">${esc(val)}</textarea>`;
  else input=`<input ${attrs} type="${opts.type||'text'}" value="${esc(val)}" placeholder="${esc(opts.placeholder||'')}" maxlength="${opts.maxlength||150}" ${opts.type==='number'?`min="${opts.min??1}" max="${opts.max??9999}" step="1"`:''} ${opts.autocomplete?`autocomplete="${opts.autocomplete}"`:''} ${opts.inputmode?`inputmode="${opts.inputmode}"`:''}>`;
  return `<div class="field"><label for="${id}">${label} ${opts.required?'<span class="required">*</span>':opts.optional?'<span class="optional">· opcional</span>':''}</label>${input}${errorFor(id)}${opts.help?`<p class="field-help" id="${id}-help">${opts.help}</p>`:''}</div>`;
}
function productTitle(p){return p.name.trim()||(p.link.trim()||p.reference.trim()?'Producto de la referencia':draft.images.length?'Producto de las imágenes':'El producto que tenés en mente');}
function productForm(p,i){
  const key=f=>`p${i}_${f}`;
  const hints={Tecnología:'Modelo, capacidad y color, si los sabés. Con una foto también podemos empezar.',Perfumería:'Mililitros y concentración, si los sabés. Una foto del frasco también sirve.',Hogar:'Medidas o características, si las tenés. No hace falta saber el modelo exacto.',Deporte:'Tipo, marca o medidas nos ayudan a encontrar opciones para vos.','Moda y accesorios':'Talle y color nos ayudan. También podés compartir una foto de lo que buscás.'};
  const reference=[p.link,p.reference,p.variants?`Versión: ${p.variants}`:''].filter(Boolean).join('\n');
  return `<div class="${i?'nf-extra-product':'nf-first-product'}" data-product="${i}">${i?`<div class="nf-extra-heading"><span>Producto ${String(i+1).padStart(2,'0')}</span><button type="button" class="nf-remove" data-remove="${i}">${icon('trash')} Quitar</button></div>`:''}<div class="nf-product-row">${field(key('name'),'Producto',{value:p.name,placeholder:'Marca, modelo o nombre',maxlength:150,attrs:'data-product-name'})}<div class="field sr-quantity-field"><label for="${key('qty')}">Cantidad</label><span class="nf-quantity"><button type="button" data-qty-index="${i}" data-qty-delta="-1" aria-label="Quitar una unidad">−</button><input id="${key('qty')}" name="${key('qty')}" type="number" min="1" max="9999" value="${esc(p.qty)}" aria-label="Cantidad" ${errors[key('qty')]?'aria-invalid="true"':''}><button type="button" data-qty-index="${i}" data-qty-delta="1" aria-label="Agregar una unidad">+</button></span>${errorFor(key('qty'))}</div></div><div class="nf-reference">${field(key('reference'),'Enlace o detalles',{value:reference,optional:true,textarea:true,placeholder:'Pegá un enlace o describí cómo lo querés…',maxlength:2000})}</div>${i?field(key('category'),'Categoría',{value:p.category||'Otros',options:categories}):`<p class="sr-inline-help">${esc(hints[p.category]||'Si tenés una foto o un enlace, no hace falta saber el modelo exacto.')}</p>`}</div>`;
}
function collect(){const form=document.querySelector('#quote-form');if(!form)return;new FormData(form).forEach((value,key)=>{
  const m=key.match(/^p(\d+)_(\w+)$/);if(m&&draft.products[Number(m[1])]){const p=draft.products[Number(m[1])];p[m[2]]=String(value);if(m[2]==='reference'){p.link='';p.variants='';}}else if(key in draft)draft[key]=String(value);
});form.querySelectorAll('input[type=checkbox][name^=p]').forEach(el=>{const m=el.name.match(/^p(\d+)_(\w+)$/);if(m&&draft.products[Number(m[1])])draft.products[Number(m[1])][m[2]]=el.checked;});saveDraft();}
function validateProducts(data=draft){let result={};if(data.requestType==='suppliers'){if(typeof data.supplierInterest!=='string'||data.supplierInterest.trim().length<3)result.supplierInterest='Contanos qué productos te gustaría comercializar.';return result;}data.products.forEach((p,i)=>{
  if(!p.name.trim()&&!p.link.trim()&&!p.reference.trim()&&!(i===0&&data.images?.length))result[`p${i}_name`]='Contanos qué buscás con un nombre, un enlace o una foto.';
  if(!Number.isInteger(Number(p.qty))||Number(p.qty)<1||Number(p.qty)>9999)result[`p${i}_qty`]='Usá un entero de 1 a 9999.';
  if(!categories.includes(p.category))result[`p${i}_category`]='Elegí una categoría.';
  
  if(p.link.trim()){try{const url=new URL(p.link.trim());if(!['https:','http:'].includes(url.protocol)||!url.hostname.includes('.'))throw Error();}catch{result[`p${i}_link`]='Usá un enlace completo que empiece con https:// o http://.';}}
});return result;}
function validateContact(data=draft){let result={};if(data.name.trim().length<2)result.name='Indicá tu nombre (al menos 2 caracteres).';
  if(data.contactMethod==='whatsapp'){
    const digits=data.phone.replace(/\D/g,'');if(digits.length<8||digits.length>15||!/^[+\d\s()\-]+$/.test(data.phone))result.phone='Indicá un número válido con código de país y área.';
  }else if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim()))result.email='Indicá un correo electrónico válido.';
  if(!data.city.trim())result.city='Indicá la ciudad de destino.';if(!data.region.trim())result.region='Indicá la provincia o región.';
  if(data.budget&&(!Number.isFinite(Number(data.budget))||Number(data.budget)<=0))result.budget='Indicá un importe mayor a cero o dejalo vacío.';return result;
}
function displayErrors(nextErrors){errors=nextErrors;renderForm(false);const first=Object.keys(errors)[0];document.getElementById(first)?.focus();}
function imageGallery(images=[],removable=false){const safe=Array.isArray(images)?images.filter(p=>p&&window.NexBuyImages?.safePreview(p.preview)):[];return safe.length?`<div class="image-gallery">${safe.map(p=>`<figure><img src="${esc(p.preview)}" alt="${esc(p.name||'Imagen del producto')}" width="160" height="120"><figcaption>${esc(p.name||'Imagen del producto')}${removable?`<button type="button" data-remove-image="${esc(p.id)}" aria-label="Quitar ${esc(p.name)}">${icon('close')} Quitar</button>`:''}</figcaption></figure>`).join('')}</div>`:'';}
function imageUpload(){return `<button type="button" class="sr-upload" id="open-image-picker" ${imageBusy||draft.images.length>=3?'disabled':''}><span class="sr-upload-copy"><strong>Tu referencia, en una imagen.</strong><small>Hasta 3 fotos · JPG, PNG o WebP · También podés pegarlas</small><span class="sr-upload-action">${icon('plus')}<span>${imageBusy?'Preparando imágenes…':draft.images.length?draft.images.length+' de 3 imágenes · agregar otra':'Agregar fotos o capturas'}</span></span></span>${draft.images.length?'':`<span class="sr-photo-stack" aria-hidden="true"><span>${icon('copy')}</span><span>${icon('copy')}</span><span>${icon('copy')}</span></span>`}</button><input type="file" id="product-images" accept="image/jpeg,image/png,image/webp" multiple hidden aria-label="Seleccionar imágenes del producto"><p id="image-message" class="${errors.images?'field-error':'field-help'}" role="status">${esc(errors.images||imageWarning||'')}</p>${imageGallery(draft.images,true)}`;}
async function addImages(files){if(imageBusy||sending)return;if(!window.NexBuyImages?.prepare){errors.images='No se pudo cargar la herramienta de imágenes. Recargá la página para adjuntarlas.';return renderForm();}collect();errors.images='';imageBusy=true;renderForm();try{for(const file of files){if(draft.images.length>=3){errors.images='Podés adjuntar hasta 3 imágenes. Quitá una para agregar otra.';break;}try{const item=await window.NexBuyImages.prepare(file);if(draft.images.reduce((sum,p)=>sum+p.size,0)+item.size>window.NexBuyImages.MAX_TOTAL){window.NexBuyImages.remove(item.id);throw Error('Las imágenes juntas no pueden superar 3 MB después de comprimir.');}draft.images.push(item);if(!item.persisted)imageWarning='No pudimos guardar las imágenes en este navegador. Si salís, tendrás que volver a subirlas.';saveDraft();}catch(error){errors.images=error.message||'No pudimos preparar la imagen.';}}}finally{collect();imageBusy=false;renderForm();}}
async function restoreImages(){if(!draft.images.length)return;imageBusy=true;const missing=[];for(const item of draft.images){if(!await window.NexBuyImages?.get(item.id))missing.push(item.id);}draft.images=draft.images.filter(p=>!missing.includes(p.id));if(missing.length){imageWarning='Recuperamos los datos del borrador, pero tendrás que volver a subir las imágenes adjuntas.';saveDraft();}imageBusy=false;renderForm();}
function updateLive(){
 const first=draft.products[0];document.querySelector('[data-live-product]').textContent=productTitle(first)+(draft.products.length>1?' y '+(draft.products.length-1)+' más':'');
 document.querySelector('[data-live-quantity]').textContent=first.name||first.link||first.reference||draft.images.length?'Cantidad: '+first.qty:'Completá tu consulta a la derecha.';
 document.querySelectorAll('[data-category]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.category===first.category||button.dataset.category==='Moda'&&first.category==='Moda y accesorios')));
}
function renderForm(focus=false){
  document.querySelectorAll('.nx-steps li').forEach((li,i)=>{li.classList.toggle('is-current',i+1===step);li.classList.toggle('is-complete',i+1<step);if(i+1===step)li.setAttribute('aria-current','step');else li.removeAttribute('aria-current');});
  const warning=!storageAvailable?'<p class="storage-warning">Este navegador no permite guardar el borrador. Podés completar y enviar la consulta.</p>':'';
  const errorSummary=Object.keys(errors).length?`<div class="error-summary" role="alert">${errors.delivery?esc(errors.delivery):'Revisá los campos marcados para continuar.'}</div>`:'';
  let inner='';
  if(step===1){
   inner=`<h2 class="form-heading" tabindex="-1">Tu próxima <em>búsqueda.</em></h2><p class="nf-copy">Contanos qué querés. Un nombre, un enlace o una foto nos sirve para empezar.</p>${errorSummary}${productForm(draft.products[0],0)}${imageUpload()}<div class="nf-extra-products">${draft.products.slice(1).map((p,i)=>productForm(p,i+1)).join('')}</div><div class="sr-actions"><button class="nf-add" type="button" id="add-product" ${draft.products.length>=10?'disabled':''}>${icon('plus')}Agregar otro producto</button><button class="nx-primary" type="submit"><span>Continuar con mis datos</span>${icon('arrow')}</button></div><p class="nx-form-note">${icon('lock')}Podés revisar y editar todo antes de enviar.</p>`;
  }else if(step===2){
   inner=`<h2 class="form-heading" tabindex="-1">¿Cómo te contactamos?</h2><p class="nf-copy">Te respondemos en las próximas 24 horas con las opciones.</p>${errorSummary}<div class="nf-contact-methods" aria-label="Contacto preferido"><button type="button" data-contact="whatsapp" aria-pressed="${draft.contactMethod==='whatsapp'}">${icon('phone')}WhatsApp</button><button type="button" data-contact="email" aria-pressed="${draft.contactMethod==='email'}">${icon('mail')}Email</button></div><div class="nf-contact-fields">${field('name','Nombre y apellido',{required:true,placeholder:'¿Cómo te llamás?',autocomplete:'name',maxlength:100})}${draft.contactMethod==='whatsapp'?field('phone','Tu número de WhatsApp',{required:true,type:'tel',placeholder:'Código de país, área + número',autocomplete:'tel',maxlength:30}):field('email','Tu email',{required:true,type:'email',placeholder:'nombre@correo.com',autocomplete:'email',maxlength:150})}<div class="field-row">${field('city','Ciudad',{required:true,placeholder:'Ej.: Salta',autocomplete:'address-level2',maxlength:100})}${field('region','Provincia',{required:true,placeholder:'Ej.: Salta',autocomplete:'address-level1',maxlength:100})}</div></div><p class="nf-help">${icon('lock')}Usamos este contacto para responder tu consulta.</p><details class="nf-optionals"><summary>Otras preferencias · opcional</summary>${field('country','País de destino',{options:['Argentina','Paraguay','Uruguay','Otro destino']})}<div class="field-row">${field('budget','Presupuesto total',{optional:true,type:'number',max:1000000000})}${field('currency','Moneda',{options:['USD','ARS']})}</div>${field('timing','¿Cuándo lo necesitás?',{options:['Sin urgencia','En las próximas 2 semanas','En el próximo mes','Quiero consultar los plazos']})}${field('notes','Algo más que debamos saber',{optional:true,textarea:true,maxlength:1500})}</details><button type="submit" class="nx-primary"><span>Revisar mi solicitud</span>${icon('arrow')}</button><button type="button" id="previous-step" class="nx-back">Volver a la consulta</button>`;
  }else{
   inner=`<h2 class="form-heading" tabindex="-1">Tu solicitud, en claro.</h2><p class="nf-copy">Un último vistazo antes de que recibamos tu consulta.</p>${errorSummary}${reviewHtml(draft,true)}<label class="checkbox-row"><input type="checkbox" id="consent" name="consent"><span>Confirmo que mis datos están bien y autorizo a NexBuy a guardar la consulta y recibirla por correo para responderme. Entiendo que consultar no implica una compra.</span></label>${errorFor('consent')}<button type="submit" class="nx-primary"><span>Enviar mi solicitud</span>${icon('arrow')}</button><p class="nx-form-note">${icon('info')}Te respondemos en las próximas 24 horas.</p><button type="button" id="previous-step" class="nx-back">Volver a mis datos</button>`;
  }
  const recovery=recoveredDraft?'<div class="draft-recovery" role="status"><span>Recuperamos tu borrador</span><button class="text-link" type="button" id="restart-draft">Empezar de nuevo</button></div>':'';
  content.innerHTML=`${warning}${recovery}${step!==1&&imageWarning?`<p class="storage-warning">${esc(imageWarning)}</p>`:''}<form id="quote-form" novalidate>${inner}</form>`;
  bindForm();hydrateIcons(content);updateLive();if(focus)content.querySelector('.form-heading')?.focus({preventScroll:true});
}
function reviewHtml(data,editable=false,status='draft'){
 const editButton=s=>editable?`<button type="button" data-edit-step="${s}">Editar</button>`:'';
 return `<div class="review-group"><div class="review-header"><h4>TUS PRODUCTOS</h4>${editButton(1)}</div>${data.products.map(p=>`<div class="review-product"><strong>${esc(p.name||(p.link||p.reference?'Producto de la referencia':'Producto de las imágenes'))}</strong><small>Cantidad: ${esc(p.qty)} · ${esc(p.category)}</small>${p.link?`<p>${esc(p.link)}</p>`:''}${p.reference?`<p>${esc(p.reference)}</p>`:''}${p.variants?`<p>${esc(p.variants)}</p>`:''}${p.alternatives?'<small>Acepta alternativas similares</small>':''}</div>`).join('')}${imageGallery(data.images||[])}</div><div class="review-group"><div class="review-header"><h4>TU CONTACTO</h4>${editButton(2)}</div><div class="review-product"><strong>${esc(data.name)}</strong><p>${data.contactMethod==='whatsapp'?'WhatsApp: '+esc(data.phone):'Email: '+esc(data.email)}</p><p>${esc(data.city)}, ${esc(data.region)} · ${esc(data.country)}</p></div></div>${data.budget||data.notes||data.timing!=='Sin urgencia'?`<div class="review-group"><div class="review-header"><h4>OTRAS PREFERENCIAS</h4>${editButton(2)}</div>${data.budget?`<p>Presupuesto: ${esc(data.budget)} ${esc(data.currency)}</p>`:''}${data.timing!=='Sin urgencia'?`<p>${esc(data.timing)}</p>`:''}${data.notes?`<p style="white-space:pre-wrap">${esc(data.notes)}</p>`:''}</div>`:''}`;
}
function bindForm(){
  const form=document.querySelector('#quote-form');
  document.querySelector('#open-image-picker')?.addEventListener('click',()=>document.querySelector('#product-images').click());
  form.querySelectorAll('[data-qty-delta]').forEach(button=>button.onclick=()=>{const input=document.getElementById('p'+button.dataset.qtyIndex+'_qty');input.value=String(Math.max(1,Math.min(9999,(Number(input.value)||1)+Number(button.dataset.qtyDelta))));collect();updateLive();});
  const upload=document.querySelector('#open-image-picker');upload?.addEventListener('dragover',event=>event.preventDefault());upload?.addEventListener('drop',event=>{event.preventDefault();addImages(Array.from(event.dataTransfer?.files||[]));});
  document.querySelector('#product-images')?.addEventListener('change',e=>{addImages(Array.from(e.target.files||[]));});
  form.addEventListener('paste',e=>{if(step!==1)return;const files=Array.from(e.clipboardData?.items||[]).filter(item=>item.kind==='file').map(item=>item.getAsFile()).filter(Boolean);if(files.length){e.preventDefault();addImages(files);}});
  form.querySelectorAll('[data-remove-image]').forEach(button=>button.onclick=()=>{collect();const id=button.dataset.removeImage;draft.images=draft.images.filter(p=>p.id!==id);window.NexBuyImages?.remove(id);errors.images='';imageWarning='';saveDraft();renderForm();});
  form.addEventListener('input',()=>{collect();updateLive();});form.addEventListener('change',()=>collect());
  form.addEventListener('submit',async e=>{e.preventDefault();if(sending)return;if(imageBusy){errors.images='Esperá a que terminemos de preparar las imágenes.';return renderForm();}collect();
    if(step===1){const validation=validateProducts();if(Object.keys(validation).length)return displayErrors(validation);step=2;errors={};saveDraft();renderForm(true);}
    else if(step===2){const validation=validateContact();if(Object.keys(validation).length)return displayErrors(validation);step=3;errors={};saveDraft();renderForm(true);}
    else{
      const pErrors=validateProducts(),cErrors=validateContact();if(Object.keys(pErrors).length){step=1;return displayErrors(pErrors);}if(Object.keys(cErrors).length){step=2;return displayErrors(cErrors);}
      if(!document.querySelector('#consent').checked)return displayErrors({consent:'Autorizá el envío de los datos a NexBuy para continuar.'});
      await confirmRequest();
    }
  });
  document.querySelector('#add-product')?.addEventListener('click',()=>{collect();draft.products.push(newProduct());errors={};renderForm();document.querySelector(`#p${draft.products.length-1}_name`).focus();saveDraft();});
  form.querySelectorAll('[data-remove]').forEach(button=>button.addEventListener('click',()=>{collect();draft.products.splice(Number(button.dataset.remove),1);errors={};renderForm();saveDraft();}));
  document.querySelector('#previous-step')?.addEventListener('click',()=>{collect();step--;errors={};saveDraft();renderForm(true);});
  form.querySelectorAll('[data-contact]').forEach(button=>button.addEventListener('click',()=>{collect();draft.contactMethod=button.dataset.contact;errors={};renderForm();saveDraft();document.getElementById(draft.contactMethod==='whatsapp'?'phone':'email').focus();}));
  form.querySelectorAll('[data-edit-step]').forEach(button=>button.addEventListener('click',()=>{step=Number(button.dataset.editStep);errors={};saveDraft();renderForm(true);}));
  document.querySelector('#restart-draft')?.addEventListener('click',startAgain);
  document.querySelector('#clear-draft')?.addEventListener('click',()=>{
    openDialog('¿Borrar este borrador?',`<p class="delete-confirm">Se eliminarán los datos del formulario. Tus solicitudes guardadas se conservarán.</p><div class="detail-actions"><button class="button button-light" id="cancel-delete">Conservar</button><button class="button button-danger" id="confirm-clear">Borrar borrador</button></div>`);
    document.querySelector('#cancel-delete').onclick=()=>dialog.close();document.querySelector('#confirm-clear').onclick=()=>{dialog.close();startAgain();};
  });
}
function deliveryLabel(status){
  return {draft:'Lista para enviar',pending_owner_approval:'Guardada, sin enviar',received_by_email_service:'Remitida por correo',registered_email_pending:'Registrada para revisión',awaiting_email_activation:'Correo de NexBuy pendiente de activar',not_sent:'No enviada',delivery_unconfirmed:'Envío sin confirmar'}[status]||'Guardada, sin enviar';
}
function keepLocalCopy(request){
  requests=[request,...requests.filter(r=>r.id!==request.id)].slice(0,50);
  request.persisted=false;
  if(storageAvailable){try{request.persisted=true;localStorage.setItem(storageKey,JSON.stringify(requests));}catch{request.persisted=false;storageAvailable=false;}}
  lastRequest=request;updateCount();
}
async function confirmRequest(){
  if(sending)return;
  if(!window.NexBuyImages?.files){errors={delivery:'No se pudo cargar el envío de imágenes. Recargá la página; tus datos siguen en el borrador.'};renderForm();return;}
  if(!window.NexBuyEmail?.submit){errors={delivery:'No se pudo cargar el envío. Recargá la página; tus datos siguen en el borrador.'};renderForm();return;}
  if(!pendingRequest||JSON.stringify(pendingRequest.data)!==JSON.stringify(draft))pendingRequest={id:`NB-${crypto.randomUUID().toUpperCase()}`,createdAt:new Date().toISOString(),status:'draft',data:JSON.parse(JSON.stringify(draft))};
  const request=pendingRequest,form=document.querySelector('#quote-form');request.data.products=request.data.products.map(p=>({...p,name:p.name||productTitle(p)}));
  sending=true;form?.setAttribute('aria-busy','true');
  form?.querySelectorAll('input,select,textarea,button').forEach(el=>{el.disabled=true;});
  const submitButton=form?.querySelector('button[type=submit]');if(submitButton)submitButton.textContent='Enviando solicitud…';
  try{
    const files=await window.NexBuyImages.files(request.data.images||[]);
    const result=await window.NexBuyEmail.submit(request,files);
    request.status=result.status;request.registered=result.registered===true;if(result.createdAt)request.createdAt=result.createdAt;keepLocalCopy(request);
    if(result.continueToEmail){persistDraft();content.innerHTML=`<div class="success"><h3 tabindex="-1">Finalizando el envío…</h3><p>Tu consulta está registrada. Volverás a NexBuy cuando FormSubmit termine el envío por correo.</p><span class="request-code">${esc(request.id)}</span></div>`;result.continueToEmail();return;}
    draft=newDraft();errors={};pendingRequest=null;
    removeDraft();
    showSubmissionResult(request);
  }catch(error){
    request.status=error.uncertain?'delivery_unconfirmed':'not_sent';keepLocalCopy(request);saveDraft();
    errors={delivery:`${request.id}: ${error.message||'No pudimos confirmar el envío. Conservamos tus datos.'}`};renderForm();
  }finally{sending=false;form?.setAttribute('aria-busy','false');}
}
function showSubmissionResult(request){
  document.querySelectorAll('.stepper li').forEach(li=>{li.className='done';li.removeAttribute('aria-current');li.querySelector('span').innerHTML=icon('check');});
  const activation=request.status==='awaiting_email_activation';
  const registered=request.registered===true;
  content.innerHTML=`<div class="success"><div class="success-icon">${icon('check')}</div><h3 tabindex="-1">${registered?'Solicitud recibida.':activation?'Solicitud recibida para envío.':'Solicitud enviada a NexBuy.'}</h3><p>${activation?'El servicio recibió tu consulta. NexBuy debe activar su correo antes de recibirla en la casilla.':'Te responderemos en las próximas 24 horas por el contacto que dejaste. Guardá el número de tu solicitud para futuras consultas.'}</p><span class="request-code">${esc(request.id)}</span><div class="approval-notice">${icon('mail')}<div><strong>${esc(deliveryLabel(request.status))}</strong><br>${registered?'Tu consulta quedó en el registro privado de NexBuy para su revisión.':'La aceptación del servicio de correo no confirma la entrega en la casilla.'} Una solicitud no confirma una compra.</div></div>${!request.persisted?'<p class="storage-warning">No pudimos guardar una copia en este navegador. Podés copiar o descargar el resumen antes de cerrar esta página.</p>':''}<div class="success-buttons"><button class="button button-primary" id="copy-success">${icon('copy')} Copiar resumen</button><button class="button button-outline" id="download-success">${icon('download')} Descargar</button></div><button class="success-new" id="new-request">Preparar otra solicitud</button></div>`;
  document.querySelector('#copy-success').onclick=()=>copyRequest(request);document.querySelector('#download-success').onclick=()=>downloadRequest(request);
  document.querySelector('#new-request').onclick=()=>{step=1;renderForm(true);};content.querySelector('h3').focus({preventScroll:true});
}
function summaryText(request){const d=request.data;return `NEXBUY IMPORTACIONES\nSolicitud ${request.id}\nFecha: ${formatDate(request.createdAt)}\nTipo: ${requestTypes[d.requestType]||requestTypes.personal}\nEstado: ${deliveryLabel(request.status)}. Sin envío a proveedores.\n\n${d.requestType==='suppliers'?'INTERÉS EN PROVEEDORES':'PRODUCTOS'}\n${d.requestType==='suppliers'?d.supplierInterest:d.products.map((p,i)=>`${i+1}. ${p.name}\nCantidad: ${p.qty}\nCategoría: ${p.category}\n${p.link?'Enlace: '+p.link+'\n':''}${p.reference?'Referencia: '+p.reference+'\n':''}${p.variants?'Versión: '+p.variants+'\n':''}Alternativas: ${p.alternatives?'sí':'no'}`).join('\n\n')}\n\nCONTACTO Y DESTINO\nNombre: ${d.name}\n${d.contactMethod==='whatsapp'?'WhatsApp: '+d.phone:'Email: '+d.email}\nDestino: ${d.city}, ${d.region}, ${d.country}\n\nPREFERENCIAS\nPresupuesto total: ${d.budget?d.budget+' '+d.currency:'Sin definir'}\nPlazo: ${d.timing}\nComentarios: ${d.notes||'Sin comentarios'}\n\nUna consulta no confirma una compra. Producto, comisión, logística, pagos y condiciones se deben informar y aceptar antes de avanzar.\nNexBuy recibe las consultas por correo mediante FormSubmit. No se envían automáticamente a proveedores.`;}
function formatDate(value){const d=new Date(value);return isNaN(d)?'Fecha no disponible':d.toLocaleString('es-AR',{dateStyle:'medium',timeStyle:'short'});}
async function copyRequest(request){try{await navigator.clipboard.writeText(summaryText(request));notify('Resumen copiado.');}catch{openDialog('Copiá tu resumen',`<p class="dialog-footnote">Seleccioná el texto y copialo manualmente.</p><textarea id="manual-copy" readonly style="min-height:300px">${esc(summaryText(request))}</textarea>`);document.querySelector('#manual-copy').select();}}
function downloadRequest(request){const blob=new Blob([summaryText(request)],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`NexBuy-${request.id}.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);notify('Resumen descargado.');}
function openDialog(title,html){document.querySelector('#dialog-title').textContent=title;document.querySelector('#dialog-content').innerHTML=html;if(!dialog.open)dialog.showModal();}
function showRequests(){
  openDialog('Mis solicitudes',requests.length?`<p class="dialog-footnote">Guardadas en este navegador. ${requests.length} de 50 disponibles. Son copias locales; el estado indica si se remitieron al servicio de correo de NexBuy.</p>${requests.map(r=>`<article class="request-item"><div class="request-item-header"><div><strong>${r.data.requestType==='suppliers'?'Acceso a proveedores':esc(r.data.products[0].name)}${r.data.requestType!=='suppliers'&&r.data.products.length>1?` + ${r.data.products.length-1} más`:''}</strong><small>${esc(r.id)} · ${esc(formatDate(r.createdAt))}</small></div><span class="pending-badge">${esc(deliveryLabel(r.status))}</span></div><p>${esc(r.data.name)} · ${esc(r.data.city)} · ${esc(requestTypes[r.data.requestType]||requestTypes.personal)}</p>${imageGallery(r.data.images||[])}<div class="request-item-actions"><button data-view="${esc(r.id)}">Ver resumen</button><button data-copy="${esc(r.id)}">Copiar</button><button data-download="${esc(r.id)}">Descargar</button><button class="danger" data-delete="${esc(r.id)}">Borrar</button></div></article>`).join('')}`:`<div class="empty-state">${icon('folder')}<h3>Tu primera idea empieza acá.</h3><p>Todavía no guardaste solicitudes en este navegador. Prepará una y revisá el resumen antes de confirmar.</p><button class="button button-primary" id="empty-start">Cotizar un producto </button></div>`);
  document.querySelector('#empty-start')?.addEventListener('click',()=>{dialog.close();document.querySelector('#cotizar').scrollIntoView({behavior:'smooth'});});
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>showDetail(requests.find(r=>r.id===b.dataset.view)));
  document.querySelectorAll('[data-copy]').forEach(b=>b.onclick=()=>copyRequest(requests.find(r=>r.id===b.dataset.copy)));
  document.querySelectorAll('[data-download]').forEach(b=>b.onclick=()=>downloadRequest(requests.find(r=>r.id===b.dataset.download)));
  document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>deleteRequest(b.dataset.delete));
}
function showDetail(request){if(!request)return;openDialog(request.id,`<p class="dialog-footnote">${esc(formatDate(request.createdAt))} · Guardada localmente</p>${reviewHtml(request.data,false,request.status)}<div class="approval-notice">${icon('lock')}<div>${esc(deliveryLabel(request.status))}. No se envió automáticamente a proveedores.</div></div><div class="detail-actions"><button class="button button-light" id="back-to-requests"> Volver</button><button class="button button-primary" id="detail-copy">${icon('copy')} Copiar</button><button class="button button-outline" id="detail-download">${icon('download')} Descargar</button></div>`);document.querySelector('#back-to-requests').onclick=showRequests;document.querySelector('#detail-copy').onclick=()=>copyRequest(request);document.querySelector('#detail-download').onclick=()=>downloadRequest(request);}
function deleteRequest(id){openDialog('¿Borrar esta solicitud?',`<p class="delete-confirm">Se eliminará ${esc(id)} del historial de este navegador. Esta acción no se puede deshacer.</p><div class="detail-actions"><button class="button button-light" id="cancel-delete">Conservar</button><button class="button button-danger" id="confirm-delete">Borrar solicitud</button></div>`);document.querySelector('#cancel-delete').onclick=showRequests;document.querySelector('#confirm-delete').onclick=()=>{const next=requests.filter(r=>r.id!==id);try{if(storageAvailable)localStorage.setItem(storageKey,JSON.stringify(next));requests=next;updateCount();showRequests();notify('Solicitud borrada.');}catch{notify('No pudimos borrar la solicitud. Intentá de nuevo.');}};}
function showPrivacy(){openDialog('Privacidad y uso',`<div class="dialog-copy"><p>NexBuy recibe las consultas para preparar cotizaciones y responder por el contacto elegido.</p><h3>Envío de tu consulta</h3><p>Solo al marcar la autorización y pulsar Enviar solicitud, los datos se guardan en el registro privado de NexBuy y se remiten a su correo mediante FormSubmit. El registro reúne las solicitudes para prepararte una propuesta y responderte dentro de las próximas 24 horas. No se envían automáticamente a proveedores ni se responde al cliente desde esta web. Consultá la <a class="text-link" href="https://formsubmit.co/privacy.pdf" target="_blank" rel="noopener noreferrer">política de privacidad de FormSubmit</a>.</p><h3>Copias en tu dispositivo</h3><p>El borrador y hasta 50 copias de tus solicitudes se guardan en este navegador y no se sincronizan con otros dispositivos. El estado de cada copia distingue un envío aceptado, un error o un envío sin confirmar. Si compartís el mismo perfil del navegador, otras personas con acceso a él podrían ver las copias.</p><h3>Cómo borrar las copias locales</h3><p>Podés borrar el borrador y cada copia desde Mis solicitudes. Borrar una copia no elimina la consulta del registro privado ni del correo de NexBuy. Para pedir la eliminación de tus datos, escribí a juanperal05@gmail.com. Los datos enviados también pueden conservarse en el correo receptor y en el servicio de entrega.</p><h3>Alcance del servicio</h3><p>NexBuy actúa como intermediario. Este formulario no procesa pagos ni confirma precios, disponibilidad, plazos o compras. Esas condiciones se acuerdan para cada operación antes de aceptarla.</p></div>`);}
document.querySelector('#open-requests').onclick=showRequests;
document.querySelector('#open-privacy')?.addEventListener('click',showPrivacy);document.querySelector('#footer-privacy').onclick=showPrivacy;
document.querySelector('#close-dialog').onclick=()=>dialog.close();
dialog.addEventListener('click',event=>{const rect=dialog.getBoundingClientRect();if(event.target===dialog&&(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom))dialog.close();});
document.querySelectorAll('[data-category]').forEach(button=>button.onclick=()=>{collect();draft.requestType='personal';draft.products[0].category=button.dataset.category==='Moda'?'Moda y accesorios':button.dataset.category;step=1;errors={};renderForm();saveDraft();});
document.querySelector('[data-how]').onclick=()=>openDialog('Cómo funciona NexBuy',document.querySelector('#how-content').innerHTML);document.querySelector('[data-quote]').onclick=()=>{step=1;errors={};renderForm(true);document.querySelector('#cotizar').scrollIntoView({behavior:'smooth'});};hydrateIcons();updateCount();renderForm();
async function receiveEmailReturn(){const url=new URL(location.href),id=url.searchParams.get('enviada'),receipt=new URLSearchParams(url.hash.slice(1)).get('receipt');if(!id||!receipt)return false;try{const response=await fetch('/api/email-return',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,receipt})});const result=await response.json();if(!response.ok||!result.registered)throw Error(result.error||'No pudimos confirmar el regreso del envío. Conservamos tu borrador.');const local=requests.find(r=>r.id===id),request={id,createdAt:result.createdAt,status:result.status,registered:true,data:local?.data||result.data};keepLocalCopy(request);for(const image of draft.images||[])window.NexBuyImages?.remove(image.id);draft=newDraft();pendingRequest=null;errors={};imageWarning='';removeDraft();history.replaceState(null,'',url.pathname);showSubmissionResult(request);return true;}catch(error){errors.delivery=error.message;renderForm();return false;}}
receiveEmailReturn().then(returned=>{if(!returned)restoreImages();});

// Optional, page-scoped agent actions. Confirmation stays in the visible form.
function registerQuoteTools(){
  const context=document.modelContext;if(!context?.registerTool)return;
  const lifecycle=new AbortController();
  const register=tool=>{try{Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}};
  register({name:'read_quote_draft',title:'Ver el borrador de NexBuy',description:'Lee el borrador local y sus errores de validación. No confirma, guarda una solicitud ni envía datos a terceros.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute(){return {step,quote:JSON.parse(JSON.stringify(draft)),errors:{...validateProducts(),...validateContact()},externalSubmissionEnabled:true,supplierSubmissionEnabled:false};}});
  register({name:'stage_quote_products',title:'Preparar los productos de la consulta',description:'Reemplaza los productos del borrador local y muestra el paso Producto. No guarda una solicitud confirmada ni la envía. El usuario revisa y confirma desde el formulario.',inputSchema:{type:'object',properties:{products:{type:'array',minItems:1,maxItems:10,items:{type:'object',properties:{name:{type:'string',maxLength:150},qty:{type:'integer',minimum:1,maximum:9999},category:{type:'string',enum:categories},link:{type:'string',maxLength:2000},reference:{type:'string',maxLength:1000},variants:{type:'string',maxLength:300},alternatives:{type:'boolean'}},required:['name','qty','category'],additionalProperties:false}}},required:['products'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute(input){
    if(!input||!Array.isArray(input.products)||input.products.length<1||input.products.length>10)throw new Error('Indicá entre 1 y 10 productos.');
    const products=input.products.map(p=>{
      if(!p||typeof p.name!=='string'||p.name.length>150||!Number.isInteger(p.qty)||p.qty<1||p.qty>9999)throw new Error('Producto o cantidad inválidos.');
      for(const [key,max] of [['link',2000],['reference',1000],['variants',300]])if(p[key]!==undefined&&(typeof p[key]!=='string'||p[key].length>max))throw new Error('Referencia inválida.');
      return {...newProduct(),name:p.name,qty:String(p.qty),category:p.category,link:p.link||'',reference:p.reference||'',variants:p.variants||'',alternatives:p.alternatives===true};
    });
    const candidate={...draft,requestType:draft.requestType==='suppliers'?'personal':draft.requestType,products},validation=validateProducts(candidate);if(Object.keys(validation).length)throw new Error(Object.values(validation).join(' '));
    draft=candidate;step=1;errors={};saveDraft();renderForm(true);return {step,productCount:products.length,state:'draft',externalSubmissionEnabled:true,supplierSubmissionEnabled:false};
  }});
  window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
registerQuoteTools();

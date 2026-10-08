'use strict';
window.NexBuyImages=(()=>{
  const MAX_COUNT=3,MAX_SOURCE=15*1024*1024,MAX_FILE=1024*1024,MAX_TOTAL=3*1024*1024;
  const TYPES=['image/jpeg','image/png','image/webp'];
  const memory=new Map();let database;
  function open(){if(database)return database;database=new Promise((resolve,reject)=>{try{if(!window.indexedDB)throw Error();const request=indexedDB.open('nexbuy.images.v1',1);request.onupgradeneeded=()=>request.result.createObjectStore('images');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(Error('No se pudo guardar la imagen.'));request.onblocked=()=>reject(Error('No se pudo guardar la imagen.'));}catch{reject(Error('No se pudo guardar la imagen.'));}});return database;}
  async function store(id,blob){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction('images','readwrite');tx.objectStore('images').put(blob,id);tx.oncomplete=resolve;tx.onerror=()=>reject(Error());tx.onabort=()=>reject(Error());});}
  async function get(id){if(memory.has(id))return memory.get(id);try{const db=await open();return await new Promise((resolve,reject)=>{const request=db.transaction('images').objectStore('images').get(id);request.onsuccess=()=>resolve(request.result||null);request.onerror=()=>reject(Error());});}catch{return null;}}
  async function remove(id){memory.delete(id);try{const db=await open();const tx=db.transaction('images','readwrite');tx.objectStore('images').delete(id);}catch{}}
  function encode(canvas,type,quality){return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('No pudimos comprimir la imagen.')),type,quality));}
  function safePreview(value){return typeof value==='string'&&value.length<=70000&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value);}
  async function prepare(file){
    if(!TYPES.includes(file.type))throw Error('Formato no válido. Usá imágenes JPG, PNG o WebP.');
    if(!file.size||file.size>MAX_SOURCE)throw Error('Cada imagen original debe pesar entre 1 byte y 15 MB.');
    const url=URL.createObjectURL(file);let image;
    try{image=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('No pudimos abrir la imagen. Revisá que sea un JPG, PNG o WebP válido.'));img.src=url;});
      if(!image.naturalWidth||!image.naturalHeight||image.naturalWidth*image.naturalHeight>80000000)throw Error('La imagen es demasiado grande o no es válida.');
      const scale=Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight));
      const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
      const context=canvas.getContext('2d');if(!context)throw Error('Este navegador no puede procesar imágenes.');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
      let blob;for(const quality of [.85,.7,.55,.4]){blob=await encode(canvas,'image/jpeg',quality);if(blob.size<=MAX_FILE)break;}
      if(!blob?.size||blob.size>MAX_FILE)throw Error('La imagen sigue siendo demasiado pesada. Usá una captura más pequeña (máximo 1 MB después de comprimir).');
      const small=document.createElement('canvas'),ratio=Math.min(1,240/Math.max(canvas.width,canvas.height));small.width=Math.max(1,Math.round(canvas.width*ratio));small.height=Math.max(1,Math.round(canvas.height*ratio));small.getContext('2d').drawImage(canvas,0,0,small.width,small.height);
      const preview=small.toDataURL('image/jpeg',.65);if(!safePreview(preview))throw Error('No pudimos preparar la miniatura. Usá una imagen más simple.');
      const id=crypto.randomUUID(),name=(file.name||'producto').replace(/\.[^.]+$/,'').replace(/[^\p{L}\p{N}_ -]/gu,'').slice(0,70)||'producto';
      memory.set(id,blob);let persisted=true;try{await store(id,blob);}catch{persisted=false;}
      return {id,name:name+'.jpg',type:'image/jpeg',size:blob.size,width:canvas.width,height:canvas.height,preview,persisted};
    }finally{URL.revokeObjectURL(url);}
  }
  async function files(images=[]){if(images.length>MAX_COUNT)throw Error('Podés adjuntar hasta 3 imágenes.');let total=0;const result=[];for(const item of images){const blob=await get(item.id);if(!blob)throw Error('Volvé a subir las imágenes antes de enviar: no se pudieron recuperar en este navegador.');total+=blob.size;result.push(new File([blob],item.name,{type:blob.type}));}if(total>MAX_TOTAL)throw Error('Las imágenes juntas no pueden superar 3 MB después de comprimir.');return result;}
  return {MAX_COUNT,MAX_TOTAL,prepare,files,get,remove,safePreview};
})();

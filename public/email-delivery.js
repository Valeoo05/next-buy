'use strict';
// A reviewed request is registered first; the browser then submits real file parts.
window.NexBuyEmail=(()=>{
  const endpoint='https://formsubmit.co/juanperal05@gmail.com';let pendingId='',pendingToken='';
  class DeliveryError extends Error{constructor(message,uncertain=false){super(message);this.uncertain=uncertain;}}
  function multipart(payload,files){
    const form=document.createElement('form');form.method='POST';form.action=endpoint;form.enctype='multipart/form-data';form.hidden=true;
    for(const [name,value] of Object.entries({...payload,_captcha:'false'})){const input=document.createElement('input');input.type='hidden';input.name=name;input.value=String(value);form.append(input);}
    files.forEach((file,index)=>{const transfer=new DataTransfer();transfer.items.add(file);const input=document.createElement('input');input.type='file';input.name=index?'attachment'+(index+1):'attachment';input.files=transfer.files;form.append(input);});
    return form;
  }
  async function submit(request,files=[]){
    if(files.length&&typeof DataTransfer!=='function')throw new DeliveryError('Este navegador no admite el envío de adjuntos. Abrí la web en una versión actual de Chrome, Safari, Firefox o Edge.');
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);let result;
    try{
      if(pendingId!==request.id||!pendingToken){const response=await fetch('/api/form-token',{credentials:'same-origin',cache:'no-store',signal:controller.signal});const data=await response.json();if(!response.ok||!data.token)throw new DeliveryError(data.error||'No pudimos preparar el envío. Tus datos siguen en el borrador.');pendingId=request.id;pendingToken=data.token;}
      const data={...request.data,images:(request.data.images||[]).map(({id,name,type,size,width,height})=>({id,name,type,size,width,height}))};
      const response=await fetch('/api/requests',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','Accept':'application/json','X-NexBuy-Form':pendingToken},body:JSON.stringify({id:request.id,data,consent:true}),signal:controller.signal});result=await response.json();
      if(!response.ok){if(response.status===409){pendingId='';pendingToken='';}throw new DeliveryError(result.error||'No pudimos registrar tu consulta. Tus datos siguen en el borrador.');}
      if(!result.registered)throw new DeliveryError('No pudimos confirmar el registro. Consultá con NexBuy indicando el número de solicitud antes de volver a enviarla.',true);
      if(result.deliveryRequired&&result.emailPayload){let form;try{form=multipart(result.emailPayload,files);}catch{throw new DeliveryError('La consulta quedó registrada, pero no pudimos preparar los adjuntos para el correo. Contactá a NexBuy con el número de solicitud.',true);}return {...result,continueToEmail(){document.body.append(form);HTMLFormElement.prototype.submit.call(form);}};}
      return result;
    }catch(error){if(error instanceof DeliveryError)throw error;throw new DeliveryError('No pudimos confirmar el registro. Puede que NexBuy ya haya recibido tu consulta. Conservamos tus datos y el número de solicitud; verificá con NexBuy antes de volver a enviar.',true);}
    finally{clearTimeout(timer);}
  }
  return {submit};
})();

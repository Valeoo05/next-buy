'use strict';
const form=document.querySelector('#admin-login-form');
let signingIn=false;
form.addEventListener('submit',async event=>{
  event.preventDefault();if(signingIn)return;signingIn=true;
  const button=form.querySelector('button'),message=document.querySelector('#login-message');
  button.disabled=true;button.textContent='Ingresando…';message.hidden=true;form.setAttribute('aria-busy','true');
  try{
    const response=await fetch('/api/admin/login',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-NexBuy-Admin':'1'},body:JSON.stringify({username:document.querySelector('#username').value,password:document.querySelector('#password').value})});
    const result=await response.json();
    if(!response.ok||!result.signedIn)throw new Error(result.error||'No pudimos iniciar sesión. Intentá nuevamente.');
    document.querySelector('#password').value='';window.location.assign(new URLSearchParams(location.search).get('next')==='stock'?'/admin/stock':'/admin');
  }catch(error){message.textContent=error.message||'No pudimos conectar. Intentá nuevamente.';message.hidden=false;}
  finally{signingIn=false;button.disabled=false;button.textContent='Ingresar';form.removeAttribute('aria-busy');}
});

'use strict';
(()=>{
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

window.NexBuyUI={icon,hydrateIcons,esc};document.addEventListener('DOMContentLoaded',()=>hydrateIcons());
})();

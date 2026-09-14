(()=>{
 'use strict';
 // Icons are reused from the system's own module cards; labels and access rules stay intact.
 function decorateNavigation(){
  document.querySelectorAll('.side .nav button[data-page]').forEach(button=>{
   if(button.querySelector('.lar-nav-icon'))return;
   const page=button.dataset.page;
   const source=document.querySelector('.mod[data-open="'+page+'"] .op-icon svg');
   const holder=document.createElement('span');holder.className='lar-nav-icon';holder.setAttribute('aria-hidden','true');
   if(source)holder.append(source.cloneNode(true));
   else if(page==='home')holder.innerHTML='<svg viewBox="0 0 24 24"><path d="m3 10 9-7 9 7v10H3zM9 20v-7h6v7"/></svg>';
   else return;
   button.prepend(holder);
  });
 }
 document.addEventListener('click',event=>{
  if(event.target.closest('[data-lar-personal]'))window.MobileUX?.openPersonal();
 });
 decorateNavigation();
 const home=document.getElementById('page-home');
 const demo=[...home.querySelectorAll('.notice')].find(e=>e.textContent.includes('AMBIENTE DEMONSTRATIVO'));
 if(demo){
  const details=document.createElement('details');details.className='lar-demo-note';
  const summary=document.createElement('summary');summary.textContent='Ambiente de teste · dados fictícios';
  demo.before(details);details.append(summary,demo);
 }
 const suggestions=home.querySelector(':scope>.sg-box');if(suggestions)home.append(suggestions);
 window.LarVisual215={refresh:decorateNavigation};
})();

function larThemePrint215(raw){
 // Keep the full election/official document templates and v214 page-fit behavior.
 if(!/<html[\s>]/i.test(raw)||raw.includes('data-lar-print-preserve-template')||raw.includes('lar-print-theme-215'))return raw;
 const css='<style id="lar-print-theme-215">body{color:#203e50}thead th{background:#eaf3f6!important;color:#285870!important}h1,h2,h3{color:#285870}.lar-global-report-head{border-color:#356f8f!important}th,td{border-color:#cfdee5!important}@media print{thead th{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style>';
 return raw.replace(/<\/head>/i,css+'</head>');
}

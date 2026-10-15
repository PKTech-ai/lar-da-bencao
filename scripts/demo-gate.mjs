/** Porta da demonstração: login na frente do HTML até o visual final estar pronto. */
const HEAD = `<style id="demo-gate-style">
html:not([data-demo-open]) .app{display:none!important}
#demo-gate{position:fixed!important;inset:0!important;z-index:2147483647!important;display:grid!important;place-items:center!important;padding:24px!important;background:#f8f7f2!important;color:#203e50!important;font:16px/1.55 "Segoe UI",Arial,sans-serif!important;overflow:auto!important}
#demo-gate *{box-sizing:border-box!important}
#demo-gate .demo-card{width:min(470px,100%)!important;background:#fff!important;border:1px solid #dae5e9!important;border-radius:24px!important;padding:30px!important;box-shadow:0 16px 40px #203e5014!important}
#demo-gate .demo-brand{display:flex!important;flex-direction:column!important;align-items:center!important;text-align:center!important;gap:12px!important;margin:0 0 22px!important;color:#203e50!important;font-size:20px!important}
#demo-gate .demo-brand img{display:block!important;width:min(248px,100%)!important;height:auto!important;background:#fff!important;border:1px solid #e2e9e8!important;border-radius:16px!important;padding:18px 16px!important}
#demo-gate h1{display:block!important;margin:0 0 8px!important;font-size:28px!important;line-height:1.25!important;color:#203e50!important}
#demo-gate p{margin:0 0 16px!important;color:#617683!important}
#demo-gate form{display:grid!important;gap:16px!important}
#demo-gate label{display:grid!important;gap:7px!important;font-weight:700!important;font-size:14px!important;color:#526f7e!important}
#demo-gate input{font:16px/1.45 "Segoe UI",Arial,sans-serif!important;color:#203e50!important;border:1px solid #c8dce5!important;border-radius:10px!important;min-height:48px!important;padding:10px 12px!important;background:#fff!important}
#demo-gate button{min-height:48px!important;border-radius:10px!important;border:1px solid #356f8f!important;background:#356f8f!important;color:#fff!important;font-weight:700!important;cursor:pointer!important}
#demo-gate button:disabled{opacity:.7!important;cursor:wait!important}
#demo-gate .demo-fine{margin:16px 0 0!important;font-size:13px!important;color:#617683!important}
.demo-conflict-pointer{display:block!important;margin:4px 0 6px!important;padding:4px 6px!important;border-radius:6px!important;background:#fff4b8!important;color:#7b5a00!important;font:12px/1.35 "Segoe UI",Arial,sans-serif!important;font-weight:700!important;white-space:normal!important}
select.duplicate,select.conflict{outline:3px solid #d6a419!important;background:#fff4b8!important}
</style>
`;

const START = `<div id="demo-gate">
<section class="demo-card" aria-labelledby="demo-login-title">
<div class="demo-brand">
<img src="/marca-lar-da-bencao.png" alt="Centro Espírita Filantrópico Lar da Bênção" width="248" height="260">
<strong>Lar da Bênção</strong>
</div>
<h1 id="demo-login-title">Acesso institucional</h1>
<p>Entre com sua conta individual.</p>
<form id="demo-login-form">
<label>E-mail institucional<input name="email" type="email" value="usuario@email.com.br" autocomplete="username"></label>
<label>Senha<input name="password" type="password" value="*********" autocomplete="current-password"></label>
<button type="submit">Continuar</button>
</form>
<p class="demo-fine">Contas compartilhadas não são permitidas. Procure o Administrador para recuperar o acesso.</p>
</section>
<script>
document.getElementById("demo-login-form").addEventListener("submit",function(event){
  event.preventDefault();
  var button=event.currentTarget.querySelector("button");
  button.disabled=true;
  button.textContent="Entrando…";
  var open=function(){
    if(open.done) return;
    open.done=true;
    var gate=document.getElementById("demo-gate");
    if(gate) gate.remove();
    document.documentElement.setAttribute("data-demo-open","1");
  };
  if(document.readyState!=="loading") open();
  else document.addEventListener("DOMContentLoaded",open,{once:true});
});
</script>
</div>
`;

const END = `<script id="demo-gate-ready">
document.documentElement.dataset.demoSettled="1";
document.querySelectorAll("img.brand-logo, img[alt*='Logo']").forEach(function(img){
  if(img.closest("#demo-gate")) return;
  img.src="/marca-lar-da-bencao.png";
  img.alt="Centro Espírita Filantrópico Lar da Bênção";
});
(function(){
  if(typeof renderscale!=="function"||typeof cf!=="function"||typeof renderConflictDetails!=="function") return;
  var original=renderscale;
  renderscale=function(){
    var changed=document.activeElement&&document.activeElement.dataset?document.activeElement.dataset.k:"";
    original();
    try{
      var ym=month.value;
      var conflicts=cf(ym)||[];
      renderConflictDetails(ym,conflicts);
      var same=new Set(), other=new Set();
      conflicts.forEach(function(c){
        (c.keys||[]).forEach(function(k){(c.type==="same_day"?same:other).add(k);});
      });
      document.querySelectorAll("select[data-k]").forEach(function(sel){
        var key=sel.dataset.k;
        sel.classList.toggle("duplicate", same.has(key));
        sel.classList.toggle("conflict", other.has(key));
        var note=sel.nextElementSibling;
        if(note&&note.classList.contains("demo-conflict-pointer")) note.remove();
        if(!same.has(key)&&!other.has(key)) return;
        var lines=conflicts.filter(function(c){return (c.keys||[]).indexOf(key)>=0;}).flatMap(function(c){
          return (c.locations||[]).filter(function(loc){return loc.key!==key;}).map(function(loc){
            return loc.date+" · "+loc.dayName+" · "+(typeof slotLabel==="function"?slotLabel(loc):loc.activity);
          });
        });
        if(!lines.length) return;
        var pointer=document.createElement("div");
        pointer.className="demo-conflict-pointer";
        pointer.textContent="Já escalado em: "+lines.join(" | ");
        sel.insertAdjacentElement("afterend", pointer);
      });
      if(changed&&(same.has(changed)||other.has(changed))){
        var targetKey="";
        conflicts.some(function(c){
          if((c.keys||[]).indexOf(changed)<0) return false;
          targetKey=(c.keys||[]).filter(function(k){return k!==changed;})[0]||changed;
          return true;
        });
        var target=document.querySelector('[data-k="'+targetKey+'"]');
        if(target){
          target.scrollIntoView({behavior:"smooth",block:"center",inline:"center"});
          target.style.boxShadow="0 0 0 4px rgba(214,164,25,.55)";
          setTimeout(function(){target.style.boxShadow="";},1800);
        }
      }
    }catch(e){}
  };
})();
</script>
`;

export function applyDemoGate(html) {
  if (html.includes('id="demo-gate"')) return html;
  const withHead = html.replace(/<head[^>]*>/, (tag) => `${tag}${HEAD}`);
  if (withHead === html) throw new Error("O HTML de demonstração não tem <head>.");
  const withStart = withHead.replace("<body>\n", `<body>\n${START}`);
  if (withStart === withHead) throw new Error("O HTML de demonstração não tem <body>.");
  const endAt = withStart.lastIndexOf("</body>");
  if (endAt < 0) throw new Error("O HTML de demonstração não tem </body>.");
  return withStart.slice(0, endAt) + END + withStart.slice(endAt);
}

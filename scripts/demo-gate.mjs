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
.demo-conflict-pointer,.demo-where-pointer{display:block!important;margin:4px 0 6px!important;padding:4px 6px!important;border-radius:6px!important;background:#fff4b8!important;color:#7b5a00!important;font:12px/1.35 "Segoe UI",Arial,sans-serif!important;font-weight:700!important;white-space:normal!important;text-align:left!important}
.demo-where-pointer{background:#e7f1fb!important;color:#1d4e89!important}
select.duplicate,select.conflict{outline:3px solid #b45309!important;background:#fde68a!important;box-shadow:inset 0 0 0 2px #b45309!important}
select.demo-where{outline:3px solid #1d4e89!important;background:#e7f1fb!important}
#demo-where-banner{display:block!important;margin:0 0 12px!important;padding:12px 14px!important;border:1px solid #e3c35c!important;border-radius:10px!important;background:#fff9df!important;color:#7b5a00!important;font:14px/1.45 "Segoe UI",Arial,sans-serif!important}
#demo-where-banner strong{color:#7b5a00!important}
#demo-where-banner button{margin:8px 8px 0 0!important}
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
  if(typeof renderscale!=="function"||typeof cf!=="function"||typeof renderConflictDetails!=="function"||typeof slotInfo!=="function") return;
  var original=renderscale, painting=false;
  function placeText(info){
    return info.date+" · "+info.dayName+" · "+(typeof slotLabel==="function"?slotLabel(info):info.activity);
  }
  function placesOf(live, value, exceptKey){
    if(!live||!live.a||!value||String(value).indexOf("w:")!==0) return [];
    return Object.keys(live.a).filter(function(k){return k!==exceptKey&&live.a[k]===value;}).map(function(k){return slotInfo(month.value,k);});
  }
  function noteAfter(sel, className, text){
    var note=sel.nextElementSibling;
    if(note&&(note.classList.contains("demo-conflict-pointer")||note.classList.contains("demo-where-pointer"))) note.remove();
    if(!text) return;
    var pointer=document.createElement("div");
    pointer.className=className;
    pointer.textContent=text;
    sel.insertAdjacentElement("afterend", pointer);
  }
  renderscale=function(){
    var changed=window.__larScaleChanged||"";
    if(painting){original();return;}
    painting=true;
    try{
      original();
      var ym=month.value, live=db.scales[ym];
      var conflicts=cf(ym)||[];
      renderConflictDetails(ym,conflicts);
      var same=new Set(), other=new Set();
      conflicts.forEach(function(c){
        (c.keys||[]).forEach(function(k){(c.type==="same_day"?same:other).add(k);});
      });
      document.querySelectorAll("#sheet select[data-k]").forEach(function(sel){
        var key=sel.dataset.k, parts=key.split("|"), dow=Number(parts[0]), day=Number(parts[3]);
        Array.prototype.forEach.call(sel.options, function(opt){
          if(!opt.value||opt.value.indexOf("w:")!==0) return;
          var sameDay=placesOf(live, opt.value, key).filter(function(info){return info.dow===dow&&info.day===day;});
          if(!sameDay.length) return;
          var worker=typeof wb==="function"?wb(Number(opt.value.slice(2))):null;
          opt.textContent="Já escalado: "+sameDay.map(placeText).join(" | ")+" — "+(worker&&worker.name||"Trabalhador");
        });
        sel.classList.toggle("duplicate", same.has(key));
        sel.classList.toggle("conflict", other.has(key));
        var lines=conflicts.filter(function(c){return (c.keys||[]).indexOf(key)>=0;}).flatMap(function(c){
          return (c.locations||[]).filter(function(loc){return loc.key!==key;}).map(placeText);
        });
        noteAfter(sel, "demo-conflict-pointer", lines.length?"Já escalado em: "+lines.join(" | "):"");
        sel.onchange=function(){
          var current=db.scales[month.value];
          if(!current||!current.a) return;
          current.a[sel.dataset.k]=sel.value;
          current.e=current.e||{};
          current.e[sel.dataset.k]=1;
          current.reviewed=false;
          current.status="Em conferência pela Doutrina";
          window.__larScaleChanged=sel.dataset.k;
          save();
          if(typeof msgs==="function") msgs(month.value);
          renderscale();
          if(typeof dash==="function") dash();
          if(typeof dir==="function") dir();
        };
      });
      var banner=document.getElementById("demo-where-banner");
      if(!banner){
        banner=document.createElement("div");
        banner.id="demo-where-banner";
        banner.hidden=true;
        var sheet=document.getElementById("sheet");
        if(sheet) sheet.parentElement.insertBefore(banner, sheet);
      }
      var changedValue=changed&&live?live.a[changed]:"";
      var changedPlaces=placesOf(live, changedValue, changed);
      if(banner){
        if(!changedPlaces.length){banner.hidden=true;banner.textContent="";}
        else{
          var worker=typeof wb==="function"?wb(Number(String(changedValue).slice(2))):null;
          var name=worker&&worker.name||"Esta pessoa";
          banner.hidden=false;
          banner.textContent="";
          var title=document.createElement("strong");
          title.textContent=name+" já está na escala.";
          banner.appendChild(title);
          changedPlaces.forEach(function(info){
            var line=document.createElement("div");
            line.textContent=placeText(info);
            banner.appendChild(line);
            var cell=document.querySelector('#sheet select[data-k="'+info.key+'"]');
            if(cell&&!same.has(info.key)&&!other.has(info.key)){
              cell.classList.add("demo-where");
              noteAfter(cell, "demo-where-pointer", "Já está aqui: "+placeText(info));
            }
            if(!cell){
              var jump=document.createElement("button");
              jump.type="button";
              jump.className="btn";
              jump.textContent="Mostrar "+info.date+" na escala";
              jump.onclick=function(){dow.value=String(info.dow);renderscale();};
              banner.appendChild(jump);
            }
          });
          var first=document.querySelector('#sheet select[data-k="'+changedPlaces[0].key+'"]')||document.querySelector('#sheet select[data-k="'+changed+'"]');
          if(first) first.scrollIntoView({behavior:"smooth",block:"center",inline:"center"});
        }
      }
    }catch(e){}
    finally{painting=false;}
  };
  window.addEventListener("lar-data-refreshed", function(){
    if(!painting&&document.getElementById("sheet")) renderscale();
  });
  if(document.getElementById("sheet")) renderscale();
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

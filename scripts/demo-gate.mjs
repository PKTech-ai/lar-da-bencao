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
#sheet th.demo-sudoku-col,#sheet td.demo-sudoku-col{background:#fff4cc!important}
#sheet th.demo-sudoku-clash-col{background:#f4b4b4!important;color:#8f1d1d!important}
#sheet td.demo-sudoku-peer{background:#d7ebff!important;box-shadow:inset 0 0 0 2px #2b6cb0!important}
#sheet td.demo-sudoku-clash{background:#ffc9c9!important;box-shadow:inset 0 0 0 3px #d64545!important}
#sheet td.demo-sudoku-peer select,#sheet td.demo-sudoku-clash select{background:transparent!important;font-weight:800!important}
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
  if(typeof renderscale!=="function"||typeof cf!=="function") return;
  var original=renderscale, painting=false;
  function clearSudoku(){
    document.querySelectorAll("#sheet .demo-sudoku-col,#sheet .demo-sudoku-clash-col,#sheet .demo-sudoku-peer,#sheet .demo-sudoku-clash").forEach(function(el){
      el.classList.remove("demo-sudoku-col","demo-sudoku-clash-col","demo-sudoku-peer","demo-sudoku-clash");
    });
  }
  function shadeColumn(day, clash){
    document.querySelectorAll("#sheet table.sched").forEach(function(table){
      var heads=Array.prototype.slice.call(table.querySelectorAll("thead th"));
      var index=heads.findIndex(function(th){return th.textContent.trim()===String(day);});
      if(index<0) return;
      heads[index].classList.add("demo-sudoku-col");
      if(clash) heads[index].classList.add("demo-sudoku-clash-col");
      Array.prototype.forEach.call(table.querySelectorAll("tbody tr"), function(tr){
        var td=tr.children[index];
        if(!td) return;
        td.classList.add("demo-sudoku-col");
        if(clash) td.classList.add("demo-sudoku-clash-col");
      });
    });
  }
  function paintSudoku(focusValue, focusKey){
    clearSudoku();
    var byDay={};
    document.querySelectorAll("#sheet select[data-k]").forEach(function(sel){
      if(!sel.value||sel.value.indexOf("w:")!==0) return;
      var day=sel.dataset.k.split("|")[3];
      var id=sel.value+"|"+day;
      (byDay[id]=byDay[id]||[]).push(sel);
    });
    Object.keys(byDay).forEach(function(id){
      var group=byDay[id];
      if(group.length<2) return;
      shadeColumn(id.split("|")[1], true);
      group.forEach(function(sel){
        var td=sel.closest("td");
        if(td) td.classList.add("demo-sudoku-clash");
      });
    });
    if(!focusValue||String(focusValue).indexOf("w:")!==0) return;
    document.querySelectorAll("#sheet select[data-k]").forEach(function(sel){
      if(sel.value!==focusValue) return;
      var td=sel.closest("td");
      if(td&&!td.classList.contains("demo-sudoku-clash")) td.classList.add("demo-sudoku-peer");
    });
    if(focusKey) shadeColumn(focusKey.split("|")[3], false);
  }
  renderscale=function(){
    var changed=window.__larScaleChanged||"";
    if(painting){original();return;}
    painting=true;
    try{
      original();
      var live=db.scales[month.value];
      document.querySelectorAll("#sheet select[data-k]").forEach(function(sel){
        Array.prototype.forEach.call(sel.options, function(opt){
          var name=opt.textContent.split(" — ")[0].trim();
          if(name) opt.textContent=name;
        });
        sel.addEventListener("focus", function(){paintSudoku(sel.value, sel.dataset.k);});
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
      paintSudoku(changed&&live?live.a[changed]:"", changed);
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

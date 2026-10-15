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
#demo-scale-note{display:block!important;margin:0 0 12px!important;padding:12px 14px!important;border-radius:12px!important;background:#fff7ed!important;border:1px solid #fdba74!important;color:#9a3412!important;font:15px/1.45 "Segoe UI",Arial,sans-serif!important}
#demo-scale-note.is-repeat{background:#fff1f2!important;border-color:#fda4af!important;color:#9f1239!important}
#demo-scale-note[hidden]{display:none!important}
#sheet select.demo-repeat{outline:3px solid #e11d48!important;background:#ffe4e6!important;font-weight:800!important}
#sheet select.demo-also{outline:3px solid #1d4e89!important;background:#e7f3ff!important;font-weight:800!important}
#sheet .demo-slot-note{display:block!important;margin:4px 0 0!important;font:12px/1.3 "Segoe UI",Arial,sans-serif!important;font-weight:700!important;text-align:left!important;white-space:normal!important}
#sheet .demo-slot-note.is-repeat{color:#9f1239!important}
#sheet .demo-slot-note.is-also{color:#1d4e89!important}
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
  function workerName(value){
    var worker=typeof wb==="function"?wb(Number(String(value).slice(2))):null;
    return worker&&worker.name||"Esta pessoa";
  }
  function placeOf(sel){
    var info=typeof slotInfo==="function"?slotInfo(month.value, sel.dataset.k):null;
    var day=info?info.day:sel.dataset.k.split("|")[3];
    var activity=info&&info.activity?info.activity:"a escala";
    return "dia "+day+", em "+activity;
  }
  function listPlaces(selects){
    var labels=[];
    selects.forEach(function(sel){
      var label=placeOf(sel);
      if(labels.indexOf(label)<0) labels.push(label);
    });
    if(labels.length<=3) return labels.join("; ");
    return labels.slice(0,2).join("; ")+"; e em mais "+(labels.length-2)+" dias";
  }
  function noteUnder(sel, kind, text){
    var next=sel.nextElementSibling;
    if(next&&next.classList.contains("demo-slot-note")) next.remove();
    var note=document.createElement("div");
    note.className="demo-slot-note "+kind;
    note.textContent=text;
    sel.insertAdjacentElement("afterend", note);
  }
  function clearMarks(){
    document.querySelectorAll("#sheet select.demo-repeat,#sheet select.demo-also").forEach(function(sel){
      sel.classList.remove("demo-repeat","demo-also");
    });
    document.querySelectorAll("#sheet .demo-slot-note").forEach(function(note){note.remove();});
  }
  function explainPerson(focusValue){
    clearMarks();
    var note=document.getElementById("demo-scale-note");
    if(!note){
      note=document.createElement("div");
      note.id="demo-scale-note";
      note.hidden=true;
      var sheet=document.getElementById("sheet");
      if(sheet) sheet.parentElement.insertBefore(note, sheet);
    }
    var byPerson={};
    document.querySelectorAll("#sheet select[data-k]").forEach(function(sel){
      if(!sel.value||sel.value.indexOf("w:")!==0) return;
      (byPerson[sel.value]=byPerson[sel.value]||[]).push(sel);
    });
    var repeated=[];
    Object.keys(byPerson).forEach(function(value){
      var byDay={};
      byPerson[value].forEach(function(sel){
        var day=sel.dataset.k.split("|")[3];
        (byDay[day]=byDay[day]||[]).push(sel);
      });
      Object.keys(byDay).forEach(function(day){
        if(byDay[day].length<2) return;
        byDay[day].forEach(function(sel){
          sel.classList.add("demo-repeat");
          noteUnder(sel, "is-repeat", "Repetida neste dia");
        });
        repeated.push({value:value, day:day, selects:byDay[day]});
      });
    });
    var focus=byPerson[focusValue]||[];
    var focusRepeat=repeated.filter(function(item){return item.value===focusValue;})[0];
    if(!focusRepeat){
      focus.forEach(function(sel){
        if(focus.length<2) return;
        sel.classList.add("demo-also");
        noteUnder(sel, "is-also", "Já está aqui");
      });
    }
    function repeatSentence(item){
      var activities=[];
      item.selects.forEach(function(sel){
        var info=typeof slotInfo==="function"?slotInfo(month.value, sel.dataset.k):null;
        var activity=info&&info.activity?info.activity:"outra atividade";
        if(activities.indexOf(activity)<0) activities.push(activity);
      });
      return workerName(item.value)+" aparece "+item.selects.length+" vezes no dia "+item.day+": "+activities.join(" e ")+". Só essas vagas estão em vermelho.";
    }
    var shownRepeat=focusRepeat||(!focusValue?repeated[0]:null);
    var sentence="";
    if(shownRepeat){
      note.classList.add("is-repeat");
      sentence=repeatSentence(shownRepeat);
    }else if(focus.length>1){
      note.classList.remove("is-repeat");
      sentence=workerName(focusValue)+" já está na escala: "+listPlaces(focus)+". Só as vagas dessa pessoa estão em azul.";
    }else{
      note.classList.remove("is-repeat");
    }
    note.hidden=!sentence;
    note.textContent=sentence;
  }
  renderscale=function(){
    var changed=window.__larScaleChanged||"";
    if(painting){original();return;}
    painting=true;
    try{
      original();
      var live=db.scales[month.value];
      document.querySelectorAll("#sheet select[data-k]").forEach(function(sel){
        var day=sel.dataset.k.split("|")[3];
        Array.prototype.forEach.call(sel.options, function(opt){
          if(!opt.value||opt.value.indexOf("w:")!==0) return;
          var original=opt.textContent;
          var name=original.split(" — ")[0].trim()||workerName(opt.value);
          var activities=[];
          document.querySelectorAll("#sheet select[data-k]").forEach(function(other){
            if(other===sel||other.value!==opt.value||other.dataset.k.split("|")[3]!==day) return;
            var info=typeof slotInfo==="function"?slotInfo(month.value, other.dataset.k):null;
            var activity=info&&info.activity?info.activity:"outra atividade";
            if(activities.indexOf(activity)<0) activities.push(activity);
          });
          if(activities.length) opt.textContent=name+" — já está neste dia: "+activities.join(" e ");
          else if(original.indexOf("FOLGA:")>=0) opt.textContent=name+" — "+original.slice(original.indexOf("FOLGA:"));
          else opt.textContent=name;
        });
        sel.addEventListener("focus", function(){explainPerson(sel.value);});
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
      explainPerson(changed&&live?live.a[changed]:"");
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

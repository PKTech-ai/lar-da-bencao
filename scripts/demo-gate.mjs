/** Porta da demonstração: login na frente do HTML até o visual final estar pronto. */
const START = `<div id="demo-gate">
<style>
html:not([data-demo-open]) body > :not(#demo-gate){display:none!important}
#demo-gate{min-height:100vh;display:grid;place-items:center;padding:24px;background:#f8f7f2;color:#203e50;font:16px/1.55 "Segoe UI",Arial,sans-serif}
#demo-gate *{box-sizing:border-box}
#demo-gate .card{width:min(470px,100%);background:#fff;border:1px solid #dae5e9;border-radius:24px;padding:30px;box-shadow:0 16px 40px #203e5014}
#demo-gate .brand{display:flex;flex-direction:column;align-items:center;text-align:center;gap:12px;margin-bottom:22px}
#demo-gate img{width:min(248px,100%);height:auto;background:#fff;border:1px solid #e2e9e8;border-radius:16px;padding:18px 16px}
#demo-gate h1{margin:0 0 8px;font-size:28px;line-height:1.25;color:#203e50}
#demo-gate p{margin:0 0 16px;color:#617683}
#demo-gate form{display:grid;gap:16px}
#demo-gate label{display:grid;gap:7px;font-weight:700;font-size:14px;color:#526f7e}
#demo-gate input{font:16px/1.45 "Segoe UI",Arial,sans-serif;color:#203e50;border:1px solid #c8dce5;border-radius:10px;min-height:48px;padding:10px 12px;background:#fff}
#demo-gate button{min-height:48px;border-radius:10px;border:1px solid #356f8f;background:#356f8f;color:#fff;font-weight:700;cursor:pointer}
#demo-gate button:disabled{opacity:.7;cursor:wait}
#demo-gate .fine{margin:16px 0 0;font-size:13px;color:#617683}
</style>
<section class="card" aria-labelledby="demo-login-title">
<div class="brand">
<img src="/marca-lar-da-bencao.png" alt="Centro Espírita Filantrópico Lar da Bênção" width="248" height="260">
<div><strong>Lar da Bênção</strong></div>
</div>
<h1 id="demo-login-title">Acesso institucional</h1>
<p>Entre com sua conta individual.</p>
<form id="demo-login-form">
<label>E-mail institucional<input name="email" type="email" value="usuario@email.com.br" autocomplete="username"></label>
<label>Senha<input name="password" type="password" value="*********" autocomplete="current-password"></label>
<button type="submit">Continuar</button>
</form>
<p class="fine">Contas compartilhadas não são permitidas. Procure o Administrador para recuperar o acesso.</p>
</section>
<script>
document.getElementById("demo-login-form").addEventListener("submit",function(event){
  event.preventDefault();
  var button=event.currentTarget.querySelector("button");
  button.disabled=true;
  button.textContent="Entrando…";
  var open=function(){
    document.documentElement.dataset.demoOpen="1";
    document.getElementById("demo-gate").hidden=true;
  };
  if(document.documentElement.dataset.demoSettled==="1") open();
  else document.addEventListener("demo-settled",open,{once:true});
});
</script>
</div>
`;

const END = `<script id="demo-gate-ready">
document.querySelectorAll('img.brand-logo, img[alt*="Logo"]').forEach(function(img){
  img.src="/marca-lar-da-bencao.png";
  img.alt="Centro Espírita Filantrópico Lar da Bênção";
});
document.documentElement.dataset.demoSettled="1";
document.dispatchEvent(new Event("demo-settled"));
</script>
`;

export function applyDemoGate(html) {
  if (html.includes('id="demo-gate"')) return html;
  const withStart = html.replace("<body>\n", `<body>\n${START}`);
  if (withStart === html) throw new Error("O HTML de demonstração não tem <body>.");
  const endAt = withStart.lastIndexOf("</body>");
  if (endAt < 0) throw new Error("O HTML de demonstração não tem </body>.");
  return withStart.slice(0, endAt) + END + withStart.slice(endAt);
}

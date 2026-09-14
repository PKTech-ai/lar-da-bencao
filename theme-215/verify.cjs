const fs=require('fs'),path=require('path'),assert=require('assert/strict'),vm=require('vm');
const {chromium}=require('C:/Users/marcel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output=path.resolve(__dirname,'../../tmp/visual-215');fs.mkdirSync(output,{recursive:true});
const result={checks:[],errors:[]},ok=s=>{result.checks.push(s);console.log(s)};
const tick=p=>p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
(async()=>{
 const html=fs.readFileSync(path.resolve(__dirname,'../dist/index.html'),'utf8');
 for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){if(/type=["']application\//.test(m[1]))continue;new vm.Script(m[2])}ok('Scripts válidos.');
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1050}}),p=await context.newPage();
  await context.route('https://**',r=>r.abort());p.on('pageerror',e=>result.errors.push(e.message));
  await p.goto('http://127.0.0.1:8767/');await p.waitForFunction(()=>window.LarVisual215);await tick(p);
  assert(await p.locator('.lar-welcome-copy').isVisible());assert(await p.locator('.lar-welcome-emblem img').evaluate(i=>i.complete&&i.naturalWidth>0));
  assert(await p.locator('.side .lar-nav-icon').count()>12);
  await p.screenshot({path:path.join(output,'desktop-home.png'),fullPage:false});
  result.home=await p.locator('.op-welcome').innerText();
  await p.locator('[data-lar-personal]').click();assert(await p.locator('#mbPersonal').isVisible());await p.locator('#mbPersonalClose').click();ok('Identidade original, ícones e acesso à Minha área funcionam.');
  for(const [w,h] of [[360,800],[390,844],[768,1024],[1024,768],[1440,1050]]){
   await p.setViewportSize({width:w,height:h});await tick(p);
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${w}: página transborda`);
   if([390,768].includes(w))await p.screenshot({path:path.join(output,`home-${w}.png`)});
  }ok('Início sem transbordamento nas cinco larguras de celular, tablet e computador.');
  await p.setViewportSize({width:390,height:844});await p.locator('#mbModules').click();await tick(p);
  await p.screenshot({path:path.join(output,'mobile-menu.png')});
  await p.locator('#mbSearchModules').fill('doutrina');await tick(p);
  assert(await p.locator('.side .nav button[data-page="doutrina"]').isVisible());assert.equal(await p.locator('.side .nav button[data-page="eventos"]').isVisible(),false);
  await p.locator('.side .nav button[data-page="doutrina"]').click();await tick(p);ok('Busca e navegação de módulos pelo celular.');
  result.doutrinaTabs=await p.locator('#page-doutrina .mb-tab-picker select').first().locator('option').allTextContents();
  await p.locator('#page-doutrina .mb-tab-picker select').first().selectOption({label:'Caravana no Lar'});await p.locator('#clNew').click();await tick(p);
  assert.equal(await p.locator('#clDate').evaluate(e=>getComputedStyle(e).fontSize),'16px');
  await p.screenshot({path:path.join(output,'mobile-form.png')});
  await p.locator('#clName').fill('Conferência visual');await p.locator('#clSave').click();assert.match(await p.locator('#clMessage').innerText(),/sucesso/);ok('Formulário de 16px e salvamento preservados.');
  for(const [w,h] of [[390,844],[768,1024],[1024,768]]){await p.setViewportSize({width:w,height:h});await tick(p);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${w}: módulo transborda`)}
  await p.evaluate(()=>{setAccessCurrentUser(16);go('doutrina');month.value=doctrineAttendanceMonth.value='2026-10';activateDepartmentPanel('page-doutrina','p-frequency');renderDoctrineAttendance()});await tick(p);
  const field=row=>p.locator(`#doctrineAttendanceContent input[data-dow="6"][data-day="3"][data-row="${row}"]`);
  await p.setViewportSize({width:390,height:844});await field('estudo_obra').fill('10');await field('caravana_lar').fill('5');await p.waitForFunction(()=>doctrineAttendanceStats('2026-10').total===15);assert.equal(await field('__total__').inputValue(),'15');
  for(const [width,height] of [[390,844],[768,1024]]){
   await p.setViewportSize({width,height});await field('estudo_obra').scrollIntoViewIfNeeded();await tick(p);
   assert.equal(await field('estudo_obra').evaluate(e=>getComputedStyle(e.closest('tr').cells[0]).position),'sticky');
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await p.screenshot({path:path.join(output,`attendance-${width}.png`)});
  }ok('Frequência soma e salva ao digitar; coluna inicial fixa no celular e no tablet.');
  result.frequency=await p.evaluate(()=>({tables:[...document.querySelectorAll('.doctrine-attendance-table')].map(t=>({id:t.id,visible:!!t.getClientRects().length})),panels:[...document.querySelectorAll('#page-doutrina .sub button')].map(b=>({panel:b.dataset.panel,text:b.textContent}))}));
  await p.evaluate(()=>{setAccessCurrentUser(2);go('home')});await tick(p);assert.equal(await p.locator('.side .nav button[data-page="acesso"]').isVisible(),false);assert.equal(await p.evaluate(()=>accessCanOpen('acesso')),false);ok('Controle de Acesso permanece oculto para perfil não administrador.');
  const inventory=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../reliability-214/print-inventory.json'),'utf8')).reports;
  const chosen=[inventory.find(r=>/Frequência|frequência/.test(r.title)),inventory.find(r=>/Tesouraria|tesouraria|caixa/i.test(r.title)),inventory.find(r=>/agenda|Agenda/.test(r.title))].filter(Boolean);
  result.print=[];
  const printPage=await context.newPage();await printPage.addInitScript(()=>window.print=()=>{});
  for(const report of chosen){
   const old=fs.readFileSync(path.resolve(__dirname,'../../reliability-214/print-cases',report.name),'utf8');
   const themed=await p.evaluate(s=>larThemePrint215(s),old);
   await printPage.goto('about:blank');await printPage.setContent(themed);await printPage.waitForFunction(()=>document.documentElement.dataset.printFitReady==='1');await printPage.emulateMedia({media:'print'});
   const landscape=await printPage.evaluate(()=>[...document.styleSheets].flatMap(s=>[...s.cssRules]).some(r=>r.cssText.startsWith('@page')&&r.cssText.includes('landscape')));
   await printPage.setViewportSize({width:landscape?1047:718,height:1000});await printPage.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));
   assert.equal(await printPage.evaluate(()=>[...document.querySelectorAll('table,th,td,img')].filter(e=>e.getClientRects().length&&(e.getBoundingClientRect().right>innerWidth+3||e.getBoundingClientRect().left< -3)).length),0);
   await printPage.pdf({path:path.join(output,report.name.replace('.html','.pdf')),preferCSSPageSize:true,printBackground:true});
   result.print.push(report.title);
  }
  assert.equal(chosen.length,3);ok('Impressões de frequência, financeiro e agenda sem cortes horizontais.');
  assert.deepEqual(result.errors,[]);result.success=true;
 }finally{await browser.close();fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify(result,null,2))}
})().catch(e=>{console.error(e.stack);process.exitCode=1});

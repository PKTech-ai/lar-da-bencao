from pathlib import Path

folder=Path(__file__).resolve().parent
project=folder.parent
root=project.parent
text=(root/'SISTEMA_LAR_BENCAO_v214_IMPRESSAO_SALVAMENTO.html').read_text(encoding='utf-8')
def once(old,new):
 global text
 assert text.count(old)==1,(old[:100],text.count(old))
 text=text.replace(old,new,1)
once('<title>Lar da Benção — Versão 214 — Impressão e salvamento</title>','<title>Lar da Benção — Versão 215 — Visual acolhedor</title>')
once("const STORE='developerSuggestions', VERSION=214;","const STORE='developerSuggestions', VERSION=215;")
once("const release=Object.freeze({number:214,date:'13/09/2026',title:'Impressão ajustável e proteção das edições'});","const release=Object.freeze({number:215,date:'14/09/2026',title:'Visual acolhedor do Lar da Bênção'});")
once("const versions=[\n  {number:214,date:release.date,title:release.title,notes:[","""const versions=[
  {number:215,date:release.date,title:release.title,notes:[
   'Paleta de azul suave e verde sálvia, com fundo claro e a identidade do Lar.',
   'Menus com ícones e telas adaptadas para celular, tablet e computador.',
   'Formulários legíveis, coluna de nomes fixa e identidade visual das impressões.'
  ]},
  {number:214,date:'13/09/2026',title:'Impressão ajustável e proteção das edições',notes:[""")
old='''<div class="op-welcome"><div><span class="op-eyebrow">Rotina da Casa</span><h2>O que vamos acompanhar hoje?</h2><p>'+esc(dateText)+'</p></div><button type="button" class="btn access-allow" data-op-refresh>Atualizar painel</button></div>'''
new='''<div class="op-welcome"><div class="lar-welcome-copy"><span class="op-eyebrow">Seja bem-vindo</span><h2>Ao Lar da Bênção</h2><p>Uma Casa de estudo, acolhimento e caridade.</p><div class="lar-welcome-actions"><button type="button" class="btn primary access-allow" data-lar-personal>Acessar minha área</button><button type="button" class="btn access-allow" data-op-refresh>Atualizar painel</button></div><small class="lar-welcome-date">'+esc(dateText)+'</small></div><div class="lar-welcome-emblem"><img src="'+esc(getSystemBrandLogo())+'" alt="Lar da Bênção — Luz, Amor e Caridade Cristã"></div></div>'''
once(old,new)
once('return nativeWrite(larFitPrintHtml214(larInstitutionalizePrintHtml(raw)));','return nativeWrite(larThemePrint215(larFitPrintHtml214(larInstitutionalizePrintHtml(raw))));')
addition='\n<style id="lar-theme-215">\n'+(folder/'theme.css').read_text(encoding='utf-8')+'\n</style>\n<script id="lar-theme-215-script">\n'+(folder/'theme.js').read_text(encoding='utf-8')+'\n</script>\n'
pos=text.rfind('</body>')
assert pos>0
text=text[:pos]+addition+text[pos:]
for target in [project/'dist/index.html',root/'SISTEMA_LAR_BENCAO_v215_VISUAL_ACOLHEDOR.html',root/'SISTEMA_LAR_BENCAO_ATUALIZADO.html']:
 target.write_text(text,encoding='utf-8')
print('Versão 215 gerada. Bytes:',len(text.encode('utf-8')))

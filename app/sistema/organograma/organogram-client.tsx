"use client";

import { useState } from "react";

const PRINT_CSS = `
@page{size:A4 landscape;margin:7mm}
*{box-sizing:border-box}
body{font-family:Arial,Helvetica,sans-serif;color:#173247;margin:0;background:#fff}
.print-head{display:flex;align-items:center;gap:10px;border-bottom:2px solid #6FA7CB;padding-bottom:7px;margin-bottom:10px}
.print-head img{width:48px;height:48px;object-fit:contain}
.print-head h1{font-size:15pt;margin:0;color:#1F5F8B}
.print-head div div{font-size:8pt;color:#667C8C;margin-top:2px}
.notice{padding:7px;border:1px solid #C6DFEF;background:#EEF7FC;border-radius:7px;font-size:8pt;margin-bottom:9px}
.syn-wrap,.org-analytic-wrap{border:0!important;padding:0!important;background:#fff!important;overflow:visible!important}
.syn-level{display:flex;justify-content:center;gap:12px;margin:8px 0}
.syn-box{border:1px solid #A8CBE0;border-radius:8px;padding:8px;max-width:46%;background:#fff}
.syn-box h3{margin:0 0 4px;font-size:10pt;color:#1F5F8B}
.small,.syn-note{font-size:7.5pt;line-height:1.3}
.syn-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:5px}
.dept-mini{border:1px solid #C7DFED;border-radius:6px;padding:6px}
.dept-mini strong{font-size:7.5pt;color:#276F9D}
.dept-mini .small{font-size:6.5pt}
.card{border:0!important;padding:0!important}
.org-a-level{display:flex;justify-content:center;gap:12px}
.org-a-level-two{display:grid;grid-template-columns:1fr 100px 1fr;align-items:center;gap:10px;max-width:900px;margin:auto}
.org-a-box{border:1.5px solid #7FB4D3;border-radius:8px;padding:8px;text-align:center;background:#fff}
.org-a-box strong{display:block;color:#1F5F8B;font-size:9pt}
.org-a-box span{display:block;color:#3C789E;font-size:7pt;font-weight:bold;margin-top:2px}
.org-a-box small{display:block;color:#607A8B;font-size:6.5pt;margin-top:4px}
.org-a-assembly{max-width:560px;background:#EAF4FB}
.org-a-connector{height:17px;width:2px;background:#7EA9C3;margin:auto}
.org-a-relation{text-align:center;font-size:6.5pt;color:#5D7B8E}
.org-a-relation b{display:block;font-size:16pt;color:#2F78A8}
.org-a-dept-title{text-align:center;background:#DDEFF9;color:#215F89;border-radius:6px;padding:5px;font-weight:bold;font-size:8pt;margin-bottom:6px}
.org-a-dept-title small{display:block;font-weight:normal;font-size:6.5pt}
.org-a-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:5px}
.org-a-dept{border:1px solid #C7DFED;border-radius:6px;padding:6px;min-height:66px}
.org-a-dept strong{display:block;color:#276F9D;font-size:7.5pt;margin-bottom:3px}
.org-a-dept span{font-size:6.2pt;line-height:1.25;color:#5D7483}
.org-a-note{margin-top:7px;padding:6px;border-left:3px solid #5D9FC8;background:#EEF7FC;font-size:6.5pt}
.org-tabs,.no-print,button{display:none!important}
.org-a-legend{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px}
.org-a-pill{border:1px solid #BFD6E6;border-radius:999px;padding:4px 7px;font-size:6.5pt;font-weight:bold;background:#fff}
.org-a-reading-guide{border:1px solid #D8E8F2;background:#F7FBFE;border-radius:7px;padding:7px;margin-bottom:8px}
.org-a-reading-guide strong{display:block;color:#1F5F8B;font-size:7.5pt;margin-bottom:3px}
.org-a-reading-guide span{display:block;font-size:6.5pt;line-height:1.25}
.org-a-flow-label{text-align:center;font-size:6.5pt;color:#5F7C8F;margin:5px 0 3px;font-weight:bold}
.org-a-summary-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin:7px 0}
.org-a-summary-card{border:1px solid #CFE1EC;border-radius:6px;padding:6px;background:#fff}
.org-a-summary-card strong{display:block;color:#256892;font-size:7pt;margin-bottom:2px}
.org-a-summary-card span{display:block;font-size:6.2pt;line-height:1.2;color:#5D7483}
`;

function printOrganogram() {
  const active = document.querySelector<HTMLElement>(".org-demo .org-panel.active");
  const activeTab = document.querySelector<HTMLElement>(".org-demo .org-tabs button.active");
  if (!active) return;
  const tabTitle = (activeTab?.textContent || "Organograma").trim();
  const logo = `${window.location.origin}/marca-lar-da-bencao.png`;
  const sheet = window.open("", "_blank", "width=1200,height=850");
  if (!sheet) return;
  sheet.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${tabTitle} — Lar da Benção</title><style>${PRINT_CSS}</style></head><body><div class="print-head"><img src="${logo}" alt="Logo"><div><h1>${tabTitle}</h1><div>Centro Espírita Filantrópico Lar da Benção</div></div></div>${active.outerHTML}</body></html>`);
  sheet.document.close();
  sheet.focus();
  setTimeout(() => sheet.print(), 300);
}

export function OrganogramClient() {
  const [view, setView] = useState<"org-sintetico" | "org-analitico">("org-sintetico");

  return (
    <section className="card org-demo">
      <div className="toolbar">
        <div>
          <strong>Organograma Institucional</strong>
          <div className="small muted">Estrutura resumida e detalhada da Casa, alinhada ao Estatuto e ao Regimento Interno.</div>
        </div>
        <div className="org-actions no-print">
          <span className="badge ok">Acesso: todos os usuários ativos</span>
          <button className="print-soft" type="button" onClick={printOrganogram}>⎙ Imprimir organograma</button>
        </div>
      </div>

      <div className="org-tabs no-print" style={{ marginTop: 12 }}>
        <button type="button" className={view === "org-sintetico" ? "active" : undefined} onClick={() => setView("org-sintetico")}>Organograma Sintético</button>
        <button type="button" className={view === "org-analitico" ? "active" : undefined} onClick={() => setView("org-analitico")}>Organograma Analítico</button>
      </div>

      <div id="org-sintetico" className={view === "org-sintetico" ? "org-panel active" : "org-panel"}>
        <div className="notice">A <strong>Diretoria Executiva não é subordinada ao Conselho Fiscal</strong>. Diretoria e Conselho Fiscal ficam no mesmo nível institucional, ambos subordinados à <strong>Assembleia Geral</strong>; o Conselho Fiscal apenas fiscaliza a gestão e emite pareceres.</div>
        <div className="syn-wrap">
          <div className="syn-level">
            <div className="syn-box syn-blue">
              <h3>Assembleia Geral</h3>
              <div className="small"><strong>Função:</strong> órgão soberano da instituição. Delibera sobre assuntos relevantes, elege Diretoria e Conselho Fiscal, aprecia contas e alterações estatutárias.</div>
              <div className="syn-note"><strong>Subordinação:</strong> topo da estrutura institucional.</div>
            </div>
          </div>
          <div className="syn-level">
            <div className="syn-box syn-green">
              <h3>Diretoria Executiva</h3>
              <div className="small"><strong>Função:</strong> administra o Centro, executa as deliberações da Assembleia Geral, coordena os departamentos e zela pelo cumprimento do Estatuto e do Regimento.</div>
              <div className="syn-note"><strong>Subordinação:</strong> subordinada à Assembleia Geral.</div>
            </div>
            <div className="syn-box syn-red">
              <h3>Conselho Fiscal</h3>
              <div className="small"><strong>Função:</strong> fiscaliza a gestão econômico-financeira e patrimonial, examina balancetes e contas e emite pareceres à Assembleia Geral.</div>
              <div className="syn-note"><strong>Subordinação:</strong> subordinado à Assembleia Geral. <strong>Não há subordinação hierárquica da Diretoria ao Conselho Fiscal.</strong></div>
            </div>
          </div>
          <div className="card" style={{ marginTop: 10 }}>
            <strong>Departamentos e setores subordinados à Diretoria Executiva</strong>
            <div className="syn-grid" style={{ marginTop: 10 }}>
              <div className="dept-mini"><strong>Secretaria</strong><div className="small">Documentação, cadastro, arquivos, comunicação interna e apoio administrativo.</div></div>
              <div className="dept-mini"><strong>Tesouraria</strong><div className="small">Receitas, despesas, contribuições, caixa e balancetes.</div></div>
              <div className="dept-mini"><strong>Patrimônio</strong><div className="small">Bens, materiais, manutenção, controle e inventário.</div></div>
              <div className="dept-mini"><strong>Doutrina Espírita</strong><div className="small">Reuniões públicas, estudos, cursos e orientação doutrinária.</div></div>
              <div className="dept-mini"><strong>Infância</strong><div className="small">Atividades doutrinárias e educativas voltadas às crianças.</div></div>
              <div className="dept-mini"><strong>Juventude</strong><div className="small">Atividades doutrinárias e educativas voltadas aos jovens.</div></div>
              <div className="dept-mini"><strong>Assistência Social</strong><div className="small">Atendimento fraterno, apoio social e ações assistenciais.</div></div>
              <div className="dept-mini"><strong>Eventos</strong><div className="small">Eventos, campanhas, promoções e ações especiais.</div></div>
              <div className="dept-mini"><strong>Divulgação</strong><div className="small">Comunicação social e setores de Relações Públicas, Livraria, Biblioteca e Brinquedoteca.</div></div>
              <div className="dept-mini"><strong>Jurídico</strong><div className="small">Suporte jurídico, consultas e pareceres quando necessário.</div></div>
            </div>
          </div>
        </div>
      </div>

      <div id="org-analitico" className={view === "org-analitico" ? "org-panel active" : "org-panel"}>
        <div className="small muted" style={{ marginBottom: 10 }}>
          Versão detalhada, ilustrativa e autoexplicativa do organograma, construída diretamente no sistema.
          Ela mostra <strong>quem delibera</strong>, <strong>quem administra</strong>, <strong>quem fiscaliza</strong> e <strong>quem executa</strong> as atividades da Casa.
        </div>
        <div className="org-analytic-wrap">
          <div className="org-a-legend">
            <div className="org-a-pill assembly">🏛 Assembleia Geral — delibera e elege</div>
            <div className="org-a-pill board">🧭 Diretoria — administra e coordena</div>
            <div className="org-a-pill fiscal">🔎 Conselho Fiscal — fiscaliza e emite parecer</div>
            <div className="org-a-pill dept">🧩 Departamentos — executam as atividades</div>
          </div>
          <div className="org-a-reading-guide">
            <strong>Como ler este quadro:</strong>
            <span>1) A <b>Assembleia Geral</b> fica no topo porque é o órgão soberano.</span>
            <span>2) A <b>Diretoria</b> administra a instituição.</span>
            <span>3) O <b>Conselho Fiscal</b> acompanha e fiscaliza, sem subordinação hierárquica à Diretoria.</span>
            <span>4) Os <b>Departamentos</b> executam as atividades regulares da Casa, cada qual com sua finalidade própria.</span>
          </div>
          <div className="org-a-level">
            <div className="org-a-box org-a-assembly">
              <strong>ASSEMBLEIA GERAL</strong>
              <span>Órgão soberano da instituição</span>
              <small><b>Finalidade:</b> delibera sobre os assuntos institucionais mais relevantes.</small>
              <small><b>Competências principais:</b> aprecia contas, delibera sobre temas institucionais e elege a Diretoria e o Conselho Fiscal.</small>
            </div>
          </div>
          <div className="org-a-flow-label">Elege e legitima a estrutura administrativa e fiscal</div>
          <div className="org-a-connector" />
          <div className="org-a-level org-a-level-two">
            <div className="org-a-box org-a-board">
              <strong>DIRETORIA</strong>
              <span>Órgão de administração e coordenação</span>
              <small><b>Composição:</b> Presidente · Vice-Presidente · Secretário(a) · Tesoureiro(a)</small>
              <small><b>Função:</b> administra a Casa, executa as deliberações da Assembleia Geral e coordena os departamentos.</small>
            </div>
            <div className="org-a-relation">
              <span>Relação institucional</span>
              <b>⇄</b>
              <small>Fiscalização e parecer</small>
              <small>Sem subordinação hierárquica</small>
            </div>
            <div className="org-a-box org-a-fiscal">
              <strong>CONSELHO FISCAL</strong>
              <span>Órgão de fiscalização</span>
              <small><b>Finalidade:</b> acompanhar a gestão econômico-financeira e patrimonial.</small>
              <small><b>Função:</b> examina contas, verifica documentos e emite pareceres para controle institucional.</small>
            </div>
          </div>
          <div className="org-a-summary-grid">
            <div className="org-a-summary-card">
              <strong>O que a Diretoria faz?</strong>
              <span>Coordena, organiza, autoriza, supervisiona e integra os departamentos, preservando a unidade administrativa da Casa.</span>
            </div>
            <div className="org-a-summary-card">
              <strong>O que o Conselho Fiscal faz?</strong>
              <span>Controla, fiscaliza e acompanha a regularidade das contas e do patrimônio, sem administrar setores operacionais.</span>
            </div>
            <div className="org-a-summary-card">
              <strong>O que os departamentos fazem?</strong>
              <span>Executam o trabalho cotidiano e específico de cada área: doutrinária, educativa, assistencial, administrativa e institucional.</span>
            </div>
          </div>
          <div className="org-a-connector board-only" />
          <div className="org-a-dept-title">
            DEPARTAMENTOS E SETORES OPERACIONAIS
            <small>Executam as atividades permanentes da Casa, vinculados administrativamente à Diretoria</small>
          </div>
          <div className="org-a-grid">
            <div className="org-a-dept"><strong>📂 Secretaria</strong><span><b>Finalidade:</b> apoiar a organização administrativa.</span><span><b>Atividades:</b> documentação, atas, cadastros, arquivos, expedientes e controle de registros.</span></div>
            <div className="org-a-dept"><strong>💰 Tesouraria</strong><span><b>Finalidade:</b> zelar pelo controle financeiro.</span><span><b>Atividades:</b> receitas, despesas, contribuições, pagamentos, prestação de contas e fechamentos.</span></div>
            <div className="org-a-dept"><strong>🏠 Patrimônio</strong><span><b>Finalidade:</b> preservar os bens da instituição.</span><span><b>Atividades:</b> inventário, conservação, controle de materiais, equipamentos e espaços físicos.</span></div>
            <div className="org-a-dept"><strong>📚 Doutrina</strong><span><b>Finalidade:</b> promover o estudo e a vivência doutrinária.</span><span><b>Atividades:</b> reuniões, estudos, palestras, escalas, frequência e orientação espiritual.</span></div>
            <div className="org-a-dept"><strong>🧒 Infância</strong><span><b>Finalidade:</b> realizar a evangelização infantil.</span><span><b>Atividades:</b> matrículas, frequência, cronogramas, estudos, tratamento e relatórios anuais.</span></div>
            <div className="org-a-dept"><strong>🌱 Juventude</strong><span><b>Finalidade:</b> acompanhar a pré-juventude e a juventude.</span><span><b>Atividades:</b> evangelização, estudos, frequência, cronograma, tratamento e prestação de contas.</span></div>
            <div className="org-a-dept"><strong>🤝 Assistência e Promoção Social</strong><span><b>Finalidade:</b> prestar apoio social e promocional.</span><span><b>Atividades:</b> análise de famílias, rancho, doações, relatórios, acompanhamento e ações de promoção social.</span></div>
            <div className="org-a-dept"><strong>🎉 Eventos</strong><span><b>Finalidade:</b> apoiar e organizar atividades institucionais especiais.</span><span><b>Atividades:</b> campanhas, promoções, logística, apoio e execução de eventos da Casa.</span></div>
            <div className="org-a-dept org-a-dept-wide"><strong>📣 Divulgação</strong><span><b>Finalidade:</b> cuidar da comunicação institucional.</span><span><b>Atividades:</b> comunicação, avisos, publicações e integração com Relações Públicas, Livraria, Biblioteca e Brinquedoteca.</span></div>
            <div className="org-a-dept"><strong>⚖️ Jurídico</strong><span><b>Finalidade:</b> oferecer suporte jurídico institucional.</span><span><b>Atividades:</b> orientação, análise documental, apoio preventivo e representação quando necessária.</span></div>
          </div>
          <div className="org-a-note">
            <strong>Leitura institucional:</strong> a Assembleia Geral é o órgão soberano; a Diretoria administra; o Conselho Fiscal fiscaliza; e os departamentos executam as atividades finalísticas e de apoio.
          </div>
        </div>
      </div>
    </section>
  );
}

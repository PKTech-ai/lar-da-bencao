"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { NavIcon } from "@/components/nav-icon";
import { api } from "@/lib/client-api";
import { addDays, buildHomeStats, filterAgenda, todayInSaoPaulo, type AgendaItem } from "@/lib/home-dashboard";
import { brDate, formatMoney } from "@/lib/resources/types";

type Pending = { key: string; label: string; count: number; href: string; hint?: string };
type Area = {
  worker: { full_name: string; status: string; functions: string[]; departments: string[] } | null;
  cleaning: { clean_date: string; status: string; fee_cents: number; payment_status: string | null }[];
  shifts: { name: string; event_date: string | null; place: string }[];
  contributions: { reference_month: string; received_at: string; amount_cents: string; kind: string }[];
};
type Home = {
  institution: { name: string; founded_on?: string; motto: string };
  memory: { foundedOn: string; age: number; nextAnniversary: string; daysToAnniversary: number };
  cards: { key: string; label: string; value: string; href?: string; hint?: string }[];
  myArea: Area | null;
};
type VisibleModule = { href: string; label: string };

const BADGE_KEYS = new Set(["admissoes", "baixas", "sugestoes"]);
const MODULE_CARDS: { href: string; title: string; text: string; when?: "always" | "access" }[] = [
  { href: "/sistema/documentos", title: "Estatuto e Regimento", text: "Acesso institucional para todos os trabalhadores ativos, com os documentos completos e resumo das principais normas." },
  { href: "/sistema/organograma", title: "Organograma", text: "Visão sintética e analítica da estrutura institucional conforme Estatuto e Regimento.", when: "always" },
  { href: "/sistema/acesso", title: "Controle de Acesso", text: "Perfis, permissões, usuários e trilha de auditoria conforme a estrutura institucional da Casa.", when: "access" },
  { href: "/sistema/doutrina", title: "Dpto de Doutrina", text: "Escalas, estudos, palestras e trabalhadores." },
  { href: "/sistema/infancia", title: "Dpto da Infância", text: "Evangelização infantil: Maternal, Jardim e 1º ao 3º Ciclo." },
  { href: "/sistema/juventude", title: "Dpto da Juventude", text: "Pré-Juventude (13–14) e Juventude (15–21)." },
  { href: "/sistema/assistencia", title: "Assistência e Promoção Social", text: "Atendimentos, ações e relatórios do departamento." },
  { href: "/sistema/tesouraria", title: "Tesouraria", text: "Contribuições, fechamento de caixa mensal e relatório ao Conselho Fiscal." },
  { href: "/sistema/conselhofiscal", title: "Conselho Fiscal", text: "Recebimento, análise e parecer sobre o fechamento mensal da Tesouraria." },
  { href: "/sistema/patrimonio", title: "Dpto de Patrimônio", text: "Cadastro de bens, tombamento, fotos, notas fiscais e acompanhamento do patrimônio da Casa." },
  { href: "/sistema/eventos", title: "Dpto de Eventos", text: "Eventos, campanhas e promoções realizadas em benefício da Casa." },
  { href: "/sistema/divulgacao", title: "Dpto de Divulgação", text: "Comunicação social e setores de Relações Públicas, Livraria, Biblioteca e Brinquedoteca." },
  { href: "/sistema/juridico", title: "Dpto Jurídico", text: "Assistência, representação e orientação jurídica da instituição." },
  { href: "/sistema/secretaria", title: "Secretaria", text: "Cadastros gerais compartilhados e rotinas administrativas." },
  { href: "/sistema/presidencia", title: "Presidência", text: "Painel consolidado e supervisão." },
  { href: "/sistema/trabalhadores", title: "Trabalhadores", text: "Cadastro, funções e vínculos dos trabalhadores da Casa." },
  { href: "/sistema/admissoes", title: "Admissões", text: "Fichas encaminhadas à Diretoria para decisão." }
];
const SHORTCUTS = [
  { href: "/sistema/tesouraria", needs: "/sistema/tesouraria", title: "Contribuições" },
  { href: "/sistema/assistencia", needs: "/sistema/assistencia", title: "Atividades sociais" },
  { href: "/sistema/infancia/frequencia", needs: "/sistema/infancia", title: "Frequência da Infância" },
  { href: "/sistema/juventude/frequencia", needs: "/sistema/juventude", title: "Frequência da Juventude" },
  { href: "/sistema/eventos", needs: "/sistema/eventos", title: "Agenda de eventos" },
  { href: "/sistema/patrimonio", needs: "/sistema/patrimonio", title: "Cadastro de bens" },
  { href: "/sistema/divulgacao", needs: "/sistema/divulgacao", title: "Controle da livraria" },
  { href: "/sistema/secretaria", needs: "/sistema/secretaria", title: "Reuniões e atas" },
  { href: "/sistema/admissoes", needs: "/sistema/admissoes", title: "Aprovação de fichas" }
];

function routineTitle(item: Pending) {
  const n = item.count;
  if (item.key === "limpeza") return `${n} taxa(s) de limpeza pendente(s) de recebimento`;
  if (item.key === "conciliacao") return `${n} lançamento(s) de extrato para conferir com o caixa`;
  if (item.key === "caixa") return `${n} mês(es) do caixa ainda aberto(s)`;
  if (item.key === "parecer") return `${n} mês(es) aguardando parecer do Conselho Fiscal`;
  if (item.key === "emprestimos") return `${n} empréstimo(s) de livros com devolução atrasada`;
  return `${n} ${item.label}`;
}

function longDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
}

const CLEANING = { scheduled: "Escalado", done: "Realizada", fee: "Taxa de serviço", cancelled: "Cancelado" } as Record<string, string>;
const PEOPLE = "M16 19v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1M10 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM20 19v-1a3 3 0 0 0-2.2-2.9M16 5.1a3 3 0 0 1 0 5.8";
const ORG = "M5 5h6v6H5zM13 5h6v6h-6zM5 13h6v6H5zM13 13h6v6h-6z";

function monthShort(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").toUpperCase();
}

function OpIcon({ name }: { name: "calendar" | "check" | "people" | "org" }) {
  return (
    <svg className="op-icon" viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {name === "calendar" ? (
        <>
          <path d="M5 5h14v15H5z" />
          <path d="M5 10h14" />
        </>
      ) : null}
      {name === "check" ? <path d="M5 12.5 9.5 17 19 7" /> : null}
      {name === "people" ? <path d={PEOPLE} /> : null}
      {name === "org" ? <path d={ORG} /> : null}
    </svg>
  );
}

export function HomeClient({ moduleCount, modules, showAccess }: { moduleCount: number; modules: VisibleModule[]; showAccess: boolean }) {
  const [home, setHome] = useState<Home | null>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [agenda, setAgenda] = useState<AgendaItem[]>([]);
  const [undatedEvents, setUndatedEvents] = useState(0);
  const [period, setPeriod] = useState<0 | 7 | 30>(30);
  const historyRef = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void api<Home>("/api/home").then(setHome).catch((e: Error) => setError(e.message));
    void api<{ pending: Pending[] }>("/api/pendencias").then((b) => setPending(b.pending)).catch(() => undefined);
    void api<{ items: AgendaItem[]; undatedEvents?: number }>("/api/agenda").then((b) => {
      setAgenda(b.items);
      setUndatedEvents(b.undatedEvents ?? 0);
    }).catch(() => undefined);
  }, []);

  const today = todayInSaoPaulo();
  const todayLabel = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const badgePending = pending.filter((item) => BADGE_KEYS.has(item.key));
  const routines = pending.filter((item) => !BADGE_KEYS.has(item.key));
  const allowed = new Set(modules.map((mod) => mod.href));
  const cards = MODULE_CARDS.filter((card) => card.when === "always" || (card.when === "access" ? showAccess : allowed.has(card.href)));
  const shortcuts = SHORTCUTS.filter((item) => allowed.has(item.needs)).slice(0, 6);
  const stats = buildHomeStats({ today, moduleCount, agenda, pending: badgePending });
  const memory = home?.memory;
  const visibleAgenda = filterAgenda(agenda, today, period);
  const agendaTotal = agenda.filter((item) => item.date >= today && item.date <= addDays(today, period)).length;

  function reload() {
    window.location.reload();
  }

  return (
    <div className="grid">
      {error ? <div className="error" role="alert">{error}</div> : null}
      <section className="card lar-welcome">
        <div>
          <p className="op-eyebrow">Seja bem-vindo</p>
          <h2>Ao Lar da Bênção</h2>
          <p>{home?.institution.motto || "Uma Casa de estudo, acolhimento e caridade."}</p>
          <div className="lar-welcome-actions">
            <Link className="button primary" href="/sistema/conta">Acessar minha área</Link>
            <button className="button" type="button" onClick={reload}>Atualizar painel</button>
          </div>
          <small className="lar-welcome-date">{todayLabel}</small>
        </div>
        <div className="lar-welcome-emblem"><img src="/marca-lar-da-bencao.png" alt="" /></div>
      </section>

      <div className="op-stats">
        {stats.map((card) => (
          <article key={card.key} className={card.pending ? "op-stat op-pending" : "op-stat"}>
            <OpIcon name={card.icon} />
            <span>{card.label}</span>
            <b>{card.value}</b>
            <small>{card.hint}</small>
          </article>
        ))}
      </div>

      <div className="op-columns">
        <section className="op-section">
          <div className="op-section-head">
            <h3>Agenda</h3>
            <label>Período
              <select aria-label="Período da agenda" value={period} onChange={(event) => setPeriod(Number(event.target.value) as 0 | 7 | 30)}>
                <option value={0}>Hoje</option>
                <option value={7}>Próximos 7 dias</option>
                <option value={30}>Próximos 30 dias</option>
              </select>
            </label>
          </div>
          {visibleAgenda.length ? (
            <ul className="op-list">
              {visibleAgenda.map((item, index) => (
                <li key={`${item.date}-${index}`}>
                  <Link href={item.href} className="op-agenda-link">
                    <span className="op-date"><b>{item.date.slice(8)}</b>{monthShort(item.date)}</span>
                    <span className="op-line-copy"><strong>{item.label}</strong><small>{item.module}</small></span>
                    <span className="op-arrow" aria-hidden="true">›</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="op-empty">
              <strong>Nenhuma atividade neste período</strong>
              <p>Confira as agendas dos seus departamentos ou escolha outro período.</p>
            </div>
          )}
          <p className="op-footnote">
            {agendaTotal > 6
              ? `Exibindo as próximas 6 de ${agendaTotal} atividades. Abra o departamento para consultar a agenda completa.`
              : "Agenda formada pelos eventos, atividades sociais, treinamentos e limpeza cadastrados nos módulos liberados."}
          </p>
        </section>
        <section className="op-section">
          <div className="op-section-head">
            <h3>Pendências</h3>
            <span>Acompanhamento</span>
          </div>
          {badgePending.length ? (
            <ul className="op-list">
              {badgePending.map((item) => (
                <li key={item.key}>
                  <Link href={item.href} className="op-pending-link">
                    <span className="op-count">{item.count}</span>
                    <span className="op-line-copy"><strong>{item.label}</strong><small>{item.hint}</small></span>
                    <span className="op-arrow" aria-hidden="true">›</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="op-empty">
              <strong>Nenhuma pendência neste resumo</strong>
              <p>Não há fichas, pedidos ou sugestões aguardando análise nas categorias exibidas.</p>
            </div>
          )}
          {undatedEvents ? (
            <Link href="/sistema/eventos" className="op-pending-link">
              <OpIcon name="calendar" />
              <span className="op-line-copy"><strong>{undatedEvents} evento(s) com data a definir</strong><small>Consultar a agenda de eventos</small></span>
              <span className="op-arrow" aria-hidden="true">›</span>
            </Link>
          ) : null}
        </section>
      </div>

      {shortcuts.length ? (
        <>
          <h3 className="op-shortcut-heading">Acessos rápidos</h3>
          <div className="op-shortcuts">
            {shortcuts.map((item) => (
              <Link key={item.href} className="button" href={item.href}>{item.title}</Link>
            ))}
          </div>
        </>
      ) : null}

      <section className="op-section op-routines">
        <h3>Conferências da rotina</h3>
        {routines.length ? (
          <ul className="ops-list">
            {routines.map((item) => (
              <li key={item.key}><Link className="button" href={item.href}>{routineTitle(item)}</Link></li>
            ))}
          </ul>
        ) : <p className="muted">Nenhuma pendência adicional encontrada nas categorias acompanhadas dos módulos liberados.</p>}
      </section>

      <h2 className="op-modules-heading">Módulos disponíveis</h2>
      <div className="mods">
        {cards.map((card) => (
          <Link key={card.href} className="card mod" href={card.href}>
            <span className="mod-ico"><NavIcon href={card.href} /></span>
            <strong>{card.title}</strong>
            <p>{card.text}</p>
          </Link>
        ))}
      </div>

      {memory ? (
        <section className="home-institution-card">
          <div className="home-institution-head">
            <div>
              <strong>Memória Institucional — {home?.institution.name || "Lar da Bênção"}</strong>
              <div className="small muted">Referência permanente da data de fundação e idade da Casa.</div>
            </div>
            <span className="home-history-badge">Desde {memory.foundedOn.slice(0, 4)}</span>
          </div>
          <div className="home-institution-grid">
            <div className="home-history-item">
              <span className="home-history-label">Data de fundação</span>
              <strong>{longDate(memory.foundedOn)}</strong>
              <small>{brDate(memory.foundedOn)}</small>
            </div>
            <div className="home-history-item featured">
              <span className="home-history-label">Idade atual da Casa</span>
              <strong>{memory.age} anos</strong>
              <small>Idade em {brDate(today)} · cálculo automático</small>
            </div>
            <div className="home-history-item">
              <span className="home-history-label">Próximo aniversário</span>
              <strong>{longDate(memory.nextAnniversary)}</strong>
              <small>Completará {memory.age + 1} anos</small>
            </div>
          </div>
          <div className="home-institution-foot">
            <span>{home?.institution.name || "Centro Espírita Filantrópico Lar da Bênção"}</span>
            <span>{memory.age} anos de história, luz, amor e caridade cristã.</span>
          </div>
        </section>
      ) : null}

      <details className="visual-suggestions">
        <summary><span>Sugestões e melhorias</span><span className="visual-suggestions-hint">Enviar uma ideia ou acompanhar</span></summary>
        <div className="sg-heading">
          <p>O que você escrever chega à Diretoria. Você acompanha a resposta na central de sugestões.</p>
          <Link className="button primary" href="/sistema/sugestoes">Enviar sugestão</Link>
        </div>
      </details>

      <footer className="lar-system-footer">
        <p>Desenvolvido por <strong>PK Instituto</strong>, inspirada pela Espiritualidade Amiga.</p>
        <div className="lar-version-row">
          <span><strong>Versão 215</strong> · Atualização: 14/09/2026</span>
          <button className="button" type="button" onClick={() => historyRef.current?.showModal()}>Histórico de versões</button>
        </div>
      </footer>
      <dialog ref={historyRef} className="home-version-dialog" aria-labelledby="larVersionTitle">
        <div className="sg-heading">
          <h2 id="larVersionTitle">Controle de versão do sistema</h2>
          <button className="button" type="button" onClick={() => historyRef.current?.close()}>Fechar</button>
        </div>
        <p className="small muted">Versão em uso: 215. Histórico das atualizações mais recentes.</p>
        <article>
          <h3>Versão 215 — Visual acolhedor do Lar da Bênção</h3>
          <p className="small muted">14/09/2026</p>
          <ul>
            <li>Paleta de azul suave e verde sálvia, com fundo claro e a identidade do Lar.</li>
            <li>Menus com ícones e telas adaptadas para celular, tablet e computador.</li>
            <li>Formulários legíveis e a Visão Geral no mesmo desenho do visual.</li>
          </ul>
        </article>
      </dialog>

      {home?.myArea?.worker ? (
        <section className="card">
          <h2>Minha área</h2>
          <p className="small">
            {home.myArea.worker.full_name} · {home.myArea.worker.departments.join(" / ") || "sem departamento"}
            {home.myArea.worker.functions.length ? ` · ${home.myArea.worker.functions.join(", ")}` : ""}
          </p>
          <div className="grid cards">
            <article className="card">
              <h3>Escala de limpeza</h3>
              {home.myArea.cleaning.map((item) => (
                <p key={item.clean_date} className="small">
                  {brDate(item.clean_date)} · {CLEANING[item.status] ?? item.status}
                  {item.fee_cents ? ` · ${formatMoney(item.fee_cents)} ${item.payment_status === "paid" ? "recebida" : "pendente"}` : ""}
                </p>
              ))}
              {!home.myArea.cleaning.length ? <p className="small muted">Nenhuma escala próxima.</p> : null}
            </article>
            <article className="card">
              <h3>Eventos</h3>
              {home.myArea.shifts.map((item, index) => (
                <p key={`${item.name}-${index}`} className="small">{item.event_date ? brDate(item.event_date) : "data a definir"} · {item.name} · {item.place}</p>
              ))}
              {!home.myArea.shifts.length ? <p className="small muted">Você não está escalado para eventos.</p> : null}
            </article>
            <article className="card">
              <h3>Minhas contribuições</h3>
              {home.myArea.contributions.map((item, index) => (
                <p key={`${item.reference_month}-${index}`} className="small">{item.reference_month.split("-").reverse().join("/")} · {formatMoney(item.amount_cents)} · {item.kind}</p>
              ))}
              {!home.myArea.contributions.length ? <p className="small muted">Nenhuma contribuição registrada.</p> : null}
            </article>
          </div>
        </section>
      ) : null}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SuggestionsBox } from "@/components/suggestions-box";
import { api } from "@/lib/client-api";
import { addDays, filterAgenda, todayInSaoPaulo, type AgendaItem } from "@/lib/home-dashboard";
import { SYSTEM_VERSION, SYSTEM_VERSION_NOTE, SYSTEM_VERSION_UPDATED } from "@/lib/system-version";
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
  departamentos: { label: string; value: string; hint: string; href: string }[];
};
type VisibleModule = { href: string; label: string };

const BADGE_KEYS = new Set(["admissoes", "baixas", "sugestoes"]);
const SHORTCUTS = [
  { href: "/sistema/tesouraria/contribuicoes", needs: "/sistema/tesouraria", title: "Contribuições" },
  { href: "/sistema/assistencia/atividades", needs: "/sistema/assistencia", title: "Atividades sociais" },
  { href: "/sistema/infancia/frequencia", needs: "/sistema/infancia", title: "Frequência da Infância" },
  { href: "/sistema/juventude/frequencia", needs: "/sistema/juventude", title: "Frequência da Juventude" },
  { href: "/sistema/eventos/agenda", needs: "/sistema/eventos", title: "Agenda de eventos" },
  { href: "/sistema/patrimonio/bens", needs: "/sistema/patrimonio", title: "Cadastro de bens" },
  { href: "/sistema/divulgacao", needs: "/sistema/divulgacao", title: "Controle da livraria" },
  { href: "/sistema/secretaria/reunioes", needs: "/sistema/secretaria", title: "Reuniões e atas" },
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

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function longDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
}

const CLEANING = { scheduled: "Escalado", done: "Realizada", fee: "Taxa de serviço", cancelled: "Cancelado" } as Record<string, string>;

function monthShort(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").toUpperCase();
}

export function HomeClient({ modules }: { modules: VisibleModule[] }) {
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
  const shortcuts = SHORTCUTS.filter((item) => allowed.has(item.needs)).slice(0, 6);
  const memory = home?.memory;
  const visibleAgenda = filterAgenda(agenda, today, period);
  const agendaTotal = agenda.filter((item) => item.date >= today && item.date <= addDays(today, period)).length;

  const attention = [
    ...badgePending.map((item) => ({ key: item.key, href: item.href, count: item.count, title: item.label, hint: item.hint })),
    ...routines.map((item) => ({ key: item.key, href: item.href, count: item.count, title: capitalize(routineTitle(item).replace(/^\d+ /, "")), hint: undefined })),
    ...(undatedEvents ? [{ key: "eventos-sem-data", href: "/sistema/eventos/agenda", count: undatedEvents, title: "Evento(s) com data a definir", hint: undefined }] : [])
  ];
  const worker = home?.myArea?.worker;

  return (
    <div className="grid">
      {error ? <div className="error" role="alert">{error}</div> : null}
      <p className="home-greeting">{todayLabel} · {home?.institution.motto || "Uma Casa de estudo, acolhimento e caridade."}</p>



      <div className="op-columns">
        <section className="op-section">
          <div className="op-section-head"><h3>Precisa de atenção</h3></div>
          {attention.length ? (
            <ul className="op-list">
              {attention.map((item) => (
                <li key={item.key}>
                  <Link href={item.href} className="op-pending-link">
                    <span className="op-count">{item.count}</span>
                    <span className="op-line-copy"><strong>{item.title}</strong>{item.hint ? <small>{item.hint}</small> : null}</span>
                    <span className="op-arrow" aria-hidden="true">›</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <div className="op-empty"><strong>Tudo em dia</strong><p>Nenhuma ficha, pedido ou conferência aguardando nos seus módulos.</p></div>}
        </section>
        <section className="op-section">
          <div className="op-section-head">
            <h3>Agenda</h3>
            <select aria-label="Período da agenda" value={period} onChange={(event) => setPeriod(Number(event.target.value) as 0 | 7 | 30)}>
              <option value={0}>Hoje</option>
              <option value={7}>Próximos 7 dias</option>
              <option value={30}>Próximos 30 dias</option>
            </select>
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
          ) : <div className="op-empty"><strong>Nenhuma atividade neste período</strong></div>}
          {agendaTotal > 6 ? <p className="op-footnote">Exibindo 6 de {agendaTotal}. A agenda completa fica em cada departamento.</p> : null}
        </section>
      </div>

      {home?.departamentos.length ? (
        <section className="op-section">
          <div className="op-section-head"><h3>A Casa em números</h3></div>
          <div className="home-numbers">
            {home.departamentos.map((d) => (
              <Link key={d.label} href={d.href} className="home-number"><span>{d.label}</span><b>{d.value}</b><small>{d.hint}</small></Link>
            ))}
          </div>
        </section>
      ) : null}

      {worker && home?.myArea ? (
        <section className="op-section">
          <div className="op-section-head"><h3>Minha área</h3><Link href="/sistema/conta">Abrir</Link></div>
          <p className="small muted">{worker.full_name} · {worker.departments.join(" / ") || "sem departamento"}{worker.functions.length ? ` · ${worker.functions.join(", ")}` : ""}</p>
          <ul className="home-mine">
            {home.myArea.cleaning.slice(0, 2).map((item) => (
              <li key={item.clean_date}>Limpeza {brDate(item.clean_date)} · {CLEANING[item.status] ?? item.status}{item.fee_cents ? ` · ${formatMoney(item.fee_cents)} ${item.payment_status === "paid" ? "recebida" : "pendente"}` : ""}</li>
            ))}
            {home.myArea.shifts.slice(0, 2).map((item, index) => (
              <li key={`${item.name}-${index}`}>Evento {item.event_date ? brDate(item.event_date) : "data a definir"} · {item.name}</li>
            ))}
            {home.myArea.contributions.slice(0, 1).map((item, index) => (
              <li key={`${item.reference_month}-${index}`}>Última contribuição {item.reference_month.split("-").reverse().join("/")} · {formatMoney(item.amount_cents)}</li>
            ))}
            {!home.myArea.cleaning.length && !home.myArea.shifts.length && !home.myArea.contributions.length ? <li className="muted">Nada marcado para você nos próximos dias.</li> : null}
          </ul>
        </section>
      ) : null}

      <section className="home-go">
        <h3>Ir para</h3>
        {shortcuts.length ? (
          <div className="op-shortcuts">
            {shortcuts.map((item) => <Link key={item.href} className="button" href={item.href}>{item.title}</Link>)}
          </div>
        ) : null}
      </section>

      <SuggestionsBox />

      {memory ? (
        <p className="home-memory-line">
          {home?.institution.name || "Lar da Bênção"} · {memory.age} anos, fundada em {longDate(memory.foundedOn)} · {memory.daysToAnniversary === 0 ? "hoje é o aniversário da Casa!" : `próximo aniversário em ${memory.daysToAnniversary} dia(s)`}
        </p>
      ) : null}

      <footer className="lar-system-footer">
        <p>Desenvolvido por <strong>PK Instituto</strong>, inspirada pela Espiritualidade Amiga.</p>
        <div className="lar-version-row">
          <span><strong>Versão {SYSTEM_VERSION}</strong> · Atualização: {SYSTEM_VERSION_UPDATED}</span>
          <button className="button" type="button" onClick={() => historyRef.current?.showModal()}>Histórico de versões</button>
        </div>
      </footer>
      <dialog ref={historyRef} className="home-version-dialog" aria-labelledby="larVersionTitle">
        <div className="sg-heading">
          <h2 id="larVersionTitle">Controle de versão do sistema</h2>
          <button className="button" type="button" onClick={() => historyRef.current?.close()}>Fechar</button>
        </div>
        <p className="small muted">Versão em uso: {SYSTEM_VERSION}. Histórico das atualizações mais recentes.</p>
        <article>
          <h3>Versão {SYSTEM_VERSION} — {SYSTEM_VERSION_NOTE}</h3>
          <p className="small muted">{SYSTEM_VERSION_UPDATED}</p>
          <ul>
            <li>Início do sistema institucional do Lar da Bênção.</li>
            <li>Cadastros, escalas e controles passam a valer a partir desta versão.</li>
          </ul>
        </article>
      </dialog>

    </div>
  );
}

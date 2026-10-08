"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
  institution: { name: string; motto: string };
  cards: { key: string; label: string; value: string; href?: string; hint?: string }[];
  myArea: Area | null;
};

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

export function HomeClient({ moduleCount }: { moduleCount: number }) {
  const [home, setHome] = useState<Home | null>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [agenda, setAgenda] = useState<AgendaItem[]>([]);
  const [period, setPeriod] = useState<0 | 7 | 30>(30);
  const [error, setError] = useState("");

  useEffect(() => {
    void api<Home>("/api/home").then(setHome).catch((e: Error) => setError(e.message));
    void api<{ pending: Pending[] }>("/api/pendencias").then((b) => setPending(b.pending)).catch(() => undefined);
    void api<{ items: AgendaItem[] }>("/api/agenda").then((b) => setAgenda(b.items)).catch(() => undefined);
  }, []);

  const today = todayInSaoPaulo();
  const todayLabel = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const stats = buildHomeStats({ today, moduleCount, agenda, pending });
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
              : "Agenda formada pelos eventos, atividades, reuniões e limpeza cadastrados nos módulos liberados."}
          </p>
        </section>
        <section className="op-section">
          <div className="op-section-head">
            <h3>Pendências</h3>
            <span>Acompanhamento</span>
          </div>
          {pending.length ? (
            <ul className="op-list">
              {pending.map((item) => (
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
        </section>
      </div>

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

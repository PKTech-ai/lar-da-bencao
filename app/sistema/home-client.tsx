"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import { brDate, formatMoney } from "@/lib/resources/types";

type Card = { key: string; label: string; value: string; href?: string; hint?: string };
type Pending = { key: string; label: string; count: number; href: string };
type AgendaItem = { date: string; label: string; module: string; href: string };
type Area = {
  worker: { full_name: string; status: string; functions: string[]; departments: string[] } | null;
  cleaning: { clean_date: string; status: string; fee_cents: number; payment_status: string | null }[];
  shifts: { name: string; event_date: string | null; place: string }[];
  contributions: { reference_month: string; received_at: string; amount_cents: string; kind: string }[];
};
type Home = {
  institution: { name: string; motto: string };
  memory: { foundedOn: string; age: number; nextAnniversary: string; daysToAnniversary: number };
  cards: Card[];
  myArea: Area | null;
};

const CLEANING = { scheduled: "Escalado", done: "Realizada", fee: "Taxa de serviço", cancelled: "Cancelado" } as Record<string, string>;

export function HomeClient({ firstName }: { firstName: string }) {
  const [home, setHome] = useState<Home | null>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [agenda, setAgenda] = useState<AgendaItem[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    void api<Home>("/api/home").then(setHome).catch((e: Error) => setError(e.message));
    void api<{ pending: Pending[] }>("/api/pendencias").then((b) => setPending(b.pending)).catch(() => undefined);
    void api<{ items: AgendaItem[] }>("/api/agenda").then((b) => setAgenda(b.items)).catch(() => undefined);
  }, []);

  const memory = home?.memory;

  return (
    <div className="grid">
      {error ? <div className="error" role="alert">{error}</div> : null}
      <section className="card">
        <strong>Olá, {firstName}.</strong>
        <p className="muted">{home?.institution.motto}</p>
        {memory ? (
          <p className="small">
            Casa fundada em {brDate(memory.foundedOn)} · {memory.age} anos ·
            {memory.daysToAnniversary === 0 ? " hoje é o aniversário da Casa." : ` próximo aniversário em ${brDate(memory.nextAnniversary)} (${memory.daysToAnniversary} dia(s)).`}
          </p>
        ) : null}
      </section>

      {pending.length ? (
        <section className="card">
          <h2>Pendências para você</h2>
          <div className="grid cards">
            {pending.map((item) => (
              <Link key={item.key} href={item.href} className="card card-link kpi"><span className="small">{item.label}</span><b>{item.count}</b></Link>
            ))}
          </div>
        </section>
      ) : null}

      {agenda.length ? (
        <section className="card">
          <h2>Próximos 45 dias</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Data</th><th>Compromisso</th><th>Módulo</th></tr></thead>
              <tbody>
                {agenda.map((item, index) => (
                  <tr key={`${item.date}-${index}`}>
                    <td>{brDate(item.date)}</td>
                    <td><Link href={item.href}>{item.label}</Link></td>
                    <td className="small">{item.module}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {home?.cards.length ? (
        <section className="card">
          <h2>Seus módulos</h2>
          <div className="grid cards">
            {home.cards.map((card) => card.href
              ? <Link key={card.key} href={card.href} className="card card-link kpi"><span className="small">{card.label}</span><b>{card.value}</b></Link>
              : <article key={card.key} className="card kpi"><span className="small">{card.label}</span><b>{card.value}</b></article>)}
          </div>
        </section>
      ) : null}

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

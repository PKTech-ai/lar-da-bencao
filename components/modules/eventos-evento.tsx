"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ResourceManager } from "@/components/resources/resource-manager";
import { api, todayLocal } from "@/lib/client-api";
import { brDate } from "@/lib/resources/types";

type EventRow = { id: string; name: string; event_date: string | null; event_time: string; place: string; responsible: string; status: string };

const PARTS = [
  { key: "itens", label: "Itens", resource: "eventos-itens" },
  { key: "escala", label: "Escala", resource: "eventos-escala" },
  { key: "avaliacao", label: "Avaliação", resource: "eventos-avaliacao" }
] as const;

/** Tudo de um evento num lugar só: escolha o evento e veja itens, escala e avaliação dele. */
export function EventoCompleto() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [chosen, setChosen] = useState<string | null>(null);
  const [part, setPart] = useState<(typeof PARTS)[number]["key"]>("itens");
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ records: EventRow[] }>("/api/r/eventos-agenda").then((b) => setEvents(b.records)).catch((e: Error) => setError(e.message));
  }, []);

  // Próximo evento primeiro; depois os realizados, do mais recente para o mais antigo.
  const today = todayLocal();
  const ordered = useMemo(() => {
    const next = events.filter((e) => !e.event_date || e.event_date >= today).sort((a, b) => (a.event_date ?? "9999").localeCompare(b.event_date ?? "9999"));
    const past = events.filter((e) => e.event_date && e.event_date < today).sort((a, b) => (b.event_date ?? "").localeCompare(a.event_date ?? ""));
    return [...next, ...past];
  }, [events, today]);
  const current = ordered.find((e) => e.id === chosen) ?? ordered[0];
  const fixed = useMemo(() => (current ? { event_id: current.id } : undefined), [current]);
  const active = PARTS.find((p) => p.key === part) ?? PARTS[0];

  if (error) return <div className="error" role="alert">{error}</div>;
  if (!events.length) {
    return (
      <section className="card">
        <h2>Nenhum evento cadastrado</h2>
        <p>Cadastre o evento na Agenda para lançar itens, escala e avaliação.</p>
        <p><Link className="button primary" href="/sistema/eventos/agenda">Abrir a Agenda</Link></p>
      </section>
    );
  }

  return (
    <div className="grid">
      <section className="card">
        <label>Evento
          <select value={current?.id ?? ""} onChange={(e) => setChosen(e.target.value)}>
            {ordered.map((e) => <option key={e.id} value={e.id}>{e.name} · {e.event_date ? brDate(e.event_date) : "data a definir"}</option>)}
          </select>
        </label>
        {current ? (
          <div className="evento-resumo">
            <span><b>Data</b>{current.event_date ? brDate(current.event_date) : "A definir"}{current.event_time ? ` às ${current.event_time}` : ""}</span>
            <span><b>Local</b>{current.place || "—"}</span>
            <span><b>Responsável</b>{current.responsible || "—"}</span>
            <span><b>Situação</b>{current.status}</span>
          </div>
        ) : null}
        <div className="row-actions" style={{ marginTop: 12 }}>
          <Link className="button" href="/sistema/eventos/agenda">Editar na Agenda</Link>
          <Link className="button" href="/sistema/ingressos">Ingressos</Link>
        </div>
      </section>
      <div className="day-picker evento-partes" role="group" aria-label="Partes do evento" style={{ display: "flex" }}>
        {PARTS.map((p) => <button key={p.key} type="button" aria-pressed={p.key === part} onClick={() => setPart(p.key)}>{p.label}</button>)}
      </div>
      {current && fixed ? <ResourceManager key={`${active.resource}-${current.id}`} resourceKey={active.resource} fixedFilters={fixed} /> : null}
    </div>
  );
}

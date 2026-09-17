"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import { brDate } from "@/lib/resources/types";

type Board = { full_name: string; role_label: string; role_key: string; biennium: string | null; starts_on: string | null; ends_on: string | null };
type Department = { key: string; label: string; people: { name: string; role: string }[] };

export function OrganogramClient() {
  const [board, setBoard] = useState<Board[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    void api<{ board: Board[]; departments: Department[] }>("/api/organograma")
      .then((b) => { setBoard(b.board); setDepartments(b.departments); })
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <div className="grid">
      {error ? <div className="error" role="alert">{error}</div> : null}
      <div className="toolbar no-print"><span /><button type="button" className="button" onClick={() => window.print()}>⎙ Imprimir</button></div>
      <section className="card">
        <h2>Diretoria</h2>
        <div className="grid cards">
          {board.map((person) => (
            <article className="card" key={`${person.role_key}-${person.full_name}`}>
              <h3>{person.role_label}</h3>
              <p>{person.full_name}</p>
              {person.biennium ? <p className="small muted">{person.biennium} · {brDate(person.starts_on)} a {brDate(person.ends_on)}</p> : <p className="small muted">Sem biênio vinculado</p>}
            </article>
          ))}
          {!board.length ? <p className="small muted">Nenhum cargo da Diretoria cadastrado.</p> : null}
        </div>
      </section>
      <section className="card">
        <h2>Departamentos</h2>
        <div className="grid cards">
          {departments.map((department) => (
            <article className="card" key={department.key}>
              <h3>{department.label}</h3>
              {department.people.length
                ? department.people.map((person) => <p key={person.name} className="small">{person.name} — {person.role}</p>)
                : <p className="small muted">Sem coordenação cadastrada.</p>}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

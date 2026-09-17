"use client";

import { useCallback, useEffect, useState } from "react";
import type { EducationDepartment } from "@/lib/education";

type Group = { name: string; ages: string; enrolled: number; evangelizers: ({ worker_id: string; name: string } | null)[] };
type Payload = { groups: Group[]; workers: { id: string; full_name: string }[]; canEdit: boolean };

export function GroupsClient({ department }: { department: EducationDepartment }) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const response = await fetch(`/api/education/${department}/groups`, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    setData(body);
  }, [department]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load().catch((e) => setError(e.message)); }, [load]);

  async function assign(group: string, position: 0 | 1, workerId: string) {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/education/${department}/groups`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ group, position, worker_id: workerId || null })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao salvar.");
    } finally {
      await load().catch(() => undefined);
      setBusy(false);
    }
  }

  const linked = new Set(data?.groups.flatMap((g) => g.evangelizers.filter(Boolean).map((e) => e!.worker_id)) ?? []);
  const label = department === "infancia" ? "Turma" : "Grupo";
  return (
    <div className="grid">
      {error ? <div className="error" role="alert">{error}</div> : null}
      <div className="grid cards">
        <article className="card kpi"><span className="small muted">Evangelizandos ativos</span><b>{data?.groups.reduce((s, g) => s + g.enrolled, 0) ?? 0}</b></article>
        <article className="card kpi"><span className="small muted">{department === "infancia" ? "Turmas" : "Grupos"}</span><b>{data?.groups.length ?? 0}</b></article>
        <article className="card kpi"><span className="small muted">Evangelizadores vinculados</span><b>{linked.size}</b></article>
      </div>
      <section className="card">
        <h2>{department === "infancia" ? "Turmas da Evangelização Infantil" : "Grupos da Juventude"}</h2>
        <p className="small muted">Faixas etárias do Regimento Interno; a idade é considerada em 30 de junho. Dois evangelizadores por {label.toLowerCase()}, somente trabalhadores aprovados pela Diretoria.</p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>{label}</th><th>Faixa etária</th><th>Evangelizadores</th><th>Inscritos</th></tr></thead>
            <tbody>
              {data?.groups.map((g) => (
                <tr key={g.name}>
                  <td><strong>{g.name}</strong></td>
                  <td>{g.ages}</td>
                  <td>
                    {([0, 1] as const).map((position) => {
                      const current = g.evangelizers[position];
                      const other = g.evangelizers[position === 0 ? 1 : 0];
                      return data.canEdit ? (
                        <select key={position} value={current?.worker_id ?? ""} disabled={busy} aria-label={`${label} ${g.name} — evangelizador ${position + 1}`}
                          onChange={(e) => void assign(g.name, position, e.target.value)} style={{ marginBottom: 4 }}>
                          <option value="">Selecione</option>
                          {data.workers.map((w) => <option key={w.id} value={w.id} disabled={w.id === other?.worker_id}>{w.full_name}</option>)}
                        </select>
                      ) : <div key={position}>{current?.name ?? "—"}</div>;
                    })}
                    {g.evangelizers.filter(Boolean).length < 2 ? <span className="small muted">Faltam evangelizadores</span> : null}
                  </td>
                  <td>{g.enrolled}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

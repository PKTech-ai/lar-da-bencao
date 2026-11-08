"use client";

import { useCallback, useEffect, useState } from "react";
import { api, postJson } from "@/lib/client-api";

type Level = "nenhum" | "chamada" | "consulta" | "coordenacao";
type Link = { department_key: string; access_level: Exclude<Level, "nenhum">; updated_at: string; updated_by_name: string | null };
type Payload = {
  user: { id: string; full_name: string; email: string; role_key: string; role_label: string };
  links: Link[];
  departments: { key: string; label: string }[];
  worker: { functions: string[]; departments: string[] } | null;
  groups: { department_key: string; class_group: string }[];
  callDepartments: string[];
};

const OPTIONS: { value: Level; label: string; tone: string }[] = [
  { value: "nenhum", label: "Nenhum", tone: "none" },
  { value: "chamada", label: "Chamada", tone: "call" },
  { value: "consulta", label: "Consulta", tone: "read" },
  { value: "coordenacao", label: "Coordenação", tone: "full" }
];

function hint(level: Level, groups: string[]) {
  if (level === "nenhum") return "Não vê este departamento. Continua com a Minha área (escalas, turmas e perfil).";
  if (level === "chamada") {
    return groups.length
      ? `Vê só a chamada da turma ${groups.join(", ")}. Nada mais do departamento.`
      : "Vê só a chamada da própria turma. Atenção: ainda não está em nenhuma turma, então a chamada vai aparecer vazia.";
  }
  if (level === "consulta") return "Vê as telas do departamento, sem alterar nada e sem o telefone dos colegas.";
  return "Vê e altera tudo do departamento, inclusive a ficha completa dos trabalhadores.";
}

export function PersonAccess({ userId }: { userId: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [extra, setExtra] = useState<string[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => setData(await api<Payload>(`/api/users/${userId}/access`)), [userId]);
  // A carga inicial é a sincronização desta tela cliente com a API protegida.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load().catch((e: Error) => setError(e.message)); }, [load]);

  if (!data) return error ? <div className="error" role="alert">{error}</div> : <p className="muted">Carregando…</p>;

  const label = (key: string) => data.departments.find((d) => d.key === key)?.label ?? key;
  const levelOf = (key: string): Level => data.links.find((l) => l.department_key === key)?.access_level ?? "nenhum";
  const fichaDepartments = data.worker?.departments ?? [];
  const shown = [...new Set([...fichaDepartments, ...data.links.map((l) => l.department_key), ...extra])]
    .filter((key) => data.departments.some((d) => d.key === key))
    .sort((a, b) => label(a).localeCompare(label(b), "pt-BR"));
  const others = data.departments.filter((d) => !shown.includes(d.key));
  const groupsOf = (key: string) => data.groups.filter((g) => g.department_key === key).map((g) => g.class_group);
  const isAdmin = data.user.role_key === "administrador";

  async function choose(department: string, level: Level) {
    setBusy(department); setError(""); setMessage("");
    try {
      await postJson(`/api/users/${userId}/access`, { department, level }, "PUT");
      await load();
      setMessage(`${label(department)}: ${OPTIONS.find((o) => o.value === level)?.label}. Salvo.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível salvar.");
    } finally {
      setBusy("");
    }
  }

  const menu = ["Minha área", ...shown.flatMap((key) => {
    const level = levelOf(key);
    if (level === "nenhum") return [];
    if (level === "chamada") return [`Chamada · ${label(key)}`];
    return [level === "consulta" ? `${label(key)} (só consulta)` : label(key)];
  })];

  return (
    <div className="grid person-access">
      <section className="card">
        <h2>{data.user.full_name}</h2>
        <p className="muted small">{data.user.email} · Perfil: {data.user.role_label}</p>
        {data.worker ? (
          <p><strong>Trabalha como:</strong> {[
            data.worker.functions.join(", "),
            fichaDepartments.length ? `na ficha: ${fichaDepartments.map(label).join(", ")}` : "",
            data.groups.length ? `turmas: ${data.groups.map((g) => `${g.class_group} (${label(g.department_key)})`).join(", ")}` : ""
          ].filter(Boolean).join(" · ") || "ficha sem funções"}</p>
        ) : <p className="muted">Sem ficha de trabalhador vinculada.</p>}
        {isAdmin ? <div className="notice">Administrador vê tudo. As escolhas abaixo não mudam nada para ele.</div> : null}
      </section>

      {error ? <div className="error" role="alert">{error}</div> : null}
      {message ? <div className="success" role="status">{message}</div> : null}

      {shown.length === 0 ? <section className="card"><p className="muted">Sem acesso a nenhum departamento. Vê só a Minha área.</p></section> : null}

      {shown.map((key) => {
        const level = levelOf(key);
        const groups = groupsOf(key);
        const link = data.links.find((l) => l.department_key === key);
        const options = OPTIONS.filter((o) => o.value !== "chamada" || data.callDepartments.includes(key));
        return (
          <section className="card person-access-dept" key={key}>
            <div className="person-access-head">
              <div>
                <h3>{label(key)}</h3>
                <p className="muted small">
                  {fichaDepartments.includes(key) ? "Está na ficha" : "Fora da ficha"}
                  {groups.length ? ` · Turma ${groups.join(", ")}` : ""}
                </p>
              </div>
              <div className={`level-switch${options.length === 4 ? " four" : ""}`} role="group" aria-label={`Acesso em ${label(key)}`}>
                {options.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    data-level={option.tone}
                    aria-pressed={level === option.value}
                    disabled={Boolean(busy)}
                    onClick={() => level !== option.value && void choose(key, option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <p className="small">{hint(level, groups)}</p>
            {link?.updated_by_name ? (
              <p className="muted small">Alterado por {link.updated_by_name} em {new Date(link.updated_at).toLocaleDateString("pt-BR")}.</p>
            ) : null}
          </section>
        );
      })}

      {others.length ? (
        <section className="card">
          <label>+ Dar acesso a outro departamento
            <select value="" onChange={(e) => e.target.value && setExtra((list) => [...list, e.target.value])}>
              <option value="">Escolha o departamento</option>
              {others.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
            </select>
          </label>
        </section>
      ) : null}

      <section className="card">
        <h3>O que vê no menu</h3>
        <p>{menu.join(" · ")}</p>
        <p className="muted small">O perfil {data.user.role_label} pode somar telas gerais (Controle de Acesso). O acesso dado aqui vale por cima das exceções do perfil.</p>
      </section>
    </div>
  );
}

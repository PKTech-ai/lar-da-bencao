"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, postJson } from "@/lib/client-api";

type Page = { key: string; label: string };
type Role = { key: string; label: string };
type Grant = { role_key: string; page_key: string; level: string };
type Override = Grant & { updated_at: string; updated_by_name: string | null };
type Biennium = { id: string; label: string; starts_on: string; ends_on: string; status: string; version: number; members: number };

const LEVELS = [
  { value: "default", label: "Padrão do perfil" },
  { value: "full", label: "Completo" },
  { value: "read", label: "Somente consulta" },
  { value: "none", label: "Sem acesso" }
];
const levelLabel = (level: string | null) => (level === "full" ? "Completo" : level === "read" ? "Consulta" : level === "none" ? "Sem acesso" : "—");

export function AccessMatrix({ canSimulate }: { canSimulate: boolean }) {
  const [tab, setTab] = useState<"matriz" | "bienios" | "teste">("matriz");
  const [simRole, setSimRole] = useState("coordenador");
  const [simDepartments, setSimDepartments] = useState<string[]>([]);
  const [simulation, setSimulation] = useState<{ key: string; label: string; level: string | null }[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [bienniums, setBienniums] = useState<Biennium[]>([]);
  const [editing, setEditing] = useState<Biennium | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [matrix, list] = await Promise.all([
      api<{ pages: Page[]; roles: Role[]; grants: Grant[]; overrides: Override[] }>("/api/acesso/matriz"),
      api<{ bienniums: Biennium[] }>("/api/acesso/bienios")
    ]);
    setPages(matrix.pages); setRoles(matrix.roles); setGrants(matrix.grants); setOverrides(matrix.overrides);
    setBienniums(list.bienniums);
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load().catch((e: Error) => setError(e.message)); }, [load]);

  const grantOf = (role: string, page: string) => grants.find((g) => g.role_key === role && g.page_key === page)?.level ?? null;
  const overrideOf = (role: string, page: string) => overrides.find((o) => o.role_key === role && o.page_key === page)?.level ?? null;

  function change(role: string, page: string, level: string) {
    setBusy(true); setError(""); setMessage("");
    void api("/api/acesso/matriz", { method: "PUT", body: JSON.stringify({ role, page, level }) })
      .then(async () => { await load(); setMessage("Matriz atualizada e registrada no Dedo-duro."); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false));
  }

  function simulate() {
    const params = new URLSearchParams({ role: simRole });
    simDepartments.forEach((d) => params.append("department", d));
    setBusy(true); setError(""); setMessage("");
    void api<{ pages: { key: string; label: string; level: string | null }[] }>(`/api/acesso/teste?${params}`)
      .then((b) => setSimulation(b.pages))
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false));
  }

  function saveBiennium(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true); setError(""); setMessage("");
    void postJson("/api/acesso/bienios", {
      id: editing?.id, version: editing?.version,
      label: data.get("label"), starts_on: data.get("starts_on"), ends_on: data.get("ends_on"), status: data.get("status")
    })
      .then(async () => { setEditing(null); setCreating(false); await load(); setMessage("Biênio salvo."); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false));
  }

  return (
    <div className="grid">
      <nav className="row-actions no-print" aria-label="Seções do controle de acesso">
        <button type="button" className={`button${tab === "matriz" ? " primary" : ""}`} onClick={() => setTab("matriz")}>Matriz de acesso</button>
        <button type="button" className={`button${tab === "bienios" ? " primary" : ""}`} onClick={() => setTab("bienios")}>Biênios</button>
        {canSimulate ? <button type="button" className={`button${tab === "teste" ? " primary" : ""}`} onClick={() => setTab("teste")}>Testar acessos</button> : null}
        <button type="button" className="button" onClick={() => window.print()}>⎙ Imprimir</button>
      </nav>
      {error ? <div className="error" role="alert">{error}</div> : null}
      {message ? <div className="success" role="status">{message}</div> : null}

      {tab === "matriz" ? (
        <section className="card">
          <h2>Matriz de acesso por página</h2>
          <p className="small muted">
            O padrão vem do perfil. Uma exceção vale só para aquele perfil naquela página e fica registrada com autor e data.
            O Administrador enxerga tudo e não aparece na matriz.
          </p>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Perfil</th>{pages.map((p) => <th key={p.key}>{p.label}</th>)}</tr></thead>
              <tbody>
                {roles.filter((r) => r.key !== "administrador").map((role) => (
                  <tr key={role.key}>
                    <td><strong>{role.label}</strong></td>
                    {pages.map((page) => {
                      const base = grantOf(role.key, page.key);
                      const exception = overrideOf(role.key, page.key);
                      return (
                        <td key={page.key}>
                          <select
                            aria-label={`${role.label} em ${page.label}`}
                            value={exception ?? "default"}
                            disabled={busy || page.key === "acesso"}
                            onChange={(e) => change(role.key, page.key, e.target.value)}
                          >
                            {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.value === "default" ? `Padrão (${levelLabel(base)})` : l.label}</option>)}
                          </select>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {overrides.length ? (
            <>
              <h3>Exceções registradas</h3>
              <ul className="small">
                {overrides.map((o) => (
                  <li key={`${o.role_key}-${o.page_key}`}>
                    {roles.find((r) => r.key === o.role_key)?.label ?? o.role_key} · {pages.find((p) => p.key === o.page_key)?.label ?? o.page_key} · {levelLabel(o.level)}
                    {o.updated_by_name ? ` · por ${o.updated_by_name}` : ""} em {new Date(o.updated_at).toLocaleString("pt-BR")}
                  </li>
                ))}
              </ul>
            </>
          ) : <p className="small muted">Nenhuma exceção registrada: todos os perfis seguem o padrão.</p>}
        </section>
      ) : tab === "teste" ? (
        <section className="card">
          <h2>Testar acessos</h2>
          <p className="small muted">
            Simula o que um perfil enxerga em cada página, usando a mesma regra que o servidor aplica.
            Não abre sessão de ninguém e fica registrado no Dedo-duro. Indisponível em produção.
          </p>
          <div className="filters">
            <label>Perfil
              <select value={simRole} onChange={(e) => setSimRole(e.target.value)}>
                {roles.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
              </select>
            </label>
            <label>Departamentos vinculados
              <select multiple size={5} value={simDepartments} onChange={(e) => setSimDepartments([...e.target.selectedOptions].map((o) => o.value))}>
                {["doutrina", "infancia", "juventude", "assistencia_social", "patrimonio", "eventos", "divulgacao", "secretaria", "tesouraria", "juridico", "conselho_fiscal", "diretoria"].map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
            <button type="button" className="button primary" onClick={simulate} disabled={busy}>Simular</button>
          </div>
          {simulation.length ? (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Página</th><th>Acesso</th></tr></thead>
                <tbody>
                  {simulation.map((page) => (
                    <tr key={page.key}><td>{page.label}</td><td>{page.level === "full" ? "Completo" : page.level === "read" ? "Somente consulta" : "Sem acesso"}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="small muted">Escolha um perfil e clique em Simular.</p>}
        </section>
      ) : (
        <section className="card">
          <div className="toolbar">
            <h2>Biênios da Diretoria</h2>
            <button type="button" className="button primary no-print" onClick={() => { setCreating(true); setEditing(null); }}>+ Novo biênio</button>
          </div>
          <p className="small muted">Presidente, vice, secretaria, tesouraria e conselho fiscal só acessam durante o biênio vinculado, com 15 dias de tolerância após o fim.</p>
          {creating || editing ? (
            <form className="form-stack" onSubmit={saveBiennium} key={editing?.id ?? "novo"}>
              <div className="form-row">
                <label>Identificação *<input name="label" required minLength={2} maxLength={80} defaultValue={editing?.label} placeholder="Ex.: Biênio 2026–2027" /></label>
                <label>Início *<input type="date" name="starts_on" required defaultValue={editing?.starts_on} /></label>
                <label>Fim *<input type="date" name="ends_on" required defaultValue={editing?.ends_on} /></label>
                <label>Situação *
                  <select name="status" defaultValue={editing?.status ?? "active"}><option value="active">Vigente</option><option value="closed">Encerrado</option></select>
                </label>
              </div>
              <div className="row-actions">
                <button type="button" className="button" onClick={() => { setCreating(false); setEditing(null); }}>Cancelar</button>
                <button className="button primary" disabled={busy}>Salvar biênio</button>
              </div>
            </form>
          ) : null}
          <div className="table-wrap">
            <table>
              <thead><tr><th>Biênio</th><th>Período</th><th>Situação</th><th>Pessoas vinculadas</th><th className="no-print">Ação</th></tr></thead>
              <tbody>
                {bienniums.map((b) => (
                  <tr key={b.id}>
                    <td><strong>{b.label}</strong></td>
                    <td>{b.starts_on.split("-").reverse().join("/")} a {b.ends_on.split("-").reverse().join("/")}</td>
                    <td>{b.status === "active" ? "Vigente" : "Encerrado"}</td>
                    <td>{b.members}</td>
                    <td className="no-print"><button type="button" className="button" onClick={() => { setEditing(b); setCreating(false); }}>Editar</button></td>
                  </tr>
                ))}
                {!bienniums.length ? <tr><td colSpan={5}>Nenhum biênio cadastrado. Cadastre antes de vincular os cargos da Diretoria.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

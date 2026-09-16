"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Row = Record<string, string | null>;
type Result = { rows: Row[]; total: number; page: number; pageSize: number; facets: { users: { id: string; name: string }[]; modules: string[] } };

const categories = ["Acesso", "Inclusão", "Edição", "Exclusão", "Impressão", "Segurança"];

export function AuditClient({ canExport }: { canExport: boolean }) {
  const [filters, setFilters] = useState({ search: "", actor: "", category: "", module: "", result: "", from: "", to: "" });
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: "30" });
    Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
    return params.toString();
  }, [filters, page]);

  const load = useCallback(async () => {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/audit?${query}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setData(body);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Falha ao consultar histórico."); }
    finally { setBusy(false); }
  }, [query]);

  useEffect(() => { const timer = setTimeout(() => void load(), 250); return () => clearTimeout(timer); }, [load]);
  function change(key: keyof typeof filters, value: string) { setPage(1); setFilters((old) => ({ ...old, [key]: value })); }

  return (
    <section className="card">
      <div className="toolbar"><strong>{data?.total ?? 0} evento(s)</strong>{canExport ? <a className="button" href={`/api/audit/export?${query}`}>Exportar CSV</a> : null}</div>
      <div className="filters">
        <label>Pesquisar<input value={filters.search} onChange={(e) => change("search", e.target.value)} placeholder="Usuário, módulo, ação ou detalhes" /></label>
        <label>Usuário<select value={filters.actor} onChange={(e) => change("actor", e.target.value)}><option value="">Todos</option>{data?.facets.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
        <label>Tipo<select value={filters.category} onChange={(e) => change("category", e.target.value)}><option value="">Todos</option>{categories.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label>Módulo<select value={filters.module} onChange={(e) => change("module", e.target.value)}><option value="">Todos</option>{data?.facets.modules.map((m) => <option key={m}>{m}</option>)}</select></label>
        <label>Resultado<select value={filters.result} onChange={(e) => change("result", e.target.value)}><option value="">Todos</option><option value="success">Sucesso</option><option value="denied">Negado</option><option value="failed">Falhou</option><option value="cancelled">Cancelado</option></select></label>
        <label>De<input type="date" value={filters.from} onChange={(e) => change("from", e.target.value)} /></label>
        <label>Até<input type="date" value={filters.to} onChange={(e) => change("to", e.target.value)} /></label>
      </div>
      {error ? <div className="error" role="alert">{error}</div> : null}
      <div className="table-wrap" aria-busy={busy}>
        <table><thead><tr><th>Data/hora</th><th>Usuário</th><th>Tipo</th><th>Ação</th><th>Módulo / seção</th><th>Resultado</th><th>Detalhes</th><th>ID</th></tr></thead>
          <tbody>{data?.rows.map((row) => <tr key={row.id ?? ""}><td>{new Date(row.occurred_at ?? "").toLocaleString("pt-BR")}</td><td><strong>{row.actor_name_snapshot}</strong><br/><span className="muted">{row.role_snapshot}</span></td><td><span className="audit-badge">{row.category}</span></td><td>{row.action}</td><td>{row.module}<br/><span className="muted">{row.section}</span></td><td>{row.result}</td><td>{row.details ?? "—"}</td><td title={row.event_hash ?? ""}>{row.id?.slice(0, 8)}</td></tr>)}</tbody>
        </table>
      </div>
      <div className="pagination"><button className="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</button><span className="button">Página {page}</span><button className="button" disabled={!data || page * data.pageSize >= data.total} onClick={() => setPage((p) => p + 1)}>Próxima</button></div>
    </section>
  );
}

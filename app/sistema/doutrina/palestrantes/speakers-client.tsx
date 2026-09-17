"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

type Speaker = {
  id: string; full_name: string; house: string | null; city: string | null; themes: string[]; phone: string | null;
  notes: string; active: boolean; version: number; scheduled: number;
};

const splitThemes = (value: FormDataEntryValue | null) => String(value ?? "").split(",").map((t) => t.trim()).filter(Boolean);

export function SpeakersClient() {
  const [rows, setRows] = useState<Speaker[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [editing, setEditing] = useState<Speaker | "new" | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/speakers", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    setRows(body.speakers);
    setCanEdit(body.canEdit);
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load().catch((e) => setError(e.message)); }, [load]);

  async function run(url: string, method: string, payload: object, success: string) {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setEditing(null);
      setMessage(success);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao salvar.");
    } finally {
      setBusy(false);
    }
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const payload = {
      full_name: values.get("full_name"), house: values.get("house"), city: values.get("city"),
      themes: splitThemes(values.get("themes")), phone: values.get("phone"), notes: values.get("notes")
    };
    if (editing === "new") void run("/api/speakers", "POST", payload, "Palestrante cadastrado.");
    else if (editing) void run(`/api/speakers/${editing.id}`, "PATCH", { ...payload, active: editing.active, version: editing.version }, "Cadastro atualizado.");
  }

  function toggle(s: Speaker) {
    void run(`/api/speakers/${s.id}`, "PATCH", {
      full_name: s.full_name, house: s.house ?? "", city: s.city ?? "", themes: s.themes, phone: s.phone ?? "", notes: s.notes,
      active: !s.active, version: s.version
    }, s.active ? "Palestrante inativado: não entra em novas escalas." : "Palestrante reativado.");
  }

  const term = search.trim().toLocaleLowerCase("pt-BR");
  const visible = rows.filter((s) => !term || [s.full_name, s.house, s.city, ...s.themes].join(" ").toLocaleLowerCase("pt-BR").includes(term));
  const form = editing === "new" ? null : editing;

  return (
    <div className="grid">
      {error ? <div className="error" role="alert">{error}</div> : null}
      {message ? <div className="success" role="status">{message}</div> : null}
      {editing ? (
        <section className="card">
          <h2>{form ? `Editar — ${form.full_name}` : "Novo palestrante externo"}</h2>
          <form className="form-stack" onSubmit={save} key={form?.id ?? "new"}>
            <div className="form-row">
              <label>Nome *<input name="full_name" required minLength={2} maxLength={160} defaultValue={form?.full_name} /></label>
              <label>Contato<input name="phone" maxLength={40} defaultValue={form?.phone ?? ""} /></label>
            </div>
            <div className="form-row">
              <label>Casa espírita<input name="house" maxLength={160} defaultValue={form?.house ?? ""} /></label>
              <label>Cidade<input name="city" maxLength={120} defaultValue={form?.city ?? ""} placeholder="Manaus/AM" /></label>
            </div>
            <label>Temas (separados por vírgula)<input name="themes" defaultValue={form?.themes.join(", ") ?? ""} placeholder="Perdão, Família" /></label>
            <label>Observações<textarea name="notes" rows={2} maxLength={2000} defaultValue={form?.notes ?? ""} /></label>
            <div className="row-actions">
              <button className="button primary" disabled={busy}>Salvar</button>
              <button type="button" className="button" onClick={() => setEditing(null)}>Cancelar</button>
            </div>
          </form>
        </section>
      ) : null}
      <section className="card">
        <div className="toolbar">
          <h2>Palestrantes Externos</h2>
          <div className="row-actions">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pesquisar" style={{ maxWidth: 260 }} />
            {canEdit ? <button className="button primary" onClick={() => setEditing("new")}>+ Palestrante</button> : null}
          </div>
        </div>
        <div className="table-wrap" style={{ marginTop: 10 }}>
          <table>
            <thead><tr><th>Nome</th><th>Casa / Cidade</th><th>Temas</th><th>Contato</th><th>Situação</th><th>Ações</th></tr></thead>
            <tbody>
              {visible.map((s) => (
                <tr key={s.id}>
                  <td><strong>{s.full_name}</strong><br /><span className="small muted">{s.scheduled} escala(s)</span></td>
                  <td>{s.house ?? "—"}<br /><span className="small muted">{s.city ?? ""}</span></td>
                  <td>{s.themes.join(", ") || "—"}</td>
                  <td>{s.phone ?? "—"}</td>
                  <td><span className={`status ${s.active ? "ready" : ""}`}>{s.active ? "Ativo" : "Inativo"}</span></td>
                  <td>{canEdit ? (
                    <div className="row-actions">
                      <button className="button" disabled={busy} onClick={() => setEditing(s)}>Editar</button>
                      <button className={`button${s.active ? " danger" : ""}`} disabled={busy} onClick={() => toggle(s)}>{s.active ? "Inativar" : "Reativar"}</button>
                    </div>
                  ) : null}</td>
                </tr>
              ))}
              {!visible.length ? <tr><td colSpan={6}>Nenhum palestrante encontrado.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

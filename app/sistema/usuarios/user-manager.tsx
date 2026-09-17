"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

type Option = { key: string; label: string };
type User = { id: string; email: string; full_name: string; role_key: string; status: string; departments: string[]; version: number; invite_pending: boolean | null; mfa_enabled: boolean | null; last_login: string | null };
type Payload = { users: User[]; roles: Option[]; departments: Option[] };

export function UserManager() {
  const [data, setData] = useState<Payload>({ users: [], roles: [], departments: [] });
  const [editing, setEditing] = useState<User | null>(null);
  const [error, setError] = useState(""); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { const response = await fetch("/api/users", { cache: "no-store" }); const body = await response.json(); if (!response.ok) throw new Error(body.error); setData(body); }, []);
  // A carga inicial é a sincronização desta tela cliente com a API protegida.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load().catch((e) => setError(e.message)); }, [load]);

  function departments(form: HTMLFormElement) { return [...form.querySelectorAll<HTMLInputElement>('input[name="departments"]:checked')].map((item) => item.value); }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage(""); const form = event.currentTarget, values = new FormData(form);
    try { const response = await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: values.get("email"), name: values.get("name"), role: values.get("role"), status: values.get("status"), departments: departments(form) }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error); form.reset(); setMessage("Convite enviado. O usuário deverá criar a senha e ativar o MFA."); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Falha ao convidar."); } finally { setBusy(false); }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editing) return; setBusy(true); setError(""); setMessage(""); const form = event.currentTarget, values = new FormData(form);
    try { const response = await fetch(`/api/users/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: values.get("name"), role: values.get("role"), status: values.get("status"), departments: departments(form), version: editing.version }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error); setEditing(null); setMessage("Acesso atualizado e registrado no Dedo-duro."); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Falha ao atualizar."); } finally { setBusy(false); }
  }

  async function revokeSessions(userId: string) {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/users/${userId}/sessions/revoke`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      if (body.self) { window.location.replace("/auth/signout?motivo=sessao"); return; }
      setMessage("Sessões encerradas em todos os aparelhos deste usuário.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao encerrar sessões.");
    } finally {
      setBusy(false);
    }
  }

  async function resendInvite(user: User) {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/users/${user.id}/invite`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setMessage(`Convite reenviado para ${user.email}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao reenviar convite.");
    } finally {
      setBusy(false);
    }
  }

  async function resetMfa(user: User) {
    if (!window.confirm(`Redefinir o MFA de ${user.full_name}? Os códigos de recuperação serão invalidados, as sessões encerradas e o usuário cadastrará um novo autenticador no próximo acesso.`)) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/users/${user.id}/mfa/reset`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setMessage("MFA redefinido. O usuário cadastrará um novo autenticador no próximo acesso.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao redefinir MFA.");
    } finally {
      setBusy(false);
    }
  }

  const fields = (user?: User) => <>
    <label>Nome completo<input name="name" defaultValue={user?.full_name} required minLength={3} maxLength={160} /></label>
    {!user ? <label>E-mail<input name="email" type="email" required /></label> : null}
    <label>Perfil<select name="role" defaultValue={user?.role_key ?? "trabalhador"}>{data.roles.map((role) => <option key={role.key} value={role.key}>{role.label}</option>)}</select></label>
    <label>Situação<select name="status" defaultValue={user?.status ?? "active"}><option value="active">Ativo</option><option value="pending">Pendente</option>{user ? <option value="suspended">Suspenso</option> : null}</select></label>
    <fieldset style={{ border: 0, padding: 0 }}><legend style={{ fontWeight: 700, marginBottom: 7 }}>Departamentos</legend><div className="grid cards">{data.departments.map((department) => <label key={department.key} style={{ display: "flex", alignItems: "center", gridTemplateColumns: "auto 1fr", fontWeight: 400 }}><input style={{ width: 20, minHeight: 20 }} type="checkbox" name="departments" value={department.key} defaultChecked={user?.departments.includes(department.key)} />{department.label}</label>)}</div></fieldset>
  </>;

  return <div className="grid">
    <section className="card"><h2>Convidar usuário</h2><form className="form-stack" onSubmit={create}>{fields()}<button className="button primary" disabled={busy}>Enviar convite</button></form></section>
    {editing ? <section className="card"><div className="toolbar"><h2>Editar acesso</h2><button className="button" onClick={() => setEditing(null)}>Cancelar</button></div><form className="form-stack" key={editing.id} onSubmit={save}>{fields(editing)}<button className="button primary" disabled={busy}>Salvar alteração</button></form></section> : null}
    {error ? <div className="error" role="alert">{error}</div> : null}{message ? <div className="success">{message}</div> : null}
    <section className="card"><h2>Contas institucionais</h2><div className="table-wrap"><table><thead><tr><th>Usuário</th><th>Perfil</th><th>Departamentos</th><th>Situação</th><th>Acesso</th><th>Ação</th></tr></thead><tbody>{data.users.map((user) => <tr key={user.id}><td><strong>{user.full_name}</strong><br/><span className="muted">{user.email}</span></td><td>{data.roles.find((role) => role.key === user.role_key)?.label ?? user.role_key}</td><td>{user.departments.map((key) => data.departments.find((d) => d.key === key)?.label ?? key).join(", ") || "—"}</td><td>{user.status}</td><td className="small">{user.invite_pending ? <span className="status building">Convite pendente</span> : user.mfa_enabled === false ? <span className="status danger">Sem MFA</span> : user.mfa_enabled ? <span className="status ready">MFA ativo</span> : "—"}<br />{user.last_login ? `Último acesso: ${new Date(user.last_login).toLocaleString("pt-BR")}` : "Nunca acessou"}</td><td><button className="button" onClick={() => setEditing(user)}>Editar</button>{user.invite_pending ? <> <button className="button" disabled={busy} onClick={() => void resendInvite(user)}>Reenviar convite</button></> : null} <button className="button danger" disabled={busy} onClick={() => void revokeSessions(user.id)}>Encerrar sessões</button> <button className="button danger" disabled={busy} onClick={() => void resetMfa(user)}>Redefinir MFA</button></td></tr>)}</tbody></table></div></section>
  </div>;
}

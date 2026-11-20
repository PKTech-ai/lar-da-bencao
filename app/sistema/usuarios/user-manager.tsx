"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useShowMore } from "@/components/show-more";
import { accessState, lastAccessText, needsAttention } from "@/lib/user-access-status";

type Option = { key: string; label: string };
type User = {
  id: string; email: string; full_name: string; role_key: string; status: string; departments: string[]; version: number;
  invite_pending: boolean | null; last_login: string | null; biennium_id: string | null; worker_id: string | null; access_allowed: boolean; admissions_access: boolean;
  /** Nome da ficha de trabalhador vinculada: é o que aparece na lista. */
  worker_name: string | null;
  must_reset_password: boolean; last_access: string | null; can_reset_password: boolean;
};
type Biennium = { id: string; label: string; starts_on: string; ends_on: string; status: string };
type Payload = { users: User[]; me?: string; roles: Option[]; departments: Option[]; bienniums: Biennium[]; workers: { id: string; full_name: string }[] };

/** A lista mostra o nome da ficha: a conta pode ter outro nome (ex.: a conta "Administrador"). */
const displayName = (user: User) => user.worker_name || user.full_name;

function departmentsText(user: User, departments: Option[]) {
  if (user.role_key === "administrador") return "Vê tudo";
  if (!user.departments.length) return "Só Minha área";
  const names = user.departments.map((key) => departments.find((d) => d.key === key)?.label ?? key);
  return names.length > 2 ? `${names.slice(0, 2).join(", ")} +${names.length - 2}` : names.join(", ");
}

const initialsOf = (name: string) => name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
const avatarTone = (id: string) => `c${(parseInt(id.slice(0, 2), 16) % 8 || 0) + 1}`;

export function UserManager() {
  const [data, setData] = useState<Payload>({ users: [], roles: [], departments: [], bienniums: [], workers: [] });
  const [editing, setEditing] = useState<User | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const term = search.trim().toLocaleLowerCase("pt-BR");
  // Busca pelo nome da ficha e pelo nome da conta. Quem pede atenção vem primeiro; depois, ordem alfabética.
  const users = data.users
    .filter((u) => !term || `${u.worker_name ?? ""} ${u.full_name} ${u.email}`.toLocaleLowerCase("pt-BR").includes(term))
    .sort((a, b) => Number(needsAttention(b)) - Number(needsAttention(a)) || displayName(a).localeCompare(displayName(b), "pt-BR"));
  const more = useShowMore(users.length, term);
  const [error, setError] = useState(""); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { const response = await fetch("/api/users", { cache: "no-store" }); const body = await response.json(); if (!response.ok) throw new Error(body.error); setData(body); }, []);
  // A carga inicial é a sincronização desta tela cliente com a API protegida.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load().catch((e) => setError(e.message)); }, [load]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage(""); const form = event.currentTarget, values = new FormData(form);
    try { const response = await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: values.get("email"), name: values.get("name"), role: values.get("role"), status: values.get("status"), admissions_access: values.get("admissions_access") === "on" }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error); form.reset(); setMessage("Convite enviado. O usuário deverá criar a senha."); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Falha ao convidar."); } finally { setBusy(false); }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editing) return; setBusy(true); setError(""); setMessage(""); const form = event.currentTarget, values = new FormData(form);
    try { const response = await fetch(`/api/users/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: values.get("name"), role: values.get("role"), status: values.get("status"), biennium_id: values.get("biennium_id") || null, worker_id: values.get("worker_id") || null, admissions_access: values.get("admissions_access") === "on", version: editing.version }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error); setEditing(null); setMessage("Acesso atualizado e registrado no Dedo-duro."); await load(); }
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

  /** Recadastrar senha: a pessoa volta a entrar com o CPF e cria uma senha nova. Nenhuma senha aparece aqui. */
  async function resetPassword(user: User) {
    const name = displayName(user);
    if (!window.confirm(`Recadastrar a senha de ${name}?\n\nNo próximo acesso, ${name} entra com o CPF (no login e na senha) e cria uma senha nova. As sessões abertas dessa pessoa são encerradas.`)) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/users/${user.id}/password-reset`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setMessage(`Pronto. ${name} entra com o CPF e cria uma senha nova no próximo acesso.`);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao recadastrar a senha.");
    } finally {
      setBusy(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  /** Ações dos três pontinhos: o resultado aparece no topo da tela. */
  function act(work: () => void) {
    setMenu(null);
    work();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const fields = (user?: User) => <>
    {user ? <p className="small muted">{user.worker_name && user.worker_name !== user.full_name ? <>Ficha: {user.worker_name}<br /></> : null}E-mail de acesso: {user.email}<br />{lastAccessText(user.last_access)}</p> : null}
    <label>Nome completo<input name="name" defaultValue={user?.full_name} required minLength={3} maxLength={160} /></label>
    {!user ? <label>E-mail<input name="email" type="email" required /></label> : null}
    <label>Perfil<select name="role" defaultValue={user?.role_key ?? "trabalhador"}>{data.roles.map((role) => <option key={role.key} value={role.key}>{role.label}</option>)}</select></label>
    <label>Situação<select name="status" defaultValue={user?.status ?? "active"}><option value="active">Ativo</option><option value="pending">Pendente</option>{user ? <option value="suspended">Suspenso</option> : null}</select></label>
    {user ? <>
      <label>Biênio (cargos da Diretoria)
        <select name="biennium_id" defaultValue={user.biennium_id ?? ""}>
          <option value="">Sem biênio vinculado</option>
          {data.bienniums.map((b) => <option key={b.id} value={b.id}>{b.label} ({b.starts_on.split("-").reverse().join("/")} a {b.ends_on.split("-").reverse().join("/")})</option>)}
        </select>
        <span className="small muted">Presidente, vice, secretaria, tesouraria e conselho fiscal só acessam durante o biênio (com 15 dias de tolerância).</span>
      </label>
      <label>Ficha de trabalhador
        <select name="worker_id" defaultValue={user.worker_id ?? ""}>
          <option value="">Sem ficha vinculada</option>
          {data.workers.map((w) => <option key={w.id} value={w.id}>{w.full_name}</option>)}
        </select>
        <span className="small muted">Vincular a ficha habilita a “Minha área”: a própria escala, as próprias contribuições e os aniversariantes do mês.</span>
      </label>
    </> : null}
    <span className="small muted">O acesso aos departamentos é dado depois, no botão Acesso de cada pessoa.</span>
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 400 }}>
      <input style={{ width: 20, minHeight: 20 }} type="checkbox" name="admissions_access" defaultChecked={user?.admissions_access === true} />
      Acesso à admissão
    </label>
    <span className="small muted">Marque antes de enviar o convite se esta pessoa deve ver Admissões. Sem a marca, a área some do menu. Administrador e Presidente continuam vendo, e os botões de aprovar e reprovar ficam só com esses dois cargos, nas fichas que ainda aguardam a Diretoria.</span>
  </>;

  return <div className="grid">
    <details className="card"><summary><h2 style={{ display: "inline" }}>+ Convidar usuário</h2></summary><form className="form-stack" style={{ marginTop: 16 }} onSubmit={create}>{fields()}<button className="button primary" disabled={busy}>Enviar convite</button></form></details>
    {editing ? <section className="card"><div className="toolbar"><h2>Editar acesso</h2><button className="button" onClick={() => setEditing(null)}>Cancelar</button></div><form className="form-stack" key={editing.id} onSubmit={save}>{fields(editing)}<button className="button primary" disabled={busy}>Salvar alteração</button></form></section> : null}
    {error ? <div className="error" role="alert">{error}</div> : null}{message ? <div className="success">{message}</div> : null}
    <section className="card">
      <h2>Contas institucionais</h2>
      <input className="ul-search" type="search" aria-label="Buscar" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome" />
      <ul className="ul-list">
        {users.map((user, i) => {
          const name = displayName(user);
          const state = accessState(user);
          const self = user.id === data.me;
          return <li key={user.id} {...more.extra(i)}>
          <div className="ul-row">
            <span className={`ul-av ${avatarTone(user.id)}`} aria-hidden="true">{initialsOf(name)}</span>
            <div className="ul-person">
              <strong>{name}{self ? <small className="muted"> (você)</small> : null}</strong>
              <span className="small muted">{data.roles.find((role) => role.key === user.role_key)?.label ?? user.role_key} · {departmentsText(user, data.departments)}</span>
            </div>
            <div className="ul-flags ul-situation">
              <span className={`status ${state.tone}`}>{state.label}</span>
              <span className="small muted">{lastAccessText(user.last_access)}</span>
            </div>
            <div className="ul-actions">
              <button
                type="button"
                className="button ul-reset"
                disabled={busy || !user.can_reset_password}
                title={self ? "Para a sua senha, use Minha área > Alterar senha." : user.can_reset_password ? undefined : "Precisa de conta ativa com CPF."}
                onClick={() => void resetPassword(user)}
              >Recadastrar senha</button>
              <Link className="button" href={`/sistema/usuarios/${user.id}/acesso`}>Acesso</Link>
              <button type="button" className="button ul-more" aria-label={`Mais opções de ${name}`} aria-expanded={menu === user.id} onClick={() => setMenu(menu === user.id ? null : user.id)}>⋯</button>
            </div>
          </div>
          {menu === user.id ? <div className="ul-menu">
            <button type="button" className="button" onClick={() => act(() => setEditing(user))}>Editar</button>
            {user.invite_pending ? <button type="button" className="button" disabled={busy} onClick={() => act(() => void resendInvite(user))}>Reenviar convite</button> : null}
            <button type="button" className="button danger" disabled={busy} onClick={() => act(() => void revokeSessions(user.id))}>Encerrar sessões</button>
          </div> : null}
        </li>;
        })}
      </ul>
      {term && !users.length ? <p className="small muted">Ninguém encontrado.</p> : null}
      {more.button}
    </section>
  </div>;
}

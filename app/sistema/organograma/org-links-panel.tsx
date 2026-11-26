"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BOARD_SEATS, CONSELHO_MAX, DEPARTMENT_SEATS, isDepartmentSeat, ORG_DEPARTMENTS, seatDepartments, seatLabel, seatLevel, unlinkEffect, type OrgSeat
} from "@/lib/org-links";
import "./org-links.css";

type Link = { id: string; seat: OrgSeat; department_key: string | null; user_id: string; granted: string[]; name: string; active: boolean };
type Option = { id: string; name: string };
type Payload = { links: Link[]; departments: { key: string; label: string }[]; users: Option[]; canEdit: boolean };

/**
 * Organograma de Vinculação: quem ocupa cada cargo da Diretoria, do Conselho Fiscal e a Coordenação e a
 * Subcoordenação de cada departamento. O Administrador vincula e desvincula; vincular já dá acesso no setor do cargo.
 */
export function OrgLinksPanel() {
  const [data, setData] = useState<Payload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => setData(await fetchLinks()), []);

  useEffect(() => {
    let alive = true;
    fetchLinks().then((body) => { if (alive) setData(body); }, (e: Error) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, []);

  if (!data) return error ? <div className="error" role="alert">{error}</div> : <p className="small muted">Carregando…</p>;

  const active = data.departments.map((d) => d.key);
  const label = (key: string) => data.departments.find((d) => d.key === key)?.label ?? key;
  const list = (keys: string[]) => keys.map(label).join(", ");
  const of = (seat: OrgSeat, department: string | null = null) =>
    data.links.filter((l) => l.seat === seat && (l.department_key ?? null) === department);

  function accessText(seat: OrgSeat, department: string | null = null) {
    if (seat === "presidente") return "Acesso total em todos os departamentos e na Diretoria";
    const keys = seatDepartments(seat, department, active);
    if (!keys.length) return "Sem acesso a liberar";
    return seatLevel(seat) === "consulta" ? `Só consulta em ${list(keys)} (não altera)` : `Acesso total em ${list(keys)}`;
  }

  async function link(seat: OrgSeat, department: string | null, user: Option) {
    const keys = seatDepartments(seat, department, active);
    const where = seatLabel(seat, department ? label(department) : undefined);
    const what = seatLevel(seat) === "consulta"
      ? "A pessoa passa a poder só consultar (sem alterar, editar ou excluir) em:"
      : "A pessoa passa a ter acesso total (consultar, alterar, editar e excluir) em:";
    if (!window.confirm(`Vincular ${user.name} em ${where}?\n\n${what}\n${list(keys) || "nenhum departamento"}`)) return false;
    setBusy(true); setError(""); setMessage("");
    const response = await fetch("/api/organograma/vinculos", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seat, department_key: department, user_id: user.id })
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) { setError(body.error ?? "Não foi possível vincular."); void load().catch(() => undefined); return false; }
    setMessage(`${user.name} vinculado(a) em ${where}. ${seatLevel(seat) === "consulta" ? "Consulta liberada." : "Acesso total liberado."}`);
    await load().catch((e: Error) => setError(e.message));
    return true;
  }

  async function unlink(row: Link) {
    const where = seatLabel(row.seat, row.department_key ? label(row.department_key) : undefined);
    const { revoke: lose, downgrade } = unlinkEffect(row, data!.links.filter((l) => l.user_id === row.user_id && l.id !== row.id));
    const text = (lose.length ? `\n\nA pessoa perde o acesso em:\n${list(lose)}` : "")
      + (downgrade.length ? `\n\nPassa a só consultar em:\n${list(downgrade)}` : "")
      || "\n\nO acesso continua, porque outro vínculo dela libera os mesmos departamentos.";
    if (!window.confirm(`Tirar ${row.name} de ${where}?${text}`)) return;
    setBusy(true); setError(""); setMessage("");
    const response = await fetch(`/api/organograma/vinculos?id=${encodeURIComponent(row.id)}`, { method: "DELETE" });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) { setError(body.error ?? "Não foi possível desvincular."); void load().catch(() => undefined); return; }
    setMessage(`${row.name} saiu de ${where}.${lose.length ? " Acesso retirado." : ""}`);
    await load().catch((e: Error) => setError(e.message));
  }

  const people = (rows: Link[], empty = "— vago —") => rows.length ? rows.map((row) => (
    <div key={row.id} className="org-link-person">
      <b>{row.name}</b>{row.active ? null : <em className="org-link-inactive"> conta inativa</em>}
      {data.canEdit ? <button type="button" className="link-button no-print" disabled={busy} onClick={() => void unlink(row)}>Tirar</button> : null}
    </div>
  )) : <div className="org-link-person org-link-empty">{empty}</div>;

  // `rows` = quem não pode ser escolhido (já está no cargo; no departamento, também quem está no outro cargo dele).
  const add = (seat: OrgSeat, department: string | null, rows: Link[]) => data.canEdit
    ? <AddPerson users={data.users.filter((u) => !rows.some((r) => r.user_id === u.id))} disabled={busy} onAdd={(user) => link(seat, department, user)} />
    : null;
  const inDepartment = (key: string) => data.links.filter((l) => isDepartmentSeat(l.seat) && l.department_key === key);

  return (
    <div className="org-links">
      {error ? <div className="error" role="alert">{error}</div> : null}
      {message ? <div className="success" role="status">{message}</div> : null}
      <p className="small muted">
        {data.canEdit
          ? <>Vincule cada pessoa ao seu cargo. Ao vincular, ela <strong>já ganha acesso total</strong> (consultar, alterar, editar e excluir) no seu setor: o <strong>Presidente</strong> em todos os departamentos; Secretário(a) e Tesoureiro(a), no próprio setor; os 3 membros do Conselho Fiscal, na página do Conselho Fiscal; cada Coordenador(a) e Subcoordenador(a), no próprio departamento. Secretaria e Tesouraria fazem parte da Diretoria. O <strong>Vice-Presidente só consulta</strong> a Diretoria, sem alterar. Ao tirar, o acesso sai junto. O perfil da pessoa não muda. Só aparece quem tem conta ativa no sistema.</>
          : <>Quem ocupa cada cargo da Casa. Só o Administrador do Sistema altera esta aba.</>}
      </p>
      <div className="org-analytic-wrap">
        <div className="org-a-level">
          <div className="org-a-box org-a-assembly">
            <strong>ASSEMBLEIA GERAL</strong>
            <span>Órgão soberano da instituição</span>
            <small>Formada pelos membros efetivos. Elege a Diretoria e o Conselho Fiscal.</small>
          </div>
        </div>
        <div className="org-a-flow-label">Elege e legitima a estrutura administrativa e fiscal</div>
        <div className="org-a-connector" />
        <div className="org-a-level org-a-level-two">
          <div className="org-a-box org-a-board org-link-box">
            <strong>DIRETORIA</strong>
            <span>Órgão de administração e coordenação</span>
            {BOARD_SEATS.map(({ seat, label: title }) => {
              const rows = of(seat);
              return (
                <div key={seat} className="org-link-seat">
                  <div className="org-link-seat-title">{title}</div>
                  {people(rows)}
                  {rows.length ? null : add(seat, null, rows)}
                  <small>{accessText(seat)}</small>
                </div>
              );
            })}
          </div>
          <div className="org-a-relation">
            <span>Relação institucional</span>
            <b>⇄</b>
            <small>Fiscalização e parecer</small>
            <small>Sem subordinação hierárquica</small>
          </div>
          <div className="org-a-box org-a-fiscal org-link-box">
            <strong>CONSELHO FISCAL</strong>
            <span>Órgão de fiscalização</span>
            <div className="org-link-seat">
              <div className="org-link-seat-title">Membros ({of("conselho_fiscal").length} de {CONSELHO_MAX})</div>
              {of("conselho_fiscal").length ? people(of("conselho_fiscal")) : null}
              {Array.from({ length: Math.max(0, CONSELHO_MAX - of("conselho_fiscal").length) }, (_, i) => (
                <div key={`vago-${i}`} className="org-link-person org-link-empty">— vago —</div>
              ))}
              {of("conselho_fiscal").length < CONSELHO_MAX ? add("conselho_fiscal", null, of("conselho_fiscal")) : null}
              <small>{accessText("conselho_fiscal")}</small>
            </div>
          </div>
        </div>
        <div className="org-a-connector board-only" />
        <div className="org-a-dept-title">
          DEPARTAMENTOS — COORDENAÇÃO E SUBCOORDENAÇÃO
          <small>Cada coordenador(a) e subcoordenador(a) vinculado(a) tem acesso total no próprio departamento</small>
        </div>
        <div className="org-a-grid">
          {ORG_DEPARTMENTS.filter((key) => active.includes(key)).map((key) => (
            <div key={key} className="org-a-dept org-link-dept">
              <strong>{label(key)}</strong>
              {DEPARTMENT_SEATS.map(({ seat, label: title }) => {
                const rows = of(seat, key);
                return (
                  <div key={seat} className="org-link-seat">
                    <div className="org-link-seat-title">{title}</div>
                    {people(rows)}
                    {rows.length ? null : add(seat, key, inDepartment(key))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

async function fetchLinks(): Promise<Payload> {
  const response = await fetch("/api/organograma/vinculos", { cache: "no-store" });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "Não foi possível abrir o organograma de vinculação.");
  return body;
}

/** Escolher a pessoa (contas ativas) e vincular. */
function AddPerson({ users, disabled, onAdd }: { users: Option[]; disabled: boolean; onAdd: (user: Option) => Promise<boolean> }) {
  const [id, setId] = useState("");
  const user = users.find((u) => u.id === id);
  return (
    <div className="org-link-add no-print">
      <select aria-label="Pessoa para vincular" value={id} disabled={disabled} onChange={(e) => setId(e.target.value)}>
        <option value="">— escolher pessoa —</option>
        {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select>
      <button type="button" className="button" disabled={disabled || !user} onClick={() => { if (user) void onAdd(user).then((ok) => { if (ok) setId(""); }); }}>Vincular</button>
    </div>
  );
}

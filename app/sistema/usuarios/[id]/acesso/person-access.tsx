"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, postJson } from "@/lib/client-api";
import { CALL_MODULE, DEPARTMENT_MODULES, type DepartmentModule, type ModuleMark } from "@/lib/department-modules";

type Floor = "full" | "read" | null;
type Payload = {
  user: { id: string; full_name: string; email: string; role_key: string; role_label: string };
  marks: Record<string, ModuleMark[]>;
  departments: { key: string; label: string; floor: Floor }[];
  worker: { functions: string[]; departments: string[] } | null;
  groups: { department_key: string; class_group: string }[];
  people: { id: string; full_name: string; departments: string }[];
};

/** Departamento → módulo marcado → também altera. */
type State = Record<string, Record<string, boolean>>;

const WORKER_MODULES = ["trabalhadores", "evangelizadores"];
const DISPLAY_LABEL: Record<string, string> = { diretoria: "Diretoria (Presidência)" };

function toState(marks: Record<string, ModuleMark[]>): State {
  return Object.fromEntries(Object.entries(marks).map(([department, list]) => [department, Object.fromEntries(list.map((m) => [m.module, m.edit]))]));
}

function toMarks(state: State): Record<string, ModuleMark[]> {
  return Object.fromEntries(Object.keys(DEPARTMENT_MODULES).map((department) => [
    department,
    Object.entries(state[department] ?? {}).map(([module, edit]) => ({ module, edit }))
  ]));
}

const sameState = (a: Record<string, ModuleMark[]>, b: Record<string, ModuleMark[]>) => {
  const norm = (m: Record<string, ModuleMark[]>) =>
    JSON.stringify(Object.keys(DEPARTMENT_MODULES).map((d) => [...(m[d] ?? [])].sort((x, y) => x.module.localeCompare(y.module))));
  return norm(a) === norm(b);
};

export function PersonAccess({ userId }: { userId: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [state, setState] = useState<State>({});
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [copyFrom, setCopyFrom] = useState("");
  const [copied, setCopied] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const payload = await api<Payload>(`/api/users/${userId}/access`);
    setData(payload);
    setState(toState(payload.marks));
    setOpen(new Set(Object.entries(payload.marks).filter(([, list]) => list.length).map(([department]) => department)));
    setCopied(null);
  }, [userId]);
  // A carga inicial é a sincronização desta tela cliente com a API protegida.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load().catch((e: Error) => setError(e.message)); }, [load]);

  const departments = useMemo(
    () => (data?.departments ?? [])
      .filter((d) => DEPARTMENT_MODULES[d.key])
      .map((d) => ({ ...d, label: DISPLAY_LABEL[d.key] ?? d.label }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR")),
    [data]
  );

  if (!data) return error ? <div className="error" role="alert">{error}</div> : <p className="muted">Carregando…</p>;

  const isAdmin = data.user.role_key === "administrador";
  const dirty = !sameState(toMarks(state), data.marks);
  const fichaDepartments = data.worker?.departments ?? [];
  const groupLabel = (key: string) => data.departments.find((d) => d.key === key)?.label ?? key;

  function touched() { setError(""); setMessage(""); setCopied((current) => current); }

  function update(department: string, change: (current: Record<string, boolean>) => Record<string, boolean>) {
    touched();
    setState((all) => ({ ...all, [department]: change(all[department] ?? {}) }));
  }

  function setView(department: string, module: string, on: boolean) {
    update(department, (current) => {
      const next = { ...current };
      if (on) next[module] = next[module] ?? false; else delete next[module];
      return next;
    });
  }

  function setEdit(department: string, module: string, on: boolean) {
    update(department, (current) => ({ ...current, [module]: on }));
  }

  function setAll(department: string, on: boolean) {
    update(department, (current) => {
      if (!on) return {};
      return Object.fromEntries(DEPARTMENT_MODULES[department].map((m) => [m.key, current[m.key] ?? false]));
    });
    if (on) setOpen((list) => new Set(list).add(department));
  }

  function setAlterAll(department: string, on: boolean) {
    update(department, (current) => {
      const next = { ...current };
      for (const m of DEPARTMENT_MODULES[department]) {
        if (m.viewOnly) continue;
        if (on) next[m.key] = true;
        else if (m.key in next) next[m.key] = false;
      }
      return next;
    });
  }

  function toggle(department: string) {
    setOpen((list) => {
      const next = new Set(list);
      if (next.has(department)) next.delete(department); else next.add(department);
      return next;
    });
  }

  async function copy() {
    if (!copyFrom) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const source = await api<Payload>(`/api/users/${copyFrom}/access`);
      setState(toState(source.marks));
      setOpen(new Set(Object.entries(source.marks).filter(([, list]) => list.length).map(([department]) => department)));
      setCopied({ id: copyFrom, name: source.user.full_name });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível copiar.");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true); setError(""); setMessage("");
    try {
      await postJson(`/api/users/${userId}/access`, { marks: toMarks(state), copiedFrom: copied?.id ?? null }, "PUT");
      await load();
      setMessage("Acesso salvo. Já vale e ficou registrado no Dedo-duro.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }

  const menu = ["Minha área"];
  for (const department of departments) {
    const modules = DEPARTMENT_MODULES[department.key];
    const marks = state[department.key] ?? {};
    const seen = department.floor ? modules : modules.filter((m) => m.key in marks);
    if (!seen.length) continue;
    const callOnly = !department.floor && seen.length === 1 && seen[0].key === CALL_MODULE;
    const changes = department.floor === "full" || seen.some((m) => marks[m.key]);
    menu.push(callOnly ? `Chamada · ${department.label}` : changes ? department.label : `${department.label} (só consulta)`);
  }

  return (
    <div className="pa-page">
      <section className="card pa-person">
        <div>
          <h2>{data.user.full_name}</h2>
          <p className="muted small">
            {[
              `Perfil: ${data.user.role_label}`,
              data.worker?.functions.length ? `Trabalha como: ${data.worker.functions.join(", ")}` : "",
              data.groups.length ? `Turmas: ${data.groups.map((g) => `${g.class_group} (${groupLabel(g.department_key)})`).join(", ")}` : ""
            ].filter(Boolean).join(" · ")}
          </p>
        </div>
        {isAdmin ? <div className="notice">Administrador vê tudo. As caixinhas abaixo não mudam nada para ele.</div> : null}
        {!isAdmin && data.people.length ? (
          <div className="pa-copy">
            <label htmlFor="pa-copy-from">Copiar acesso de</label>
            <select id="pa-copy-from" value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)}>
              <option value="">Escolha a pessoa</option>
              {data.people.map((p) => <option key={p.id} value={p.id}>{p.full_name} · {p.departments}</option>)}
            </select>
            <button type="button" className="button" disabled={!copyFrom || busy} onClick={() => void copy()}>Copiar</button>
            {copied ? <span className="pa-copied" role="status">Copiado de {copied.name}. Ajuste o que for diferente e salve.</span> : null}
          </div>
        ) : null}
      </section>

      {error ? <div className="error" role="alert">{error}</div> : null}

      <section className="card pa-list">
        {departments.map((department) => (
          <DepartmentRow
            key={department.key}
            department={department}
            marks={state[department.key] ?? {}}
            isOpen={open.has(department.key)}
            onFicha={fichaDepartments.includes(department.key)}
            groups={data.groups.filter((g) => g.department_key === department.key).map((g) => g.class_group)}
            roleLabel={data.user.role_label}
            disabled={busy}
            onToggle={() => toggle(department.key)}
            onAll={(on) => setAll(department.key, on)}
            onView={(module, on) => setView(department.key, module, on)}
            onEdit={(module, on) => setEdit(department.key, module, on)}
            onAlterAll={(on) => setAlterAll(department.key, on)}
          />
        ))}
      </section>

      <section className="card pa-foot">
        <div>
          <h2>O que vê no menu</h2>
          <p>{menu.join(" · ")}</p>
        </div>
        <div className="pa-actions">
          <button type="button" className="button primary" disabled={busy || !dirty} onClick={() => void save()}>Salvar acesso</button>
          {message ? <span className="pa-copied" role="status">{message}</span> : null}
          {dirty && !message ? <span className="muted small">Há mudanças ainda não salvas.</span> : null}
        </div>
      </section>
    </div>
  );
}

function DepartmentRow({ department, marks, isOpen, onFicha, groups, roleLabel, disabled, onToggle, onAll, onView, onEdit, onAlterAll }: {
  department: { key: string; label: string; floor: Floor };
  marks: Record<string, boolean>;
  isOpen: boolean;
  onFicha: boolean;
  groups: string[];
  roleLabel: string;
  disabled: boolean;
  onToggle: () => void;
  onAll: (on: boolean) => void;
  onView: (module: string, on: boolean) => void;
  onEdit: (module: string, on: boolean) => void;
  onAlterAll: (on: boolean) => void;
}) {
  const { key, label, floor } = department;
  const modules = DEPARTMENT_MODULES[key];
  const viewed = (m: DepartmentModule) => Boolean(floor) || m.key in marks;
  const edited = (m: DepartmentModule) => !m.viewOnly && (floor === "full" || marks[m.key] === true);
  const editable = modules.filter((m) => !m.viewOnly);
  const seen = modules.filter(viewed).length;
  const changing = modules.filter(edited).length;
  const callOnly = !floor && seen === 1 && viewed(modules.find((m) => m.key === CALL_MODULE) ?? modules[0]) && CALL_MODULE in marks;

  const summary = seen === 0 ? `${modules.length} módulos`
    : callOnly ? "Só a chamada"
    : floor === "full" ? `Pelo perfil · altera tudo`
    : floor === "read" && changing === 0 ? "Pelo perfil · só consulta"
    : `${seen} de ${modules.length} · ${changing > 0 ? `altera ${changing}` : "só consulta"}`;

  const notes: { text: string; alert?: boolean }[] = [];
  if (CALL_MODULE in marks) {
    notes.push(groups.length
      ? { text: `Chamada: turma ${groups.join(", ")}.` }
      : { text: "Chamada: ainda não está em nenhuma turma, então vai aparecer vazia.", alert: true });
  }
  for (const name of WORKER_MODULES) {
    const item = modules.find((m) => m.key === name);
    if (!item || !viewed(item)) continue;
    notes.push({ text: edited(item) ? `${item.label}: vê a ficha completa e o telefone dos colegas.` : `${item.label}: vê a lista sem o telefone dos colegas.` });
  }

  const allEditing = changing === editable.length;

  return (
    <div className={`pa-dept${isOpen ? " open" : ""}`}>
      <div className="pa-dept-row">
        <label className="pa-flag">
          <input
            type="checkbox"
            aria-label={`Consultar todos os módulos de ${label}`}
            checked={seen === modules.length}
            disabled={disabled || Boolean(floor)}
            ref={(el) => { if (el) el.indeterminate = seen > 0 && seen < modules.length; }}
            onChange={(e) => onAll(e.target.checked)}
          />
        </label>
        <button type="button" className="pa-toggle" aria-expanded={isOpen} aria-controls={`pa-panel-${key}`} onClick={onToggle}>
          <span className="pa-name">{label}{onFicha ? <span className="pa-ficha">na ficha</span> : null}</span>
          <span className={`pa-summary${seen > 0 ? " on" : ""}`}>{summary}</span>
          <span className="pa-chev" aria-hidden="true" />
        </button>
      </div>
      <div className="pa-panel" id={`pa-panel-${key}`} hidden={!isOpen}>
        {floor ? <p className="pa-note">Já vem do perfil {roleLabel}: as caixinhas travadas não podem ser tiradas aqui.</p> : null}
        <div className="pa-modules">
          {modules.map((item, index) => {
            const showGroup = item.group && item.group !== modules[index - 1]?.group;
            const on = viewed(item);
            const edit = edited(item);
            return (
              <div key={item.key} className="pa-mod-wrap">
                {showGroup ? <p className="pa-group">{item.group}</p> : null}
                <div className={`pa-mod${on ? " on" : ""}${edit ? " altering" : ""}`}>
                  <label className="pa-mod-main">
                    <input type="checkbox" checked={on} disabled={disabled || Boolean(floor)} onChange={(e) => onView(item.key, e.target.checked)} />
                    <span>{item.label}</span>
                  </label>
                  {item.viewOnly ? null : (
                    <label className="pa-alter">
                      <input
                        type="checkbox"
                        aria-label={`Alterar ${item.label}`}
                        checked={edit}
                        disabled={disabled || floor === "full"}
                        onChange={(e) => onEdit(item.key, e.target.checked)}
                      />
                      Alterar
                    </label>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="pa-panel-foot">
          {notes.length ? (
            <p className={`pa-note${notes.some((n) => n.alert) ? " alert" : ""}`}>{notes.map((n) => n.text).join(" ")}</p>
          ) : <span />}
          {floor === "full" || editable.length === 0 ? null : (
            <button type="button" className="pa-link" disabled={disabled} onClick={() => onAlterAll(!allEditing)}>
              {allEditing ? "Desmarcar Alterar" : "Alterar todos"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DAY_HOURS, DAY_NAME, DOW_ORDER, FREE_THEME, TEMPLATES, canAddExtra, monthDays, parseSlotKey, roleOf, slotKey,
  type Conflict, type ScaleSpeaker, type ScaleStatus, type ScaleStudy, type ScaleWorker
} from "@/lib/doutrina-scale";

type Payload = {
  month: { id: string; status: ScaleStatus; statusLabel: string; reviewed: boolean; version: number } | null;
  assignments: Record<string, string>;
  edited: string[];
  extras: string[];
  review: { conflicts: Conflict[]; invalid: { key: string; message: string }[] } | null;
  options: { workers: ScaleWorker[]; speakers: ScaleSpeaker[]; studies: ScaleStudy[] };
  canEdit: boolean;
};

const currentMonth = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()).slice(0, 7);

function describeSlot(key: string, ym: string) {
  const slot = parseSlotKey(key);
  if (!slot) return key;
  const role = roleOf(slot);
  return `${String(slot.day).padStart(2, "0")}/${ym.slice(5)} · ${DAY_NAME[slot.dow]} · ${role.section.n} → ${role.label}${slot.pos ? ` ${slot.pos + 1}` : ""}`;
}

export function ScalesClient() {
  const [ym, setYm] = useState(currentMonth);
  const [dow, setDow] = useState<number>(3);
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch(`/api/doutrina/scale?month=${ym}`, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    setData(body);
  }, [ym]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load().catch((e) => setError(e.message)); }, [load]);

  async function call(method: string, payload: object, success?: (body: Record<string, unknown>) => string) {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/doutrina/scale", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ month: ym, ...payload }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      if (success) setMessage(success(body));
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha na operação.");
      await load().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  const active = data?.month && data.month.status !== "deleted" ? data.month : null;
  const version = active?.version;

  function operate(action: "generate" | "regenerate" | "delete" | "check" | "approve" | "publish") {
    if (action === "regenerate" && !window.confirm("Gerar a escala novamente? Todas as posições do mês serão substituídas, inclusive as alterações manuais.")) return;
    if (action === "delete" && !window.confirm("Excluir a escala do mês? Frequências continuam registradas.")) return;
    void call("POST", { action, version }, (body) => {
      if (action === "generate" || action === "regenerate") return `Escala gerada: ${body.added} posição(ões), ${body.missing} vaga(s) pendente(s). Confira funções e trabalhadores.`;
      if (action === "delete") return `Escala excluída (${body.removed} posição(ões)).`;
      if (action === "publish") return "Escala publicada.";
      if (body.status === "pending_issues") return action === "approve" ? "Existem duplicidades ou conflitos. Corrija antes de aprovar." : "Conferência concluída com pendências.";
      return action === "approve" ? "Escala aprovada." : "Escala conferida sem conflitos.";
    });
  }

  const byKey = useMemo(() => new Map(Object.entries(data?.assignments ?? {})), [data]);
  const edited = useMemo(() => new Set(data?.edited ?? []), [data]);
  const extras = useMemo(() => new Set(data?.extras ?? []), [data]);
  const duplicateKeys = useMemo(() => new Set((data?.review?.conflicts ?? []).filter((c) => c.type === "same_day").flatMap((c) => c.keys)), [data]);
  const conflictKeys = useMemo(() => new Set([
    ...(data?.review?.conflicts ?? []).filter((c) => c.type !== "same_day").flatMap((c) => c.keys),
    ...(data?.review?.invalid ?? []).map((i) => i.key)
  ]), [data]);
  const workerName = useMemo(() => new Map((data?.options.workers ?? []).map((w) => [w.id, w.name])), [data]);

  function options(key: string, current: string) {
    if (!data) return [];
    const slot = parseSlotKey(key)!;
    const { section, type } = roleOf(slot);
    const list: { value: string; label: string; disabled?: boolean }[] = [];
    if (type === "STUDY") {
      if (section.s === "PALESTRA") list.push({ value: FREE_THEME, label: "TEMA LIVRE" });
      data.options.studies.filter((s) => s.type === section.s).forEach((s) => list.push({ value: `t:${s.id}`, label: `${s.code ? `${s.code} — ` : ""}${s.title}` }));
      return list;
    }
    if (type === "SPEAKER") {
      data.options.workers.filter((w) => w.functions.includes("Palestrante")).forEach((w) => list.push({ value: `w:${w.id}`, label: `${w.name} (INT.)` }));
      data.options.speakers.forEach((s) => list.push({ value: `s:${s.id}`, label: `${s.name} (EXT.)` }));
      return list;
    }
    const sameDay = new Map<string, string>();
    const blocked = new Map<string, string>();
    for (const [otherKey, value] of byKey) {
      if (otherKey === key || !value.startsWith("w:")) continue;
      const other = parseSlotKey(otherKey);
      if (!other) continue;
      if (other.dow === slot.dow && other.day === slot.day && !sameDay.has(value)) sameDay.set(value, roleOf(other).section.n);
      if (type === "Psicofônico" && (slot.dow === 3 || slot.dow === 5)) {
        const pairDow = slot.dow === 3 ? 5 : 3;
        const pairDay = slot.dow === 3 ? slot.day + 2 : slot.day - 2;
        if (other.dow === pairDow && other.day === pairDay && roleOf(other).type === "Psicofônico") blocked.set(value, `${String(pairDay).padStart(2, "0")}/${ym.slice(5)}`);
      }
    }
    data.options.workers.filter((w) => w.functions.includes(type) && w.days.includes(slot.dow)).forEach((w) => {
      const value = `w:${w.id}`;
      const reason = blocked.has(value) ? ` — FOLGA: trabalhou ${blocked.get(value)}` : sameDay.has(value) ? ` — JÁ ESCALADO EM: ${sameDay.get(value)}` : "";
      list.push({ value, label: `${w.name}${reason}`, disabled: blocked.has(value) && current !== value });
    });
    return list;
  }

  const readOnly = !data?.canEdit || !active || busy;
  const dates = monthDays(ym, dow);

  return (
    <div className="grid">
      <section className="card no-print">
        <div className="form-row">
          <label>Mês<input type="month" value={ym} onChange={(e) => e.target.value && setYm(e.target.value)} /></label>
          <label>Folha
            <select value={dow} onChange={(e) => setDow(Number(e.target.value))}>
              {DOW_ORDER.map((d) => <option key={d} value={d}>{DAY_NAME[d]}</option>)}
            </select>
          </label>
        </div>
        <div className="row-actions" style={{ marginTop: 12 }}>
          {data?.canEdit ? <>
            <button className="button primary" disabled={busy} onClick={() => operate(active ? "regenerate" : "generate")}>{active ? "Gerar novamente" : "Gerar escala"}</button>
            {active ? <button className="button danger" disabled={busy} onClick={() => operate("delete")}>Excluir escala do mês</button> : null}
            <button className="button" disabled={readOnly} onClick={() => operate("check")}>Conferir</button>
            <button className="button" disabled={readOnly} onClick={() => operate("approve")}>Aprovar</button>
            <button className="button" disabled={readOnly || active?.status !== "approved"} onClick={() => operate("publish")}>Publicar</button>
          </> : null}
          {active ? <>
            <Link className="button" href={`/sistema/doutrina/escalas/imprimir?month=${ym}&dow=${dow}`}>⎙ Folha</Link>
            <Link className="button" href={`/sistema/doutrina/escalas/imprimir?month=${ym}`}>⎙ Mês consolidado</Link>
          </> : null}
        </div>
        <p className="small" style={{ marginBottom: 0 }}>
          <strong>Situação:</strong> {data?.month ? data.month.statusLabel : "Sem escala neste mês"}
          {active ? <> · {edited.size} alteração(ões) manual(is) · {active.reviewed ? `${(data?.review?.conflicts.length ?? 0) + (data?.review?.invalid.length ?? 0)} pendência(s)` : "Não conferida"}</> : null}
        </p>
      </section>

      {error ? <div className="error" role="alert">{error}</div> : null}
      {message ? <div className="success" role="status">{message}</div> : null}

      {data?.review && (data.review.conflicts.length || data.review.invalid.length) ? (
        <section className="card no-print">
          <h2>Resultado da conferência</h2>
          <div className="history-list">
            {data.review.conflicts.map((c) => (
              <article key={c.id}>
                <strong>{workerName.get(c.workerId) ?? "Trabalhador"} — {c.type === "same_day" ? "Duplicidade no mesmo dia" : "Alternância quarta/sexta"}</strong>
                <p className="small">{c.type === "same_day" ? "Aparece em mais de uma atividade no mesmo dia e horário." : "Psicofônico escalado na quarta e na sexta da mesma semana: deve folgar em um dos dias."}</p>
                {c.keys.map((k) => <p key={k} className="small muted">{describeSlot(k, ym)}</p>)}
              </article>
            ))}
            {data.review.invalid.map((i) => (
              <article key={i.key}><strong>{describeSlot(i.key, ym)}</strong><p className="small">{i.message}</p></article>
            ))}
          </div>
        </section>
      ) : null}

      {active ? (
        <section className="card scale-sheet">
          <div className="sheet-title">CENTRO ESPÍRITA FILANTRÓPICO LAR DA BÊNÇÃO</div>
          <div className="sheet-sub">ESCALA DE TRABALHADORES — {DAY_NAME[dow]} — {ym.split("-").reverse().join("/")} · HORÁRIO: {DAY_HOURS[dow]}</div>
          {TEMPLATES[dow].map((section, si) => (
            <div key={section.n + si}>
              <h3>{section.n}</h3>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>DIAS</th>{dates.map((day) => <th key={day}>{String(day).padStart(2, "0")}</th>)}</tr></thead>
                  <tbody>
                    {section.r.map(([label], ri) => (
                      <tr key={label + ri}>
                        <td>{label}</td>
                        {dates.map((day) => {
                          const prefix = `${dow}|${si}|${ri}|${day}|`;
                          const keys = [...byKey.keys()].filter((k) => k.startsWith(prefix)).sort((a, b) => Number(a.split("|")[4]) - Number(b.split("|")[4]));
                          return (
                            <td key={day}>
                              {keys.map((key) => {
                                const current = byKey.get(key) ?? "";
                                const cls = [edited.has(key) ? "slot-edited" : "", duplicateKeys.has(key) ? "slot-duplicate" : "", conflictKeys.has(key) ? "slot-conflict" : ""].join(" ");
                                const select = (
                                  <select key={key} aria-label={describeSlot(key, ym)} className={cls} value={current} disabled={readOnly}
                                    onChange={(e) => void call("PATCH", { key, value: e.target.value, version })}>
                                    <option value="">— selecionar —</option>
                                    {options(key, current).map((o) => <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>)}
                                  </select>
                                );
                                return extras.has(key) ? (
                                  <div className="slot-extra" key={key}>{select}
                                    {!readOnly ? <button className="link-button" title="Remover posição adicional" onClick={() => void call("PUT", { op: "remove", key, version })}>×</button> : null}
                                  </div>
                                ) : select;
                              })}
                              {!readOnly && canAddExtra({ dow, si, ri }) && keys.length ? (
                                <button className="link-button" onClick={() => void call("PUT", { op: "add", key: slotKey({ dow, si, ri, day, pos: 0 }).slice(0, -2), version })}>+ adicional</button>
                              ) : null}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </section>
      ) : data ? (
        <div className="notice">{data.month?.status === "deleted" ? "Escala excluída deste mês. Use “Gerar escala” para criar novamente." : "Nenhuma escala gerada neste mês."}</div>
      ) : null}
    </div>
  );
}

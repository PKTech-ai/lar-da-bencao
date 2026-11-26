"use client";

import Link from "next/link";
import { useMobileDay } from "@/components/mobile-day-columns";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  DAY_HOURS, DAY_NAME, DOW_ORDER, FREE_THEME, RECESS_KINDS, RECESS_KIND_KEYS, TEMPLATES, THEME_MAX, availabilityIndex, canAddExtra, monthDays, parseSlotKey, psychRuleDay,
  psychWeekMessage, recessKinds, recessSet, roleOf, slotAvailability, slotKey, typedThemeText, typedThemeValue,
  type Availability, type Conflict, type PsychBooking, type RecessDay, type RecessKind, type ScaleSpeaker, type ScaleStatus, type ScaleStudy, type ScaleWorker
} from "@/lib/doutrina-scale";

type Payload = {
  month: { id: string; status: ScaleStatus; statusLabel: string; reviewed: boolean; version: number } | null;
  assignments: Record<string, string>;
  edited: string[];
  extras: string[];
  review: { conflicts: Conflict[]; invalid: { key: string; message: string }[] } | null;
  options: { workers: ScaleWorker[]; speakers: ScaleSpeaker[]; studies: ScaleStudy[] };
  canEdit: boolean;
  fixed: { id: string; key: string; worker_id: string; worker_name: string; section_name: string; role_label: string }[];
  /** Psicofônicos de quarta e sexta dos meses vizinhos nas semanas que viram o mês. */
  outside: PsychBooking[];
  /** Dias sem escala do mês (recesso ou evento da casa). */
  recess: RecessDay[];
};

/**
 * `group`: título do bloco na lista (optgroup), na ordem em que aparece.
 * `name` e `reference`: estudo sem a referência e a referência da Biblioteca (mostrada abaixo do estudo escolhido).
 */
type Choice = { value: string; label: string; tone?: Availability["color"]; availability?: Availability; group?: string; name?: string; reference?: string };

/** Opção da lista do tema da palestra que abre a caixa para digitar (não é gravada). */
const TYPE_THEME = "__digitar__";
const PALESTRA_GROUP = "Temas de palestra";
const ESE_GROUP = "O Evangelho Segundo o Espiritismo — roteiros";
const studyName = (s: ScaleStudy) => `${s.code ? `${s.code} — ` : ""}${s.title}`;
/** Como na Biblioteca de Estudos: código, título e referência (ex.: "ROT. 045 — Perdoai… · ESE Cap. X — itens 1 a 4"). */
const studyLabel = (s: ScaleStudy) => `${studyName(s)}${s.reference ? ` · ${s.reference}` : ""}`;
const sameText = (a: string, b: string) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }) === 0;

/** Opções da lista, com os blocos (optgroup) na ordem em que aparecem. */
function renderChoices(choices: Choice[], current: string) {
  const option = (o: Choice) => <option key={o.value} value={o.value} className={o.tone && o.value !== current ? `opt-${o.tone}` : undefined}>{o.label}</option>;
  const out: ReactNode[] = [];
  for (let i = 0; i < choices.length;) {
    const group = choices[i].group;
    if (!group) { out.push(option(choices[i])); i += 1; continue; }
    const items: Choice[] = [];
    while (i < choices.length && choices[i].group === group) items.push(choices[i++]);
    out.push(<optgroup key={group} label={group}>{items.map(option)}</optgroup>);
  }
  return out;
}

const ICON: Record<Availability["color"], string> = { green: "🟢", blue: "🔵", red: "🔴" };
const fmtDate = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;

const currentMonth = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()).slice(0, 7);

/** Data da reunião (quarta ou sexta) que vem primeiro num conflito da semana, para a mensagem da regra. */
function firstPsychDate(conflict: Conflict, ym: string) {
  const dates = [...conflict.keys.flatMap((k) => { const s = parseSlotKey(k); return s ? [`${ym}-${String(s.day).padStart(2, "0")}`] : []; }), ...(conflict.outsideDates ?? [])];
  return dates.sort()[0] ?? `${ym}-01`;
}

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
  /** Tema da palestra sendo digitado (posição e texto). */
  const [typing, setTyping] = useState<{ key: string; text: string } | null>(null);
  /** Quadro dos trabalhadores fixos aberto ou recolhido (começa recolhido; lembra a escolha neste aparelho). */
  const [fixedOpen, setFixedOpen] = useState(false);
  useEffect(() => {
    try { if (localStorage.getItem("escala-fixos-aberto") === "1") setFixedOpen(true); } catch { /* sem armazenamento */ }
  }, []);
  function toggleFixed() {
    setFixedOpen((open) => {
      try { localStorage.setItem("escala-fixos-aberto", open ? "0" : "1"); } catch { /* sem armazenamento */ }
      return !open;
    });
  }

  // Só a leitura mais recente vale: uma resposta antiga que chega depois não sobrescreve a nova.
  const loadSeq = useRef(0);
  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    const response = await fetch(`/api/doutrina/scale?month=${ym}`, { cache: "no-store" });
    const body = await response.json();
    if (seq !== loadSeq.current) return;
    if (!response.ok) throw new Error(body.error);
    setData(body);
  }, [ym]);
  useEffect(() => { void load().catch((e) => setError(e.message)); }, [load]);
  // Volta para a tela: recalcula a disponibilidade com o que outra pessoa mudou nas escalas (inclusive meses vizinhos).
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") void load().catch(() => undefined); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [load]);

  async function call(method: string, payload: object, success?: (body: Record<string, unknown>) => string, url = "/api/doutrina/scale") {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ month: ym, ...payload }) });
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
    if (action === "regenerate" && !window.confirm("Gerar a escala novamente? Todas as posições do mês serão substituídas, inclusive as alterações manuais. Os trabalhadores fixos 📌 são mantidos.")) return;
    if (action === "delete" && !window.confirm("Excluir a escala do mês? Frequências continuam registradas.")) return;
    void call("POST", { action, version }, (body) => {
      if (action === "generate" || action === "regenerate") {
        const skipped = (body.skipped as string[] | undefined) ?? [];
        const psychSkipped = (body.psychSkipped as string[] | undefined) ?? [];
        return `Escala gerada: ${body.added} posição(ões), ${body.missing} vaga(s) pendente(s), ${body.fixed ?? 0} fixo(s) mantido(s).`
          + (Number(body.recess) ? ` ${body.recess} dia(s) de recesso ou evento ficaram sem ninguém escalado.` : "")
          + (skipped.length ? ` Fixos que não valem mais (afastados ou sem a função/dia na ficha): ${skipped.join("; ")}.` : " Confira funções e trabalhadores.")
          + (psychSkipped.length ? ` Fixos que ficaram de fora por já serem psicofônicos na outra reunião da semana: ${psychSkipped.join("; ")}.` : "");
      }
      if (action === "delete") return `Escala excluída (${body.removed} posição(ões)).`;
      if (action === "publish") return "Escala publicada.";
      if (body.status === "pending_issues") return action === "approve" ? "Existem duplicidades ou conflitos. Corrija antes de aprovar." : "Conferência concluída com pendências.";
      return action === "approve" ? "Escala aprovada." : "Escala conferida sem conflitos.";
    });
  }

  const byKey = useMemo(() => new Map(Object.entries(data?.assignments ?? {})), [data]);
  const edited = useMemo(() => new Set(data?.edited ?? []), [data]);
  const extras = useMemo(() => new Set(data?.extras ?? []), [data]);
  // Duplicidade na hora (mesmo trabalhador duas vezes no mesmo dia), sem esperar a conferência.
  const duplicateKeys = useMemo(() => {
    const byDay = new Map<string, string[]>();
    for (const [key, value] of byKey) {
      const slot = value.startsWith("w:") ? parseSlotKey(key) : null;
      if (!slot) continue;
      const id = `${slot.dow}|${slot.day}|${value}`;
      byDay.set(id, [...(byDay.get(id) ?? []), key]);
    }
    return new Set([
      ...[...byDay.values()].filter((keys) => keys.length > 1).flat(),
      ...(data?.review?.conflicts ?? []).flatMap((c) => c.keys)
    ]);
  }, [byKey, data]);
  const conflictKeys = useMemo(() => new Set((data?.review?.invalid ?? []).map((i) => i.key)), [data]);
  const context = useMemo(() => ({ assignments: byKey, outside: data?.outside ?? [] }), [byKey, data]);
  const index = useMemo(() => availabilityIndex(ym, context), [ym, context]);
  const workerName = useMemo(() => new Map((data?.options.workers ?? []).map((w) => [w.id, w.name])), [data]);
  const fixedByKey = useMemo(() => new Map((data?.fixed ?? []).map((f) => [f.key, f])), [data]);
  const recess = useMemo(() => recessSet(ym, data?.recess ?? []), [ym, data]);
  const recessKind = useMemo(() => recessKinds(ym, data?.recess ?? []), [ym, data]);
  // Fixos marcados depois da última geração ainda não aparecem em todas as semanas do mês.
  const fixedPending = useMemo(() => (data?.fixed ?? []).filter((f) => {
    const [fdow, fsi, fri, fpos] = f.key.split("|").map(Number);
    return monthDays(ym, fdow).some((day) => {
      if (recess.has(day)) return false;
      const value = byKey.get(slotKey({ dow: fdow, si: fsi, ri: fri, day, pos: fpos }));
      return value !== undefined && value !== `w:${f.worker_id}`;
    });
  }).length, [data, byKey, ym, recess]);

  /** Dia sem escala: recesso ou evento da casa. Ninguém é escalado na data (o dia inteiro, todas as atividades). */
  function setDayKind(day: number, kind: RecessKind | null) {
    const shown = `${String(day).padStart(2, "0")}/${ym.slice(5)}`;
    if (kind && !recess.has(day)) {
      const people = [...byKey].filter(([k, v]) => { const s = parseSlotKey(k); return s?.day === day && s.dow === dow && /^[ws]:/.test(v); }).length;
      if (people && !window.confirm(`Marcar ${shown} como ${RECESS_KINDS[kind].option}? Nesse dia ninguém é escalado: ${people} pessoa(s) escalada(s) sairão da escala.`)) return;
    }
    void call("PUT", { date: `${ym}-${String(day).padStart(2, "0")}`, kind }, (body) => kind
      ? `${shown} marcado como ${RECESS_KINDS[kind].option}: ninguém é escalado nesse dia.${Number(body.cleared) ? ` ${body.cleared} pessoa(s) saíram da escala do dia.` : ""}`
      : `${shown} voltou para a escala normal.${active ? " Preencha as posições do dia ou use “Gerar novamente”." : ""}`, "/api/doutrina/scale/recess");
  }

  function togglePin(patternKey: string, current: string) {
    const pinned = fixedByKey.get(patternKey);
    if (pinned) {
      void call("DELETE", { key: patternKey }, () => `${pinned.worker_name} deixou de ser fixo. Na próxima geração a vaga volta para a regra normal.`, "/api/doutrina/scale/fixed");
      return;
    }
    const name = workerName.get(current.slice(2)) ?? "Trabalhador";
    void call("POST", { key: patternKey, worker_id: current.slice(2) }, (body) => {
      const days = (list: unknown) => ((list as number[] | undefined) ?? []).map((d) => String(d).padStart(2, "0")).join(", ");
      const skipped = days(body.busyDays);
      const moved = days(body.movedDays);
      const psych = days(body.psychDays);
      const recessed = days(body.recessDays);
      const replaced = ((body.replaced as string[] | undefined) ?? []).join(", ");
      return `${name} agora é fixo 📌 nesta função e já foi colocado em todas as semanas do mês.`
        + (replaced ? ` O fixo antigo em ${replaced}, que não estava valendo, foi retirado.` : "")
        + (moved ? ` No(s) dia(s) ${moved} saiu da outra atividade em que estava: escolha quem fica no lugar.` : "")
        + (skipped ? ` Fora do(s) dia(s) ${skipped}: indisponível na ficha.` : "")
        + (psych ? ` Fora do(s) dia(s) ${psych}: já é psicofônico na outra reunião mediúnica da semana.` : "")
        + (recessed ? ` Fora do(s) dia(s) ${recessed}: recesso ou evento.` : "");
    }, "/api/doutrina/scale/fixed");
  }

  /**
   * Opções da posição. Trabalhadores com 🟢 disponível, 🔵 já psicofônico na quarta/sexta da semana (bloqueia só a outra
   * reunião mediúnica; nas demais funções só informa) e 🔴 já escalado em outra função na data. Quem está na posição
   * aparece só com o nome (o ícone só quando há algo a notar), para a folha continuar limpa.
   */
  function options(key: string, current: string): Choice[] {
    if (!data) return [];
    const slot = parseSlotKey(key)!;
    const { section, type } = roleOf(slot);
    const list: Choice[] = [];
    const worker = (w: ScaleWorker, suffix = ""): Choice => {
      const value = `w:${w.id}`;
      const availability = slotAvailability(ym, slot, w.id, context, index);
      const flag = value === current ? (availability.color === "green" ? "" : `${ICON[availability.color]} `) : `${ICON[availability.color]} `;
      const note = value !== current && availability.note ? ` — ${availability.note}` : "";
      return { value, label: `${flag}${w.name}${suffix}${note}`, tone: availability.color, availability };
    };
    if (type === "STUDY") {
      const studies = (kind: string, group?: string): Choice[] =>
        data.options.studies.filter((s) => s.type === kind)
          .map((s) => ({ value: `t:${s.id}`, label: studyLabel(s), name: studyName(s), reference: s.reference || undefined, group }));
      if (section.s !== "PALESTRA") return studies(section.s ?? "");
      // Palestra pública: tema livre, tema digitado (ou buscado pelo título), temas de palestra e roteiros do ESE.
      const typed = typedThemeText(current);
      list.push({ value: FREE_THEME, label: "TEMA LIVRE" });
      if (typed !== null) list.push({ value: current, label: `✎ ${typed}` });
      list.push({ value: TYPE_THEME, label: "✎ Digitar ou buscar o tema…" });
      return [...list, ...studies("PALESTRA", PALESTRA_GROUP), ...studies("ESE", ESE_GROUP)];
    }
    if (type === "SPEAKER") {
      data.options.workers.filter((w) => w.functions.includes("Palestrante")).forEach((w) => list.push(worker(w, " (INT.)")));
      data.options.speakers.forEach((s) => list.push({ value: `s:${s.id}`, label: `${s.name} (EXT.)` }));
      return list;
    }
    data.options.workers.filter((w) => w.functions.includes(type) && w.days.includes(slot.dow)).forEach((w) => list.push(worker(w)));
    return list;
  }

  /** Escolha na lista: recusa na hora o que a regra não permite (o servidor e o banco recusam de novo). */
  function choose(key: string, value: string, choices: Choice[]) {
    const picked = choices.find((c) => c.value === value);
    if (picked?.availability?.blocked) {
      setMessage("");
      setError(picked.availability.message);
      return;
    }
    const heads = picked?.availability?.color === "blue" ? ` Atenção: ${data?.options.workers.find((w) => `w:${w.id}` === value)?.name ?? "Este médium"} já está escalado nesta semana como ${picked.availability.note}` : "";
    void call("PATCH", { key, value, version, series: extras.has(key) }, (body) => {
      const days = (list: unknown) => ((list as number[] | undefined) ?? []).map((d) => String(d).padStart(2, "0")).join(", ");
      const busy = days(body.busyDays);
      const psych = days(body.psychDays);
      const recessed = days(body.recessDays);
      const note = (busy ? ` Fora do(s) dia(s) ${busy}: já escalado em outra atividade.` : "")
        + (psych ? ` Fora do(s) dia(s) ${psych}: já é psicofônico na outra reunião mediúnica da semana.` : "")
        + (recessed ? ` Fora do(s) dia(s) ${recessed}: recesso ou evento.` : "") + heads;
      const sequenced = (body.sequenced as number[] | undefined) ?? [];
      if (sequenced.length) return `Escala atualizada. Os dias ${days(sequenced)} receberam os roteiros seguintes, em sequência.${heads}`;
      return Number(body.followed) ? `Adicional repetido em ${body.followed} semana(s) seguinte(s).${note}` : `Escala atualizada.${note}`;
    });
  }

  /**
   * Tema digitado da palestra: o título de um roteiro (ou tema de palestra) sugerido na lista vira o próprio estudo;
   * "tema livre" vira Tema Livre; qualquer outro texto é gravado como digitado.
   */
  function saveTyped(key: string, current: string, choices: Choice[]) {
    const text = (typing?.text ?? "").replace(/\s+/g, " ").trim();
    const study = choices.find((c) => c.group && (sameText(c.label, text) || sameText(c.name ?? "", text)));
    const value = study ? study.value : sameText(text, "Tema Livre") ? FREE_THEME : typedThemeValue(text);
    if (!value) {
      setMessage("");
      setError(`Digite o tema com 2 a ${THEME_MAX} letras, ou escolha um roteiro do ESE na lista.`);
      return;
    }
    setTyping(null);
    if (value !== current) choose(key, value, choices);
  }

  const readOnly = !data?.canEdit || !active || busy;
  const dates = monthDays(ym, dow);
  // Celular: uma data por vez (a de hoje ou a última que já passou no mês).
  const todayKey = currentMonth() === ym ? String(Number(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()).slice(8))).padStart(2, "0") : "00";
  const mobile = useMobileDay(dates.map((d) => ({ key: String(d).padStart(2, "0"), label: `${String(d).padStart(2, "0")}/${ym.slice(5)}${recessKind.has(d) ? ` · ${RECESS_KINDS[recessKind.get(d)!].short}` : ""}` })), todayKey);

  return (
    <div className="grid">
      <section className="card no-print">
        <div className="form-row">
          <label>Mês<input type="month" value={ym} onChange={(e) => { if (e.target.value) { setYm(e.target.value); setTyping(null); } }} /></label>
          <label>Folha
            <select value={dow} onChange={(e) => { setDow(Number(e.target.value)); setTyping(null); }}>
              {DOW_ORDER.map((d) => <option key={d} value={d}>{DAY_NAME[d]}</option>)}
            </select>
          </label>
        </div>
        {data?.canEdit && dates.length ? (
          <fieldset className="recess-days">
            <legend>Dia especial nesta folha (recesso ou evento: ninguém é escalado no dia)</legend>
            {dates.map((day) => (
              <label key={day}>
                {String(day).padStart(2, "0")}/{ym.slice(5)}
                <select value={recessKind.get(day) ?? ""} disabled={busy}
                  onChange={(e) => setDayKind(day, (e.target.value || null) as RecessKind | null)}>
                  <option value="">Escala normal</option>
                  {RECESS_KIND_KEYS.map((k) => <option key={k} value={k}>{RECESS_KINDS[k].option}</option>)}
                </select>
              </label>
            ))}
          </fieldset>
        ) : null}
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

      {data && (data.fixed.length || data.canEdit) ? (
        <section className="card no-print fixed-panel">
          <div className="fixed-panel-head">
            <span><strong>📌 Trabalhadores fixos ({data.fixed.length})</strong>
              {fixedPending ? <span className="small"> · {fixedPending} ainda fora desta escala: use “Gerar novamente”</span> : null}</span>
            <button type="button" className="button" aria-expanded={fixedOpen} aria-controls="fixed-panel-body" onClick={toggleFixed}>
              {fixedOpen ? "Recolher ▴" : "Expandir ▾"}
            </button>
          </div>
          {fixedOpen ? <div id="fixed-panel-body">
          <p className="small muted">O fixo fica na mesma função em todas as semanas, em toda escala gerada, até ser desmarcado.
            Para marcar, toque no 📍 ao lado do nome na folha do dia.</p>
          {data.fixed.length ? (
            <ul className="fixed-list">
              {data.fixed.map((f) => (
                <li key={f.id}>
                  <span><strong>{f.worker_name}</strong><br /><span className="small muted">{DAY_NAME[Number(f.key.split("|")[0])]} · {f.section_name} → {f.role_label}</span></span>
                  {data.canEdit ? <button className="button" disabled={busy} onClick={() => togglePin(f.key, "")}>Desmarcar</button> : null}
                </li>
              ))}
            </ul>
          ) : <p className="small">Nenhum trabalhador fixo.</p>}
          </div> : null}
        </section>
      ) : null}

      {data?.review && (data.review.conflicts.length || data.review.invalid.length) ? (
        <section className="card no-print">
          <h2>Resultado da conferência</h2>
          <div className="history-list">
            {data.review.conflicts.map((c) => (
              <article key={c.id}>
                {c.type === "psych_week" ? <>
                  <strong>{workerName.get(c.workerId) ?? "Médium"} — Psicofônico na quarta e na sexta da mesma semana</strong>
                  <p className="small">{psychWeekMessage(firstPsychDate(c, ym))} Tire-o de uma das duas reuniões.</p>
                </> : <>
                  <strong>{workerName.get(c.workerId) ?? "Trabalhador"} — Duplicidade no mesmo dia</strong>
                  <p className="small">Aparece em mais de uma atividade no mesmo dia e horário.</p>
                </>}
                {c.keys.map((k) => <p key={k} className="small muted">{describeSlot(k, ym)}</p>)}
                {(c.outsideDates ?? []).map((d) => <p key={d} className="small muted">{fmtDate(d)} · {DAY_NAME[new Date(`${d}T12:00:00Z`).getUTCDay()]} · MEDIÚNICA → PSICOF. (escala de outro mês)</p>)}
              </article>
            ))}
            {data.review.invalid.map((i) => (
              <article key={i.key}><strong>{describeSlot(i.key, ym)}</strong><p className="small">{i.message}</p></article>
            ))}
          </div>
        </section>
      ) : null}

      {active ? (
        <section className={`card scale-sheet ${mobile.scope}`}>
          {mobile.picker}
          {data?.canEdit ? (
            <p className="small muted no-print scale-legend">
              {psychRuleDay(dow)
                ? "Ao escolher: 🟢 disponível · 🔵 já é psicofônico na quarta ou na sexta desta semana (não pode ser psicofônico na outra reunião) · 🔴 já escalado em outra função nesta data"
                : "Ao escolher: 🟢 disponível · 🔴 já escalado em outra função nesta data. A regra do psicofônico vale só para quarta e sexta: neste dia, todos os médiuns podem ser escalados conforme o dia disponível na ficha."}
            </p>
          ) : null}
          <div className="sheet-title">CENTRO ESPÍRITA FILANTRÓPICO LAR DA BÊNÇÃO</div>
          <div className="sheet-sub">ESCALA DE TRABALHADORES — {DAY_NAME[dow]} — {ym.split("-").reverse().join("/")} · HORÁRIO: {DAY_HOURS[dow]}</div>
          {typing ? (
            /* Sugestões da caixa do tema digitado: ao digitar parte do título ou o número, aparecem os roteiros do ESE. */
            <datalist id="palestra-temas">
              <option value="Tema Livre" />
              {(data?.options.studies ?? []).filter((s) => s.type === "PALESTRA" || s.type === "ESE").map((s) => <option key={s.id} value={studyLabel(s)} />)}
            </datalist>
          ) : null}
          {TEMPLATES[dow].map((section, si) => (
            <div key={section.n + si}>
              <h3>{section.n}</h3>
              <div className="table-wrap">
                <table data-grid="">
                  <thead><tr><th>DIAS</th>{dates.map((day) => <th key={day} data-day={String(day).padStart(2, "0")}>{String(day).padStart(2, "0")}</th>)}</tr></thead>
                  <tbody>
                    {section.r.map(([label], ri) => (
                      <tr key={label + ri}>
                        <td>{label}</td>
                        {dates.map((day) => {
                          const closed = recessKind.get(day);
                          if (closed) {
                            return ri ? null : <td key={day} data-day={String(day).padStart(2, "0")} rowSpan={section.r.length} className="recess-cell">{RECESS_KINDS[closed].sheet}</td>;
                          }
                          const prefix = `${dow}|${si}|${ri}|${day}|`;
                          const keys = [...byKey.keys()].filter((k) => k.startsWith(prefix)).sort((a, b) => Number(a.split("|")[4]) - Number(b.split("|")[4]));
                          return (
                            <td key={day} data-day={String(day).padStart(2, "0")}>
                              {keys.map((key) => {
                                const current = byKey.get(key) ?? "";
                                const patternKey = `${dow}|${si}|${ri}|${key.split("|")[4]}`;
                                const pinned = fixedByKey.get(patternKey);
                                const pinOk = pinned && current === `w:${pinned.worker_id}`;
                                const choices = options(key, current);
                                const occupant = current.startsWith("w:") ? choices.find((c) => c.value === current)?.availability : undefined;
                                const psychClash = occupant?.color === "blue" && occupant.blocked;
                                const cls = [edited.has(key) ? "slot-edited" : "", duplicateKeys.has(key) ? "slot-duplicate" : "", conflictKeys.has(key) ? "slot-conflict" : "",
                                  psychClash ? "slot-psych" : "", pinOk ? "slot-fixed" : ""].join(" ");
                                const canPin = Boolean(data?.canEdit) && !busy && roleOf({ dow, si, ri }).type !== "STUDY" && Boolean(pinned || current.startsWith("w:"));
                                const pin = canPin ? (
                                  <button type="button" className={`pin-button${pinned ? " is-pinned" : ""}`} onClick={() => togglePin(patternKey, current)}
                                    title={pinned ? `${pinned.worker_name} é fixo — tocar para desmarcar` : `Fixar ${workerName.get(current.slice(2)) ?? ""} nesta função toda semana`}
                                    aria-label={pinned ? `Desmarcar ${pinned.worker_name} como fixo` : `Marcar ${workerName.get(current.slice(2)) ?? ""} como fixo`}>
                                    {pinned ? "📌" : "📍"}
                                  </button>
                                ) : pinned ? <span className="pin-button is-pinned" title={`${pinned.worker_name} é fixo`}>📌</span> : null;
                                if (typing?.key === key && !readOnly) {
                                  return (
                                    <form className="slot-with-pin theme-typing" key={key} onSubmit={(e) => { e.preventDefault(); saveTyped(key, current, choices); }}>
                                      <input autoFocus list="palestra-temas" value={typing.text} maxLength={THEME_MAX} enterKeyHint="done"
                                        placeholder="Digite o tema ou busque o roteiro" aria-label={`Tema digitado — ${describeSlot(key, ym)}`}
                                        onChange={(e) => setTyping({ key, text: e.target.value })}
                                        onKeyDown={(e) => { if (e.key === "Escape") setTyping(null); }} />
                                      <button type="submit" className="button primary" title="Gravar o tema">OK</button>
                                      <button type="button" className="slot-remove" title="Cancelar" aria-label="Cancelar o tema digitado" onClick={() => setTyping(null)}>×</button>
                                    </form>
                                  );
                                }
                                const select = (
                                  <select key={key} aria-label={describeSlot(key, ym)} className={cls} value={current} disabled={readOnly}
                                    title={duplicateKeys.has(key) ? "Duplicidade: escalado mais de uma vez neste dia" : psychClash ? occupant!.message : occupant?.color === "blue" ? occupant.message
                                      : roleOf({ dow, si, ri }).type === "STUDY" ? choices.find((c) => c.value === current)?.label : undefined}
                                    onChange={(e) => {
                                      if (e.target.value === TYPE_THEME) setTyping({ key, text: typedThemeText(current) ?? "" });
                                      else choose(key, e.target.value, choices);
                                    }}>
                                    <option value="">— selecionar —</option>
                                    {renderChoices(choices, current)}
                                  </select>
                                );
                                const remove = readOnly ? null : extras.has(key) ? (
                                  <button type="button" className="slot-remove" title="Remover esta posição adicional" aria-label={`Remover posição adicional — ${describeSlot(key, ym)}`}
                                    onClick={() => void call("PUT", { op: "remove", key, version }, () => "Posição adicional removida.")}>×</button>
                                ) : current ? (
                                  <button type="button" className="slot-remove" title="Tirar desta posição" aria-label={`Tirar da escala — ${describeSlot(key, ym)}`}
                                    onClick={() => void call("PATCH", { key, value: "", version }, () => "Posição liberada.")}>×</button>
                                ) : null;
                                // Estudo escolhido: a referência da Biblioteca aparece logo abaixo (ex.: ESE Cap. X — itens 1 a 4).
                                const reference = choices.find((c) => c.value === current)?.reference;
                                if (!reference) return <div className="slot-with-pin" key={key}>{select}{pin}{remove}</div>;
                                return (
                                  <div key={key}>
                                    <div className="slot-with-pin">{select}{pin}{remove}</div>
                                    <div className="slot-reference">{reference}</div>
                                  </div>
                                );
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

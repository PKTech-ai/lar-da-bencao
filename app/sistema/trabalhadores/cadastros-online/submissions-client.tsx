"use client";

import { useCallback, useEffect, useState } from "react";
import { api, postJson } from "@/lib/client-api";
import { WEEKDAYS, workerStatusLabel, type WorkerStatus } from "@/lib/worker-constants";
import {
  submissionDiff, type ExistingFicha, type MatchSuggestion, type SubmissionPayload, type WorkerSummary
} from "@/lib/worker-submissions";

type Option = { key: string; label: string };
type Submission = { id: string; created_at: string; payload: SubmissionPayload | null; suggestions: MatchSuggestion[] };
type WorkerDetail = ExistingFicha & { id: string; status: WorkerStatus; version: number };
type Outcome = { result: "created" | "updated" | "discarded"; resubmitted?: boolean };

const brDate = (value: string) => value.split("-").reverse().join("/");

export function SubmissionsClient({ departments }: { departments: Option[] }) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [workers, setWorkers] = useState<WorkerSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const label = useCallback((key: string) => departments.find((d) => d.key === key)?.label ?? key, [departments]);

  const load = useCallback(async () => {
    const body = await api<{ submissions: Submission[]; workers: WorkerSummary[] }>("/api/workers/submissions");
    setSubmissions(body.submissions);
    setWorkers(body.workers);
    setLoaded(true);
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load().catch((e) => setError(e.message)); }, [load]);

  async function review(id: string, payload: object) {
    setBusy(true); setError(""); setMessage("");
    try {
      const outcome = await postJson<Outcome>(`/api/workers/submissions/${id}`, payload);
      setMessage(
        outcome.result === "discarded" ? "Envio descartado."
          : outcome.result === "created" ? "Ficha criada. O trabalhador fica PENDENTE — AGUARDANDO DIRETORIA."
            : outcome.resubmitted ? "Ficha atualizada e encaminhada para nova análise da Diretoria." : "Ficha atualizada."
      );
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao tratar o envio.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {error ? <div className="error" role="alert">{error}</div> : null}
      {message ? <div className="success" role="status">{message}</div> : null}
      {loaded && !submissions.length ? <section className="card"><p>Nenhum envio aguardando conferência.</p></section> : null}
      {submissions.map((submission) => (
        <SubmissionCard key={submission.id} submission={submission} workers={workers} label={label} busy={busy}
          onReview={(payload) => void review(submission.id, payload)} onError={setError} />
      ))}
    </>
  );
}

function SubmissionCard({ submission, workers, label, busy, onReview, onError }: {
  submission: Submission; workers: WorkerSummary[]; label: (key: string) => string; busy: boolean;
  onReview: (payload: object) => void; onError: (message: string) => void;
}) {
  const { payload, suggestions } = submission;
  const [target, setTarget] = useState<WorkerDetail | null>(null);
  const [origin, setOrigin] = useState(payload?.departments[0] ?? "");
  const received = new Date(submission.created_at).toLocaleString("pt-BR");
  const suggested = suggestions
    .map((item) => ({ ...item, worker: workers.find((w) => w.id === item.worker_id) }))
    .filter((item): item is MatchSuggestion & { worker: WorkerSummary } => Boolean(item.worker));
  const others = workers.filter((w) => !suggestions.some((item) => item.worker_id === w.id));

  async function choose(workerId: string) {
    setTarget(null);
    if (!workerId) return;
    try {
      setTarget((await api<{ worker: WorkerDetail }>(`/api/workers/${workerId}`)).worker);
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : "Falha ao abrir a ficha.");
    }
  }

  function discard() {
    const note = window.prompt("Motivo do descarte (fica registrado no Dedo-duro):");
    if (note === null) return;
    onReview({ action: "discard", note });
  }

  if (!payload) {
    return (
      <section className="card">
        <h2>Envio ilegível</h2>
        <p className="muted small">Recebido em {received}. Os dados não puderam ser lidos; só é possível descartar.</p>
        <button className="button danger" disabled={busy} onClick={discard}>Descartar</button>
      </section>
    );
  }

  const diff = target ? submissionDiff(target, payload, label) : [];
  const rows: [string, string][] = [
    ["Telefone", payload.phone], ["E-mail", payload.email || "—"], ["Nascimento", brDate(payload.birth_date)],
    ["Naturalidade", payload.naturality || "—"], ["Estado civil", payload.marital_status || "—"],
    ["Profissão", payload.profession || "—"], ["Endereço", payload.address || "—"],
    ["Departamentos", payload.departments.map(label).join(", ")], ["Funções na Doutrina", payload.functions.join(", ") || "—"],
    ["Dias disponíveis", payload.available_days.map((day) => WEEKDAYS[day]).join(", ") || "—"],
    ["Serviço voluntário", payload.volunteer_service || "—"],
    ["Termo de voluntariado", "Aceito"], ["Autorização de imagem", payload.image_authorization ? "Sim" : "Não"]
  ];

  return (
    <section className="card">
      <div className="toolbar">
        <h2>{payload.full_name}</h2>
        <span className="muted small">Recebido em {received}</span>
      </div>
      <div className="table-wrap">
        <table>
          <tbody>{rows.map(([name, value]) => <tr key={name}><th scope="row">{name}</th><td>{value}</td></tr>)}</tbody>
        </table>
      </div>
      <div className="form-stack" style={{ marginTop: 16 }}>
        <label>Já tem ficha? Vincular a
          <select value={target?.id ?? ""} disabled={busy} onChange={(event) => void choose(event.target.value)}>
            <option value="">— escolher ficha existente —</option>
            {suggested.length ? (
              <optgroup label="Fichas parecidas">
                {suggested.map(({ worker, reasons }) => <option key={worker.id} value={worker.id}>{worker.full_name} ({reasons.join("; ")})</option>)}
              </optgroup>
            ) : null}
            <optgroup label="Todas as fichas">
              {others.map((worker) => <option key={worker.id} value={worker.id}>{worker.full_name}</option>)}
            </optgroup>
          </select>
          <span className="small muted">{suggested.length ? `${suggested.length} ficha(s) parecida(s) encontrada(s).` : "Nenhuma ficha parecida encontrada."}</span>
        </label>
        {target ? (
          <>
            <div className="notice">
              Ficha de <strong>{target.full_name}</strong> — {workerStatusLabel[target.status]}.
              {diff.some((row) => row.field === "departments" || row.field === "functions") && (target.status === "active" || target.status === "inactive")
                ? " Como departamentos ou funções mudam, a ficha volta para PENDENTE — AGUARDANDO DIRETORIA." : ""}
            </div>
            {diff.length ? (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Campo</th><th>Hoje na ficha</th><th>Depois de atualizar</th></tr></thead>
                  <tbody>{diff.map((row) => <tr key={row.field}><th scope="row">{row.label}</th><td>{row.before}</td><td>{row.after}</td></tr>)}</tbody>
                </table>
              </div>
            ) : <p className="muted small">O envio não muda nenhum campo desta ficha.</p>}
          </>
        ) : null}
        <div className="row-actions">
          {target ? (
            <button className="button primary" disabled={busy} onClick={() => onReview({ action: "apply", worker_id: target.id, version: target.version })}>Atualizar esta ficha</button>
          ) : null}
          {!target ? (
            <>
              {payload.departments.length > 1 ? (
                <label>Departamento solicitante
                  <select value={origin} onChange={(event) => setOrigin(event.target.value)}>
                    {payload.departments.map((key) => <option key={key} value={key}>{label(key)}</option>)}
                  </select>
                </label>
              ) : null}
              <button className="button primary" disabled={busy} onClick={() => onReview({ action: "create", origin_department: origin })}>Criar nova ficha</button>
            </>
          ) : null}
          <button className="button danger" disabled={busy} onClick={discard}>Descartar</button>
        </div>
      </div>
    </section>
  );
}

"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { readFicha, WorkerFichaForm, type FichaValues } from "@/components/worker-ficha-form";
import { api, postJson } from "@/lib/client-api";
import { workerStatusLabel, type WorkerStatus } from "@/lib/worker-constants";
import {
  fichaFromSubmission, submissionDiff, type ExistingFicha, type MatchSuggestion, type SubmissionPayload, type WorkerSummary
} from "@/lib/worker-submissions";

type Option = { key: string; label: string };
type Submission = { id: string; created_at: string; payload: SubmissionPayload | null; suggestions: MatchSuggestion[] };
type WorkerDetail = ExistingFicha & { id: string; status: WorkerStatus; version: number };
type Outcome = { result: "created" | "updated" | "discarded"; resubmitted?: boolean };

function toForm(payload: SubmissionPayload, existing?: ExistingFicha): FichaValues {
  const ficha = fichaFromSubmission(payload, existing);
  return {
    ...ficha,
    email: ficha.email || null,
    phone: ficha.phone || null,
    birth_date: ficha.birth_date || null,
    naturality: ficha.naturality || null,
    marital_status: ficha.marital_status || null,
    profession: ficha.profession || null,
    address: ficha.address || null,
    filled_date: ficha.filled_date || null
  };
}

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
        <SubmissionCard key={submission.id} submission={submission} workers={workers} departments={departments} label={label} busy={busy}
          onReview={(payload) => void review(submission.id, payload)} onError={setError} />
      ))}
    </>
  );
}

function SubmissionCard({ submission, workers, departments, label, busy, onReview, onError }: {
  submission: Submission; workers: WorkerSummary[]; departments: Option[]; label: (key: string) => string; busy: boolean;
  onReview: (payload: object) => void; onError: (message: string) => void;
}) {
  const { payload, suggestions } = submission;
  const [target, setTarget] = useState<WorkerDetail | null>(null);
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

  const receivedPayload = payload;
  const diff = target ? submissionDiff(target, receivedPayload, label) : [];
  const initial = toForm(receivedPayload, target ?? undefined);
  const originOptions = [
    ...departments.filter((department) => receivedPayload.departments.includes(department.key)),
    ...departments.filter((department) => !receivedPayload.departments.includes(department.key))
  ];

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const ficha = readFicha(form);
    const origin = String(new FormData(form).get("origin_department") ?? "");
    if (target) onReview({ action: "apply", worker_id: target.id, version: target.version, ficha });
    else onReview({ action: "create", origin_department: origin || receivedPayload.departments[0], ficha });
  }

  return (
    <section className="card">
      <div className="toolbar">
        <h2>{payload.full_name}</h2>
        <span className="muted small">Recebido em {received}</span>
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
                  <thead><tr><th>Campo</th><th>Hoje na ficha</th><th>O que chegou no formulário</th></tr></thead>
                  <tbody>{diff.map((row) => <tr key={row.field}><th scope="row">{row.label}</th><td>{row.before}</td><td>{row.after}</td></tr>)}</tbody>
                </table>
              </div>
            ) : <p className="muted small">O envio não muda nenhum campo desta ficha. Você ainda pode corrigir os campos abaixo.</p>}
          </>
        ) : null}
        <WorkerFichaForm key={target?.id ?? "nova"} departments={departments} initial={initial}
          originOptions={target ? undefined : originOptions} busy={busy}
          notice="Corrija qualquer campo. Só o Administrador do Sistema grava esta ficha."
          submitLabel={target ? "Atualizar esta ficha" : "Criar nova ficha"} onSubmit={save} />
        <div className="row-actions">
          <button className="button danger" disabled={busy} onClick={discard}>Descartar</button>
        </div>
      </div>
    </section>
  );
}

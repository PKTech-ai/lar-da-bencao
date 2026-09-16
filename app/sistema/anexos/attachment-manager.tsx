"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

type Attachment = { id: string; filename: string; mime_type: string; size_bytes: string; sha256: string; status: string; scan_result: string | null; uploaded_at: string };
const ownerType = "system_test", ownerId = "operational-readiness";

function hex(bytes: ArrayBuffer) { return [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, "0")).join(""); }
function size(value: number) { return value < 1024 * 1024 ? `${Math.ceil(value / 1024)} KB` : `${(value / 1024 / 1024).toFixed(1)} MB`; }

export function AttachmentManager() {
  const [files, setFiles] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const response = await fetch(`/api/attachments?ownerType=${ownerType}&ownerId=${ownerId}`, { cache: "no-store" });
    const body = await response.json();
    if (response.ok) setFiles(body.attachments);
  }, []);
  // A carga inicial é a sincronização desta tela cliente com a API protegida.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage(""); setProgress(0);
    try {
      const input = event.currentTarget.elements.namedItem("file") as HTMLInputElement;
      const file = input.files?.[0]; if (!file) throw new Error("Selecione um arquivo.");
      const digest = hex(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()));
      const init = await fetch("/api/attachments/init", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ownerType, ownerId, filename: file.name, mimeType: file.type || "application/pdf", sizeBytes: file.size, sha256: digest }) });
      const created = await init.json(); if (!init.ok) throw new Error(created.error);
      for (let part = 0; part < created.chunkCount; part++) {
        const chunk = file.slice(part * created.chunkSize, Math.min(file.size, (part + 1) * created.chunkSize));
        const sent = await fetch(`/api/attachments/${created.id}/chunks/${part}`, { method: "PUT", headers: { "Content-Type": "application/octet-stream", "X-Upload-Token": created.token }, body: chunk });
        const sentBody = await sent.json(); if (!sent.ok) throw new Error(sentBody.error);
        setProgress(Math.round(((part + 1) / created.chunkCount) * 85));
      }
      const final = await fetch(`/api/attachments/${created.id}/finalize`, { method: "POST", headers: { "X-Upload-Token": created.token } });
      const finalBody = await final.json(); if (!final.ok) throw new Error(finalBody.error);
      setProgress(100); setMessage("Arquivo conferido, inspecionado e ativado no banco."); input.value = ""; await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Falha no upload."); }
    finally { setBusy(false); }
  }

  return <div className="grid">
    <section className="card"><h2>Enviar arquivo de validação</h2><p className="muted">PDF, JPG, PNG, CSV, OFX, WebM ou OGG. Até 15 MB nesta área.</p>
      <form className="form-stack" onSubmit={upload}><label>Arquivo<input name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,.csv,.ofx,.webm,.ogg" required /></label>
        {busy ? <div className="upload-progress" aria-label={`Upload ${progress}%`}><span style={{ width: `${progress}%` }} /></div> : null}
        {error ? <div className="error" role="alert">{error}</div> : null}{message ? <div className="success">{message}</div> : null}
        <button className="button primary" disabled={busy}>{busy ? `Processando… ${progress}%` : "Enviar e inspecionar"}</button></form>
    </section>
    <section className="card"><h2>Arquivos desta validação</h2><div className="table-wrap"><table><thead><tr><th>Arquivo</th><th>Tamanho</th><th>Situação</th><th>Integridade</th><th>Ação</th></tr></thead><tbody>{files.map((file) => <tr key={file.id}><td><strong>{file.filename}</strong><br/><span className="muted">{new Date(file.uploaded_at).toLocaleString("pt-BR")}</span></td><td>{size(Number(file.size_bytes))}</td><td>{file.status} · {file.scan_result ?? "—"}</td><td title={file.sha256}>{file.sha256.slice(0, 12)}…</td><td>{file.status === "active" ? <a className="button" href={`/api/attachments/${file.id}/download`}>Baixar</a> : "Indisponível"}</td></tr>)}</tbody></table></div></section>
  </div>;
}

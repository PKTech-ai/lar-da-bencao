"use client";

import { useCallback, useEffect, useState } from "react";
import { uploadAttachment } from "@/lib/upload-client";

type Doc = {
  slug: string; title: string; description: string; version: number; updated_at: string;
  attachment_id: string | null; filename: string | null; size_bytes: string | null; attachment_status: string | null;
};

export function DocumentsClient() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const [progress, setProgress] = useState(0);

  const load = useCallback(async () => {
    const response = await fetch("/api/documents", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    setDocs(body.documents);
    setCanManage(body.canManage);
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load().catch((e) => setError(e.message)); }, [load]);

  async function replace(doc: Doc, file: File | undefined) {
    if (!file) return;
    if (file.type && file.type !== "application/pdf") { setError("Envie o documento em PDF."); return; }
    setBusy(doc.slug); setError(""); setMessage(""); setProgress(0);
    try {
      const attachmentId = await uploadAttachment(file, "institutional_document", doc.slug, setProgress);
      const response = await fetch(`/api/documents/${doc.slug}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: doc.title, description: doc.description, attachment_id: attachmentId, version: doc.version })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setMessage(`${doc.title}: PDF conferido e publicado.`);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao enviar o PDF.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="grid">
      {error ? <div className="error" role="alert">{error}</div> : null}
      {message ? <div className="success" role="status">{message}</div> : null}
      <div className="grid cards">
        {docs.map((doc) => (
          <article className="card" key={doc.slug}>
            <h2>{doc.title}</h2>
            <p className="small muted">{doc.description}</p>
            {doc.attachment_id && doc.attachment_status === "active" ? (
              <div className="row-actions">
                <a className="button primary" href={`/api/attachments/${doc.attachment_id}/download?inline=1`} target="_blank" rel="noreferrer">Abrir</a>
                <a className="button" href={`/api/attachments/${doc.attachment_id}/download`}>Salvar PDF</a>
              </div>
            ) : <p className="notice small">PDF ainda não publicado.</p>}
            {canManage ? (
              <label className="small" style={{ marginTop: 12 }}>
                {doc.attachment_id ? "Substituir PDF" : "Enviar PDF"}
                <input type="file" accept=".pdf,application/pdf" disabled={Boolean(busy)} onChange={(e) => void replace(doc, e.target.files?.[0])} />
              </label>
            ) : null}
            {busy === doc.slug ? <div className="upload-progress" aria-label={`Envio ${progress}%`}><span style={{ width: `${progress}%` }} /></div> : null}
          </article>
        ))}
      </div>
      {canManage ? <p className="small muted">Os PDFs oficiais embutidos na versão 215 podem ser extraídos em <a href="/sistema/importacao">Importação v215</a>.</p> : null}
    </div>
  );
}

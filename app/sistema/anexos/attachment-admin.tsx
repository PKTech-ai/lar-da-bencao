"use client";

import { useCallback, useEffect, useState } from "react";

type Row = { id: string; owner_type: string; owner_id: string; filename: string; size_bytes: string; status: string; scan_result: string | null; scan_engine: string | null; uploaded_at: string; uploaded_by_name: string; has_binary: boolean };
type Payload = {
  byStatus: { status: string; files: number; bytes: string }[];
  byOwner: { owner_type: string; files: number; bytes: string }[];
  attention: Row[];
  storage: { chunk_bytes: string; database_bytes: string };
};

const mb = (bytes: string | number) => `${(Number(bytes) / 1024 / 1024).toFixed(1)} MB`;
const STATUS: Record<string, string> = { active: "Ativos", quarantined: "Quarentena", uploading: "Enviando", pending_scan: "Aguardando inspeção", deleted: "Descartados" };

export function AttachmentAdmin() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const response = await fetch("/api/attachments/admin", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    setData(body);
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load().catch((e) => setError(e.message)); }, [load]);

  async function discard(row: Row) {
    const reason = window.prompt(`Motivo do descarte de “${row.filename}”:`);
    if (!reason?.trim()) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/attachments/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: row.id, reason }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao descartar.");
    } finally {
      setBusy(false);
    }
  }

  if (!data) return error ? <div className="error" role="alert">{error}</div> : null;
  return (
    <div className="grid">
      {error ? <div className="error" role="alert">{error}</div> : null}
      <div className="grid cards">
        <article className="card kpi"><span className="small muted">Binários no banco</span><b>{mb(data.storage.chunk_bytes)}</b></article>
        <article className="card kpi"><span className="small muted">Tamanho total do banco</span><b>{mb(data.storage.database_bytes)}</b></article>
        {data.byStatus.map((s) => <article className="card kpi" key={s.status}><span className="small muted">{STATUS[s.status] ?? s.status}</span><b>{s.files}</b><span className="small muted">{mb(s.bytes)}</span></article>)}
      </div>
      <section className="card">
        <h2>Quarentena e uploads interrompidos</h2>
        <p className="small muted">Arquivos bloqueados pela inspeção não podem ser baixados. O cron diário remove o binário da quarentena após 30 dias e descarta anexos órfãos após 24 horas.</p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Arquivo</th><th>Vínculo</th><th>Situação</th><th>Inspeção</th><th>Enviado</th><th>Ação</th></tr></thead>
            <tbody>
              {data.attention.map((row) => (
                <tr key={row.id}>
                  <td><strong>{row.filename}</strong><br /><span className="small muted">{mb(row.size_bytes)}{row.has_binary ? "" : " · binário removido"}</span></td>
                  <td>{row.owner_type}<br /><span className="small muted">{row.owner_id}</span></td>
                  <td><span className={`status ${row.status === "quarantined" ? "danger" : "building"}`}>{STATUS[row.status] ?? row.status}</span></td>
                  <td>{row.scan_result ?? "—"}{row.scan_engine ? <><br /><span className="small muted">{row.scan_engine}</span></> : null}</td>
                  <td>{new Date(row.uploaded_at).toLocaleString("pt-BR")}<br /><span className="small muted">{row.uploaded_by_name}</span></td>
                  <td><button className="button danger" disabled={busy} onClick={() => void discard(row)}>Descartar</button></td>
                </tr>
              ))}
              {!data.attention.length ? <tr><td colSpan={6}>Nenhum arquivo exige atenção.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card">
        <h2>Volume ativo por vínculo</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Vínculo</th><th>Arquivos</th><th>Tamanho</th></tr></thead>
            <tbody>{data.byOwner.map((o) => <tr key={o.owner_type}><td>{o.owner_type}</td><td>{o.files}</td><td>{mb(o.bytes)}</td></tr>)}</tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { buildPlan, isDemoPackage, readPackage, type ImportPlan, type LegacyManifest, type PhotoToImport } from "@/lib/legacy/v215";
import { uploadAttachment } from "@/lib/upload-client";

type Report = Record<string, { created: number; skipped: number }>;
type Prepared = { manifest: LegacyManifest; plan: ImportPlan; photos: PhotoToImport[]; warnings: string[]; origin: Record<string, number>; demo: boolean };
type ImportRow = { id: string; status: string; source_sha256: string; created_at: string; completed_at: string | null; rolled_back_at: string | null; created_by_name: string; report: { entities?: Report } };

const LABELS: Record<string, string> = {
  worker: "Trabalhadores (fichas)", speaker: "Palestrantes externos", study_folder: "Pastas de estudo", study: "Estudos",
  evangelizando: "Evangelizandos", group_evangelizer: "Evangelizadores por turma", evangelizando_attendance: "Chamadas (P/F)",
  education_schedule: "Cronograma", doctrine_attendance: "Frequência da Doutrina", scale_month: "Escalas mensais"
};

function dataUrlToFile(dataUrl: string, name: string) {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/data:(.*);base64/)?.[1] ?? "image/jpeg";
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return new File([bytes], `${name}.${mime === "image/png" ? "png" : "jpg"}`, { type: mime });
}

function ReportTable({ report }: { report: Report }) {
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Destino</th><th>Novos</th><th>Já existentes / ignorados</th></tr></thead>
        <tbody>{Object.entries(report).map(([entity, r]) => <tr key={entity}><td>{LABELS[entity] ?? entity}</td><td>{r.created}</td><td>{r.skipped}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

export function ImportClient() {
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [dryRun, setDryRun] = useState<{ report: Report; warnings: string[]; alreadyImported: boolean } | null>(null);
  const [history, setHistory] = useState<ImportRow[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const loadHistory = useCallback(async () => {
    const response = await fetch("/api/legacy-import", { cache: "no-store" });
    const body = await response.json();
    if (response.ok) setHistory(body.imports);
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadHistory(); }, [loadHistory]);

  async function choose(file: File | undefined) {
    setPrepared(null); setDryRun(null); setError(""); setStatus("");
    if (!file) return;
    setBusy(true);
    try {
      setStatus("Conferindo manifesto, dados e anexos do pacote…");
      const { manifest, database } = await readPackage(new Uint8Array(await file.arrayBuffer()));
      const built = buildPlan(database);
      setPrepared({ manifest, ...built, demo: isDemoPackage(database) });
      setStatus("Pacote íntegro. Faça a simulação antes de importar.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível ler o pacote.");
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  async function post(action: "dry-run" | "commit") {
    const { manifest, plan, origin } = prepared!;
    const response = await fetch("/api/legacy-import", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, manifest: { sha256: manifest.sha256, appVersion: manifest.appVersion, createdAt: manifest.createdAt, createdBy: manifest.createdBy, counts: manifest.counts }, origin, plan })
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    return body;
  }

  async function simulate() {
    setBusy(true); setError("");
    try { setDryRun(await post("dry-run")); setStatus("Simulação concluída: nada foi gravado."); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Falha na simulação."); }
    finally { setBusy(false); }
  }

  async function commit() {
    if (!window.confirm("Importar os dados para o Postgres? A operação fica registrada e pode ser revertida depois.")) return;
    setBusy(true); setError("");
    try {
      const body = await post("commit");
      const students = body.students as Record<string, string>;
      let sent = 0;
      for (const photo of prepared!.photos) {
        const id = students[photo.legacy_id];
        if (!id) continue;
        setStatus(`Enviando fotos inspecionadas… ${++sent}/${prepared!.photos.length}`);
        try {
          const attachmentId = await uploadAttachment(dataUrlToFile(photo.data_url, photo.name), `evangelizando_photo_${photo.department_key}`, id);
          await fetch(`/api/evangelizandos/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "photo", attachment_id: attachmentId, version: 1 }) });
        } catch {
          // A foto pode ser reenviada depois pela ficha; a importação dos dados já foi concluída.
        }
      }
      setDryRun({ report: body.report, warnings: body.warnings, alreadyImported: true });
      setStatus("Importação concluída e registrada no Dedo-duro. Guarde o ZIP original em local seguro.");
      await loadHistory();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha na importação.");
    } finally {
      setBusy(false);
    }
  }

  async function rollback(row: ImportRow) {
    if (!window.confirm("Reverter esta importação? Todos os registros criados por ela serão removidos, inclusive alterações feitas depois neles.")) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/legacy-import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "rollback", import_id: row.id }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setStatus("Importação revertida.");
      await loadHistory();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao reverter.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid">
      <section className="card">
        <h2>1. Escolher o pacote</h2>
        <p className="small muted">Use o arquivo “LAR_BENCAO_BACKUP_COMPLETO_*.zip” gerado em Controle de Acesso → Backup e restauração da v215. O arquivo é conferido neste navegador (manifesto e hashes) e só o necessário é enviado ao servidor.</p>
        <label>Arquivo ZIP<input type="file" accept=".zip,application/zip" disabled={busy} onChange={(e) => void choose(e.target.files?.[0])} /></label>
      </section>
      {error ? <div className="error" role="alert">{error}</div> : null}
      {status ? <div className="notice" role="status">{status}</div> : null}
      {prepared ? (
        <section className="card">
          <h2>2. Conferência do pacote</h2>
          <p className="small">Gerado em {new Date(prepared.manifest.createdAt).toLocaleString("pt-BR")}{prepared.manifest.createdBy ? ` por ${prepared.manifest.createdBy}` : ""} · v{prepared.manifest.appVersion} · {prepared.manifest.counts.files} arquivo(s) · SHA-256 {prepared.manifest.sha256.slice(0, 16)}…</p>
          {prepared.demo ? <div className="error">Este pacote contém os dados fictícios de demonstração. A importação é bloqueada em produção.</div> : null}
          <div className="grid cards">
            {Object.entries(prepared.origin).map(([k, v]) => <article className="card kpi" key={k}><span className="small muted">{k === "users_not_imported" ? "Usuários (não importados: use convites)" : k}</span><b>{v}</b></article>)}
          </div>
          {prepared.warnings.length ? <details style={{ marginTop: 12 }}><summary>{prepared.warnings.length} aviso(s)</summary><ul>{prepared.warnings.slice(0, 200).map((w, i) => <li key={i} className="small">{w}</li>)}</ul></details> : null}
          <div className="row-actions" style={{ marginTop: 12 }}>
            <button className="button" disabled={busy} onClick={() => void simulate()}>Simular importação (sem gravar)</button>
            <button className="button primary" disabled={busy || !dryRun || dryRun.alreadyImported} onClick={() => void commit()}>Importar</button>
          </div>
          {dryRun ? (
            <div style={{ marginTop: 12 }}>
              <h3>{dryRun.alreadyImported ? "Resultado" : "Resultado da simulação"}</h3>
              {dryRun.alreadyImported && !status.startsWith("Importação concluída") ? <div className="notice">Este pacote já tem uma importação ativa. Reverta-a no histórico para importar de novo.</div> : null}
              <ReportTable report={dryRun.report} />
              {dryRun.warnings.length ? <ul>{dryRun.warnings.map((w, i) => <li key={i} className="small">{w}</li>)}</ul> : null}
            </div>
          ) : null}
        </section>
      ) : null}
      <section className="card">
        <h2>Histórico de importações</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Quando</th><th>Responsável</th><th>Pacote</th><th>Situação</th><th>Relatório</th><th>Ação</th></tr></thead>
            <tbody>
              {history.map((row) => (
                <tr key={row.id}>
                  <td>{new Date(row.created_at).toLocaleString("pt-BR")}</td>
                  <td>{row.created_by_name}</td>
                  <td title={row.source_sha256}>{row.source_sha256.slice(0, 12)}…</td>
                  <td>{row.status === "completed" ? "Concluída" : row.status === "rolled_back" ? `Revertida em ${new Date(row.rolled_back_at!).toLocaleString("pt-BR")}` : row.status}</td>
                  <td>{row.report?.entities ? Object.entries(row.report.entities).map(([k, r]) => `${LABELS[k] ?? k}: ${r.created}`).join(" · ") : "—"}</td>
                  <td>{row.status === "completed" ? <button className="button danger" disabled={busy} onClick={() => void rollback(row)}>Reverter</button> : null}</td>
                </tr>
              ))}
              {!history.length ? <tr><td colSpan={6}>Nenhuma importação realizada.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

"use client";

import { useState } from "react";
import { ResourceManager, type ResourceRow } from "@/components/resources/resource-manager";
import { postJson } from "@/lib/client-api";

/** Pareceres do Conselho Fiscal, com o arquivamento da decisão (trava o parecer e a competência). */
export function FiscalReviewsPanel() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function lock(row: ResourceRow, reload: () => Promise<void>) {
    if (!window.confirm("Arquivar a decisão trava o parecer e impede a reabertura do caixa desta competência. Continuar?")) return;
    setError(""); setMessage("");
    void postJson(`/api/conselho/pareceres/${row.id}/arquivar`, {})
      .then(async () => { await reload(); setMessage("Decisão arquivada."); })
      .catch((e: Error) => setError(e.message));
  }

  return (
    <div className="grid">
      {error ? <div className="error" role="alert">{error}</div> : null}
      {message ? <div className="success" role="status">{message}</div> : null}
      <ResourceManager
        resourceKey="conselho-analises"
        extraColumns={[{ label: "Decisão arquivada", render: (row) => (row.locked_at ? new Date(String(row.locked_at)).toLocaleDateString("pt-BR") : "—") }]}
        rowActions={(row, reload) => (row.locked_at || !["Deferido", "Indeferido"].includes(String(row.status))
          ? null
          : <button type="button" className="button" onClick={() => lock(row, reload)}>Arquivar decisão</button>)}
      />
    </div>
  );
}

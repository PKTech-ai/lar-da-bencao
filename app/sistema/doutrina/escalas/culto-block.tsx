"use client";

import Link from "next/link";
import { useState } from "react";
import { CultoPersonSelect, saveCulto, type CultoPatch } from "@/components/culto-people";
import { CULTO_HOURS, cultoEligible } from "@/lib/doutrina-extras";
import type { ScaleWorker } from "@/lib/doutrina-scale";
import { brDate } from "@/lib/monthly-saturdays";

export type SheetCulto = {
  month: string; culto: string; host_name: string; leader_id: string | null; speaker_id: string | null;
  leader_name: string; speaker_name: string; version: number; canEdit: boolean;
};

/**
 * Culto no Lar dos Trabalhadores na folha de sábado: penúltimo sábado, 19:30 às 20:30. O responsável da Doutrina
 * escolhe aqui (ou na aba Culto no Lar) o Dirigente e o Expositor; o trabalhador do lar vem da aba Culto no Lar.
 */
export function CultoSheetBlock({ culto, workers, onSaved }: { culto: SheetCulto; workers: readonly ScaleWorker[]; onSaved: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const leaders = workers.filter((w) => cultoEligible("leader", w.functions)).map(({ id, name }) => ({ id, name }));
  const speakers = workers.filter((w) => cultoEligible("speaker", w.functions)).map(({ id, name }) => ({ id, name }));

  async function save(patch: CultoPatch) {
    setBusy(true); setError("");
    const result = await saveCulto(culto.month, culto.version, patch);
    if (result.error) setError(result.error);
    await onSaved().catch(() => undefined);
    setBusy(false);
  }

  return (
    <div className="culto-sheet">
      <h3>CULTO NO LAR DOS TRABALHADORES — PENÚLTIMO SÁBADO · HORÁRIO: {CULTO_HOURS.toUpperCase()}</h3>
      {error ? <div className="error no-print" role="alert">{error}</div> : null}
      <div className="table-wrap">
        <table>
          <thead><tr><th>DATA</th><th>TRABALHADOR (LAR)</th><th>DIRIGENTE</th><th>EXPOSITOR</th></tr></thead>
          <tbody>
            <tr>
              <td><strong>{brDate(culto.culto).slice(0, 5)}</strong></td>
              <td>{culto.host_name || "—"}</td>
              <td>{culto.canEdit ? (
                <CultoPersonSelect label={`Dirigente — Culto no Lar de ${brDate(culto.culto)}`} value={culto.leader_id} name={culto.leader_name}
                  options={leaders} disabled={busy} onChange={(id) => void save({ leader_id: id })} />
              ) : culto.leader_name || "—"}</td>
              <td>{culto.canEdit ? (
                <CultoPersonSelect label={`Expositor — Culto no Lar de ${brDate(culto.culto)}`} value={culto.speaker_id} name={culto.speaker_name}
                  options={speakers} disabled={busy} onChange={(id) => void save({ speaker_id: id })} />
              ) : culto.speaker_name || "—"}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="small muted no-print">O trabalhador que recebe o culto no lar é escolhido na aba <Link href="/sistema/doutrina/culto-lar">Culto no Lar</Link>.</p>
    </div>
  );
}

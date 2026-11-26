"use client";

/** Escolha do Dirigente e do Expositor do Culto no Lar — usada na tela do Culto e na folha de sábado da Escala Mensal. */

export type CultoOption = { id: string; name: string };
export type CultoPatch = { host_name?: string; leader_id?: string | null; speaker_id?: string | null };

/** Grava no Culto no Lar do mês só o que mudou. Devolve a mensagem de erro (ou "" quando gravou) e o código HTTP. */
export async function saveCulto(month: string, version: number, patch: CultoPatch) {
  const response = await fetch("/api/doutrina/culto", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ month, version, ...patch })
  });
  const body = await response.json().catch(() => ({}));
  return { error: response.ok ? "" : String(body.error ?? "Não foi possível gravar."), status: response.status };
}

/**
 * Lista de quem pode dirigir ou expor. Quem já está escolhido continua aparecendo mesmo se deixou de ter a função
 * (fica marcado), para a Doutrina ver e trocar.
 */
export function CultoPersonSelect({ label, value, name, options, disabled, onChange }: {
  label: string; value: string | null; name: string; options: readonly CultoOption[]; disabled?: boolean; onChange: (id: string | null) => void;
}) {
  const missing = value && !options.some((o) => o.id === value);
  return (
    <select aria-label={label} value={value ?? ""} disabled={disabled} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">— escolher —</option>
      {missing ? <option value={value}>{name || "Trabalhador"} (sem a função na ficha)</option> : null}
      {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
    </select>
  );
}

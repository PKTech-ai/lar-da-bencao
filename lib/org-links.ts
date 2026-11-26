/**
 * Organograma de Vinculação: cargos da estrutura (Estatuto e Regimento) e o acesso que cada vínculo libera.
 * Lógica pura, usada pela tela (prévia do que a pessoa ganha ou perde) e pela API (o que de fato é gravado).
 * Banco: app.org_links (supabase/migrations/202611261900_organograma_vinculacao.sql).
 */
import { DEPARTMENT_MODULES } from "@/lib/department-modules";

export const BOARD_SEATS = [
  { seat: "presidente", label: "Presidente" },
  { seat: "vice_presidente", label: "Vice-Presidente" },
  { seat: "secretario", label: "Secretário(a)" },
  { seat: "tesoureiro", label: "Tesoureiro(a)" }
] as const;

export type BoardSeat = (typeof BOARD_SEATS)[number]["seat"];
export type OrgSeat = BoardSeat | "conselho_fiscal" | "coordenacao";
export const ORG_SEATS: readonly OrgSeat[] = ["presidente", "vice_presidente", "secretario", "tesoureiro", "conselho_fiscal", "coordenacao"];

export const isBoardSeat = (seat: string): seat is BoardSeat => BOARD_SEATS.some((s) => s.seat === seat);

/** Departamentos do quadro, na ordem do organograma. */
export const ORG_DEPARTMENTS = [
  "secretaria", "tesouraria", "patrimonio", "doutrina", "infancia", "juventude", "assistencia_social", "eventos", "divulgacao", "juridico"
] as const;

export function seatLabel(seat: OrgSeat, departmentLabel?: string) {
  if (seat === "conselho_fiscal") return "Conselho Fiscal";
  if (seat === "coordenacao") return `Coordenação${departmentLabel ? ` — ${departmentLabel}` : ""}`;
  return BOARD_SEATS.find((s) => s.seat === seat)!.label;
}

/**
 * Departamentos em que o vínculo dá acesso total. Só o Presidente vê todos (menos o Conselho Fiscal, que fiscaliza a
 * Diretoria); os outros cargos, só o próprio setor. `active` = departamentos ativos no sistema.
 */
export function seatDepartments(seat: OrgSeat, department: string | null, active: readonly string[]): string[] {
  const wanted = seat === "presidente" ? active.filter((key) => key !== "conselho_fiscal")
    : seat === "vice_presidente" ? ["diretoria"]
    : seat === "secretario" ? ["secretaria"]
    : seat === "tesoureiro" ? ["tesouraria"]
    : seat === "conselho_fiscal" ? ["conselho_fiscal"]
    : department ? [department] : [];
  return wanted.filter((key) => active.includes(key) && DEPARTMENT_MODULES[key]);
}

/** O que a pessoa perde ao sair de um vínculo: o que ele liberou, menos o que outro vínculo dela ainda libera. */
export function departmentsToRevoke(granted: readonly string[], otherLinksOfSamePerson: readonly { granted: readonly string[] }[]) {
  const kept = new Set(otherLinksOfSamePerson.flatMap((l) => l.granted));
  return granted.filter((key) => !kept.has(key));
}

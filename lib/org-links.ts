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

/** O Conselho Fiscal tem 3 membros. */
export const CONSELHO_MAX = 3;

/** Nível que o vínculo dá: o Vice-Presidente só consulta; os demais cargos, acesso total (coordenação). */
export type GrantLevel = "coordenacao" | "consulta";
export const seatLevel = (seat: OrgSeat): GrantLevel => (seat === "vice_presidente" ? "consulta" : "coordenacao");
const RANK: Record<GrantLevel, number> = { consulta: 1, coordenacao: 2 };
export const higherLevel = (a: GrantLevel, b: GrantLevel) => RANK[a] >= RANK[b];

/**
 * Departamentos em que o vínculo dá acesso. Só o Presidente vê todos (menos o Conselho Fiscal, que fiscaliza a
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

type LinkLike = { seat: OrgSeat; granted: readonly string[] };

/** Maior nível que os outros vínculos da pessoa dão no departamento, ou null quando nenhum dá. */
export function levelFromLinks(department: string, links: readonly LinkLike[]): GrantLevel | null {
  let best: GrantLevel | null = null;
  for (const link of links) {
    if (!link.granted.includes(department)) continue;
    const level = seatLevel(link.seat);
    if (!best || !higherLevel(best, level)) best = level;
  }
  return best;
}

/**
 * O que acontece ao tirar a pessoa de um vínculo: onde ela perde o acesso (nenhum outro vínculo dela dá) e onde
 * passa a só consultar (outro vínculo dela dá só consulta).
 */
export function unlinkEffect(link: LinkLike, otherLinksOfSamePerson: readonly LinkLike[]) {
  const revoke: string[] = [];
  const downgrade: string[] = [];
  for (const key of link.granted) {
    const kept = levelFromLinks(key, otherLinksOfSamePerson);
    if (!kept) revoke.push(key);
    else if (!higherLevel(kept, seatLevel(link.seat))) downgrade.push(key);
  }
  return { revoke, downgrade };
}

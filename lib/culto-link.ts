/**
 * Link público do Culto no Lar (para postar no grupo do WhatsApp): /culto/<ano>-<código>. O código é derivado do ano
 * com o segredo do servidor, então o link é sempre o mesmo para o ano, não precisa ser guardado no banco e não dá
 * para adivinhar. Pelo link, o trabalhador só escolhe um sábado LIVRE digitando o nome; trocar ou liberar é só
 * na tela do sistema (Doutrina › Culto no Lar).
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { query } from "@/lib/db";
import { serverEnv } from "@/lib/env";
import { isProgramYear, yearSaturdays, type MonthSaturdays } from "@/lib/monthly-saturdays";

export const CULTO_LINK_FLAG = "module_doutrina";

function signature(year: number) {
  return createHmac("sha256", `lar-culto-link:${serverEnv().CRON_SECRET}`).update(`culto:${year}`).digest("base64url").slice(0, 16);
}

export function cultoLinkCode(year: number) {
  return `${year}-${signature(year)}`;
}

export function cultoLinkUrl(year: number) {
  return new URL(`/culto/${cultoLinkCode(year)}`, serverEnv().APP_URL).toString();
}

/** Ano do link, ou null quando o código não confere. */
export function cultoLinkYear(code: string): number | null {
  const match = /^(\d{4})-([A-Za-z0-9_-]{16})$/.exec(code);
  if (!match) return null;
  const year = Number(match[1]);
  if (!isProgramYear(year)) return null;
  const expected = Buffer.from(signature(year));
  const given = Buffer.from(match[2]);
  return expected.length === given.length && timingSafeEqual(expected, given) ? year : null;
}

/** Hoje em Manaus (AAAA-MM-DD). */
export function manausToday() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Manaus" });
}

/** O que a página pública mostra: só datas e o nome digitado (nunca dirigente, expositor ou ids). */
export type CultoPublicMonth = MonthSaturdays & { host_name: string; past: boolean };

export async function loadCultoPublicYear(year: number): Promise<CultoPublicMonth[]> {
  const rows = await query<{ month: number; host_name: string }>(
    "select month, host_name from app.culto_lar_months where year = $1 and deleted_at is null",
    [year]
  );
  const saved = new Map(rows.rows.map((r) => [r.month, r.host_name]));
  const today = manausToday();
  return yearSaturdays(year).map((m) => ({ ...m, host_name: saved.get(Number(m.month.slice(5))) ?? "", past: m.culto < today }));
}

/** Para comparar nomes sem diferença de maiúsculas, acentos e espaços. */
export function sameName(a: string, b: string) {
  const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
  return plain(a) === plain(b);
}

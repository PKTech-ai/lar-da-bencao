import { requireActor } from "@/lib/auth";
import { query } from "@/lib/db";
import { errorResponse } from "@/lib/errors";
import { listEnabledFlags } from "@/lib/feature-flags";
import { hasPermission } from "@/lib/permissions";

type Pending = { key: string; label: string; count: number; href: string };

/** Feed de pendências do usuário: só o que ele pode abrir, com o módulo ligado. */
export async function GET() {
  try {
    const actor = await requireActor();
    const flags = await listEnabledFlags();
    const pending: Pending[] = [];
    const add = async (key: string, label: string, href: string, flag: string, allowed: Promise<boolean>, sql: string) => {
      if (!flags.get(flag) || !(await allowed)) return;
      const result = await query<{ count: string }>(sql);
      const count = Number(result.rows[0]?.count ?? 0);
      if (count) pending.push({ key, label, count, href });
    };
    await add("admissoes", "Fichas aguardando a Diretoria", "/sistema/admissoes", "module_workers",
      hasPermission(actor, "presidencia", "approve"), "select count(*)::text as count from app.workers where status = 'pending'");
    await add("baixas", "Baixas patrimoniais aguardando decisão", "/sistema/presidencia/baixas", "module_patrimonio",
      hasPermission(actor, "presidencia", "approve"), "select count(*)::text as count from app.patrimony_disposals where status = 'pending'");
    await add("limpeza", "Taxas de limpeza pendentes de recebimento", "/sistema/patrimonio/limpeza", "module_patrimonio",
      hasPermission(actor, "department", "update", "patrimonio"),
      "select count(*)::text as count from app.cleaning_roster where payment_status = 'pending'");
    return Response.json({ pending }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

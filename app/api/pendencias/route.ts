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
    await add("sugestoes", "Sugestões sem resposta", "/sistema/sugestoes", "business_modules",
      hasPermission(actor, "presidencia", "update"),
      "select count(*)::text as count from app.suggestions where status in ('Recebida','Em análise')");
    await add("conciliacao", "Linhas do extrato a conciliar", "/sistema/tesouraria/extrato", "module_tesouraria",
      hasPermission(actor, "tesouraria", "update"),
      "select count(*)::text as count from app.bank_statement_lines where status = 'pending'");
    await add("caixa", "Meses do caixa ainda abertos", "/sistema/tesouraria", "module_tesouraria",
      hasPermission(actor, "tesouraria", "update"),
      `select count(*)::text as count from (
         select distinct to_char(e.entry_date, 'YYYY-MM') as month from app.treasury_entries e where e.archived_at is null
          and e.entry_date < date_trunc('month', current_date)) meses
        where not exists (select 1 from app.treasury_months m where m.reference_month = meses.month and m.status <> 'Aberto')`);
    await add("parecer", "Meses aguardando parecer do Conselho Fiscal", "/sistema/conselhofiscal", "module_conselho_fiscal",
      hasPermission(actor, "conselho_fiscal", "update"),
      `select count(*)::text as count from app.treasury_months m
        where m.status = 'Enviado ao Conselho Fiscal'
          and not exists (select 1 from app.fiscal_reviews r where r.reference_month = m.reference_month and r.archived_at is null)`);
    await add("emprestimos", "Empréstimos de livros atrasados", "/sistema/divulgacao/emprestimos", "module_divulgacao",
      hasPermission(actor, "department", "update", "divulgacao"),
      `select count(*)::text as count from app.book_loans l
        where l.archived_at is null and l.due_date < current_date
          and l.quantity > coalesce((select sum(r.quantity) from app.book_loan_returns r where r.loan_id = l.id), 0)`);
    return Response.json({ pending }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

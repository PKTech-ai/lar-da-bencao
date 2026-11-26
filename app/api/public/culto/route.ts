import { z } from "zod";
import { appendAudit } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/csrf";
import { query, transaction } from "@/lib/db";
import { AppError, errorResponse } from "@/lib/errors";
import { isFlagEnabled } from "@/lib/feature-flags";
import { CULTO_LINK_FLAG, cultoLinkYear, manausToday, sameName } from "@/lib/culto-link";
import { CULTO_NAME_MAX, cultoHostName } from "@/lib/doutrina-extras";
import { brDate, penultimateSaturday } from "@/lib/monthly-saturdays";
import { requestContext } from "@/lib/request-context";

const headers = { "Cache-Control": "private, no-store" };

/** Ação gravada no Dedo-duro; também usada para limitar escolhas seguidas da mesma conexão. */
const ACTION = "Culto no Lar: sábado escolhido pelo link";
const LIMIT = { max: 6, windowMinutes: 60 };

const schema = z.object({
  code: z.string().max(40),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mês inválido."),
  host_name: z.string().max(CULTO_NAME_MAX + 40),
  /** Campo-isca escondido: só robô preenche. */
  website: z.string().max(200).optional()
});

/**
 * Escolha de um sábado do Culto no Lar pelo link público (sem login). Só ocupa sábado livre e ainda por vir; não
 * troca nem libera (isso é na tela do sistema) e não mexe no Dirigente nem no Expositor.
 */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    if (!(await isFlagEnabled(CULTO_LINK_FLAG))) throw new AppError("Link não encontrado.", 404, "NOT_FOUND");
    const input = schema.parse(await request.json().catch(() => null));
    const year = cultoLinkYear(input.code);
    if (!year || !input.month.startsWith(`${year}-`)) throw new AppError("Link não encontrado. Peça o link novo à Doutrina.", 404, "NOT_FOUND");
    const name = cultoHostName(input.host_name);
    if (!name) throw new AppError(`Digite o seu nome com 2 a ${CULTO_NAME_MAX} letras.`);
    if (input.website) return Response.json({ host_name: name }, { headers });

    const date = penultimateSaturday(input.month);
    if (date < manausToday()) throw new AppError(`O sábado ${brDate(date)} já passou. Escolha outro sábado livre.`, 409, "PAST_DATE");

    const { maskedIp } = await requestContext();
    if (maskedIp) {
      const recent = await query<{ count: number }>(
        "select count(*)::int as count from app.audit_events where action = $1 and masked_ip = $2 and occurred_at > now() - make_interval(mins => $3)",
        [ACTION, maskedIp, LIMIT.windowMinutes]
      );
      if (recent.rows[0].count >= LIMIT.max) {
        return Response.json(
          { error: "Muitas escolhas seguidas a partir desta conexão. Tente de novo mais tarde ou fale com a Doutrina.", code: "TOO_MANY" },
          { status: 429, headers: { ...headers, "Retry-After": String(LIMIT.windowMinutes * 60) } }
        );
      }
    }

    const [y, m] = input.month.split("-").map(Number);
    const result = await transaction(async (client) => {
      const taken = await client.query<{ month: number; culto_date: string; host_name: string }>(
        "select month, to_char(culto_date, 'YYYY-MM-DD') as culto_date, host_name from app.culto_lar_months where year = $1 and deleted_at is null and host_name <> ''",
        [y]
      );
      const current = taken.rows.find((r) => r.month === m);
      // Toque duplo ou segunda tentativa da mesma pessoa: o sábado já é dela.
      if (current && sameName(current.host_name, name)) return { host_name: current.host_name };
      const own = taken.rows.find((r) => r.month !== m && sameName(r.host_name, name));
      if (own) {
        throw new AppError(`${own.host_name} já está com o Culto no Lar de ${brDate(own.culto_date)}. Para trocar de sábado, fale com a Doutrina.`, 409, "ALREADY_HOSTING");
      }
      // Só ocupa se ainda estiver livre: quem chegar primeiro fica com o sábado. Dirigente e Expositor ficam como estão.
      const saved = await client.query<{ id: string }>(
        `insert into app.culto_lar_months (year, month, culto_date, host_name)
         values ($1, $2, $3::date, $4)
         on conflict (year, month) do update set host_name = excluded.host_name, culto_date = excluded.culto_date,
           leader_id = case when app.culto_lar_months.deleted_at is null then app.culto_lar_months.leader_id end,
           speaker_id = case when app.culto_lar_months.deleted_at is null then app.culto_lar_months.speaker_id end,
           deleted_at = null, deleted_by = null, updated_by = null, updated_at = now(), version = app.culto_lar_months.version + 1
         where app.culto_lar_months.host_name = '' or app.culto_lar_months.deleted_at is not null
         returning id`,
        [y, m, date, name]
      );
      if (!saved.rows[0]) {
        throw new AppError(
          current ? `O sábado ${brDate(date)} já foi escolhido por ${current.host_name}. Escolha outro sábado livre.` : "Este sábado acabou de ser escolhido por outra pessoa. Escolha outro sábado livre.",
          409, "TAKEN"
        );
      }
      await appendAudit(null, {
        category: "Inclusão", action: ACTION, module: "Doutrina", section: "Culto no Lar",
        entityType: "culto_lar_month", entityId: saved.rows[0].id, details: `${brDate(date)} · ${name}`,
        after: { host_name: name }
      }, client);
      return { host_name: name };
    });
    return Response.json(result, { headers });
  } catch (error) {
    return errorResponse(error);
  }
}

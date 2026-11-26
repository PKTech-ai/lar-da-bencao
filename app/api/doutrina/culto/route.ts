import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/csrf";
import { query, transaction } from "@/lib/db";
import { AppError, errorResponse } from "@/lib/errors";
import { canEditDoutrina, requireDoutrina } from "@/lib/doutrina-data";
import { CULTO_NAME_MAX, cultoHostName } from "@/lib/doutrina-extras";
import { isValidMonth } from "@/lib/doutrina-scale";
import { brDate, isProgramYear, penultimateSaturday, yearSaturdays } from "@/lib/monthly-saturdays";

/**
 * Programação anual do Culto no Lar dos Trabalhadores: um por mês, no penúltimo sábado (o último sábado é da
 * Caravana do Amor). Quem tem Alterar em Culto no Lar escolhe um sábado livre e digita o nome do trabalhador.
 */

const putSchema = z.object({
  month: z.string().refine(isValidMonth, "Mês inválido."),
  host_name: z.string().max(CULTO_NAME_MAX + 40),
  /** Versão da linha do mês quando a tela abriu (0 = mês ainda sem nada gravado). */
  version: z.number().int().nonnegative()
});

type CultoRow = { year: number; month: number; host_name: string; deleted_at: string | null; version: number };

async function loadMonth(ym: string, db: { query: typeof query }) {
  const [y, m] = ym.split("-").map(Number);
  const rows = await db.query<CultoRow>(
    "select year, month, host_name, deleted_at, version from app.culto_lar_months where year=$1 and month=$2 for update",
    [y, m]
  );
  return rows.rows[0] ?? null;
}

export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    await requireDoutrina(actor, "read", "culto-lar");
    const year = Number(new URL(request.url).searchParams.get("year"));
    if (!isProgramYear(year)) throw new AppError("Ano inválido.");
    const [rows, canEdit] = await Promise.all([
      query<CultoRow>("select year, month, host_name, deleted_at, version from app.culto_lar_months where year=$1", [year]),
      canEditDoutrina(actor, "culto-lar")
    ]);
    const saved = new Map(rows.rows.map((r) => [r.month, r]));
    const months = yearSaturdays(year).map((m) => {
      const row = saved.get(Number(m.month.slice(5)));
      return { ...m, host_name: row && !row.deleted_at ? row.host_name : "", version: row?.version ?? 0 };
    });
    return Response.json({ year, months, canEdit }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Grava (ou libera, com nome vazio) o trabalhador do Culto no Lar de um mês. */
export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    await requireDoutrina(actor, "update", "culto-lar");
    const input = putSchema.parse(await request.json());
    const name = cultoHostName(input.host_name);
    if (name === null) throw new AppError(`Digite o nome do trabalhador com 2 a ${CULTO_NAME_MAX} letras.`);
    const [year, month] = input.month.split("-").map(Number);
    const date = penultimateSaturday(input.month);
    const result = await transaction(async (client) => {
      const current = await loadMonth(input.month, client);
      // Outra pessoa mexeu neste sábado depois que a tela abriu: não sobrescreve sem querer.
      if ((current?.version ?? 0) !== input.version) {
        const taken = current && !current.deleted_at && current.host_name;
        throw new AppError(taken
          ? `O sábado ${brDate(date)} acabou de ser escolhido por ${current.host_name}. Recarregue a página e escolha outro sábado livre.`
          : "Este sábado foi alterado por outra pessoa. Recarregue a página.", 409, "VERSION_CONFLICT");
      }
      const saved = await client.query<{ id: string; version: number }>(
        `insert into app.culto_lar_months (year, month, culto_date, host_name, created_by, updated_by)
         values ($1, $2, $3::date, $4, $5, $5)
         on conflict (year, month) do update set host_name = excluded.host_name, culto_date = excluded.culto_date,
           deleted_at = null, deleted_by = null, updated_by = excluded.updated_by, updated_at = now(),
           version = app.culto_lar_months.version + 1
         returning id, version`,
        [year, month, date, name, actor.id]
      );
      const before = current && !current.deleted_at ? current.host_name : "";
      await appendAudit(actor, {
        category: before ? (name ? "Edição" : "Exclusão") : "Inclusão",
        action: name ? "Culto no Lar: trabalhador do mês" : "Culto no Lar: sábado liberado",
        module: "Doutrina", section: "Culto no Lar", entityType: "culto_lar_month", entityId: saved.rows[0].id,
        details: `${brDate(date)}${name ? ` · ${name}` : ""}`,
        before: before ? { host_name: before } : null, after: name ? { host_name: name } : null
      }, client);
      return { version: saved.rows[0].version, host_name: name };
    });
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}

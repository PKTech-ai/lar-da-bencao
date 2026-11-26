import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/csrf";
import { transaction } from "@/lib/db";
import { AppError, errorResponse } from "@/lib/errors";
import { cultoOptions, loadCultoYear } from "@/lib/culto-data";
import { canEditDoutrina, requireDoutrina } from "@/lib/doutrina-data";
import { CULTO_NAME_MAX, cultoHostName } from "@/lib/doutrina-extras";
import { isValidMonth } from "@/lib/doutrina-scale";
import { brDate, isProgramYear, penultimateSaturday } from "@/lib/monthly-saturdays";

/**
 * Programação anual do Culto no Lar dos Trabalhadores: um por mês, no penúltimo sábado, das 19:30 às 20:30 (o último
 * sábado é da Caravana do Amor). Quem tem Alterar em Culto no Lar escolhe um sábado livre e digita o nome do
 * trabalhador, e escolhe o Dirigente e o Expositor entre os trabalhadores da Doutrina com essas funções.
 */

const putSchema = z.object({
  month: z.string().refine(isValidMonth, "Mês inválido."),
  /** Só os campos enviados mudam. */
  host_name: z.string().max(CULTO_NAME_MAX + 40).optional(),
  leader_id: z.string().uuid().nullable().optional(),
  speaker_id: z.string().uuid().nullable().optional(),
  /** Versão da linha do mês quando a tela abriu (0 = mês ainda sem nada gravado). */
  version: z.number().int().nonnegative()
}).refine((v) => v.host_name !== undefined || v.leader_id !== undefined || v.speaker_id !== undefined, "Nada para gravar.");

type CultoRow = { host_name: string; leader_id: string | null; speaker_id: string | null; deleted_at: string | null; version: number };

export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    await requireDoutrina(actor, "read", "culto-lar");
    const year = Number(new URL(request.url).searchParams.get("year"));
    if (!isProgramYear(year)) throw new AppError("Ano inválido.");
    const [months, options, canEdit] = await Promise.all([loadCultoYear(year), cultoOptions(), canEditDoutrina(actor, "culto-lar")]);
    return Response.json({ year, months, options, canEdit }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Grava o trabalhador (nome vazio libera o sábado), o Dirigente ou o Expositor do Culto no Lar de um mês. */
export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    await requireDoutrina(actor, "update", "culto-lar");
    const input = putSchema.parse(await request.json());
    const name = input.host_name === undefined ? undefined : cultoHostName(input.host_name);
    if (name === null) throw new AppError(`Digite o nome do trabalhador com 2 a ${CULTO_NAME_MAX} letras.`);
    const [year, month] = input.month.split("-").map(Number);
    const date = penultimateSaturday(input.month);
    const result = await transaction(async (client) => {
      const found = await client.query<CultoRow>(
        "select host_name, leader_id, speaker_id, deleted_at, version from app.culto_lar_months where year=$1 and month=$2 for update",
        [year, month]
      );
      const current = found.rows[0] ?? null;
      const live = current && !current.deleted_at ? current : null;
      // Outra pessoa mexeu neste sábado depois que a tela abriu: não sobrescreve sem querer.
      if ((current?.version ?? 0) !== input.version) {
        throw new AppError(name && live?.host_name
          ? `O sábado ${brDate(date)} acabou de ser escolhido por ${live.host_name}. Recarregue a página e escolha outro sábado livre.`
          : "Este Culto no Lar foi alterado por outra pessoa. Recarregue a página.", 409, "VERSION_CONFLICT");
      }
      const next = {
        host_name: name ?? live?.host_name ?? "",
        leader_id: input.leader_id !== undefined ? input.leader_id : live?.leader_id ?? null,
        speaker_id: input.speaker_id !== undefined ? input.speaker_id : live?.speaker_id ?? null
      };
      if (next.leader_id && next.leader_id === next.speaker_id) throw new AppError("O Dirigente e o Expositor precisam ser pessoas diferentes.", 409, "SAME_PERSON");
      const options = await cultoOptions(client);
      if (input.leader_id && !options.leader.some((w) => w.id === input.leader_id)) {
        throw new AppError("Dirigente sem função de dirigente na ficha, inativo ou fora da Doutrina.", 409, "WORKER_NOT_ELIGIBLE");
      }
      if (input.speaker_id && !options.speaker.some((w) => w.id === input.speaker_id)) {
        throw new AppError("Expositor sem função de expositor ou palestrante na ficha, inativo ou fora da Doutrina.", 409, "WORKER_NOT_ELIGIBLE");
      }
      const saved = await client.query<{ id: string; version: number }>(
        `insert into app.culto_lar_months (year, month, culto_date, host_name, leader_id, speaker_id, created_by, updated_by)
         values ($1, $2, $3::date, $4, $5, $6, $7, $7)
         on conflict (year, month) do update set host_name = excluded.host_name, leader_id = excluded.leader_id,
           speaker_id = excluded.speaker_id, culto_date = excluded.culto_date, deleted_at = null, deleted_by = null,
           updated_by = excluded.updated_by, updated_at = now(), version = app.culto_lar_months.version + 1
         returning id, version`,
        [year, month, date, next.host_name, next.leader_id, next.speaker_id, actor.id]
      );
      const nameOf = (id: string | null, list: { id: string; name: string }[]) => (id ? list.find((w) => w.id === id)?.name ?? "—" : "—");
      const what = name !== undefined
        ? (name ? `trabalhador ${name}` : "sábado liberado")
        : input.leader_id !== undefined ? `dirigente ${nameOf(next.leader_id, options.leader)}` : `expositor ${nameOf(next.speaker_id, options.speaker)}`;
      await appendAudit(actor, {
        category: live ? "Edição" : "Inclusão",
        action: "Culto no Lar atualizado",
        module: "Doutrina", section: "Culto no Lar", entityType: "culto_lar_month", entityId: saved.rows[0].id,
        details: `${brDate(date)} · ${what}`,
        before: live ? { host_name: live.host_name, leader_id: live.leader_id, speaker_id: live.speaker_id } : null,
        after: next
      }, client);
      return { version: saved.rows[0].version };
    });
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}

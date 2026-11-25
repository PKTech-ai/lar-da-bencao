import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/csrf";
import { transaction } from "@/lib/db";
import { AppError, errorResponse } from "@/lib/errors";
import { insertSlots, loadScale, lockScales, requireDoutrina } from "@/lib/doutrina-data";
import { DAY_NAME, RECESS_KINDS, RECESS_KIND_KEYS, TEMPLATES, isValidMonth, parseSlotKey } from "@/lib/doutrina-scale";

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
  /** Recesso ou evento da casa; `null` volta o dia para a escala normal. */
  kind: z.enum(RECESS_KIND_KEYS).nullable()
});

/**
 * Escolhe o que acontece numa data da escala: escala normal, recesso ou evento da casa (encerramento da
 * evangelização, confraternização). Recesso e eventos deixam o dia sem ninguém: com a escala do mês aberta,
 * adicionais saem e as demais posições ficam vazias. Trocar um pelo outro só muda o nome do dia.
 * Voltar para a escala normal deixa as posições vazias para preencher (ou "Gerar novamente").
 */
export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    await requireDoutrina(actor, "update", "escalas");
    const input = schema.parse(await request.json());
    const date = new Date(`${input.date}T12:00:00Z`);
    const ym = input.date.slice(0, 7);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== input.date || !isValidMonth(ym)) throw new AppError("Data inválida.");
    const dow = date.getUTCDay();
    if (!TEMPLATES[dow]) throw new AppError("Não há atividade da escala neste dia da semana.");
    const day = date.getUTCDate();
    const shown = `${input.date.slice(8, 10)}/${input.date.slice(5, 7)}/${input.date.slice(0, 4)}`;

    const result = await transaction(async (client) => {
      await lockScales(client);
      const before = await client.query<{ kind: string }>(
        "select kind from app.scale_recess where department_key = 'doutrina' and recess_date = $1::date", [input.date]);
      const previous = before.rows[0]?.kind ?? null;
      if (previous === input.kind) return { kind: input.kind, cleared: 0 };
      if (input.kind) {
        await client.query(
          `insert into app.scale_recess (recess_date, kind, created_by) values ($1::date, $2, $3)
           on conflict (department_key, recess_date) do update set kind = excluded.kind`,
          [input.date, input.kind, actor.id]
        );
      } else {
        await client.query("delete from app.scale_recess where department_key = 'doutrina' and recess_date = $1::date", [input.date]);
      }

      let cleared = 0;
      const scale = await loadScale(ym, client, true);
      if (scale.month && scale.month.status !== "deleted") {
        // Só quem sai da escala normal precisa esvaziar o dia; entre recesso e evento ele já está vazio.
        if (input.kind && !previous) {
          const keys = [...scale.assignments.keys()].filter((k) => { const s = parseSlotKey(k); return s?.dow === dow && s.day === day; });
          const extras = keys.filter((k) => scale.extras.has(k));
          const filled = keys.filter((k) => !scale.extras.has(k) && scale.assignments.get(k));
          cleared = keys.filter((k) => scale.assignments.get(k)?.startsWith("w:") || scale.assignments.get(k)?.startsWith("s:")).length;
          if (extras.length) await client.query("delete from app.scale_assignments where scale_month_id = $1 and slot_key = any($2::text[])", [scale.month.id, extras]);
          await insertSlots(client, scale.month.id, ym, filled.map((k): [string, string] => [k, ""]), { edited: true });
        }
        // Mudou o dia: a escala volta para conferência.
        await client.query(
          `update app.scale_months set status = 'in_review', reviewed = false, published_at = null, updated_by = $2, updated_at = now(), version = version + 1 where id = $1`,
          [scale.month.id, actor.id]
        );
      }
      const name = (kind: string | null) => (kind ? RECESS_KINDS[kind as keyof typeof RECESS_KINDS]?.option ?? kind : "Escala normal");
      await appendAudit(actor, {
        category: input.kind ? (previous ? "Edição" : "Inclusão") : "Exclusão",
        action: input.kind ? `Dia sem escala marcado: ${name(input.kind)}` : `Dia sem escala retirado: ${name(previous)}`,
        module: "Doutrina", section: "Escala mensal", entityType: "scale_recess", entityId: input.date,
        details: `${shown} · ${DAY_NAME[dow]}${previous && input.kind ? ` · antes: ${name(previous)}` : ""}${cleared ? ` · ${cleared} pessoa(s) retirada(s) do dia` : ""}`
      }, client);
      return { kind: input.kind, cleared };
    });
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}

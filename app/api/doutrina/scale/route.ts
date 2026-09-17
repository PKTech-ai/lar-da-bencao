import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/csrf";
import { transaction } from "@/lib/db";
import { AppError, errorResponse } from "@/lib/errors";
import {
  assertMonthVersion, canEditDoutrina, insertSlots, loadScale, loadScaleOptions, requireDoutrina, reviewScale
} from "@/lib/doutrina-data";
import {
  buildScale, canAddExtra, isValidMonth, parseSlotKey, roleOf, scaleStatusLabel, slotKey, validateSlotValue, type ScaleStatus
} from "@/lib/doutrina-scale";

const monthSchema = z.string().refine(isValidMonth, "Mês inválido.");
const actionSchema = z.object({
  month: monthSchema,
  action: z.enum(["generate", "regenerate", "delete", "check", "approve", "publish"]),
  version: z.number().int().positive().optional()
});
const slotSchema = z.object({
  month: monthSchema,
  key: z.string().max(40),
  value: z.string().max(60),
  version: z.number().int().positive()
});
const extraSchema = z.object({
  month: monthSchema,
  op: z.enum(["add", "remove"]),
  /** add: `dia-da-semana|seção|linha|dia`; remove: chave completa da posição extra. */
  key: z.string().max(40),
  version: z.number().int().positive()
});

const noStore = { "Cache-Control": "private, no-store" };
const audit = (section: string) => ({ module: "Doutrina", section, entityType: "scale_month" });

export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    await requireDoutrina(actor, "read");
    const ym = monthSchema.parse(new URL(request.url).searchParams.get("month"));
    const [scale, options, canEdit] = await Promise.all([loadScale(ym), loadScaleOptions(), canEditDoutrina(actor)]);
    const review = scale.month?.reviewed ? reviewScale(scale.assignments, options) : null;
    return Response.json({
      month: scale.month ? { ...scale.month, statusLabel: scaleStatusLabel[scale.month.status] } : null,
      assignments: Object.fromEntries(scale.assignments),
      edited: [...scale.edited],
      extras: [...scale.extras],
      review,
      options,
      canEdit
    }, { headers: noStore });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Operações do mês: gerar, gerar novamente, excluir, conferir, aprovar e publicar. */
export async function POST(request: Request) {
  let actor = null;
  try {
    assertSameOrigin(request);
    actor = await requireActor();
    await requireDoutrina(actor, "update");
    const input = actionSchema.parse(await request.json());
    const author = actor;
    const result = await transaction(async (client) => {
      const scale = await loadScale(input.month, client, true);
      assertMonthVersion(scale.month, input.version);
      const current = scale.month && scale.month.status !== "deleted" ? scale.month : null;
      const [year, monthNumber] = input.month.split("-").map(Number);
      const setStatus = async (status: ScaleStatus, reviewed: boolean, extra = "") => {
        await client.query(
          `update app.scale_months set status=$2, reviewed=$3, updated_by=$4, updated_at=now(), version=version+1 ${extra} where id=$1`,
          [current!.id, status, reviewed, author.id]
        );
      };

      if (input.action === "generate" || input.action === "regenerate") {
        if (current && input.action === "generate") {
          throw new AppError("Já existe escala neste mês. Use “Gerar novamente” para substituí-la.", 409, "SCALE_EXISTS");
        }
        const options = await loadScaleOptions(client);
        const generated = buildScale(input.month, options.workers, options.speakers, options.studies);
        const saved = await client.query<{ id: string }>(
          `insert into app.scale_months (department_key, year, month, status, reviewed, generated_at, created_by, updated_by)
           values ('doutrina', $1, $2, 'generated', false, now(), $3, $3)
           on conflict (department_key, year, month) do update
             set status='generated', reviewed=false, generated_at=now(), deleted_at=null, deleted_by=null, published_at=null,
                 updated_by=$3, updated_at=now(), version=app.scale_months.version+1
           returning id`,
          [year, monthNumber, author.id]
        );
        const monthId = saved.rows[0].id;
        const removed = await client.query("delete from app.scale_assignments where scale_month_id=$1", [monthId]);
        await insertSlots(client, monthId, input.month, [...generated]);
        const missing = [...generated.values()].filter((value) => !value).length;
        await appendAudit(author, {
          category: removed.rowCount ? "Edição" : "Inclusão",
          action: removed.rowCount ? "Exclusão e nova geração de escala" : "Geração de escala",
          ...audit("Escala mensal"), entityId: monthId,
          details: `${input.month}: ${removed.rowCount ?? 0} removida(s) · ${generated.size} gerada(s) · ${missing} vaga(s) pendente(s)`
        }, client);
        return { removed: removed.rowCount ?? 0, added: generated.size, missing };
      }

      if (!current) throw new AppError("Não há escala ativa neste mês. Gere a escala primeiro.", 404, "SCALE_NOT_FOUND");

      if (input.action === "delete") {
        const removed = await client.query("delete from app.scale_assignments where scale_month_id=$1", [current.id]);
        await client.query(
          `update app.scale_months set status='deleted', reviewed=false, deleted_at=now(), deleted_by=$2, published_at=null,
             updated_by=$2, updated_at=now(), version=version+1 where id=$1`,
          [current.id, author.id]
        );
        await appendAudit(author, {
          category: "Exclusão", action: "Exclusão de escala", ...audit("Escala mensal"), entityId: current.id,
          details: `${input.month}: ${removed.rowCount ?? 0} posição(ões) removida(s). Frequências continuam registradas.`
        }, client);
        return { removed: removed.rowCount ?? 0 };
      }

      if (input.action === "publish") {
        if (current.status !== "approved") throw new AppError("Aprove a escala antes de publicar.", 409, "NOT_APPROVED");
        await setStatus("published", true, ", published_at=now()");
        await appendAudit(author, { category: "Edição", action: "Publicação de escala", ...audit("Escala mensal"), entityId: current.id, details: input.month }, client);
        return { status: "published" };
      }

      const review = reviewScale(scale.assignments, await loadScaleOptions(client));
      const issues = review.conflicts.length + review.invalid.length;
      if (input.action === "check" || issues) {
        await setStatus(issues ? "pending_issues" : "checked", true);
        await appendAudit(author, {
          category: "Edição", action: "Conferência de escala", ...audit("Escala mensal"), entityId: current.id,
          result: issues && input.action === "approve" ? "denied" : "success",
          details: `${input.month}: ${review.conflicts.length} conflito(s), ${review.invalid.length} posição(ões) inválida(s)`
        }, client);
        return { status: issues ? "pending_issues" : "checked", review, approved: false };
      }
      await setStatus("approved", true);
      await appendAudit(author, { category: "Edição", action: "Aprovação de escala", ...audit("Escala mensal"), entityId: current.id, details: input.month }, client);
      return { status: "approved", review, approved: true };
    });
    return Response.json(result);
  } catch (error) {
    if (actor) {
      await appendAudit(actor, {
        category: "Edição", action: "Falha em operação de escala", ...audit("Escala mensal"), result: "failed",
        reasonCode: error instanceof AppError ? error.code : "INTERNAL_ERROR"
      }).catch(console.error);
    }
    return errorResponse(error);
  }
}

/** Troca manual de uma posição. Volta a escala para conferência. */
export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    await requireDoutrina(actor, "update");
    const input = slotSchema.parse(await request.json());
    const slot = parseSlotKey(input.key);
    if (!slot) throw new AppError("Posição inválida.");
    const result = await transaction(async (client) => {
      const scale = await loadScale(input.month, client, true);
      if (!scale.month || scale.month.status === "deleted") throw new AppError("Não há escala ativa neste mês.", 404, "SCALE_NOT_FOUND");
      assertMonthVersion(scale.month, input.version);
      if (!scale.assignments.has(input.key)) throw new AppError("Posição inexistente nesta escala.", 404, "SLOT_NOT_FOUND");
      const options = await loadScaleOptions(client);
      const problem = validateSlotValue(slot, input.value, { ...options, assignments: scale.assignments });
      if (problem) throw new AppError(problem, 409, "SLOT_INVALID");
      const before = scale.assignments.get(input.key);
      await insertSlots(client, scale.month.id, input.month, [[input.key, input.value]], { edited: true });
      const updated = await client.query<{ version: number }>(
        `update app.scale_months set status='in_review', reviewed=false, published_at=null, updated_by=$2, updated_at=now(), version=version+1
          where id=$1 returning version`,
        [scale.month.id, actor.id]
      );
      await appendAudit(actor, {
        category: "Edição", action: "Alteração manual de escala", ...audit("Escala mensal"), entityId: scale.month.id,
        details: `${input.month} · ${roleOf(slot).section.n} → ${roleOf(slot).label} · dia ${slot.day}`,
        before: { value: before }, after: { value: input.value }
      }, client);
      return { version: updated.rows[0].version };
    });
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}

/** Posições adicionais (passistas do Grupo do Passe, recepcionistas e psicofônicos). */
export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    await requireDoutrina(actor, "update");
    const input = extraSchema.parse(await request.json());
    const result = await transaction(async (client) => {
      const scale = await loadScale(input.month, client, true);
      if (!scale.month || scale.month.status === "deleted") throw new AppError("Não há escala ativa neste mês.", 404, "SCALE_NOT_FOUND");
      assertMonthVersion(scale.month, input.version);
      let key: string;
      if (input.op === "add") {
        const slot = parseSlotKey(`${input.key}|0`);
        if (!slot || !canAddExtra(slot)) throw new AppError("Esta função não aceita posições adicionais.");
        const prefix = `${input.key}|`;
        const used = [...scale.assignments.keys()].filter((k) => k.startsWith(prefix)).map((k) => Number(k.split("|")[4]));
        if (!used.length) throw new AppError("Dia fora desta escala.", 404, "SLOT_NOT_FOUND");
        key = slotKey({ ...slot, pos: Math.max(roleOf(slot).min, Math.max(...used) + 1) });
        await insertSlots(client, scale.month.id, input.month, [[key, ""]], { edited: true, extra: true });
      } else {
        if (!scale.extras.has(input.key)) throw new AppError("Somente posições adicionais podem ser removidas.", 409, "NOT_EXTRA");
        key = input.key;
        await client.query("delete from app.scale_assignments where scale_month_id=$1 and slot_key=$2", [scale.month.id, key]);
      }
      const updated = await client.query<{ version: number }>(
        `update app.scale_months set status='in_review', reviewed=false, published_at=null, updated_by=$2, updated_at=now(), version=version+1
          where id=$1 returning version`,
        [scale.month.id, actor.id]
      );
      await appendAudit(actor, {
        category: input.op === "add" ? "Inclusão" : "Exclusão",
        action: input.op === "add" ? "Posição adicional na escala" : "Remoção de posição adicional",
        ...audit("Escala mensal"), entityId: scale.month.id, details: `${input.month} · ${key}`
      }, client);
      return { key, version: updated.rows[0].version };
    });
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}

import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/csrf";
import { transaction } from "@/lib/db";
import { AppError, errorResponse } from "@/lib/errors";
import { requireDoutrina, speakerSchema } from "@/lib/doutrina-data";

const patchSchema = speakerSchema.extend({ active: z.boolean(), version: z.number().int().positive() });

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    await requireDoutrina(actor, "update");
    const id = z.string().uuid().parse((await context.params).id);
    const input = patchSchema.parse(await request.json());
    await transaction(async (client) => {
      const current = await client.query<{ full_name: string; active: boolean; version: number }>(
        "select full_name, active, version from app.speakers where id=$1 for update", [id]
      );
      const before = current.rows[0];
      if (!before) throw new AppError("Palestrante não encontrado.", 404, "NOT_FOUND");
      if (before.version !== input.version) throw new AppError("Cadastro alterado por outra sessão. Recarregue a página.", 409, "VERSION_CONFLICT");
      await client.query(
        `update app.speakers set full_name=$2, house=nullif($3,''), city=nullif($4,''), themes=$5, phone=nullif($6,''), notes=$7,
            active=$8, updated_by=$9, updated_at=now(), version=version+1 where id=$1`,
        [id, input.full_name, input.house, input.city, [...new Set(input.themes)], input.phone, input.notes, input.active, actor.id]
      );
      await appendAudit(actor, {
        category: "Edição",
        action: before.active && !input.active ? "Palestrante externo inativado" : !before.active && input.active ? "Palestrante externo reativado" : "Atualização de palestrante externo",
        module: "Doutrina", section: "Palestrantes Externos", entityType: "speaker", entityId: id,
        before: { full_name: before.full_name, active: before.active }, after: { full_name: input.full_name, active: input.active }
      }, client);
    });
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

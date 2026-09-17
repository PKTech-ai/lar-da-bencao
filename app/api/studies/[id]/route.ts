import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/csrf";
import { transaction } from "@/lib/db";
import { AppError, errorResponse } from "@/lib/errors";
import { attachmentOwnerType, requireLibrary, studyInput, type LibraryDepartment } from "@/lib/study-library";

const patchSchema = z.union([
  studyInput.extend({ active: z.boolean().optional(), version: z.number().int().positive() }),
  /** Vincula (ou remove) o arquivo já enviado e inspecionado para este estudo. */
  z.object({ attachment_id: z.string().uuid().nullable(), version: z.number().int().positive() })
]);

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    const id = z.string().uuid().parse((await context.params).id);
    const input = patchSchema.parse(await request.json());
    const result = await transaction(async (client) => {
      const current = await client.query<{ department_key: LibraryDepartment; version: number; title: string; attachment_id: string | null; active: boolean }>(
        "select department_key, version, title, attachment_id, active from app.studies where id=$1 for update",
        [id]
      );
      const before = current.rows[0];
      if (!before) throw new AppError("Estudo não encontrado.", 404, "NOT_FOUND");
      await requireLibrary(actor, before.department_key, "update");
      if (before.version !== input.version) throw new AppError("O estudo foi alterado por outra sessão. Recarregue a página.", 409, "VERSION_CONFLICT");

      if ("attachment_id" in input) {
        if (input.attachment_id) {
          const file = await client.query(
            "select 1 from app.attachments where id=$1 and owner_type=$2 and owner_id=$3 and status='active'",
            [input.attachment_id, attachmentOwnerType(before.department_key), id]
          );
          if (!file.rowCount) throw new AppError("Arquivo não encontrado, não inspecionado ou de outro estudo.", 409, "ATTACHMENT_INVALID");
        }
        await client.query("update app.studies set attachment_id=$2, updated_by=$3, updated_at=now(), version=version+1 where id=$1", [id, input.attachment_id, actor.id]);
        await appendAudit(actor, {
          category: "Edição", action: input.attachment_id ? "Arquivo vinculado ao estudo" : "Arquivo desvinculado do estudo",
          module: "Biblioteca de Estudos", section: before.department_key, entityType: "study", entityId: id,
          before: { attachment_id: before.attachment_id }, after: { attachment_id: input.attachment_id }
        }, client);
        return { ok: true };
      }

      if (before.department_key === "doutrina" && !input.study_type) throw new AppError("Informe o tipo do estudo.");
      if (input.folder_id) {
        const folder = await client.query("select 1 from app.study_folders where id=$1 and department_key=$2", [input.folder_id, before.department_key]);
        if (!folder.rowCount) throw new AppError("Pasta não encontrada neste departamento.", 404, "FOLDER_NOT_FOUND");
      }
      await client.query(
        `update app.studies set folder_id=$2, study_type=$3, code=nullif($4,''), title=$5, reference=nullif($6,''), description=$7,
            active=coalesce($8, active), updated_by=$9, updated_at=now(), version=version+1 where id=$1`,
        [id, input.folder_id ?? null, input.study_type ?? null, input.code, input.title, input.reference, input.description, input.active ?? null, actor.id]
      );
      await appendAudit(actor, {
        category: "Edição",
        action: input.active === false && before.active ? "Estudo retirado da biblioteca" : input.active && !before.active ? "Estudo restaurado" : "Atualização de estudo",
        module: "Biblioteca de Estudos", section: before.department_key, entityType: "study", entityId: id,
        details: input.title, before: { title: before.title, active: before.active }, after: { title: input.title, active: input.active ?? before.active }
      }, client);
      return { ok: true };
    });
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}

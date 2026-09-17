import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/csrf";
import { transaction } from "@/lib/db";
import { AppError, errorResponse } from "@/lib/errors";
import { requireLibrary, type LibraryDepartment } from "@/lib/study-library";

const renameSchema = z.object({ title: z.string().trim().min(1).max(160) });

async function lockFolder(client: { query: (text: string, values: unknown[]) => Promise<{ rows: unknown[] }> }, id: string) {
  const found = await client.query("select id, department_key, title, system from app.study_folders where id=$1 for update", [id]);
  const folder = found.rows[0] as { id: string; department_key: LibraryDepartment; title: string; system: boolean } | undefined;
  if (!folder) throw new AppError("Pasta não encontrada.", 404, "NOT_FOUND");
  if (folder.system) throw new AppError("Pastas padrão da biblioteca não podem ser alteradas.", 409, "SYSTEM_FOLDER");
  return folder;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    const id = z.string().uuid().parse((await context.params).id);
    const input = renameSchema.parse(await request.json());
    await transaction(async (client) => {
      const folder = await lockFolder(client, id);
      await requireLibrary(actor, folder.department_key, "update");
      await client.query("update app.study_folders set title=$2, updated_at=now() where id=$1", [id, input.title]).catch((error: { code?: string }) => {
        if (error.code === "23505") throw new AppError("Já existe uma pasta com este nome neste local.", 409, "FOLDER_EXISTS");
        throw error;
      });
      await appendAudit(actor, {
        category: "Edição", action: "Renomeação de pasta de estudos", module: "Biblioteca de Estudos", section: folder.department_key,
        entityType: "study_folder", entityId: id, before: { title: folder.title }, after: { title: input.title }
      }, client);
    });
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Exclui somente pasta vazia (sem subpastas nem estudos). */
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    const id = z.string().uuid().parse((await context.params).id);
    await transaction(async (client) => {
      const folder = await lockFolder(client, id);
      await requireLibrary(actor, folder.department_key, "delete");
      const usage = await client.query<{ children: number; studies: number }>(
        `select (select count(*)::int from app.study_folders where parent_id=$1) as children,
                (select count(*)::int from app.studies where folder_id=$1) as studies`,
        [id]
      );
      if (usage.rows[0].children || usage.rows[0].studies) {
        throw new AppError("A pasta não está vazia. Mova ou retire os estudos e subpastas antes de excluir.", 409, "FOLDER_NOT_EMPTY");
      }
      await client.query("delete from app.study_folders where id=$1", [id]);
      await appendAudit(actor, {
        category: "Exclusão", action: "Exclusão de pasta de estudos", module: "Biblioteca de Estudos", section: folder.department_key,
        entityType: "study_folder", entityId: id, details: folder.title
      }, client);
    });
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

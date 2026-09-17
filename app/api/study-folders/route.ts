import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/csrf";
import { query } from "@/lib/db";
import { AppError, errorResponse } from "@/lib/errors";
import { libraryDepartment, requireLibrary } from "@/lib/study-library";

const schema = z.object({
  department_key: libraryDepartment,
  parent_id: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(1).max(160)
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    const input = schema.parse(await request.json());
    await requireLibrary(actor, input.department_key, "create");
    if (input.parent_id) {
      const parent = await query("select 1 from app.study_folders where id=$1 and department_key=$2", [input.parent_id, input.department_key]);
      if (!parent.rowCount) throw new AppError("Pasta superior não encontrada.", 404, "FOLDER_NOT_FOUND");
    }
    const inserted = await query<{ id: string }>(
      "insert into app.study_folders (department_key, parent_id, title) values ($1,$2,$3) returning id",
      [input.department_key, input.parent_id ?? null, input.title]
    ).catch((error: { code?: string }) => {
      if (error.code === "23505") throw new AppError("Já existe uma pasta com este nome neste local.", 409, "FOLDER_EXISTS");
      throw error;
    });
    await appendAudit(actor, {
      category: "Inclusão", action: input.parent_id ? "Criação de subpasta de estudos" : "Criação de pasta de estudos",
      module: "Biblioteca de Estudos", section: input.department_key, entityType: "study_folder", entityId: inserted.rows[0].id, details: input.title
    });
    return Response.json({ id: inserted.rows[0].id }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

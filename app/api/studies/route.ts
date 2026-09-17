import { requireActor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/csrf";
import { query, transaction } from "@/lib/db";
import { AppError, errorResponse } from "@/lib/errors";
import { canEditLibrary, libraryDepartment, requireLibrary, studyInput } from "@/lib/study-library";

const createSchema = studyInput.extend({ department_key: libraryDepartment });

export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    const department = libraryDepartment.parse(new URL(request.url).searchParams.get("department") ?? "doutrina");
    await requireLibrary(actor, department, "read");
    const [folders, studies] = await Promise.all([
      query("select id, parent_id, title, system from app.study_folders where department_key=$1 order by lower(title)", [department]),
      query(
        `select s.id, s.folder_id, s.study_type, s.code, s.title, s.reference, s.description, s.active, s.version, s.updated_at,
                a.id as attachment_id, a.filename as attachment_name, a.status as attachment_status
           from app.studies s left join app.attachments a on a.id = s.attachment_id
          where s.department_key=$1
          order by s.active desc, s.study_type nulls last, s.code nulls last, s.title`,
        [department]
      )
    ]);
    return Response.json(
      { folders: folders.rows, studies: studies.rows, canEdit: await canEditLibrary(actor, department) },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    const input = createSchema.parse(await request.json());
    await requireLibrary(actor, input.department_key, "create");
    if (input.department_key === "doutrina" && !input.study_type) throw new AppError("Informe o tipo do estudo (ESE, ESDE, MEP, Obra, Palestra…).");
    const id = await transaction(async (client) => {
      if (input.folder_id) {
        const folder = await client.query("select 1 from app.study_folders where id=$1 and department_key=$2", [input.folder_id, input.department_key]);
        if (!folder.rowCount) throw new AppError("Pasta não encontrada neste departamento.", 404, "FOLDER_NOT_FOUND");
      }
      const inserted = await client.query<{ id: string }>(
        `insert into app.studies (department_key, folder_id, study_type, code, title, reference, description, created_by, updated_by)
         values ($1,$2,$3,nullif($4,''),$5,nullif($6,''),$7,$8,$8) returning id`,
        [input.department_key, input.folder_id ?? null, input.study_type ?? null, input.code, input.title, input.reference, input.description, actor.id]
      );
      await appendAudit(actor, {
        category: "Inclusão", action: "Cadastro de estudo", module: "Biblioteca de Estudos", section: input.department_key,
        entityType: "study", entityId: inserted.rows[0].id, details: [input.code, input.title].filter(Boolean).join(" — ")
      }, client);
      return inserted.rows[0].id;
    });
    return Response.json({ id }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

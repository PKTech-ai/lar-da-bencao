import { requireActor } from "@/lib/auth";
import { query } from "@/lib/db";
import { errorResponse } from "@/lib/errors";
import { requireFlag } from "@/lib/feature-flags";
import { assertPermission, hasPermission } from "@/lib/permissions";

export async function GET() {
  try {
    const actor = await requireActor();
    await requireFlag("module_documentos");
    await assertPermission(actor, "institucional", "read");
    const result = await query(
      `select d.slug, d.title, d.description, d.version, d.updated_at,
              a.id as attachment_id, a.filename, a.size_bytes::text, a.status as attachment_status
         from app.institutional_documents d
         left join app.attachments a on a.id = d.attachment_id
        where d.published order by d.sort_order, d.title`
    );
    return Response.json(
      { documents: result.rows, canManage: await hasPermission(actor, "institucional", "update") },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    return errorResponse(error);
  }
}

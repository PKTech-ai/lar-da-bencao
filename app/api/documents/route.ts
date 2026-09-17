import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/csrf";
import { query, transaction } from "@/lib/db";
import { errorResponse } from "@/lib/errors";
import { requireFlag } from "@/lib/feature-flags";
import { assertPermission } from "@/lib/permissions";

const schema = z.object({
  slug: z.string().regex(/^[a-z0-9_-]+$/).max(80),
  title: z.string().trim().min(2).max(200),
  attachment_id: z.string().uuid().optional().nullable(),
  published: z.boolean().default(true)
});

export async function GET() {
  try {
    const actor = await requireActor();
    await requireFlag("module_documentos");
    await assertPermission(actor, "institucional", "read");
    const result = await query("select * from app.institutional_documents where published order by title");
    return Response.json({ documents: result.rows }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  let actor = null;
  try {
    assertSameOrigin(request);
    actor = await requireActor();
    await requireFlag("module_documentos");
    await assertPermission(actor, "users", "admin");
    const input = schema.parse(await request.json());
    const id = await transaction(async (client) => {
      const inserted = await client.query<{ id: string }>(
        `insert into app.institutional_documents (slug, title, attachment_id, published)
         values ($1,$2,$3,$4)
         on conflict (slug) do update set title=excluded.title, attachment_id=excluded.attachment_id, published=excluded.published, updated_at=now()
         returning id`,
        [input.slug, input.title, input.attachment_id ?? null, input.published]
      );
      await appendAudit(actor!, { category: "Inclusão", action: "Documento institucional", module: "Documentos", entityType: "institutional_document", entityId: inserted.rows[0].id, details: input.title }, client);
      return inserted.rows[0].id;
    });
    return Response.json({ id }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/csrf";
import { transaction } from "@/lib/db";
import { AppError, errorResponse } from "@/lib/errors";
import { requireFlag } from "@/lib/feature-flags";
import { assertPermission } from "@/lib/permissions";

const slugSchema = z.string().regex(/^[a-z0-9_-]{2,80}$/);
const bodySchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(1000).default(""),
  attachment_id: z.string().uuid().nullable().optional(),
  version: z.number().int().nonnegative()
});

/** Cria ou atualiza um documento institucional e vincula o PDF já inspecionado (somente administrador). */
export async function PUT(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    await requireFlag("module_documentos");
    await assertPermission(actor, "institucional", "update");
    const slug = slugSchema.parse((await context.params).slug);
    const input = bodySchema.parse(await request.json());
    await transaction(async (client) => {
      const current = await client.query<{ version: number; attachment_id: string | null; title: string }>(
        "select version, attachment_id, title from app.institutional_documents where slug=$1 for update", [slug]
      );
      const before = current.rows[0];
      if ((before?.version ?? 0) !== input.version) throw new AppError("Documento alterado por outra sessão. Recarregue a página.", 409, "VERSION_CONFLICT");
      if (input.attachment_id) {
        const file = await client.query(
          "select 1 from app.attachments where id=$1 and owner_type='institutional_document' and owner_id=$2 and status='active' and mime_type='application/pdf'",
          [input.attachment_id, slug]
        );
        if (!file.rowCount) throw new AppError("PDF não encontrado, não inspecionado ou enviado para outro documento.", 409, "ATTACHMENT_INVALID");
      }
      const attachment = input.attachment_id === undefined ? before?.attachment_id ?? null : input.attachment_id;
      await client.query(
        `insert into app.institutional_documents (slug, title, description, attachment_id, published, updated_by)
         values ($1,$2,$3,$4,true,$5)
         on conflict (slug) do update set title=excluded.title, description=excluded.description, attachment_id=excluded.attachment_id,
           updated_by=excluded.updated_by, updated_at=now(), version=app.institutional_documents.version+1`,
        [slug, input.title, input.description, attachment, actor.id]
      );
      await appendAudit(actor, {
        category: before ? "Edição" : "Inclusão",
        action: attachment !== (before?.attachment_id ?? null) ? "Documento institucional substituído" : "Documento institucional atualizado",
        module: "Documentos", entityType: "institutional_document", entityId: slug, details: input.title,
        before: before ? { title: before.title, attachment_id: before.attachment_id } : null,
        after: { title: input.title, attachment_id: attachment }
      }, client);
    });
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

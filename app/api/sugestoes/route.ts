import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/csrf";
import { query, transaction } from "@/lib/db";
import { errorResponse } from "@/lib/errors";
import { hasPermission } from "@/lib/permissions";

const schema = z.object({
  subject: z.string().trim().min(3).max(160),
  body: z.string().trim().min(5).max(4000),
  area: z.string().trim().max(80).optional().default(""),
  anonymous: z.boolean().optional().default(false)
});

/** Sugestões e elogios: quem envia vê as próprias; a Diretoria vê todas e responde. */
export async function GET() {
  try {
    const actor = await requireActor();
    const manage = await hasPermission(actor, "presidencia", "read");
    const result = await query(
      `select s.id, s.subject, s.body, s.area, s.status, s.answer, s.created_at, s.answered_at, s.version,
              case when s.anonymous then null else u.full_name end as author,
              s.anonymous, (s.created_by = $1) as mine
         from app.suggestions s left join app.users u on u.id = s.created_by
        where $2::boolean or s.created_by = $1
        order by s.created_at desc limit 300`,
      [actor.id, manage]
    );
    return Response.json({ suggestions: result.rows, canManage: manage }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    const input = schema.parse(await request.json());
    const id = await transaction(async (client) => {
      const inserted = await client.query<{ id: string }>(
        "insert into app.suggestions (subject, body, area, anonymous, created_by) values ($1,$2,$3,$4,$5) returning id",
        [input.subject, input.body, input.area, input.anonymous, actor.id]
      );
      // Mesmo anônima, a autoria fica no banco: o Dedo-duro registra sem expor o conteúdo.
      await appendAudit(actor, {
        category: "Inclusão", action: "Sugestão enviada", module: "Sistema", section: "Sugestões",
        entityType: "suggestion", entityId: inserted.rows[0].id, details: input.anonymous ? "Envio anônimo para a Diretoria" : input.subject
      }, client);
      return inserted.rows[0].id;
    });
    return Response.json({ id }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

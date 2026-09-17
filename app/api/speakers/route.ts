import { requireActor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/csrf";
import { query } from "@/lib/db";
import { errorResponse } from "@/lib/errors";
import { canEditDoutrina, requireDoutrina, speakerSchema } from "@/lib/doutrina-data";

export async function GET() {
  try {
    const actor = await requireActor();
    await requireDoutrina(actor, "read");
    const result = await query(
      `select id, full_name, house, city, themes, phone, notes, active, version,
              (select count(*)::int from app.scale_assignments a where a.speaker_id = s.id) as scheduled
         from app.speakers s order by active desc, full_name`
    );
    return Response.json({ speakers: result.rows, canEdit: await canEditDoutrina(actor) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    await requireDoutrina(actor, "update");
    const input = speakerSchema.parse(await request.json());
    const inserted = await query<{ id: string }>(
      `insert into app.speakers (full_name, house, city, themes, phone, notes, created_by, updated_by)
       values ($1,nullif($2,''),nullif($3,''),$4,nullif($5,''),$6,$7,$7) returning id`,
      [input.full_name, input.house, input.city, [...new Set(input.themes)], input.phone, input.notes, actor.id]
    );
    await appendAudit(actor, {
      category: "Inclusão", action: "Cadastro de palestrante externo", module: "Doutrina", section: "Palestrantes Externos",
      entityType: "speaker", entityId: inserted.rows[0].id, details: input.full_name
    });
    return Response.json({ id: inserted.rows[0].id }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

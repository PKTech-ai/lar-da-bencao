import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/csrf";
import { query, transaction } from "@/lib/db";
import { errorResponse } from "@/lib/errors";
import { requireFlag } from "@/lib/feature-flags";
import { assertPermission } from "@/lib/permissions";
import { assertSchedulableWorker } from "@/lib/workers";

const schema = z.object({
  visit_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  host_name: z.string().trim().min(2).max(160),
  visitors_count: z.number().int().min(0).max(500).default(0),
  notes: z.string().max(2000).optional(),
  worker_id: z.string().uuid().optional().nullable()
});

export async function GET() {
  try {
    const actor = await requireActor();
    await requireFlag("module_doutrina");
    await assertPermission(actor, "department", "read", "doutrina");
    const result = await query("select * from app.culto_lar_entries order by visit_date desc limit 200");
    return Response.json({ entries: result.rows }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  let actor = null;
  try {
    assertSameOrigin(request);
    actor = await requireActor();
    await requireFlag("module_doutrina");
    await assertPermission(actor, "department", "create", "doutrina");
    const input = schema.parse(await request.json());
    if (input.worker_id) await assertSchedulableWorker({ query }, input.worker_id, "doutrina");
    const id = await transaction(async (client) => {
      const inserted = await client.query<{ id: string }>(
        `insert into app.culto_lar_entries (visit_date, host_name, visitors_count, notes, worker_id, created_by, updated_by)
         values ($1::date,$2,$3,coalesce($4,''),$5,$6,$6) returning id`,
        [input.visit_date, input.host_name, input.visitors_count, input.notes ?? "", input.worker_id ?? null, actor!.id]
      );
      await appendAudit(actor!, { category: "Inclusão", action: "Registro Culto no Lar", module: "Doutrina", section: "Culto no Lar", entityType: "culto_lar", entityId: inserted.rows[0].id }, client);
      return inserted.rows[0].id;
    });
    return Response.json({ id }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

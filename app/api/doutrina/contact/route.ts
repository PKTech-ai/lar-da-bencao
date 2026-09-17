import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/csrf";
import { query } from "@/lib/db";
import { errorResponse } from "@/lib/errors";
import { requireDoutrina } from "@/lib/doutrina-data";

const schema = z.object({ phone: z.string().trim().max(40) });

/** Contato do departamento exibido nas escalas impressas (o responsável vem do Controle de Acesso). */
export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    await requireDoutrina(actor, "update");
    const input = schema.parse(await request.json());
    await query(
      `insert into app.department_contacts (department_key, phone, updated_by) values ('doutrina', $1, $2)
       on conflict (department_key) do update set phone = excluded.phone, updated_by = excluded.updated_by, updated_at = now()`,
      [input.phone, actor.id]
    );
    await appendAudit(actor, { category: "Edição", action: "Contato do departamento atualizado", module: "Doutrina", section: "Painel", entityType: "department", entityId: "doutrina" });
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

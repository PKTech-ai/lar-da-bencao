import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/csrf";
import { errorResponse } from "@/lib/errors";
import { assertPermission } from "@/lib/permissions";

const schema = z.object({ description: z.string().trim().max(300).optional().default(""), total: z.number().int().min(0).max(1_000_000).optional() });

/** Registra a impressão do Dedo-duro (o mock também audita quem imprime). */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    await assertPermission(actor, "audit", "read");
    const input = schema.parse(await request.json());
    await appendAudit(actor, {
      category: "Impressão", action: "Impressão do Dedo-duro", module: "Controle de Acesso", section: "Dedo-duro",
      details: `${input.total ?? 0} evento(s)${input.description ? ` · ${input.description}` : ""}`
    });
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

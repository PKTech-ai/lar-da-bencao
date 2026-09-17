import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/csrf";
import { transaction } from "@/lib/db";
import { AppError, errorResponse } from "@/lib/errors";
import { institution } from "@/lib/home";
import { assertPermission, hasPermission } from "@/lib/permissions";

const schema = z.object({
  name: z.string().trim().min(2).max(160),
  founded_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
  motto: z.string().trim().max(200).optional().default(""),
  cnpj: z.string().trim().max(20).optional().default(""),
  address: z.string().trim().max(300).optional().default(""),
  phone: z.string().trim().max(40).optional().default(""),
  email: z.union([z.email().max(200), z.literal("")]).optional().default(""),
  version: z.number().int().positive()
});

export async function GET() {
  try {
    const actor = await requireActor();
    const [settings, canEdit] = await Promise.all([institution(), hasPermission(actor, "users", "admin")]);
    return Response.json({ institution: settings, canEdit }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    await assertPermission(actor, "users", "admin");
    const input = schema.parse(await request.json());
    await transaction(async (client) => {
      const updated = await client.query(
        `update app.institution_settings set name=$1, founded_on=$2, motto=$3, cnpj=$4, address=$5, phone=$6, email=$7,
                updated_by=$8, updated_at=now(), version=version+1 where id and version=$9`,
        [input.name, input.founded_on, input.motto, input.cnpj, input.address, input.phone, input.email, actor.id, input.version]
      );
      if (!updated.rowCount) throw new AppError("Configuração alterada por outra sessão. Recarregue a página.", 409, "VERSION_CONFLICT");
      await appendAudit(actor, {
        category: "Edição", action: "Alteração da configuração institucional", module: "Sistema", section: "Instituição",
        details: `${input.name} · fundação ${input.founded_on}`, after: { ...input }
      }, client);
    });
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

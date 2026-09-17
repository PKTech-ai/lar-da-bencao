import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/csrf";
import { query, transaction } from "@/lib/db";
import { AppError, errorResponse } from "@/lib/errors";
import { assertPermission } from "@/lib/permissions";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");
const schema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().trim().min(2).max(80),
  starts_on: isoDate,
  ends_on: isoDate,
  status: z.enum(["active", "closed"]),
  version: z.number().int().positive().optional()
});

/** Biênios da Diretoria: fora do período (com 15 dias de tolerância) o acesso de cargo é cortado. */
export async function GET() {
  try {
    const actor = await requireActor();
    await assertPermission(actor, "users", "admin");
    const result = await query(
      `select b.id, b.label, to_char(b.starts_on,'YYYY-MM-DD') as starts_on, to_char(b.ends_on,'YYYY-MM-DD') as ends_on, b.status, b.version,
              (select count(*)::int from app.users u where u.biennium_id = b.id) as members
         from app.bienniums b order by b.starts_on desc`
    );
    return Response.json({ bienniums: result.rows }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    await assertPermission(actor, "users", "admin");
    const input = schema.parse(await request.json());
    if (input.ends_on < input.starts_on) throw new AppError("O fim do biênio não pode ser anterior ao início.");
    const id = await transaction(async (client) => {
      if (input.id) {
        const updated = await client.query(
          "update app.bienniums set label=$2, starts_on=$3, ends_on=$4, status=$5, updated_by=$6, updated_at=now(), version=version+1 where id=$1 and version=$7",
          [input.id, input.label, input.starts_on, input.ends_on, input.status, actor.id, input.version]
        );
        if (!updated.rowCount) throw new AppError("Biênio alterado por outra sessão. Recarregue a página.", 409, "VERSION_CONFLICT");
        await appendAudit(actor, {
          category: "Segurança", action: "Alteração de biênio", module: "Controle de Acesso", section: "Biênios",
          entityType: "biennium", entityId: input.id, details: `${input.label} · ${input.starts_on} a ${input.ends_on} · ${input.status}`
        }, client);
        return input.id;
      }
      const inserted = await client.query<{ id: string }>(
        "insert into app.bienniums (label, starts_on, ends_on, status, created_by, updated_by) values ($1,$2,$3,$4,$5,$5) returning id",
        [input.label, input.starts_on, input.ends_on, input.status, actor.id]
      );
      await appendAudit(actor, {
        category: "Segurança", action: "Cadastro de biênio", module: "Controle de Acesso", section: "Biênios",
        entityType: "biennium", entityId: inserted.rows[0].id, details: `${input.label} · ${input.starts_on} a ${input.ends_on}`
      }, client);
      return inserted.rows[0].id;
    });
    return Response.json({ id }, { status: input.id ? 200 : 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

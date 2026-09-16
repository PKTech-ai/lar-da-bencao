import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { transaction } from "@/lib/db";
import { AppError, errorResponse } from "@/lib/errors";
import { assertPermission } from "@/lib/permissions";
import { assertSameOrigin } from "@/lib/csrf";

const schema = z.object({
  name: z.string().trim().min(3).max(160), role: z.string().regex(/^[a-z_]+$/),
  status: z.enum(["pending", "active", "suspended"]), departments: z.array(z.string().regex(/^[a-z_]+$/)).max(12),
  version: z.number().int().positive()
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  let actor = null;
  try {
    assertSameOrigin(request);
    actor = await requireActor(); await assertPermission(actor, "users", "admin");
    const id = z.string().uuid().parse((await context.params).id), input = schema.parse(await request.json());
    await transaction(async (client) => {
      const current = await client.query<{ full_name: string; role_key: string; status: string; version: number }>("select full_name,role_key,status,version from app.users where id=$1 for update", [id]);
      const before = current.rows[0]; if (!before) throw new AppError("Usuário não encontrado.", 404, "USER_NOT_FOUND");
      if (before.version !== input.version) throw new AppError("Este usuário foi alterado por outra sessão. Recarregue a página.", 409, "VERSION_CONFLICT");
      if (before.role_key === "administrador" && before.status === "active" && (input.role !== "administrador" || input.status !== "active")) {
        const admins = await client.query<{ count: string }>("select count(*)::text as count from app.users where role_key='administrador' and status='active'");
        if (Number(admins.rows[0].count) <= 1) throw new AppError("O último Administrador ativo não pode ser suspenso ou rebaixado.", 409, "LAST_ADMIN");
      }
      const updated = await client.query("update app.users set full_name=$2,role_key=$3,status=$4,updated_by=$5 where id=$1 and version=$6", [id, input.name, input.role, input.status, actor!.id, input.version]);
      if (!updated.rowCount) throw new AppError("Conflito ao atualizar usuário.", 409, "VERSION_CONFLICT");
      await client.query("delete from app.user_departments where user_id=$1", [id]);
      for (const department of input.departments) await client.query("insert into app.user_departments(user_id,department_key) values($1,$2)", [id, department]);
      await appendAudit(actor!, { category: "Segurança", action: "Alteração de acesso", module: "Controle de Acesso", section: "Usuários e Perfis", entityType: "user", entityId: id, result: "success", details: `${input.name} · ${input.role} · ${input.status}.`, before, after: { name: input.name, role: input.role, status: input.status, departments: input.departments } }, client);
    });
    return Response.json({ status: "updated" });
  } catch (error) {
    if (actor) await appendAudit(actor, { category: "Segurança", action: "Alteração de acesso falhou", module: "Controle de Acesso", section: "Usuários e Perfis", entityType: "user", result: "failed", reasonCode: error instanceof AppError ? error.code : "INTERNAL_ERROR" }).catch(console.error);
    return errorResponse(error);
  }
}

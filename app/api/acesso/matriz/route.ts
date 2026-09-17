import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/csrf";
import { query, transaction } from "@/lib/db";
import { errorResponse } from "@/lib/errors";
import { assertPermission } from "@/lib/permissions";

const putSchema = z.object({
  role: z.string().regex(/^[a-z_]+$/),
  page: z.string().regex(/^[a-z]+$/),
  level: z.enum(["full", "read", "none", "default"])
});

/** Matriz de acesso: concessão padrão por perfil e as exceções registradas. */
export async function GET() {
  try {
    const actor = await requireActor();
    await assertPermission(actor, "users", "admin");
    const [pages, roles, grants, overrides] = await Promise.all([
      query("select key, label, sort_order from app.pages order by sort_order, label"),
      query("select key, label from app.roles order by label"),
      query("select role_key, page_key, level from app.page_grants"),
      query("select o.role_key, o.page_key, o.level, o.updated_at, u.full_name as updated_by_name from app.page_grant_overrides o left join app.users u on u.id = o.updated_by")
    ]);
    return Response.json(
      { pages: pages.rows, roles: roles.rows, grants: grants.rows, overrides: overrides.rows },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    return errorResponse(error);
  }
}

/** Grava ou remove a exceção de um perfil em uma página (o padrão volta com "default"). */
export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    await assertPermission(actor, "users", "admin");
    const input = putSchema.parse(await request.json());
    await transaction(async (client) => {
      const before = await client.query<{ level: string }>(
        "select level from app.page_grant_overrides where role_key = $1 and page_key = $2",
        [input.role, input.page]
      );
      if (input.level === "default") {
        await client.query("delete from app.page_grant_overrides where role_key = $1 and page_key = $2", [input.role, input.page]);
      } else {
        await client.query(
          `insert into app.page_grant_overrides (role_key, page_key, level, updated_by) values ($1,$2,$3,$4)
           on conflict (role_key, page_key) do update set level = excluded.level, updated_by = excluded.updated_by, updated_at = now()`,
          [input.role, input.page, input.level, actor.id]
        );
      }
      await appendAudit(actor, {
        category: "Segurança", action: "Alteração da matriz de acesso", module: "Controle de Acesso", section: "Matriz",
        entityType: "page_grant_override", entityId: `${input.role}:${input.page}`,
        details: `${input.role} · ${input.page} · ${input.level === "default" ? "volta ao padrão do perfil" : input.level}`,
        before: { level: before.rows[0]?.level ?? null }, after: { level: input.level === "default" ? null : input.level }
      }, client);
    });
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

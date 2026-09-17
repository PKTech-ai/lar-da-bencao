import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { dbPool, transaction } from "@/lib/db";
import { AppError, errorResponse } from "@/lib/errors";
import { assertPermission } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";
import { assertSameOrigin } from "@/lib/csrf";

const createSchema = z.object({
  email: z.email().max(200), name: z.string().trim().min(3).max(160),
  role: z.string().regex(/^[a-z_]+$/), departments: z.array(z.string().regex(/^[a-z_]+$/)).max(12).default([]),
  status: z.enum(["pending", "active"]).default("active")
});

export async function GET() {
  try {
    const actor = await requireActor(); await assertPermission(actor, "users", "admin");
    const [users, roles, departments] = await Promise.all([
      dbPool().query(`select u.id,u.auth_user_id,u.email,u.full_name,u.role_key,u.status,u.created_at,u.version,
        coalesce(array_agg(ud.department_key) filter (where ud.department_key is not null),'{}') departments
        from app.users u left join app.user_departments ud on ud.user_id=u.id group by u.id order by u.full_name`),
      dbPool().query("select key,label from app.roles order by label"),
      dbPool().query("select key,label from app.departments where active order by label")
    ]);
    // Situação no Auth (convite aceito? MFA ativo?) e último login confirmado pelo Dedo-duro.
    const listed = await createAdminClient().auth.admin.listUsers({ page: 1, perPage: 1000 }).catch(() => null);
    const authById = new Map((listed?.data?.users ?? []).map((u) => [u.id, u]));
    const logins = await dbPool().query<{ actor_user_id: string; last_login: string }>(
      "select actor_user_id, max(occurred_at) as last_login from app.audit_events where action = 'Login concluído com MFA' and result = 'success' group by actor_user_id"
    );
    const lastLogin = new Map(logins.rows.map((r) => [r.actor_user_id, r.last_login]));
    const enriched = users.rows.map((u: { id: string; auth_user_id: string }) => {
      const auth = authById.get(u.auth_user_id);
      return {
        ...u,
        auth_known: Boolean(auth),
        invite_pending: auth ? !auth.last_sign_in_at : null,
        mfa_enabled: auth ? (auth.factors ?? []).some((f) => f.status === "verified") : null,
        last_login: lastLogin.get(u.id) ?? null
      };
    });
    return Response.json({ users: enriched, roles: roles.rows, departments: departments.rows }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  let actor = null; let authId: string | undefined;
  try {
    assertSameOrigin(request);
    actor = await requireActor(); await assertPermission(actor, "users", "admin");
    const input = createSchema.parse(await request.json());
    const role = await dbPool().query("select 1 from app.roles where key=$1", [input.role]);
    if (!role.rowCount) throw new AppError("Perfil inexistente.");
    const admin = createAdminClient();
    const invited = await admin.auth.admin.inviteUserByEmail(input.email.toLowerCase(), {
      data: { full_name: input.name },
      redirectTo: `${serverEnv().APP_URL}/auth/callback?next=/definir-senha`
    });
    if (invited.error || !invited.data.user) throw invited.error ?? new Error("Convite não criado.");
    authId = invited.data.user.id;
    const id = await transaction(async (client) => {
      const inserted = await client.query<{ id: string }>(`insert into app.users (auth_user_id,email,full_name,role_key,status,created_by,updated_by) values ($1,$2,$3,$4,$5,$6,$6) returning id`, [authId, input.email.toLowerCase(), input.name, input.role, input.status, actor!.id]);
      for (const department of input.departments) await client.query("insert into app.user_departments(user_id,department_key) values($1,$2)", [inserted.rows[0].id, department]);
      await appendAudit(actor!, { category: "Inclusão", action: "Convite de usuário", module: "Controle de Acesso", section: "Usuários e Perfis", entityType: "user", entityId: inserted.rows[0].id, result: "success", details: `${input.name} · ${input.role} · ${input.status}.` }, client);
      return inserted.rows[0].id;
    });
    return Response.json({ id, status: "invited" }, { status: 201 });
  } catch (error) {
    if (authId) await createAdminClient().auth.admin.deleteUser(authId).catch(console.error);
    if (actor) await appendAudit(actor, { category: "Segurança", action: "Falha ao convidar usuário", module: "Controle de Acesso", section: "Usuários e Perfis", result: "failed", reasonCode: error instanceof AppError ? error.code : "INTERNAL_ERROR" }).catch(console.error);
    return errorResponse(error);
  }
}

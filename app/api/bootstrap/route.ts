import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { appendAudit } from "@/lib/audit";
import { transaction } from "@/lib/db";
import { serverEnv } from "@/lib/env";
import { AppError, errorResponse } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({ email: z.email().max(200), password: z.string().min(14).max(200), name: z.string().trim().min(3).max(160) });

function authorized(request: Request) {
  const expected = Buffer.from(serverEnv().BOOTSTRAP_SECRET);
  const received = Buffer.from(request.headers.get("x-bootstrap-secret") ?? "");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export async function POST(request: Request) {
  let authId: string | undefined;
  try {
    if (!authorized(request)) throw new AppError("Não autorizado.", 401, "UNAUTHORIZED");
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) { console.error("BOOTSTRAP_DEBUG", JSON.stringify(body), JSON.stringify(parsed.error.issues)); throw parsed.error; }
    const input = parsed.data;
    await transaction(async (client) => {
      await client.query("select pg_advisory_xact_lock(709217)");
      const count = await client.query<{ count: string }>("select count(*)::text as count from app.users");
      if (Number(count.rows[0].count) > 0) throw new AppError("A inicialização já foi concluída.", 409, "ALREADY_BOOTSTRAPPED");
      const admin = createAdminClient();
      const created = await admin.auth.admin.createUser({ email: input.email.toLowerCase(), password: input.password, email_confirm: true, user_metadata: { full_name: input.name } });
      if (created.error || !created.data.user) throw created.error ?? new Error("Conta não criada.");
      authId = created.data.user.id;
      const inserted = await client.query<{ id: string }>(
        `insert into app.users (auth_user_id,email,full_name,role_key,status) values ($1,$2,$3,'administrador','active') returning id`,
        [authId, input.email.toLowerCase(), input.name]
      );
      await appendAudit({ id: inserted.rows[0].id, authUserId: authId, email: input.email, name: input.name, role: "administrador", status: "active", departments: [], sessionId: null }, {
        category: "Segurança", action: "Inicialização do Administrador", module: "Controle de Acesso", section: "Bootstrap", entityType: "user", entityId: inserted.rows[0].id, result: "success", details: "Primeiro Administrador criado. O segredo de bootstrap deve ser rotacionado."
      }, client);
    });
    return Response.json({ status: "created", message: "Administrador criado. Entre no sistema e ative o MFA imediatamente." }, { status: 201 });
  } catch (error) {
    if (authId) await createAdminClient().auth.admin.deleteUser(authId).catch(console.error);
    return errorResponse(error);
  }
}

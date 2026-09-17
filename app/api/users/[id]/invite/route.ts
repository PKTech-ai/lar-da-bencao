import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/csrf";
import { query } from "@/lib/db";
import { serverEnv } from "@/lib/env";
import { AppError, errorResponse } from "@/lib/errors";
import { assertPermission } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

/** Reenvia o convite de quem ainda não definiu a senha (BL-057). */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    await assertPermission(actor, "users", "admin");
    const id = z.string().uuid().parse((await context.params).id);
    const found = await query<{ auth_user_id: string; email: string; full_name: string; status: string }>(
      "select auth_user_id, email, full_name, status from app.users where id=$1", [id]
    );
    const user = found.rows[0];
    if (!user) throw new AppError("Usuário não encontrado.", 404, "USER_NOT_FOUND");
    if (user.status === "suspended") throw new AppError("Usuário suspenso não recebe convite.", 409, "USER_SUSPENDED");
    const admin = createAdminClient();
    const auth = await admin.auth.admin.getUserById(user.auth_user_id);
    if (auth.error) throw auth.error;
    if (auth.data.user?.last_sign_in_at) throw new AppError("Este usuário já acessou o sistema. Use a recuperação de senha.", 409, "INVITE_ALREADY_ACCEPTED");
    const invited = await admin.auth.admin.inviteUserByEmail(user.email, {
      data: { full_name: user.full_name },
      redirectTo: `${serverEnv().APP_URL}/auth/callback?next=/definir-senha`
    });
    if (invited.error) throw invited.error;
    await appendAudit(actor, {
      category: "Segurança", action: "Reenvio de convite", module: "Controle de Acesso", section: "Usuários e Perfis",
      entityType: "user", entityId: id, details: user.full_name
    });
    return Response.json({ status: "invited" });
  } catch (error) {
    return errorResponse(error);
  }
}

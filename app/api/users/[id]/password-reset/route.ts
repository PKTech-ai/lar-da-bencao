import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/csrf";
import { transaction } from "@/lib/db";
import { AppError, errorResponse } from "@/lib/errors";
import { assertPermission } from "@/lib/permissions";
import { revokeAllSessions } from "@/lib/sessions";
import { createAdminClient } from "@/lib/supabase/admin";
import { initialPasswordForCpf } from "@/lib/worker-access";

/**
 * Recadastrar senha: usa o mesmo caminho do primeiro acesso. A senha volta a ser o CPF, a troca fica obrigatória
 * (`must_reset_password`) e as sessões abertas caem. Nada de senha ou link volta para a tela.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  let actor = null;
  try {
    assertSameOrigin(request);
    actor = await requireActor();
    await assertPermission(actor, "users", "admin");
    const id = z.string().uuid().parse((await context.params).id);
    if (id === actor.id) throw new AppError("Para trocar a sua própria senha, use Minha área > Alterar senha.", 409, "SELF_PASSWORD_RESET");
    const admin = actor;
    // 1) Troca obrigatória e sessões encerradas. Se o passo 2 falhar, a pessoa entra com a senha antiga e já cai
    //    na tela de criar senha nova: nada fica aberto. O provedor não pode ser chamado dentro desta transação,
    //    porque ele espera pelas mesmas linhas que ela trava.
    const target = await transaction(async (client) => {
      const found = await client.query<{ auth_user_id: string; full_name: string; status: string; cpf: string | null; worker_name: string | null }>(
        `select u.auth_user_id, u.full_name, u.status, u.cpf, w.full_name as worker_name
           from app.users u left join app.workers w on w.id = u.worker_id where u.id = $1 for update of u`,
        [id]
      );
      const row = found.rows[0];
      if (!row) throw new AppError("Usuário não encontrado.", 404, "USER_NOT_FOUND");
      if (row.status !== "active") throw new AppError("Só conta ativa pode recadastrar a senha.", 409, "USER_NOT_ACTIVE");
      if (!row.cpf) throw new AppError("Esta conta não tem CPF. Preencha o CPF antes de recadastrar a senha.", 409, "CPF_REQUIRED");
      await client.query("update app.users set must_reset_password = true, updated_by = $2, updated_at = now() where id = $1", [id, admin.id]);
      const removed = await revokeAllSessions(client, id, row.auth_user_id);
      return { authUserId: row.auth_user_id, cpf: row.cpf, label: row.worker_name ?? row.full_name, removed };
    });
    // 2) A senha volta a ser o CPF, como no primeiro acesso.
    const updated = await createAdminClient().auth.admin.updateUserById(target.authUserId, { password: initialPasswordForCpf(target.cpf) });
    if (updated.error) throw new AppError("Não foi possível recadastrar a senha agora. Tente de novo.", 502, "AUTH_UPDATE_FAILED");
    await appendAudit(admin, {
      category: "Segurança",
      action: "Senha recadastrada pela administração",
      module: "Controle de Acesso",
      section: "Usuários e Perfis",
      entityType: "user",
      entityId: id,
      details: `${target.label}: entra com o CPF e cria senha nova no próximo acesso (${target.removed} sessão(ões) encerrada(s)).`
    });
    return Response.json({ status: "reset", name: target.label }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (actor) {
      await appendAudit(actor, {
        category: "Segurança",
        action: "Falha ao recadastrar senha",
        module: "Controle de Acesso",
        section: "Usuários e Perfis",
        entityType: "user",
        result: "failed",
        reasonCode: error instanceof AppError ? error.code : "INTERNAL_ERROR"
      }).catch(console.error);
    }
    return errorResponse(error);
  }
}

import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { cpfDigits } from "@/lib/cpf";
import { assertSameOrigin } from "@/lib/csrf";
import { query } from "@/lib/db";
import { AppError, errorResponse } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  password: z.string().min(14, "Use pelo menos 14 caracteres."),
  confirmation: z.string()
});

/** Troca a senha da sessão atual. No primeiro acesso, a senha nova não pode ser o CPF. */
export async function POST(request: Request) {
  let actor = null;
  try {
    assertSameOrigin(request);
    actor = await requireActor();
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message ?? "Dados inválidos.");
    const input = parsed.data;
    if (input.password !== input.confirmation) throw new AppError("A confirmação não confere.");

    const found = await query<{ cpf: string | null; must_reset_password: boolean }>(
      "select cpf, must_reset_password from app.users where id=$1",
      [actor.id]
    );
    const current = found.rows[0];
    if (current?.cpf && cpfDigits(input.password) === current.cpf) {
      throw new AppError("A senha nova não pode ser o CPF.");
    }

    const supabase = await createClient();
    const updated = await supabase.auth.updateUser({ password: input.password });
    if (updated.error) throw new AppError(updated.error.message, 400, "AUTH_UPDATE_FAILED");
    await query("update app.users set must_reset_password = false, updated_at = now() where id = $1", [actor.id]);
    await appendAudit(actor, {
      category: "Segurança",
      action: current?.must_reset_password ? "Senha definida no primeiro acesso" : "Senha definida ou alterada",
      module: "Controle de Acesso",
      section: "Autenticação",
      entityType: "user",
      entityId: actor.id
    });
    return Response.json({ next: "/sistema" }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/csrf";
import { errorResponse } from "@/lib/errors";

const schema = z.object({ event: z.enum(["login_success", "password_changed", "logout"]) });

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = schema.parse(await request.json());
    const actor = await requireActor({ requireMfa: input.event !== "password_changed" });
    const action = input.event === "login_success"
      ? "Login concluído com MFA"
      : input.event === "logout"
        ? "Encerramento da sessão neste aparelho"
        : "Senha definida ou alterada";
    await appendAudit(actor, {
      category: "Segurança",
      action,
      module: "Controle de Acesso",
      section: "Autenticação",
      entityType: "user",
      entityId: actor.id,
      result: "success"
    });
    return Response.json({ status: "recorded" });
  } catch (error) {
    return errorResponse(error);
  }
}

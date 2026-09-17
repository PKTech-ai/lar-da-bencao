import { notFound, redirect } from "next/navigation";
import type { Actor } from "@/lib/auth";
import { requireActor } from "@/lib/auth";
import { query } from "@/lib/db";
import { AuthenticationError } from "@/lib/errors";
import { isFlagEnabled } from "@/lib/feature-flags";
import { hasAnyDepartmentPermission, hasPermission, type PermissionAction } from "@/lib/permissions";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";

export async function requirePageActor() {
  try {
    const actor = await requireActor();
    try {
      const terms = await query<{ id: string }>(
        "select id from app.terms_acceptances where user_id=$1 and terms_version=$2 limit 1",
        [actor.id, CURRENT_TERMS_VERSION]
      );
      if (!terms.rows[0]) redirect("/termos");
    } catch (error) {
      // NEXT redirect throws a special digest error — rethrow it.
      if (error && typeof error === "object" && "digest" in error) throw error;
      // Tabela de termos pode ainda não existir antes da migração de hardening.
    }
    return actor;
  } catch (error) {
    if (error instanceof AuthenticationError) {
      redirect(error.code === "MFA_REQUIRED" ? "/mfa" : error.code === "SESSION_REVOKED" ? "/auth/signout?motivo=sessao" : "/login");
    }
    throw error;
  }
}

type ModuleAccess = {
  resource?: string;
  action?: PermissionAction;
  /** Departamento fixo; `"any"` aceita qualquer departamento do ator. */
  department?: string;
};

/**
 * Página de módulo: exige flag ligada e permissão. Falha em qualquer um → 404,
 * sem revelar se o módulo existe para quem não pode vê-lo.
 */
export async function requireModulePage(flag: string, access: ModuleAccess = {}): Promise<Actor> {
  const actor = await requirePageActor();
  const { resource = "department", action = "read", department } = access;
  if (!(await isFlagEnabled(flag))) notFound();
  const allowed = department === "any"
    ? await hasAnyDepartmentPermission(actor, action)
    : await hasPermission(actor, resource, action, department);
  if (!allowed) notFound();
  return actor;
}

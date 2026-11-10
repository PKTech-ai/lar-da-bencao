import { notFound, redirect } from "next/navigation";
import type { Actor } from "@/lib/auth";
import { requireActor } from "@/lib/auth";
import { query } from "@/lib/db";
import { AuthenticationError } from "@/lib/errors";
import { isFlagEnabled } from "@/lib/feature-flags";
import { departmentModuleAccess, departmentsWithModule, hasModule, hasPermission, type PermissionAction } from "@/lib/permissions";
import type { EducationDepartment } from "@/lib/education";
import { canOpenAttendance } from "@/lib/education-data";
import { departmentsWith } from "@/lib/workers";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";

export async function requirePageActor() {
  try {
    const actor = await requireActor();
    if (actor.mustResetPassword) redirect("/definir-senha?motivo=primeiro-acesso");
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
      redirect(error.code === "SESSION_REVOKED" ? "/auth/signout?motivo=sessao"
        : error.code === "BIENNIUM_CLOSED" ? "/auth/signout?motivo=bienio"
        : "/login");
    }
    throw error;
  }
}

type ModuleAccess = {
  resource?: string;
  action?: PermissionAction;
  /** Departamento fixo; `"any"` aceita qualquer departamento do ator. */
  department?: string;
  /** Módulo de Usuários › Acesso que abre a página. */
  module?: string;
};

/**
 * Página de módulo: exige flag ligada e permissão. Falha em qualquer um → 404,
 * sem revelar se o módulo existe para quem não pode vê-lo.
 */
/**
 * Frequência da Evangelização: abre para quem vê o departamento e também para quem tem só a Chamada nele.
 * `seesDepartment` diz se as outras abas do departamento podem aparecer.
 */
export async function requireAttendancePage(flag: string, department: EducationDepartment) {
  const actor = await requirePageActor();
  if (!(await isFlagEnabled(flag))) notFound();
  if (!(await canOpenAttendance(actor, department))) notFound();
  const seesDepartment = await hasPermission(actor, "department", "read", department);
  return { actor, seesDepartment };
}

export async function requireModulePage(flag: string, access: ModuleAccess = {}): Promise<Actor> {
  const actor = await requirePageActor();
  const { resource = "department", action = "read", department, module } = access;
  if (!(await isFlagEnabled(flag))) notFound();
  let allowed: boolean;
  if (department === "any") {
    // Telas da Casa inteira: Ordens de Serviço ou as fichas de trabalhadores.
    if (module) allowed = (await departmentsWithModule(actor, module, action)).length > 0;
    else {
      const scope = await departmentsWith(actor, "read");
      allowed = scope === null || scope.length > 0;
    }
  } else if (module && department) {
    allowed = await hasModule(actor, department, module, action);
  } else {
    allowed = await hasPermission(actor, resource, action, department);
  }
  if (!allowed) notFound();
  return actor;
}

const EDUCATION_ROUTES: readonly (readonly [string, string])[] = [
  ["evangelizandos", "evangelizandos"], ["aniversariantes", "aniversariantes"], ["estudos", "estudos"],
  ["frequencia", "frequencia"], ["chamada", "frequencia"], ["cronograma", "cronograma"], ["planejamento", "planejamento"],
  ["relatorio", "relatorio"], ["os", "ordens-servico"], ["evangelizadores", "/sistema/trabalhadores"]
];

const HOME_ROUTES: Readonly<Record<string, readonly (readonly [string, string])[]>> = {
  infancia: EDUCATION_ROUTES,
  juventude: EDUCATION_ROUTES,
  doutrina: [
    ["trabalhadores", "trabalhadores"], ["palestrantes", "palestrantes"], ["estudos", "estudos"], ["escalas", "escalas"],
    ["frequencia", "frequencia"], ["culto-lar", "culto-lar"], ["os", "ordens-servico"]
  ]
};

/** Painel do departamento; sem o Painel marcado, leva ao primeiro módulo que a pessoa tem. */
export async function requireDepartmentHome(flag: string, department: string): Promise<Actor> {
  const actor = await requireModulePage(flag, { department });
  const access = await departmentModuleAccess(actor, department);
  if (access.can("painel", "read")) return actor;
  const next = HOME_ROUTES[department]?.find(([module]) => access.can(module, "read"));
  if (!next) notFound();
  redirect(next[1].startsWith("/") ? next[1] : `/sistema/${department}/${next[1]}`);
}

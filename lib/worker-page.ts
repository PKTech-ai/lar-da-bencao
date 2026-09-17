import type { Actor } from "@/lib/auth";
import { query } from "@/lib/db";
import { canDecideAdmissions, departmentsWith } from "@/lib/workers";

export type DepartmentOption = { key: string; label: string };

/** Capacidades da tela de trabalhadores calculadas no servidor. */
export async function workerPageContext(actor: Actor) {
  const departments = (await query<DepartmentOption>("select key, label from app.departments where active order by label")).rows;
  const [createScope, updateScope, canDecide] = await Promise.all([
    departmentsWith(actor, "create"),
    departmentsWith(actor, "update"),
    canDecideAdmissions(actor)
  ]);
  const originOptions = createScope === null ? departments : departments.filter((d) => createScope.includes(d.key));
  return { departments, originOptions, updateScope, canDecide };
}

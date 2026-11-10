import { ModuleTabs } from "@/components/module-tabs";
import { ATTENDANCE_MODULE, CALL_MODULE } from "@/lib/department-modules";
import type { EducationDepartment } from "@/lib/education";
import { requirePageActor } from "@/lib/page-auth";
import { departmentModuleAccess } from "@/lib/permissions";

const tabs: readonly (readonly [string, string, readonly string[]])[] = [
  ["", "Painel", ["painel"]], ["evangelizandos", "Evangelizandos", ["evangelizandos"]], ["aniversariantes", "Aniversariantes", ["aniversariantes"]],
  ["estudos", "Biblioteca de Estudos", ["estudos"]], ["frequencia", "Frequência", [CALL_MODULE, ATTENDANCE_MODULE]], ["cronograma", "Cronograma", ["cronograma"]],
  ["planejamento", "Planejamento Anual", ["planejamento"]], ["relatorio", "Relatório Anual", ["relatorio"]], ["ordens-servico", "Ordens de Serviço", ["os"]]
];

/** Só as abas dos módulos que a pessoa tem neste departamento. */
export async function EducationNav({ department, current }: { department: EducationDepartment; current: string }) {
  const access = await departmentModuleAccess(await requirePageActor(), department);
  const allowed = tabs.filter(([, , modules]) => modules.some((module) => access.can(module, "read")));
  return (
    <>
      <ModuleTabs label="Seções do departamento" current={`/sistema/${department}${current ? `/${current}` : ""}`}
        tabs={[...allowed.map(([path, label]) => ({ href: `/sistema/${department}${path ? `/${path}` : ""}`, label })),
          ...(access.can("evangelizadores", "read") ? [{ href: "/sistema/trabalhadores", label: "Evangelizadores (fichas)" }] : [])]} />
    </>
  );
}

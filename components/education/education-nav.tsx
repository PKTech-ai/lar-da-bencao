import { ModuleTabs } from "@/components/module-tabs";
import type { EducationDepartment } from "@/lib/education";

const tabs = [
  ["", "Painel"], ["evangelizandos", "Evangelizandos"], ["aniversariantes", "Aniversariantes"], ["estudos", "Biblioteca de Estudos"],
  ["frequencia", "Frequência"], ["cronograma", "Cronograma"], ["planejamento", "Planejamento Anual"], ["relatorio", "Relatório Anual"],
  ["ordens-servico", "Ordens de Serviço"]
] as const;

export function EducationNav({ department, current }: { department: EducationDepartment; current: string }) {
  return (
    <>
      <ModuleTabs label="Seções do departamento" current={`/sistema/${department}${current ? `/${current}` : ""}`}
        tabs={[...tabs.map(([path, label]) => ({ href: `/sistema/${department}${path ? `/${path}` : ""}`, label })),
          { href: "/sistema/trabalhadores", label: "Evangelizadores (fichas)" }]} />
    </>
  );
}

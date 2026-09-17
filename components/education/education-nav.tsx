import Link from "next/link";
import type { EducationDepartment } from "@/lib/education";

const tabs = [
  ["", "Painel"], ["evangelizandos", "Evangelizandos"], ["aniversariantes", "Aniversariantes"], ["estudos", "Biblioteca de Estudos"],
  ["frequencia", "Frequência"], ["cronograma", "Cronograma"], ["planejamento", "Planejamento Anual"], ["relatorio", "Relatório Anual"]
] as const;

export function EducationNav({ department, current }: { department: EducationDepartment; current: string }) {
  return (
    <nav className="row-actions no-print" aria-label="Seções do departamento" style={{ marginBottom: 16 }}>
      {tabs.map(([path, label]) => (
        <Link key={path} className={`button${current === path ? " primary" : ""}`} href={`/sistema/${department}${path ? `/${path}` : ""}`}>{label}</Link>
      ))}
      <Link className="button" href="/sistema/trabalhadores">Evangelizadores (fichas)</Link>
    </nav>
  );
}

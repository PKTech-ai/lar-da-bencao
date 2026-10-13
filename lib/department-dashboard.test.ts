import { describe, expect, it } from "vitest";
import { buildDepartmentDashboard, workerDepartmentKey } from "@/lib/department-dashboard";
import { findModulePage } from "@/lib/module-pages";

describe("painel do departamento", () => {
  it("usa a chave do departamento quando o módulo tem uma", () => {
    expect(workerDepartmentKey(findModulePage("assistencia")!)).toBe("assistencia_social");
    expect(workerDepartmentKey(findModulePage("patrimonio")!)).toBe("patrimonio");
  });
  it("usa a chave certa para módulos sem departamento", () => {
    expect(workerDepartmentKey(findModulePage("tesouraria")!)).toBe("tesouraria");
    expect(workerDepartmentKey(findModulePage("secretaria")!)).toBe("secretaria");
    expect(workerDepartmentKey(findModulePage("conselhofiscal")!)).toBe("conselho_fiscal");
    expect(workerDepartmentKey(findModulePage("presidencia")!)).toBe("diretoria");
  });
  it("monta três indicadores e diz quando não há alerta", () => {
    const d = buildDepartmentDashboard({ active: 7, pending: 2, birthdays: 1, alerts: [] });
    expect(d.kpis).toEqual([
      { label: "Trabalhadores ativos", value: "7" },
      { label: "Fichas aguardando a Diretoria", value: "2" },
      { label: "Aniversariantes do mês", value: "1" }
    ]);
    expect(d.alerts).toEqual([]);
  });
});

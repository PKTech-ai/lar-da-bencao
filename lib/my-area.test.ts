import { describe, expect, it } from "vitest";
import { birthdaysOfMonth, contributionStatus, upcoming } from "@/lib/my-area";

describe("Minha área", () => {
  it("mostra só as próximas escalas, em ordem, até 10", () => {
    const scales = Array.from({ length: 14 }, (_, i) => ({ date: `2026-11-${String(i + 1).padStart(2, "0")}`, activity: "Passe", role: "Passista" }));
    const list = upcoming([{ date: "2026-10-01", activity: "x", role: "y" }, ...scales.reverse()], "2026-10-14");
    expect(list).toHaveLength(10);
    expect(list[0].date).toBe("2026-11-01");
  });

  it("classifica a contribuição como no visual v215", () => {
    expect(contributionStatus(null, 0)).toBe("Valor previsto não informado");
    expect(contributionStatus(0, 5000)).toBe("Recebido");
    expect(contributionStatus(0, 0)).toBe("Sem valor previsto");
    expect(contributionStatus(5000, 5000)).toBe("Pago");
    expect(contributionStatus(5000, 2000)).toBe("Parcial");
    expect(contributionStatus(5000, 0)).toBe("Pendente");
  });

  it("lista os aniversariantes do mês sem o ano de nascimento", () => {
    const people = [
      { name: "Bia", birth_date: "1980-11-25", departments: [] },
      { name: "Ana", birth_date: "1990-11-03", departments: ["Doutrina"] },
      { name: "Caio", birth_date: "1975-12-03", departments: [] },
      { name: "Sem data", birth_date: "", departments: [] }
    ];
    const list = birthdaysOfMonth(people, "2026-11-25");
    expect(list).toEqual([
      { name: "Ana", day: 3, today: false, departments: ["Doutrina"] },
      { name: "Bia", day: 25, today: true, departments: [] }
    ]);
    expect(JSON.stringify(list)).not.toContain("1980");
  });
});

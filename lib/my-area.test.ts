import { describe, expect, it } from "vitest";
import { contributionStatus, upcoming } from "@/lib/my-area";

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
});

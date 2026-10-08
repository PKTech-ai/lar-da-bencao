import { describe, expect, it } from "vitest";
import { addDays, buildHomeStats, filterAgenda, sessionInitials, sessionShowsRole } from "@/lib/home-dashboard";

describe("painel da visão geral", () => {
  it("soma os quatro indicadores com a agenda de hoje e os eventos", () => {
    const stats = buildHomeStats({
      today: "2026-10-08",
      moduleCount: 4,
      agenda: [
        { date: "2026-10-08", label: "Limpeza", module: "Patrimônio", href: "/sistema/patrimonio/limpeza" },
        { date: "2026-10-11", label: "Café", module: "Eventos", href: "/sistema/eventos" }
      ],
      pending: [{ key: "admissoes", label: "Fichas", count: 2, href: "/sistema/admissoes" }]
    });
    expect(stats.map((item) => [item.key, item.value])).toEqual([
      ["agenda", "1"],
      ["pending", "2"],
      ["events", "1"],
      ["modules", "4"]
    ]);
    expect(stats[1].pending).toBe(true);
  });

  it("filtra a agenda pelo período e fica nos seis primeiros", () => {
    const items = Array.from({ length: 8 }, (_, index) => ({
      date: addDays("2026-10-08", index),
      label: `Item ${index}`,
      module: "Eventos",
      href: "/sistema/eventos"
    }));
    expect(filterAgenda(items, "2026-10-08", 0)).toHaveLength(1);
    expect(filterAgenda(items, "2026-10-08", 7).map((item) => item.date)).toEqual([
      "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11", "2026-10-12", "2026-10-13"
    ]);
    expect(filterAgenda(items, "2026-10-08", 30)).toHaveLength(6);
  });

  it("monta as iniciais pulando da, de e do", () => {
    expect(sessionInitials("Administrador do Sistema")).toBe("AS");
    expect(sessionInitials("Ana")).toBe("A");
  });

  it("esconde o perfil quando o nome já é o rótulo do perfil", () => {
    expect(sessionShowsRole("Administrador do Sistema", "Administrador do Sistema")).toBe(false);
    expect(sessionShowsRole("Ana Souza", "Administrador do Sistema")).toBe(true);
  });
});

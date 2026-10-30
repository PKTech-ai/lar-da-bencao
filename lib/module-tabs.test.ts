import { describe, expect, it } from "vitest";
import { activeTab, bottomTabs, shortTabLabel } from "@/lib/module-tabs";

const tabs = [
  { href: "/sistema/doutrina", label: "Painel" },
  { href: "/sistema/doutrina/escalas", label: "Escala Mensal" },
  { href: "/sistema/doutrina/frequencia", label: "Frequência" }
];

describe("aba ativa", () => {
  it("marca o Painel só na raiz exata", () => {
    expect(activeTab("/sistema/doutrina", tabs)?.label).toBe("Painel");
    expect(activeTab("/sistema/doutrina/", tabs)?.label).toBe("Painel");
  });
  it("marca a aba pelo prefixo, inclusive em subpáginas", () => {
    expect(activeTab("/sistema/doutrina/escalas/imprimir", tabs)?.label).toBe("Escala Mensal");
  });
  it("não marca nada fora do módulo", () => {
    expect(activeTab("/sistema/infancia", tabs)).toBeUndefined();
  });
});

describe("barra de baixo do celular", () => {
  const many = ["Painel", "Rancho dos Evangelizandos", "Voluntários", "Mantenedores", "Clube de Mães — Livro Caixa", "Famílias"]
    .map((label, i) => ({ href: `/sistema/assistencia/${i}`, label }));
  it("até 4 abas, todas à mostra", () => {
    expect(bottomTabs(tabs, tabs[0].href)).toEqual({ visible: tabs, more: [] });
  });
  it("com mais abas, 3 à mostra e sempre a atual", () => {
    const first = bottomTabs(many, many[0].href);
    expect(first.visible.map((t) => t.label)).toEqual(["Painel", "Rancho dos Evangelizandos", "Voluntários"]);
    expect(first.more).toHaveLength(3);
    const last = bottomTabs(many, many[5].href);
    expect(last.visible.map((t) => t.label)).toEqual(["Painel", "Rancho dos Evangelizandos", "Famílias"]);
    expect(last.more.map((t) => t.label)).toEqual(["Voluntários", "Mantenedores", "Clube de Mães — Livro Caixa"]);
  });
  it("rótulos curtos", () => {
    expect(shortTabLabel("Rancho dos Evangelizandos")).toBe("Rancho");
    expect(shortTabLabel("Clube de Mães — Livro Caixa")).toBe("Clube de Mães");
    expect(shortTabLabel("Painel")).toBe("Painel");
  });
});
